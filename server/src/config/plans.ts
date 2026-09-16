/**
 * Grille tarifaire et quotas d'actions LinkedIn par offre.
 * Miroir de client/src/marketing/content/plans.ts — garder les deux synchronisés.
 *
 * Les quotas d'actions sont exprimés par semaine (lundi → dimanche) et par mois
 * civil, par compte LinkedIn. Le journalier n'est jamais une donnée du plan :
 * il est dérivé aléatoirement chaque jour par quota.service.ts pour ne pas
 * produire de motif régulier détectable par LinkedIn.
 *
 * Références Unipile (https://developer.unipile.com/docs/provider-limits-and-restrictions) :
 * invitations 80–100/j max et ~200/semaine (plafond LinkedIn), messages 100–150/j,
 * profils ~100/j (150 Sales Navigator/Recruiter), autres actions ~100/j.
 */

export type PlanId = "STARTER" | "PRO" | "BUSINESS";

export type ActionKind = "invites" | "messages" | "visits" | "follows";

export const ACTION_KINDS: ActionKind[] = ["invites", "messages", "visits", "follows"];

export interface QuotaWindow {
  week: number;
  month: number;
}

export type PlanActionLimits = Record<ActionKind, QuotaWindow>;

export interface BillingPlan {
  name: string;
  monthly: number;
  /** Prix mensuel équivalent en engagement annuel (−20 %, arrondi). */
  annual: number;
  maxProspects: number;
  maxTeamSeats: number;
  /** -1 = illimitées */
  maxCampaigns: number;
  /** Tokens d'enrichissement (e-mail / téléphone) par mois civil, partagés par l'organisation. */
  enrichmentTokens: number;
  actions: PlanActionLimits;
  /** Visites pour un compte LinkedIn STANDARD (sans Sales Navigator/Recruiter), si différent. */
  visitsStandard?: QuotaWindow;
}

export const BILLING_PLANS: Record<PlanId, BillingPlan> = {
  STARTER: {
    name: "Starter",
    monthly: 22,
    annual: 18,
    maxProspects: 1_000,
    maxTeamSeats: 1,
    maxCampaigns: -1,
    enrichmentTokens: 20,
    actions: {
      invites: { week: 100, month: 400 },
      messages: { week: 250, month: 1_000 },
      visits: { week: 250, month: 1_000 },
      follows: { week: 150, month: 600 },
    },
  },
  PRO: {
    name: "Pro",
    monthly: 40,
    annual: 32,
    maxProspects: 10_000,
    maxTeamSeats: 5,
    maxCampaigns: -1,
    enrichmentTokens: 50,
    actions: {
      invites: { week: 150, month: 600 },
      messages: { week: 400, month: 1_600 },
      visits: { week: 400, month: 1_600 },
      follows: { week: 300, month: 1_200 },
    },
  },
  BUSINESS: {
    name: "Business",
    monthly: 70,
    annual: 56,
    maxProspects: 50_000,
    maxTeamSeats: 10,
    maxCampaigns: -1,
    enrichmentTokens: 100,
    actions: {
      invites: { week: 200, month: 800 },
      messages: { week: 600, month: 2_400 },
      visits: { week: 600, month: 2_400 },
      follows: { week: 400, month: 1_600 },
    },
    visitsStandard: { week: 400, month: 1_600 },
  },
};

/**
 * Plafonds de sécurité journaliers (maxima Unipile). Jamais dépassés, quel que
 * soit le plan ou le rattrapage hebdomadaire. Invisibles dans les offres.
 */
export const DAILY_SAFETY_CAPS: Record<ActionKind, number> = {
  invites: 90,
  messages: 150,
  visits: 100,
  follows: 100,
};

/** Coût en tokens d'une coordonnée trouvée (restitué si introuvable). */
export const ENRICHMENT_COST = { email: 1, phone: 5 } as const;

/** Nombre maximal de prospects enrichis par requête. */
export const ENRICHMENT_BATCH_MAX = 50;

/** Visites journalières autorisées pour Sales Navigator / Recruiter. */
export const DAILY_VISITS_CAP_SALES_NAV = 150;

/** Durée de la montée en charge d'un compte LinkedIn fraîchement connecté. */
export const WARMUP_DAYS = 14;

/** Types de compte LinkedIn bénéficiant des quotas de visites élargis. */
export const EXTENDED_VISITS_ACCOUNT_TYPES = ["SALES_NAVIGATOR", "RECRUITER"];

/** Les organisations créées avant la refonte portent `ENTERPRISE` : alias de `BUSINESS`. */
export function normalizePlanId(raw: string | null | undefined): PlanId {
  if (raw === "STARTER" || raw === "PRO") return raw;
  return "BUSINESS";
}

export function getPlan(raw: string | null | undefined): BillingPlan {
  return BILLING_PLANS[normalizePlanId(raw)];
}

export function hasExtendedVisits(accountType: string | null | undefined): boolean {
  return EXTENDED_VISITS_ACCOUNT_TYPES.includes(accountType || "");
}

/** Quotas hebdo/mensuels du plan, avec la règle « compte standard » sur les visites. */
export function getPlanActionLimits(
  planRaw: string | null | undefined,
  accountType: string | null | undefined
): PlanActionLimits {
  const plan = getPlan(planRaw);
  const visits =
    plan.visitsStandard && !hasExtendedVisits(accountType) ? plan.visitsStandard : plan.actions.visits;
  return { ...plan.actions, visits };
}

export function dailySafetyCap(kind: ActionKind, accountType: string | null | undefined): number {
  if (kind === "visits" && hasExtendedVisits(accountType)) return DAILY_VISITS_CAP_SALES_NAV;
  return DAILY_SAFETY_CAPS[kind];
}
