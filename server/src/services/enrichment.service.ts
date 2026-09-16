import { prisma } from "../../../lib/prisma.js";
import { UnipileService } from "./unipile.service.js";
import { getQuotaSnapshot, quotaPeriods } from "./quota.service.js";
import { ENRICHMENT_BATCH_MAX, ENRICHMENT_COST, getPlan } from "../config/plans.js";

/**
 * Tokens d'enrichissement (e-mail / téléphone), façon « Email Finder ».
 *
 * 1 token = 1 e-mail trouvé, 5 tokens = 1 téléphone trouvé. Les tokens sont
 * réservés avant l'appel Unipile (le solde ne devient jamais négatif, même en
 * parallèle), puis seuls ceux des coordonnées effectivement trouvées sont
 * débités — le reste est restitué. Solde mensuel partagé par l'organisation :
 * dotation du plan + dotations manuelles − débits − réservations en cours.
 *
 * Chaque lookup est une lecture de profil LinkedIn : il compte dans le quota
 * de visites (quota.service.ts) et respecte la cible du jour.
 */

const DEFAULT_TZ = "Africa/Abidjan";

export class EnrichmentError extends Error {
  constructor(
    message: string,
    public readonly code: "NO_ORGANIZATION" | "NO_LINKEDIN_ACCOUNT" | "VISITS_QUOTA" | "NO_TOKENS" | "NOTHING_TO_ENRICH"
  ) {
    super(message);
  }
}

export interface EnrichmentBalance {
  plan: string;
  allowance: number;
  granted: number;
  debited: number;
  pending: number;
  refunded: number;
  remaining: number;
  lookups: number;
  periodStart: string;
  periodEnd: string;
}

type Db = Pick<typeof prisma, "organization" | "enrichmentLedger">;

export async function getBalance(
  organizationId: string,
  tz: string = DEFAULT_TZ,
  db: Db = prisma
): Promise<EnrichmentBalance> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { plan: true } });
  const plan = getPlan(org?.plan);
  const periods = quotaPeriods(new Date(), tz);

  const rows = await db.enrichmentLedger.findMany({
    where: { organizationId, createdAt: { gte: periods.monthStart } },
    select: { kind: true, status: true, emailCost: true, phoneCost: true, emailFound: true, phoneFound: true, grantedTokens: true },
  });

  let granted = 0;
  let debited = 0;
  let pending = 0;
  let refunded = 0;
  let lookups = 0;
  for (const r of rows) {
    if (r.kind === "GRANT") {
      granted += r.grantedTokens;
      continue;
    }
    lookups++;
    if (r.status === "PENDING") {
      pending += r.emailCost + r.phoneCost;
    } else if (r.status === "DONE") {
      debited += (r.emailFound ? r.emailCost : 0) + (r.phoneFound ? r.phoneCost : 0);
      refunded += (r.emailFound ? 0 : r.emailCost) + (r.phoneFound ? 0 : r.phoneCost);
    } else {
      refunded += r.emailCost + r.phoneCost;
    }
  }

  const allowance = plan.enrichmentTokens;
  return {
    plan: plan.name,
    allowance,
    granted,
    debited,
    pending,
    refunded,
    remaining: Math.max(0, allowance + granted - debited - pending),
    lookups,
    periodStart: periods.monthStart.toISOString(),
    periodEnd: periods.nextMonth.toISOString(),
  };
}

export type EnrichmentSkipReason = "ALREADY_COMPLETE" | "INSUFFICIENT_TOKENS" | "VISITS_QUOTA" | "BATCH_LIMIT" | "NO_IDENTIFIER";

export interface EnrichmentProspectResult {
  prospectId: string;
  status: "ENRICHED" | "NOT_FOUND" | "PARTIAL" | "SKIPPED" | "FAILED";
  email: string | null;
  phone: string | null;
  reserved: number;
  charged: number;
  refunded: number;
  reason?: EnrichmentSkipReason;
}

export interface EnrichmentRunResult {
  results: EnrichmentProspectResult[];
  balance: EnrichmentBalance;
}

