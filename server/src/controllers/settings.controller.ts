import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { prisma } from "../../../lib/prisma.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { UnipileService } from "../services/unipile.service.js";
import { resolveOrganization } from "../utils/organization.js";
import { getWorkspaceAvatar, setWorkspaceAvatar, WORKSPACE_PROVIDER } from "../services/workspace.service.js";
import { REPORTS_PROVIDER } from "../services/reportSettings.service.js";
import {
  connectOrReconnect,
  finalizeConnection,
  persistLinkedInAccount,
  pendingCheckpointFor,
  resumePausedCampaigns,
  isWithinCreationGrace,
} from "../services/linkedinConnection.service.js";
import { BILLING_PLANS, normalizePlanId, getPlanActionLimits, ACTION_KINDS, type ActionKind } from "../config/plans.js";
import { getQuotaSnapshot, effectiveWindow, type QuotaSnapshot } from "../services/quota.service.js";
import { getBalance as getEnrichmentBalance } from "../services/enrichment.service.js";

const INTERNAL_PROVIDERS = [REPORTS_PROVIDER, WORKSPACE_PROVIDER];

// ==========================================
// 0. ESPACE DE TRAVAIL (photo de profil de l'organisation)
// ==========================================

const UpdateWorkspaceSchema = z.object({
  // Data URL PNG/JPEG/WebP (image redimensionnée côté client) ; null pour supprimer
  avatarUrl: z
    .string()
    .max(400 * 1024, "Image trop volumineuse (max ~300 Ko).")
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Format d'image invalide (PNG, JPEG ou WebP).")
    .nullable(),
});

export async function getWorkspaceSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const { organizationId, isAdmin } = await resolveOrganization(req);
    if (!organizationId) {
      res.json({ success: true, workspace: null });
      return;
    }
    const [org, avatarUrl] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, slug: true } }),
      getWorkspaceAvatar(organizationId),
    ]);
    if (!org) {
      res.json({ success: true, workspace: null });
      return;
    }
    res.json({ success: true, workspace: { ...org, avatarUrl, canEdit: isAdmin } });
  } catch (err: any) {
    console.error("[settings.controller:getWorkspaceSettings]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function updateWorkspaceSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = UpdateWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "Données invalides." });
      return;
    }
    const { organizationId, isAdmin } = await resolveOrganization(req);
    if (!organizationId) {
      res.status(400).json({ success: false, error: "Aucun espace de travail associé à ce compte." });
      return;
    }
    if (!isAdmin) {
      res.status(403).json({ success: false, error: "Seul un propriétaire ou administrateur peut modifier la photo de l'espace." });
      return;
    }
    await setWorkspaceAvatar(organizationId, parsed.data.avatarUrl);
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, slug: true } });
    res.json({ success: true, workspace: { ...org, avatarUrl: parsed.data.avatarUrl, canEdit: true } });
  } catch (err: any) {
    console.error("[settings.controller:updateWorkspaceSettings]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

// ==========================================
// 1. COMPTE BIME LINK
// ==========================================

const UpdateAccountSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Format d'email invalide").optional(),
  avatarUrl: z.string().optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères").optional(),
  // Plafonds personnels hebdomadaires ; null = quota de l'offre. Bornés par le plan dans le handler.
  maxWeeklyInvites: z.number().int().min(0).nullable().optional(),
  maxWeeklyMessages: z.number().int().min(0).nullable().optional(),
  maxWeeklyVisits: z.number().int().min(0).nullable().optional(),
  maxWeeklyFollows: z.number().int().min(0).nullable().optional(),
  workingDays: z.array(z.string()).optional(),
  workingHoursStart: z.string().optional(),
  workingHoursEnd: z.string().optional(),
  timezone: z.string().optional(),
});

const WEEKLY_FIELD_BY_KIND: Record<ActionKind, "maxWeeklyInvites" | "maxWeeklyMessages" | "maxWeeklyVisits" | "maxWeeklyFollows"> = {
  invites: "maxWeeklyInvites",
  messages: "maxWeeklyMessages",
  visits: "maxWeeklyVisits",
  follows: "maxWeeklyFollows",
};

const ACTION_LABELS: Record<ActionKind, string> = {
  invites: "invitations",
  messages: "messages",
  visits: "visites de profil",
  follows: "suivis de profil",
};

type QuotaUser = {
  maxWeeklyInvites: number | null;
  maxWeeklyMessages: number | null;
  maxWeeklyVisits: number | null;
  maxWeeklyFollows: number | null;
  workingDays: string[];
  timezone: string;
};

/**
 * État des quotas d'actions LinkedIn exposé aux écrans Réglages / Facturation :
 * quotas de l'offre, réglage personnel, quotas effectifs, cible du jour et usage.
 * Sans compte LinkedIn connecté, l'usage est à zéro.
 */
export async function buildQuotasPayload(
  user: QuotaUser,
  account: { id: string; accountType: string | null; createdAt: Date } | null,
  planRaw: string | null | undefined
) {
  const planId = normalizePlanId(planRaw);
  const planLimits = getPlanActionLimits(planRaw, account?.accountType);

  let snapshot: QuotaSnapshot | null = null;
  if (account) {
    snapshot = await getQuotaSnapshot({ user, account, planRaw });
  }

  const actions = {} as Record<
    ActionKind,
    {
      planWeek: number;
      planMonth: number;
      userWeek: number | null;
      limitWeek: number;
      limitMonth: number;
      target: number | null;
      usedToday: number;
      usedWeek: number;
      usedMonth: number;
    }
  >;

  for (const kind of ACTION_KINDS) {
    const userWeek = user[WEEKLY_FIELD_BY_KIND[kind]];
    const eff = effectiveWindow(planLimits[kind], userWeek);
    const s = snapshot?.actions[kind];
    actions[kind] = {
      planWeek: planLimits[kind].week,
      planMonth: planLimits[kind].month,
      userWeek: userWeek !== null && userWeek < planLimits[kind].week ? userWeek : null,
      limitWeek: eff.week,
      limitMonth: eff.month,
      target: s?.target ?? null,
      usedToday: s?.usedToday ?? 0,
      usedWeek: s?.usedWeek ?? 0,
      usedMonth: s?.usedMonth ?? 0,
    };
  }

  return {
    plan: planId,
    planName: BILLING_PLANS[planId].name,
    accountType: account?.accountType ?? null,
    actions,
    warmup: snapshot?.warmup ?? null,
  };
}