/** Coût d'un prospect : uniquement ce qui lui manque. */
export function costFor(p: { email: string | null; phone: string | null }) {
  const emailCost = p.email ? 0 : ENRICHMENT_COST.email;
  const phoneCost = p.phone ? 0 : ENRICHMENT_COST.phone;
  return { emailCost, phoneCost, total: emailCost + phoneCost };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function enrichProspects(params: {
  userId: string;
  organizationId: string | null | undefined;
  prospectIds: string[];
}): Promise<EnrichmentRunResult> {
  const { userId, organizationId, prospectIds } = params;
  if (!organizationId) {
    throw new EnrichmentError("Votre compte n'est rattaché à aucune organisation.", "NO_ORGANIZATION");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: { select: { plan: true } },
      accounts: { where: { status: "CONNECTED" }, orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });
  const account = user?.accounts[0];
  if (!user || !account?.unipileAccountId) {
    throw new EnrichmentError(
      "Connectez votre compte LinkedIn pour enrichir vos prospects.",
      "NO_LINKEDIN_ACCOUNT"
    );
  }

  const prospects = await prisma.prospect.findMany({
    where: { id: { in: prospectIds }, OR: [{ list: { userId } }, { userId }] },
    select: { id: true, email: true, phone: true, providerProfileId: true, linkedinUrl: true, avatarUrl: true, headline: true, company: true },
  });

  const results: EnrichmentProspectResult[] = [];
  const skip = (prospectId: string, reason: EnrichmentSkipReason) =>
    results.push({ prospectId, status: "SKIPPED", email: null, phone: null, reserved: 0, charged: 0, refunded: 0, reason });

  // Prospects à traiter, dans l'ordre demandé
  const candidates: typeof prospects = [];
  for (const id of prospectIds) {
    const p = prospects.find((x) => x.id === id);
    if (!p) continue;
    if (costFor(p).total === 0) {
      skip(p.id, "ALREADY_COMPLETE");
      continue;
    }
    if (!p.providerProfileId && !p.linkedinUrl) {
      skip(p.id, "NO_IDENTIFIER");
      continue;
    }
    candidates.push(p);
  }
  if (candidates.length === 0) {
    return { results, balance: await getBalance(organizationId, user.timezone) };
  }

  // Protection du compte : la cible visites du jour borne le lot
  const snapshot = await getQuotaSnapshot({ user, account, planRaw: user.organization?.plan });
  const visits = snapshot.actions.visits;
  if (visits.blocked) {
    throw new EnrichmentError(
      visits.blocked.reason === "DAY"
        ? "Quota de visites de profil du jour atteint. Réessayez demain."
        : "Quota de visites de profil de la période atteint. L'enrichissement reprendra à la prochaine période.",
      "VISITS_QUOTA"
    );
  }
  const visitsLeft = Math.max(0, visits.target - visits.usedToday);
  const batchLimit = Math.min(ENRICHMENT_BATCH_MAX, visitsLeft);

  // Réservation atomique des tokens
  const reserved = await prisma.$transaction(async (tx) => {
    // Sérialise les réservations d'une même organisation (deux requêtes parallèles ne peuvent pas dépenser le même token)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
    const balance = await getBalance(organizationId, user.timezone, tx);
    let remaining = balance.remaining;
    const rows: { prospect: (typeof candidates)[number]; ledgerId: string; emailCost: number; phoneCost: number }[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const p = candidates[i];
      if (rows.length >= batchLimit) {
        skip(p.id, rows.length >= ENRICHMENT_BATCH_MAX ? "BATCH_LIMIT" : "VISITS_QUOTA");
        continue;
      }
      const { emailCost, phoneCost, total } = costFor(p);
      if (total > remaining) {
        skip(p.id, "INSUFFICIENT_TOKENS");
        continue;
      }
      remaining -= total;
      const ledger = await tx.enrichmentLedger.create({
        data: {
          organizationId,
          userId,
          prospectId: p.id,
          accountId: account.id,
          kind: "LOOKUP",
          status: "PENDING",
          emailCost,
          phoneCost,
        },
        select: { id: true },
      });
      rows.push({ prospect: p, ledgerId: ledger.id, emailCost, phoneCost });
    }
    return rows;
  });

  if (reserved.length === 0) {
    const anyTokenSkip = results.some((r) => r.reason === "INSUFFICIENT_TOKENS");
    if (anyTokenSkip) {
      throw new EnrichmentError("Plus assez de tokens ce mois-ci.", "NO_TOKENS");
    }
    return { results, balance: await getBalance(organizationId, user.timezone) };
  }

  // Lookups séquentiels, espacés aléatoirement (1,5 → 4 s) comme une navigation humaine
  for (let i = 0; i < reserved.length; i++) {
    const { prospect, ledgerId, emailCost, phoneCost } = reserved[i];
    if (i > 0) await sleep(1500 + Math.random() * 2500);

    try {
      const identifier = prospect.providerProfileId || prospect.linkedinUrl;
      const lookup = await UnipileService.getProfileDetailsAndStatus(identifier, account.unipileAccountId);
      if (!lookup.success) {
        await prisma.enrichmentLedger.update({ where: { id: ledgerId }, data: { status: "FAILED", note: "Profil injoignable" } });
        results.push({ prospectId: prospect.id, status: "FAILED", email: null, phone: null, reserved: emailCost + phoneCost, charged: 0, refunded: emailCost + phoneCost });
        continue;
      }

      const profile = lookup.profile;
      const foundEmail = emailCost > 0 && profile?.email ? profile.email : null;
      const foundPhone = phoneCost > 0 && profile?.phone ? profile.phone : null;

      const update: Record<string, unknown> = { connectionStatus: lookup.connectionStatus };
      if (foundEmail) update.email = foundEmail;
      if (foundPhone) update.phone = foundPhone;
      if (profile?.providerProfileId?.startsWith("ACo") && !prospect.providerProfileId) update.providerProfileId = profile.providerProfileId;
      if (profile?.avatarUrl && (!prospect.avatarUrl || prospect.avatarUrl.includes("ui-avatars.com"))) update.avatarUrl = profile.avatarUrl;
      if (profile?.headline && (!prospect.headline || prospect.headline === "Professionnel")) update.headline = profile.headline;
      if (profile?.company && (!prospect.company || prospect.company === "—")) update.company = profile.company;

      await prisma.$transaction([
        prisma.prospect.update({ where: { id: prospect.id }, data: update }),
        prisma.enrichmentLedger.update({
          where: { id: ledgerId },
          data: { status: "DONE", emailFound: Boolean(foundEmail), phoneFound: Boolean(foundPhone) },
        }),
      ]);

      const charged = (foundEmail ? emailCost : 0) + (foundPhone ? phoneCost : 0);
      const wanted = (emailCost > 0 ? 1 : 0) + (phoneCost > 0 ? 1 : 0);
      const got = (foundEmail ? 1 : 0) + (foundPhone ? 1 : 0);
      results.push({
        prospectId: prospect.id,
        status: got === 0 ? "NOT_FOUND" : got === wanted ? "ENRICHED" : "PARTIAL",
        email: foundEmail ?? prospect.email,
        phone: foundPhone ?? prospect.phone,
        reserved: emailCost + phoneCost,
        charged,
        refunded: emailCost + phoneCost - charged,
      });
    } catch (err: any) {
      console.error(`[Enrichment] Échec du lookup pour le prospect ${prospect.id}:`, err?.message);
      await prisma.enrichmentLedger.update({ where: { id: ledgerId }, data: { status: "FAILED", note: err?.message?.slice(0, 200) } });
      results.push({ prospectId: prospect.id, status: "FAILED", email: null, phone: null, reserved: emailCost + phoneCost, charged: 0, refunded: emailCost + phoneCost });
    }
  }

  // Remettre les résultats dans l'ordre demandé
  results.sort((a, b) => prospectIds.indexOf(a.prospectId) - prospectIds.indexOf(b.prospectId));
  return { results, balance: await getBalance(organizationId, user.timezone) };
}

export async function grantTokens(params: { organizationId: string; tokens: number; note?: string; byUserId: string }) {
  return prisma.enrichmentLedger.create({
    data: {
      organizationId: params.organizationId,
      userId: params.byUserId,
      kind: "GRANT",
      status: "DONE",
      grantedTokens: params.tokens,
      note: params.note ?? null,
    },
  });
}

export async function getHistory(organizationId: string, tz: string = DEFAULT_TZ, limit = 100) {
  const periods = quotaPeriods(new Date(), tz);
  const rows = await prisma.enrichmentLedger.findMany({
    where: { organizationId, createdAt: { gte: periods.monthStart } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const prospectIds = rows.map((r) => r.prospectId).filter((x): x is string => Boolean(x));
  const userIds = [...new Set(rows.map((r) => r.userId).filter((x): x is string => Boolean(x)))];
  const [prospects, users] = await Promise.all([
    prospectIds.length
      ? prisma.prospect.findMany({ where: { id: { in: prospectIds } }, select: { id: true, firstName: true, lastName: true, company: true } })
      : [],
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [],
  ]);
  const prospectById = new Map(prospects.map((p) => [p.id, p]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => {
    const charged = r.status === "DONE" ? (r.emailFound ? r.emailCost : 0) + (r.phoneFound ? r.phoneCost : 0) : 0;
    const p = r.prospectId ? prospectById.get(r.prospectId) : undefined;
    const u = r.userId ? userById.get(r.userId) : undefined;
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      prospect: p ? { id: p.id, name: `${p.firstName} ${p.lastName}`.trim(), company: p.company } : null,
      user: u ? { id: u.id, name: u.name || u.email } : null,
      reserved: r.emailCost + r.phoneCost,
      charged,
      refunded: r.kind === "LOOKUP" && r.status !== "PENDING" ? r.emailCost + r.phoneCost - charged : 0,
      emailFound: r.emailFound,
      phoneFound: r.phoneFound,
      granted: r.grantedTokens,
      note: r.note,
    };
  });
}