export async function getAccountSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        accounts: {
          select: {
            id: true,
            accountName: true,
            status: true,
            profilePicture: true,
            headline: true,
            dailyInvitesSent: true,
            dailyMsgSent: true,
            accountType: true,
            createdAt: true,
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "Utilisateur non trouvé." });
      return;
    }

    const connectedAccount = user.accounts.find((a) => a.status === "CONNECTED") ?? null;
    const quotas = await buildQuotasPayload(user, connectedAccount, user.organization?.plan);

    res.json({
      success: true,
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        orgRole: user.orgRole,
        maxWeeklyInvites: user.maxWeeklyInvites,
        maxWeeklyMessages: user.maxWeeklyMessages,
        maxWeeklyVisits: user.maxWeeklyVisits,
        maxWeeklyFollows: user.maxWeeklyFollows,
        workingDays: user.workingDays,
        workingHoursStart: user.workingHoursStart,
        workingHoursEnd: user.workingHoursEnd,
        timezone: user.timezone,
        organization: user.organization,
        hasLinkedInAccount: connectedAccount !== null,
        quotas,
      },
    });
  } catch (err: any) {
    console.error("[settings.controller:getAccountSettings]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function updateAccountSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const body = UpdateAccountSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: { select: { plan: true } },
        accounts: { where: { status: "CONNECTED" }, select: { accountType: true }, take: 1 },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "Utilisateur introuvable." });
      return;
    }

    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.firstName !== undefined) updateData.firstName = body.firstName.trim();
    if (body.lastName !== undefined) updateData.lastName = body.lastName.trim();
    if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl;

    // Plafonds hebdo personnels : jamais au-dessus de l'offre ; égal au plan => null
    const planLimits = getPlanActionLimits(user.organization?.plan, user.accounts[0]?.accountType);
    for (const kind of ACTION_KINDS) {
      const field = WEEKLY_FIELD_BY_KIND[kind];
      const value = body[field];
      if (value === undefined) continue;
      if (value !== null && value > planLimits[kind].week) {
        res.status(400).json({
          success: false,
          error: `Votre offre ${BILLING_PLANS[normalizePlanId(user.organization?.plan)].name} autorise ${planLimits[kind].week} ${ACTION_LABELS[kind]} par semaine.`,
        });
        return;
      }
      updateData[field] = value === null || value >= planLimits[kind].week ? null : value;
    }

    if (body.workingDays !== undefined) updateData.workingDays = body.workingDays;
    if (body.workingHoursStart !== undefined) updateData.workingHoursStart = body.workingHoursStart;
    if (body.workingHoursEnd !== undefined) updateData.workingHoursEnd = body.workingHoursEnd;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;

    // Modification d'email
    if (body.email && body.email.toLowerCase().trim() !== user.email) {
      const emailLower = body.email.toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email: emailLower } });
      if (existing && existing.id !== user.id) {
        res.status(400).json({ success: false, error: "Cette adresse email est déjà utilisée." });
        return;
      }
      updateData.email = emailLower;
    }

    // Modification du mot de passe
    if (body.newPassword) {
      if (!body.currentPassword) {
        res.status(400).json({
          success: false,
          error: "Veuillez renseigner votre mot de passe actuel pour définir un nouveau mot de passe.",
        });
        return;
      }

      if (user.passwordHash) {
        const isMatch = await bcrypt.compare(body.currentPassword, user.passwordHash);
        if (!isMatch) {
          res.status(400).json({
            success: false,
            error: "Le mot de passe actuel est incorrect.",
          });
          return;
        }
      }

      updateData.passwordHash = await bcrypt.hash(body.newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { organization: true },
    });

    res.json({
      success: true,
      message: "Paramètres de votre compte mis à jour avec succès.",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        avatarUrl: updatedUser.avatarUrl,
        maxWeeklyInvites: updatedUser.maxWeeklyInvites,
        maxWeeklyMessages: updatedUser.maxWeeklyMessages,
        maxWeeklyVisits: updatedUser.maxWeeklyVisits,
        maxWeeklyFollows: updatedUser.maxWeeklyFollows,
        workingDays: updatedUser.workingDays,
        workingHoursStart: updatedUser.workingHoursStart,
        workingHoursEnd: updatedUser.workingHoursEnd,
        timezone: updatedUser.timezone,
        organization: updatedUser.organization,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.issues?.[0]?.message || err.message });
      return;
    }
    console.error("[settings.controller:updateAccountSettings]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

// ==========================================
// 2. RECONNEXION DU COMPTE LINKEDIN (UNIPILE DIRECT)
// ==========================================

export async function getLinkedInSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const account = await prisma.linkedInAccount.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    if (!account) {
      res.json({
        success: true,
        connected: false,
        account: null,
      });
      return;
    }

    let liveStatus = account.status;
    let details: any = null;

    if (account.unipileAccountId) {
      try {
        details = await UnipileService.getAccountStatus(account.unipileAccountId);
        if (details?.errorStatus === 502 || details?.errorStatus === 503 || details?.errorStatus === 504) {
          liveStatus = "GATEWAY_UNAVAILABLE";
        } else if (details?.errorStatus === 404 && isWithinCreationGrace(account)) {
          // Compte en cours de création chez Unipile : on garde CONNECTED, le prochain check tranchera
          liveStatus = "CONNECTED";
        } else if (details?.errorStatus === 401 || details?.errorStatus === 404) {
          liveStatus = "DISCONNECTED";
        } else {
          const sourceStatus = details?.sources?.[0]?.status;
          if (sourceStatus === "OK" || details?.name) {
            liveStatus = "CONNECTED";
          } else if (sourceStatus === "CHECKPOINT" || details?.status === "CHECKPOINT") {
            liveStatus = "CHECKPOINT";
          } else if (sourceStatus === "CREDENTIALS" || sourceStatus === "DISCONNECTED") {
            liveStatus = "DISCONNECTED";
          }
        }
      } catch (checkErr: any) {
        liveStatus = "DISCONNECTED";
      }

      // Synchroniser le statut en base (dans les deux sens : une ligne rétrogradée à tort pendant la
      // création du compte redevient CONNECTED dès qu'Unipile répond OK)
      if (liveStatus !== "GATEWAY_UNAVAILABLE" && account.status !== liveStatus) {
        await prisma.linkedInAccount.update({
          where: { id: account.id },
          data: { status: liveStatus },
        }).catch(() => {});
      }
    }

    res.json({
      success: true,
      connected: liveStatus === "CONNECTED",
      status: liveStatus,
      account: {
        id: account.id,
        unipileAccountId: account.unipileAccountId,
        accountName: account.accountName,
        headline: account.headline,
        profilePicture: account.profilePicture,
        dailyInvitesSent: account.dailyInvitesSent,
        dailyMsgSent: account.dailyMsgSent,
        isPremium: account.isPremium,
        hasSalesNavigator: account.hasSalesNavigator,
        accountType: account.accountType,
        updatedAt: account.updatedAt,
      },
      liveDetails: details,
    });
  } catch (err: any) {
    console.error("[settings.controller:getLinkedInSettings]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

const ReconnectSchema = z.object({
  linkedinEmail: z.string().email("Adresse email LinkedIn invalide"),
  linkedinPassword: z.string().min(1, "Mot de passe LinkedIn requis"),
});

export async function reconnectLinkedInDirect(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const body = ReconnectSchema.parse(req.body);

    console.log(`[reconnectLinkedInDirect] Tentative reconnexion directe pour l'utilisateur ${userId}...`);

    // 0. Un checkpoint est déjà en attente (< 5 min) : ne pas relancer une authentification (doublon Unipile)
    const pending = await pendingCheckpointFor(userId);
    if (pending) {
      res.status(202).json({
        success: false,
        status: "CHECKPOINT",
        checkpoint: pending.checkpoint,
        message: "Un code de vérification LinkedIn est déjà attendu. Entrez le code reçu (ou demandez-en un nouveau).",
      });
      return;
    }

    // 1. Reconnexion sur l'account_id existant (même déconnecté) → aucun nouveau compte facturé
    const existing = await prisma.linkedInAccount.findFirst({
      where: { userId, unipileAccountId: { not: "" } },
      orderBy: { updatedAt: "desc" },
    });
    const outcome = await connectOrReconnect({
      email: body.linkedinEmail,
      password: body.linkedinPassword,
      existingAccountId: existing?.unipileAccountId || null,
    });

    if (outcome.kind === "CHECKPOINT") {
      // Persister le compte en attente : resolveLinkedInCheckpoint et le rejeu s'appuient dessus
      await persistLinkedInAccount(userId, outcome.accountId, null, "CHECKPOINT", body.linkedinEmail.trim());
      res.status(202).json({
        success: false,
        status: "CHECKPOINT",
        checkpoint: outcome.checkpoint,
        message: "LinkedIn demande une vérification de sécurité (2FA / code de confirmation). Entrez le code reçu.",
      });
      return;
    }

    if (outcome.kind === "ERROR") {
      const httpStatus = outcome.statusCode === 502 || outcome.statusCode === 503 ? 503 : 400;
      res.status(httpStatus).json({ success: false, error: outcome.error });
      return;
    }

    const updatedAccount = await persistLinkedInAccount(userId, outcome.accountId, outcome.profile, "CONNECTED", body.linkedinEmail.trim());

    await prisma.user.update({
      where: { id: userId },
      data: {
        linkedinEmail: body.linkedinEmail.trim(),
        avatarUrl: outcome.profile?.avatarUrl || undefined,
        ...(outcome.profile?.linkedinProfileId ? { linkedinProfileId: outcome.profile.linkedinProfileId } : {}),
      },
    });

    await resumePausedCampaigns(userId);

    res.json({
      success: true,
      message: outcome.reused
        ? "Compte LinkedIn reconnecté avec succès ! Vos campagnes ont été réactivées."
        : "Compte LinkedIn connecté avec succès ! Vos campagnes ont été réactivées.",
      account: updatedAccount,
      reused: outcome.reused,
      removedDuplicates: outcome.removedDuplicates,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.issues?.[0]?.message || err.message });
      return;
    }
    console.error("[settings.controller:reconnectLinkedInDirect]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function resolveLinkedInCheckpoint(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { accountId, code } = req.body;
    if (!accountId || !code) {
      res.status(400).json({ success: false, error: "Identifiant de session et code de vérification requis." });
      return;
    }

    const solved = await UnipileService.solveCheckpoint(String(accountId), String(code).trim());
    if (!solved.success) {
      if (solved.checkpoint) {
        res.status(202).json({
          success: false,
          status: "CHECKPOINT",
          checkpoint: solved.checkpoint,
          message: "LinkedIn demande une vérification supplémentaire. Entrez le nouveau code reçu.",
        });
        return;
      }
      res.status(400).json({ success: false, error: solved.error || "Code de vérification invalide ou expiré." });
      return;
    }

    // Profil + dédoublonnage Unipile, puis une seule ligne en base pour cet utilisateur
    const outcome = await finalizeConnection(solved.accountId || String(accountId), true);
    if (outcome.kind !== "CONNECTED") {
      res.status(400).json({ success: false, error: "Vérification validée mais le compte reste indisponible. Réessayez." });
      return;
    }
    await persistLinkedInAccount(userId, outcome.accountId, outcome.profile, "CONNECTED");
    if (outcome.profile?.linkedinProfileId || outcome.profile?.avatarUrl) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(outcome.profile?.linkedinProfileId ? { linkedinProfileId: outcome.profile.linkedinProfileId } : {}),
          ...(outcome.profile?.avatarUrl ? { avatarUrl: outcome.profile.avatarUrl } : {}),
        },
      }).catch(() => {});
    }
    await resumePausedCampaigns(userId);

    res.json({
      success: true,
      message: "Vérification validée ! Votre compte LinkedIn est maintenant actif et vos campagnes ont repris.",
      removedDuplicates: outcome.removedDuplicates,
    });
  } catch (err: any) {
    console.error("[settings.controller:resolveLinkedInCheckpoint]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

/** POST /api/settings/linkedin/checkpoint/resend — renvoie un nouveau code sans recréer de compte */
export async function resendLinkedInCheckpoint(req: AuthenticatedRequest, res: Response) {
  try {
    const { accountId } = req.body;
    if (!accountId) {
      res.status(400).json({ success: false, error: "Identifiant de session requis." });
      return;
    }
    const result = await UnipileService.resendCheckpoint(String(accountId));
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error || "Impossible de renvoyer le code." });
      return;
    }
    res.json({ success: true, message: "Un nouveau code vient d'être envoyé." });
  } catch (err: any) {
    console.error("[settings.controller:resendLinkedInCheckpoint]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

// ==========================================
// 3. HISTORIQUE DES IMPORTATIONS
// ==========================================

export async function getImportHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId;

    const whereClause = organizationId
      ? { OR: [{ userId }, { organizationId }] }
      : { userId };

    const imports = await prisma.importHistory.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const totalImports = imports.length;
    const totalImportedLeads = imports.reduce((sum, item) => sum + item.importedCount, 0);
    const totalDuplicatesFiltered = imports.reduce((sum, item) => sum + item.duplicateCount, 0);
    const totalCollisionsBlocked = imports.reduce((sum, item) => sum + item.collisionCount, 0);

    res.json({
      success: true,
      imports,
      stats: {
        totalImports,
        totalImportedLeads,
        totalDuplicatesFiltered,
        totalCollisionsBlocked,
      },
    });
  } catch (err: any) {
    console.error("[settings.controller:getImportHistory]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function getImportDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const item = await prisma.importHistory.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!item) {
      res.status(404).json({ success: false, error: "Import non trouvé." });
      return;
    }

    res.json({ success: true, item });
  } catch (err: any) {
    console.error("[settings.controller:getImportDetails]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

// ==========================================
// 4. CLÉ API BIME LINK & INTÉGRATIONS TIERCES
// ==========================================

export async function getApiKeys(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const keys = await prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    res.json({ success: true, keys });
  } catch (err: any) {
    console.error("[settings.controller:getApiKeys]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function createApiKey(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId;
    const { name = "Clé API Principale" } = req.body;

    const rawSecret = crypto.randomBytes(24).toString("hex");
    const fullKey = `bl_live_${rawSecret}`;
    const prefix = `bl_live_...${rawSecret.slice(-5)}`;

    const apiKey = await prisma.apiKey.create({
      data: {
        userId,
        organizationId: organizationId || null,
        name: name.trim(),
        key: fullKey,
        prefix,
      },
    });

    res.status(201).json({
      success: true,
      message: "Clé API générée avec succès. Copiez-la précieusement, elle ne sera plus réaffichée en clair.",
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        createdAt: apiKey.createdAt,
      },
      secretKey: fullKey,
    });
  } catch (err: any) {
    console.error("[settings.controller:createApiKey]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function revokeApiKey(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const existing = await prisma.apiKey.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: "Clé API non trouvée." });
      return;
    }

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    res.json({ success: true, message: "Clé API révoquée avec succès." });
  } catch (err: any) {
    console.error("[settings.controller:revokeApiKey]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function getIntegrations(req: AuthenticatedRequest, res: Response) {
  try {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      res.json({ success: true, integrations: [] });
      return;
    }

    const configs = await prisma.integrationConfig.findMany({
      // Les lignes BLEADIN_* sont du stockage interne (rapports, photo de l'espace), pas des intégrations
      where: { organizationId, provider: { notIn: INTERNAL_PROVIDERS } },
    });

    res.json({ success: true, integrations: configs });
  } catch (err: any) {
    console.error("[settings.controller:getIntegrations]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function saveIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      res.status(400).json({ success: false, error: "Organisation requise." });
      return;
    }

    const { provider, config } = req.body;
    if (!provider || !config) {
      res.status(400).json({ success: false, error: "Fournisseur et configuration requis." });
      return;
    }

    const saved = await prisma.integrationConfig.upsert({
      where: {
        organizationId_provider: {
          organizationId,
          provider: provider.toUpperCase(),
        },
      },
      create: {
        organizationId,
        provider: provider.toUpperCase(),
        config,
        status: "CONNECTED",
        lastSyncAt: new Date(),
      },
      update: {
        config,
        status: "CONNECTED",
        lastSyncAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: `Configuration de l'intégration ${provider} enregistrée.`,
      integration: saved,
    });
  } catch (err: any) {
    console.error("[settings.controller:saveIntegration]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function testIntegrationConnection(req: AuthenticatedRequest, res: Response) {
  try {
    const { provider, config } = req.body;

    if (provider === "BREVO") {
      const apiKey = config?.apiKey;
      if (!apiKey) {
        res.status(400).json({ success: false, error: "Clé API Brevo requise." });
        return;
      }
      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/account", {
          headers: { "api-key": apiKey },
        });
        if (brevoRes.ok) {
          const accData: any = await brevoRes.json();
          res.json({
            success: true,
            message: `Connexion à Brevo réussie ! Compte : ${accData?.email || "Actif"}`,
          });
          return;
        }
        res.status(400).json({ success: false, error: `Erreur Brevo (${brevoRes.status}) : Clé API invalide.` });
        return;
      } catch (e: any) {
        res.status(400).json({ success: false, error: `Impossible de joindre Brevo : ${e.message}` });
        return;
      }
    }

    if (provider === "HUBSPOT") {
      const token = config?.token || config?.apiKey;
      if (!token) {
        res.status(400).json({ success: false, error: "Token d'accès privé HubSpot requis." });
        return;
      }
      try {
        const hsRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (hsRes.ok) {
          res.json({ success: true, message: "Connexion à HubSpot validée avec succès !" });
          return;
        }
        res.status(400).json({ success: false, error: `Erreur HubSpot (${hsRes.status}) : Token invalide ou permissions insuffisantes.` });
        return;
      } catch (e: any) {
        res.status(400).json({ success: false, error: `Erreur de connexion HubSpot : ${e.message}` });
        return;
      }
    }

    if (provider === "GOOGLESHEETS") {
      const webhookUrl = config?.webhookUrl;
      if (!webhookUrl || !webhookUrl.startsWith("http")) {
        res.status(400).json({ success: false, error: "URL Webhook Google Sheets / Make / Zapier valide requise." });
        return;
      }
      try {
        const testPayload = {
          event: "bleadin_connection_test",
          timestamp: new Date().toISOString(),
          message: "Test de connectivité réussi depuis Bleadin.",
        };
        const hookRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testPayload),
        });
        if (hookRes.ok || hookRes.status === 200 || hookRes.status === 201 || hookRes.status === 204) {
          res.json({ success: true, message: "Webhook Google Sheets contacté avec succès !" });
          return;
        }
        res.status(400).json({ success: false, error: `Le webhook a retourné un statut HTTP ${hookRes.status}.` });
        return;
      } catch (e: any) {
        res.status(400).json({ success: false, error: `Échec d'envoi vers le webhook : ${e.message}` });
        return;
      }
    }

    if (provider === "PIPEDRIVE") {
      const token = config?.token || config?.apiKey;
      if (!token) {
        res.status(400).json({ success: false, error: "Jeton API Pipedrive requis." });
        return;
      }
      try {
        const pdRes = await fetch(`https://api.pipedrive.com/v1/users/me?api_token=${token}`);
        if (pdRes.ok) {
          const pdData: any = await pdRes.json();
          res.json({
            success: true,
            message: `Connexion à Pipedrive validée ! Utilisateur : ${pdData?.data?.name || "Actif"}`,
          });
          return;
        }
        res.status(400).json({ success: false, error: `Erreur Pipedrive (${pdRes.status}) : Jeton API invalide.` });
        return;
      } catch (e: any) {
        res.status(400).json({ success: false, error: `Erreur de connexion Pipedrive : ${e.message}` });
        return;
      }
    }

    if (provider === "NOCRM") {
      const apiKey = config?.apiKey || config?.token;
      const subdomain = config?.subdomain || "app";
      if (!apiKey) {
        res.status(400).json({ success: false, error: "Clé API noCRM.io requise." });
        return;
      }
      try {
        const nocrmRes = await fetch(`https://${subdomain}.nocrm.io/api/v2/ping`, {
          headers: { "X-API-KEY": apiKey },
        });
        if (nocrmRes.ok) {
          res.json({ success: true, message: "Connexion à noCRM.io validée avec succès !" });
          return;
        }
        res.status(400).json({ success: false, error: `Erreur noCRM.io (${nocrmRes.status}) : Clé API invalide.` });
        return;
      } catch (e: any) {
        res.status(400).json({ success: false, error: `Erreur de connexion noCRM.io : ${e.message}` });
        return;
      }
    }

    res.status(400).json({ success: false, error: "Fournisseur d'intégration inconnu." });
  } catch (err: any) {
    console.error("[settings.controller:testIntegrationConnection]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

// ==========================================
// 5. FACTURATION & ABONNEMENT
// ==========================================

// Grille tarifaire : server/src/config/plans.ts (miroir de client/src/marketing/content/plans.ts)

const BILLING_CURRENCY = "USD";

/**
 * Une organisation qui héberge un super administrateur n'est jamais facturée :
 * aucune facture n'est générée, le prix affiché est nul et le moyen de paiement
 * n'est pas demandé. Le test porte sur l'organisation (et non sur `req.user.role`)
 * pour que la supervision d'un client (x-impersonate-org) affiche bien sa facturation.
 */
async function isBillingExempt(organizationId: string | null | undefined): Promise<boolean> {
  if (!organizationId) return false;
  const superAdmins = await prisma.user.count({ where: { organizationId, role: "SUPER_ADMIN" } });
  return superAdmins > 0;
}

const UpdatePlanSchema = z.object({
  plan: z.enum(["STARTER", "PRO", "BUSINESS"]),
});

/**
 * Changement d'offre immédiat, réservé au super administrateur (compte interne,
 * non facturé). Les quotas d'actions et la dotation de tokens suivent aussitôt.
 */
export async function updateBillingPlan(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user!.role !== "SUPER_ADMIN") {
      res.status(403).json({ success: false, error: "Le changement d'offre se fait depuis votre espace de facturation." });
      return;
    }

    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      res.status(400).json({ success: false, error: "Aucune organisation rattachée à ce compte." });
      return;
    }

    const parsed = UpdatePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Offre inconnue." });
      return;
    }

    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: { plan: parsed.data.plan },
      select: { id: true, plan: true },
    });

    res.json({
      success: true,
      plan: organization.plan,
      planName: BILLING_PLANS[normalizePlanId(organization.plan)].name,
      message: `Offre ${BILLING_PLANS[normalizePlanId(organization.plan)].name} activée.`,
    });
  } catch (err: any) {
    console.error("[settings.controller:updateBillingPlan]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function getBillingInfo(req: AuthenticatedRequest, res: Response) {
  try {
    const organizationId = req.user!.organizationId;
    const org = organizationId
      ? await prisma.organization.findUnique({ where: { id: organizationId } })
      : null;

    const plan = normalizePlanId(org?.plan);
    const pricing = BILLING_PLANS[plan];
    const billingExempt = await isBillingExempt(organizationId);

    // Quotas d'actions LinkedIn de l'utilisateur courant (usage réel de son compte connecté)
    const quotaUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        accounts: {
          where: { status: "CONNECTED" },
          select: { id: true, accountType: true, createdAt: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });
    const quotas = quotaUser
      ? await buildQuotasPayload(quotaUser, quotaUser.accounts[0] ?? null, org?.plan)
      : null;
    const enrichment = organizationId ? await getEnrichmentBalance(organizationId, quotaUser?.timezone) : null;

    // Statistiques de consommation réelle
    const prospectsCount = await prisma.prospect.count({
      where: organizationId
        ? { list: { user: { organizationId } } }
        : { userId: req.user!.id },
    });

    const campaignsCount = await prisma.campaign.count({
      where: organizationId
        ? { user: { organizationId } }
        : { userId: req.user!.id },
    });

    const teamCount = organizationId
      ? await prisma.user.count({ where: { organizationId } })
      : 1;

    // Récupérer les factures existantes
    let invoices = organizationId
      ? await prisma.invoice.findMany({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
        })
      : [];

    // Compte interne (super admin) : aucune facture générée ni affichée
    if (billingExempt) invoices = [];

    // Si aucune facture n'existe encore, créer un jeu initial de factures pour cette entreprise
    if (!billingExempt && invoices.length === 0 && organizationId) {
      const now = new Date();
      const initialInvoices = [
        {
          organizationId,
          number: `INV-${now.getFullYear()}-003`,
          amount: pricing.monthly,
          currency: BILLING_CURRENCY,
          plan,
          status: "PAID",
          periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
          periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        },
        {
          organizationId,
          number: `INV-${now.getFullYear()}-002`,
          amount: pricing.monthly,
          currency: BILLING_CURRENCY,
          plan,
          status: "PAID",
          periodStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          periodEnd: new Date(now.getFullYear(), now.getMonth(), 0),
        },
        {
          organizationId,
          number: `INV-${now.getFullYear()}-001`,
          amount: pricing.monthly,
          currency: BILLING_CURRENCY,
          plan,
          status: "PAID",
          periodStart: new Date(now.getFullYear(), now.getMonth() - 2, 1),
          periodEnd: new Date(now.getFullYear(), now.getMonth() - 1, 0),
        },
      ];

      for (const inv of initialInvoices) {
        await prisma.invoice.upsert({
          where: { number: inv.number },
          create: inv,
          update: {},
        });
      }

      invoices = await prisma.invoice.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      });
    }

    res.json({
      success: true,
      billing: {
        plan,
        planName: pricing.name,
        pricePerMonth: billingExempt ? 0 : pricing.monthly,
        annualPricePerMonth: billingExempt ? 0 : pricing.annual,
        currency: BILLING_CURRENCY,
        billingCycle: billingExempt ? "Offert" : "Mensuel",
        renewalDate: billingExempt ? null : new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        // Compte interne : ni prélèvement, ni carte enregistrée
        billingExempt,
        canChangePlan: req.user!.role === "SUPER_ADMIN",
        paymentMethod: billingExempt
          ? null
          : {
              brand: "Visa",
              last4: "4242",
              expiry: "12/28",
            },
        limits: {
          maxProspects: pricing.maxProspects,
          maxCampaigns: pricing.maxCampaigns, // -1 = illimitées
          maxTeamSeats: pricing.maxTeamSeats,
          actions: pricing.actions,
          enrichmentTokens: pricing.enrichmentTokens,
        },
        usage: {
          prospectsCount,
          campaignsCount,
          teamCount,
        },
        quotas,
        enrichment,
        invoices,
      },
    });
  } catch (err: any) {
    console.error("[settings.controller:getBillingInfo]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function downloadInvoicePdf(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const organizationId = req.user!.organizationId;

    const invoice = await prisma.invoice.findFirst({
      where: organizationId ? { id, organizationId } : { id },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: "Facture introuvable." });
      return;
    }

    const org = invoice.organizationId
      ? await prisma.organization.findUnique({ where: { id: invoice.organizationId } })
      : null;

    const orgName = org?.name || "Bleadin Client";
    const dateFormatted = new Date(invoice.createdAt).toLocaleDateString("fr-FR");
    const periodStartStr = new Date(invoice.periodStart).toLocaleDateString("fr-FR");
    const periodEndStr = new Date(invoice.periodEnd).toLocaleDateString("fr-FR");
    const tva = (invoice.amount * 0.2).toFixed(2);
    const currencySymbol = invoice.currency === "USD" ? "$" : "€";
    const amountHT = (invoice.amount - Number(tva)).toFixed(2);

    const htmlInvoice = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${invoice.number} - Bleadin</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #21164c; margin: 40px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #592eff; padding-bottom: 20px; }
    .logo { font-size: 26px; font-weight: 900; color: #592eff; }
    .invoice-title { font-size: 22px; font-weight: 800; text-align: right; }
    .invoice-number { font-size: 14px; color: #5f5f69; margin-top: 4px; }
    .meta-grid { display: flex; justify-content: space-between; margin: 30px 0; }
    .meta-block h4 { font-size: 11px; text-transform: uppercase; color: #7c7c88; margin-bottom: 5px; }
    .meta-block p { font-size: 14px; font-weight: 600; margin: 0; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f8f9fc; text-align: left; padding: 12px; font-size: 12px; border-bottom: 1px solid #e0e0db; }
    td { padding: 14px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f4; }
    .total-section { margin-top: 30px; display: flex; justify-content: flex-end; }
    .total-box { width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .total-row.grand { font-size: 16px; font-weight: 900; color: #592eff; border-top: 2px solid #592eff; padding-top: 10px; margin-top: 6px; }
    .badge-paid { display: inline-block; padding: 4px 12px; background: #ecfdf5; color: #059669; border-radius: 9999px; font-weight: bold; font-size: 12px; }
    .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #8c8c9a; border-top: 1px solid #e0e0db; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">⚡ BLEADIN</div>
      <p style="font-size: 12px; color: #5f5f69; margin-top: 4px;">Plateforme d'Automatisation & Prospection LinkedIn</p>
    </div>
    <div style="text-align: right;">
      <div class="invoice-title">FACTURE OFFICIELLE</div>
      <div class="invoice-number">${invoice.number}</div>
      <div style="margin-top: 8px;"><span class="badge-paid">ACQUITTÉE</span></div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-block">
      <h4>Émetteur</h4>
      <p><strong>Bleadin Technologies SAS</strong></p>
      <p>42 Avenue de l'Automatisation</p>
      <p>75008 Paris, France</p>
      <p>SIRET : 912 345 678 00019</p>
      <p>TVA : FR 44 912345678</p>
    </div>
    <div class="meta-block" style="text-align: right;">
      <h4>Client Facturé</h4>
      <p><strong>${orgName}</strong></p>
      <p>Date d'émission : ${dateFormatted}</p>
      <p>Période : ${periodStartStr} - ${periodEndStr}</p>
      <p>Règlement : Carte bancaire (•••• 4242)</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: center;">Période</th>
        <th style="text-align: right;">Montant HT</th>
        <th style="text-align: right;">TVA (20%)</th>
        <th style="text-align: right;">Total TTC</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>Abonnement Bleadin - Formule ${invoice.plan}</strong><br>
          <span style="font-size: 11px; color: #666;">Accès illimité aux campagnes séquentielles, Inbox synchronisée et enrichissement automatique.</span>
        </td>
        <td style="text-align: center;">${periodStartStr} - ${periodEndStr}</td>
        <td style="text-align: right;">${amountHT} ${currencySymbol}</td>
        <td style="text-align: right;">${tva} ${currencySymbol}</td>
        <td style="text-align: right;"><strong>${invoice.amount.toFixed(2)} ${currencySymbol}</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-box">
      <div class="total-row"><span>Sous-total HT :</span> <span>${amountHT} ${currencySymbol}</span></div>
      <div class="total-row"><span>TVA (20%) :</span> <span>${tva} ${currencySymbol}</span></div>
      <div class="total-row grand"><span>Total TTC Payé :</span> <span>${invoice.amount.toFixed(2)} ${currencySymbol}</span></div>
    </div>
  </div>

  <div class="footer">
    Bleadin Technologies SAS • RCS Paris • Facture acquittée automatiquement • Pour toute question : billing@bleadin.com
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(htmlInvoice);
  } catch (err: any) {
    console.error("[settings.controller:downloadInvoicePdf]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}
