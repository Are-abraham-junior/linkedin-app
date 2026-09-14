import { Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import crypto from "crypto";
import { AuthenticatedRequest, generateToken, JWT_SECRET } from "../middlewares/auth.middleware.js";
import { sendPasswordResetEmail } from "../services/mail.service.js";
import {
  connectOrReconnect,
  finalizeConnection,
  persistLinkedInAccount,
  pendingCheckpointFor,
  type ConnectOutcome,
} from "../services/linkedinConnection.service.js";
import { UnipileService } from "../services/unipile.service.js";
import { getWorkspaceAvatar } from "../services/workspace.service.js";

const SetupAdminSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  organizationName: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

const RegisterSchema = z.object({
  firstName: z.string().min(1, "Le prénom est obligatoire"),
  lastName: z.string().min(1, "Le nom est obligatoire"),
  email: z.string().email("Adresse email professionnelle invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  workspaceName: z.string().min(2, "Le nom de l'espace ou entreprise doit contenir au moins 2 caractères"),
});

let cachedSetupCompleted: boolean | null = true;

export async function getSetupStatus(req: AuthenticatedRequest, res: Response) {
  try {
    if (cachedSetupCompleted !== null) {
      res.json({
        success: true,
        setupCompleted: cachedSetupCompleted,
      });
      return;
    }

    const superAdminCount = await prisma.user.count({
      where: { role: "SUPER_ADMIN" },
    });

    cachedSetupCompleted = superAdminCount > 0;

    res.json({
      success: true,
      setupCompleted: cachedSetupCompleted,
      superAdminCount,
    });
  } catch (error: any) {
    res.json({
      success: true,
      setupCompleted: true,
    });
  }
}

export async function setupSuperAdmin(req: AuthenticatedRequest, res: Response) {
  try {
    const body = SetupAdminSchema.parse(req.body);

    // Vérifier si un Super Admin existe déjà
    const existingSuperAdmin = await prisma.user.count({
      where: { role: "SUPER_ADMIN" },
    });

    if (existingSuperAdmin > 0) {
      res.status(400).json({
        success: false,
        error: "Un Super Administrateur a déjà été configuré sur cette plateforme.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    // Créer l'organisation principale
    const org = await prisma.organization.create({
      data: {
        name: body.organizationName || "Bleadin Technologies",
        slug: "bleadin-main",
        plan: "ENTERPRISE",
      },
    });

    // Créer le Super Admin
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase().trim(),
        name: body.name.trim(),
        passwordHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        organizationId: org.id,
        maxDailyInvites: 60,
        maxDailyMsg: 120,
      },
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      organizationId: user.organizationId,
    });

    res.status(201).json({
      success: true,
      message: "Super Administrateur créé avec succès.",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        organization: org,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
      return;
    }
    console.error("[auth.controller:setupSuperAdmin]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function register(req: AuthenticatedRequest, res: Response) {
  try {
    const body = RegisterSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();
    const firstName = body.firstName.trim();
    const lastName = body.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const workspaceName = body.workspaceName.trim();

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        error: "Un compte existe déjà avec cette adresse email. Veuillez vous connecter.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const slugBase = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 30);
    const slug = `${slugBase || "org"}-${Date.now().toString(36)}`;

    // Création transactionnelle de l'organisation et de l'utilisateur Owner
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: workspaceName,
          slug,
          plan: "ENTERPRISE",
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          name: fullName,
          firstName,
          lastName,
          passwordHash,
          role: "USER",
          orgRole: "OWNER",
          status: "ACTIVE",
          organizationId: org.id,
          maxDailyInvites: 30,
          maxDailyMsg: 70,
        },
      });

      // Créer une première liste de prospects par défaut
      await tx.prospectList.create({
        data: {
          name: "Premiers prospects",
          description: "Liste initiale créée automatiquement",
          color: "#592eff",
          userId: user.id,
        },
      });

      return { user, org };
    });

    const token = generateToken({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      name: result.user.name,
      organizationId: result.org.id,
    });

    res.status(201).json({
      success: true,
      message: "Compte et espace créés avec succès.",
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        orgRole: result.user.orgRole,
        status: result.user.status,
        organization: result.org,
        hasLinkedInAccount: false,
        linkedInAccount: null,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
      return;
    }
    console.error("[auth.controller:register]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function login(req: AuthenticatedRequest, res: Response) {
  try {
    const body = LoginSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: true,
        accounts: {
          select: {
            id: true,
            accountName: true,
            status: true,
            unipileAccountId: true,
            dailyInvitesSent: true,
            dailyMsgSent: true,
          },
        },
      },
    });

    if (!user || !user.passwordHash) {
      res.status(401).json({ success: false, error: "Identifiants incorrects." });
      return;
    }

    if (user.status === "SUSPENDED") {
      res.status(403).json({
        success: false,
        error: "Votre compte a été suspendu par un administrateur.",
      });
      return;
    }

    const isValidPassword = await bcrypt.compare(body.password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ success: false, error: "Identifiants incorrects." });
      return;
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      organizationId: user.organizationId,
    });

    const primaryAccount = user.accounts.find((a: any) => a.status === "CONNECTED") || user.accounts[0] || null;
    const hasLinkedInAccount = Boolean(primaryAccount && primaryAccount.status === "CONNECTED" && primaryAccount.unipileAccountId);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        orgRole: user.orgRole,
        status: user.status,
        organization: user.organization,
        maxDailyInvites: user.maxDailyInvites,
        maxDailyMsg: user.maxDailyMsg,
        hasLinkedInAccount,
        linkedInAccount: primaryAccount,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
      return;
    }
    console.error("[auth.controller:login]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Non authentifié" });
      return;
    }

    const actualUserId = (req.user as any).originalSuperAdminId || req.user.id;
    let user = await prisma.user.findUnique({
      where: { id: actualUserId },
      include: {
        organization: true,
        accounts: true,
        _count: {
          select: {
            prospectLists: true,
            campaigns: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "Utilisateur non trouvé" });
      return;
    }

    // Auto-sync LinkedIn profile picture and details if missing
    const primaryAccount = user.accounts.find((a: any) => a.status === "CONNECTED") || user.accounts[0];
    if (primaryAccount && primaryAccount.status === "CONNECTED" && primaryAccount.unipileAccountId && (!user.avatarUrl || !primaryAccount.profilePicture)) {
      try {
        const profileResult = await UnipileService.getConnectedAccountProfile(primaryAccount.unipileAccountId);
        if (profileResult.success && profileResult.profile) {
          const p = profileResult.profile;
          const userUpdates: any = {};
          if (p.avatarUrl) userUpdates.avatarUrl = p.avatarUrl;
          if (p.name && (!user.name || user.name === user.email.split("@")[0])) userUpdates.name = p.name;
          if (p.linkedinProfileId) userUpdates.linkedinProfileId = p.linkedinProfileId;

          if (Object.keys(userUpdates).length > 0) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: userUpdates,
              include: {
                organization: true,
                accounts: true,
                _count: {
                  select: { prospectLists: true, campaigns: true },
                },
              },
            });
          }

          await prisma.linkedInAccount.update({
            where: { id: primaryAccount.id },
            data: {
              accountName: p.name || primaryAccount.accountName,
              profilePicture: p.avatarUrl || primaryAccount.profilePicture,
              headline: p.headline || primaryAccount.headline,
              isPremium: p.isPremium ?? primaryAccount.isPremium,
              hasSalesNavigator: p.hasSalesNavigator ?? primaryAccount.hasSalesNavigator,
              accountType: p.accountType ?? primaryAccount.accountType,
            },
          });
        }
      } catch (err) {
        console.error("Failed to auto-sync LinkedIn profile in getMe:", err);
      }
    }

    let userOrg = user.organization;
    let linkedAcc: typeof user.accounts[0] | null = user.accounts.find((a: any) => a.status === "CONNECTED") || user.accounts[0] || null;

    if (req.user?.organizationId && req.user?.isImpersonating) {
      const org = await prisma.organization.findUnique({
        where: { id: req.user.organizationId },
      });
      if (org) userOrg = org;

      if (req.user.ownerId) {
        const ownerAcc = await prisma.linkedInAccount.findFirst({
          where: { userId: req.user.ownerId, status: "CONNECTED" },
        });
        linkedAcc = ownerAcc || null;
      }
    }

    // Photo de profil de l'espace (stockage JSON temporaire, cf. workspace.service)
    const workspaceAvatar = userOrg ? await getWorkspaceAvatar(userOrg.id) : null;
    const organization = userOrg ? { ...userOrg, avatarUrl: workspaceAvatar } : userOrg;

    const finalAvatar = user.avatarUrl || linkedAcc?.profilePicture || null;
    const hasLinkedInAccount = Boolean(linkedAcc && linkedAcc.status === "CONNECTED" && linkedAcc.unipileAccountId);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: finalAvatar,
        role: (req.user as any).originalSuperAdminId ? "SUPER_ADMIN" : user.role,
        orgRole: user.orgRole,
        status: user.status,
        organization,
        maxDailyInvites: user.maxDailyInvites,
        maxDailyMsg: user.maxDailyMsg,
        hasLinkedInAccount,
        linkedInAccount: linkedAcc ? { ...linkedAcc, profilePicture: finalAvatar } : null,
        stats: {
          listsCount: user._count.prospectLists,
          campaignsCount: user._count.campaigns,
        },
      },
    });
  } catch (error: any) {
    console.error("[auth.controller:getMe]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

const LinkedInAuthSchema = z.object({
  linkedinEmail: z.string().email("Email LinkedIn invalide"),
  linkedinPassword: z.string().min(1, "Mot de passe LinkedIn requis"),
});

/**
 * POST /api/auth/linkedin
 * Inscription OU connexion via LinkedIn (Unipile Custom Auth).
 * - Si l'utilisateur existe déjà → connexion
 * - Sinon → création de compte + organisation
 */
/** Utilisateur déjà authentifié (Bearer optionnel, ex. onboarding après inscription) */
function authenticatedUserIdFrom(req: AuthenticatedRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      if (decoded?.id) return decoded.id;
    } catch {}
  }
  return null;
}

const USER_WITH_ACCOUNTS = {
  organization: true,
  accounts: { select: { id: true, accountName: true, status: true, unipileAccountId: true } },
} as const;

/**
 * Utilisateur ciblé par une connexion LinkedIn AVANT tout appel Unipile : l'appelant authentifié,
 * sinon celui dont l'e-mail LinkedIn (ou l'e-mail Bleadin) correspond. Permet de reconnecter
 * sur son account_id existant au lieu de créer un compte Unipile facturé.
 */
async function findUserForLinkedInLogin(req: AuthenticatedRequest, linkedinEmail: string) {
  const authenticatedUserId = authenticatedUserIdFrom(req);
  let user: any = null;
  if (authenticatedUserId) {
    user = await prisma.user.findUnique({ where: { id: authenticatedUserId }, include: USER_WITH_ACCOUNTS });
  }
  if (!user) {
    user = await prisma.user.findFirst({
      where: { OR: [{ linkedinEmail }, { email: linkedinEmail }] },
      include: USER_WITH_ACCOUNTS,
    });
  }
  return { user, authenticatedUserId };
}

/**
 * Suite commune de linkedinAuth et linkedinAuthCheckpoint une fois le compte Unipile connecté :
 * rattachement à l'utilisateur existant (ou inscription), une seule ligne LinkedInAccount, JWT.
 */
async function completeLinkedInAuth(
  req: AuthenticatedRequest,
  res: Response,
  outcome: Extract<ConnectOutcome, { kind: "CONNECTED" }>,
  linkedinEmail: string
) {
  const profile = outcome.profile;
  let user: any = (await findUserForLinkedInLogin(req, linkedinEmail)).user;

  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { linkedinEmail: linkedinEmail },
          { email: linkedinEmail },
          ...(profile?.linkedinProfileId ? [{ linkedinProfileId: profile.linkedinProfileId }] : []),
        ],
      },
      include: {
        organization: true,
        accounts: { select: { id: true, accountName: true, status: true, unipileAccountId: true } },
      },
    });
  }

  if (user) {
    // --- CONNEXION : vérification d'espace dédié & rattachement LinkedIn ---
    if (!user.linkedinEmail || user.linkedinEmail !== linkedinEmail) {
      const existingHolder = await prisma.user.findFirst({
        where: {
          linkedinEmail: linkedinEmail,
          id: { not: user.id },
        },
        include: { organization: true },
      });

      if (existingHolder) {
        res.status(400).json({
          success: false,
          error: `Ce compte LinkedIn (${linkedinEmail}) est déjà associé à l'espace "${existingHolder.organization?.name || existingHolder.email}". Chaque compte LinkedIn doit avoir son propre espace dédié.`,
        });
        return;
      }
    }

    const updateData: any = {};
    if (profile?.avatarUrl) updateData.avatarUrl = profile.avatarUrl;
    if (profile?.name) updateData.name = profile.name;
    if (!user.linkedinEmail) updateData.linkedinEmail = linkedinEmail;
    if (profile?.linkedinProfileId && !user.linkedinProfileId) updateData.linkedinProfileId = profile.linkedinProfileId;

    // Si l'utilisateur existant n'a pas encore d'organisation, on lui en crée une
    if (!user.organizationId) {
      const slug = `org-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const org = await prisma.organization.create({
        data: {
          name: `${profile?.name || user.name || linkedinEmail}'s workspace`,
          slug,
          plan: "ENTERPRISE",
        },
      });
      updateData.organizationId = org.id;
      updateData.orgRole = "OWNER";
    }

    try {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
        include: {
          organization: true,
          accounts: { select: { id: true, accountName: true, status: true, unipileAccountId: true } },
        },
      });
    } catch (dbErr: any) {
      if (dbErr.code === "P2002") {
        res.status(400).json({
          success: false,
          error: `Ce compte LinkedIn est déjà rattaché à un autre espace. Chaque compte a son propre espace dédié.`,
        });
        return;
      }
      throw dbErr;
    }

    // Une seule ligne LinkedInAccount par utilisateur ; les anciens comptes Unipile sont supprimés (await)
    await persistLinkedInAccount(user.id, outcome.accountId, profile, "CONNECTED", linkedinEmail);

  } else {
    // --- INSCRIPTION : création du compte ---
    const slug = `org-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const org = await prisma.organization.create({
      data: {
        name: `${profile?.name || linkedinEmail}'s workspace`,
        slug,
        plan: "ENTERPRISE",
      },
    });

    user = await prisma.user.create({
      data: {
        email: linkedinEmail,
        linkedinEmail: linkedinEmail,
        linkedinProfileId: profile?.linkedinProfileId,
        name: profile?.name || linkedinEmail.split("@")[0],
        avatarUrl: profile?.avatarUrl,
        role: "USER",
        orgRole: "OWNER",
        status: "ACTIVE",
        organizationId: org.id,
        maxDailyInvites: 30,
        maxDailyMsg: 70,
      },
      include: {
        organization: true,
        accounts: true,
      },
    });

    await persistLinkedInAccount(user.id, outcome.accountId, profile, "CONNECTED", linkedinEmail);
  }

  const linkedInAccount = await prisma.linkedInAccount.findFirst({
    where: { userId: user.id, status: "CONNECTED" },
    select: { id: true, accountName: true, status: true, unipileAccountId: true },
  });

  // 4. Générer le JWT
  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role as "SUPER_ADMIN" | "USER",
    name: user.name,
    organizationId: user.organizationId,
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      orgRole: (user as any).orgRole,
      status: user.status,
      organization: user.organization,
      maxDailyInvites: user.maxDailyInvites,
      maxDailyMsg: user.maxDailyMsg,
      linkedInAccount: user.accounts?.[0] || null,
    },
  });
}

export async function linkedinAuth(req: AuthenticatedRequest, res: Response) {
  try {
    const body = LinkedInAuthSchema.parse(req.body);
    const linkedinEmail = body.linkedinEmail.trim();

    // 1. Utilisateur connu ? → reconnexion sur son account_id (pas de nouveau compte facturé)
    const { user: preUser } = await findUserForLinkedInLogin(req, linkedinEmail);
    if (preUser) {
      const pending = await pendingCheckpointFor(preUser.id);
      if (pending) {
        res.status(202).json({
          success: false,
          status: "CHECKPOINT",
          checkpoint: pending.checkpoint,
          message: "Un code de vérification LinkedIn est déjà attendu. Entrez le code reçu.",
        });
        return;
      }
    }
    const existingAccountId: string | null =
      preUser?.accounts?.find((a: any) => a.unipileAccountId)?.unipileAccountId || null;

    // 2. Connexion / reconnexion Unipile
    const outcome = await connectOrReconnect({ email: linkedinEmail, password: body.linkedinPassword, existingAccountId });

    if (outcome.kind === "CHECKPOINT") {
      if (preUser) {
        await persistLinkedInAccount(preUser.id, outcome.accountId, null, "CHECKPOINT", linkedinEmail);
      }
      res.status(202).json({
        success: false,
        status: "CHECKPOINT",
        checkpoint: outcome.checkpoint,
        message: "LinkedIn demande une vérification de sécurité (2FA / code de confirmation). Entrez le code reçu.",
      });
      return;
    }
    if (outcome.kind === "ERROR") {
      res.status(401).json({ success: false, error: outcome.error || "Identifiants LinkedIn incorrects." });
      return;
    }

    await completeLinkedInAuth(req, res, outcome, linkedinEmail);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
      return;
    }
    console.error("[auth.controller:linkedinAuth]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

const LinkedInCheckpointSchema = z.object({
  accountId: z.string().min(1, "Identifiant de session requis."),
  code: z.string().min(1, "Code de vérification requis."),
  linkedinEmail: z.string().email("Adresse email LinkedIn invalide"),
});

/**
 * POST /api/auth/linkedin/checkpoint — résout le code 2FA reçu après linkedinAuth (public),
 * sur le MÊME account_id : aucun nouveau compte Unipile n'est créé.
 */
export async function linkedinAuthCheckpoint(req: AuthenticatedRequest, res: Response) {
  try {
    const body = LinkedInCheckpointSchema.parse(req.body);
    const linkedinEmail = body.linkedinEmail.trim();

    const solved = await UnipileService.solveCheckpoint(body.accountId, body.code.trim());
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

    const outcome = await finalizeConnection(solved.accountId || body.accountId, true);
    if (outcome.kind !== "CONNECTED") {
      res.status(400).json({ success: false, error: "Vérification validée mais le compte reste indisponible. Réessayez." });
      return;
    }
    await completeLinkedInAuth(req, res, outcome, linkedinEmail);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
      return;
    }
    console.error("[auth.controller:linkedinAuthCheckpoint]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

/** POST /api/auth/linkedin/checkpoint/resend (public) */
export async function linkedinAuthResendCheckpoint(req: AuthenticatedRequest, res: Response) {
  const accountId = String(req.body?.accountId || "");
  if (!accountId) {
    res.status(400).json({ success: false, error: "Identifiant de session requis." });
    return;
  }
  const result = await UnipileService.resendCheckpoint(accountId);
  if (!result.success) {
    res.status(400).json({ success: false, error: result.error || "Impossible de renvoyer le code." });
    return;
  }
  res.json({ success: true, message: "Un nouveau code vient d'être envoyé." });
}

const AcceptInvitationSchema = z.object({
  token: z.string().min(1, "Token requis"),
  firstName: z.string().min(1, "Le prénom est obligatoire"),
  lastName: z.string().min(1, "Le nom est obligatoire"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

/**
 * POST /api/auth/join
 * Un invité accepte une invitation en créant son compte Bleadin (identifiants
 * applicatifs). L'email est celui de l'invitation. La connexion LinkedIn se
 * fait ensuite depuis l'application (bandeau « Connecter LinkedIn »).
 */
export async function acceptInvitation(req: AuthenticatedRequest, res: Response) {
  try {
    const body = AcceptInvitationSchema.parse(req.body);

    // 1. Valider l'invitation
    const invitation = await prisma.teamInvitation.findUnique({
      where: { token: body.token },
      include: { organization: true },
    });

    if (!invitation) {
      res.status(404).json({ success: false, error: "Invitation introuvable ou invalide." });
      return;
    }
    if (invitation.status !== "PENDING") {
      res.status(400).json({ success: false, error: "Cette invitation a déjà été utilisée ou est expirée." });
      return;
    }
    if (new Date() > invitation.expiresAt) {
      await prisma.teamInvitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
      res.status(400).json({ success: false, error: "Cette invitation a expiré." });
      return;
    }

    // 2. Refuser si un compte existe déjà avec cet email (pas de rattachement automatique)
    const email = invitation.email.toLowerCase().trim();
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { linkedinEmail: email }] },
      select: { id: true },
    });
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: "Un compte existe déjà avec cette adresse email. Connectez-vous avec vos identifiants habituels.",
      });
      return;
    }

    // 3. Créer le compte, sa liste par défaut et clore l'invitation — atomiquement
    const firstName = body.firstName.trim();
    const lastName = body.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: fullName,
          firstName,
          lastName,
          role: "USER",
          orgRole: invitation.orgRole,
          status: "ACTIVE",
          organizationId: invitation.organizationId,
          maxDailyInvites: 30,
          maxDailyMsg: 70,
        },
        include: { organization: true },
      });

      await tx.prospectList.create({
        data: {
          name: "Premiers prospects",
          description: "Liste initiale créée automatiquement",
          color: "#592eff",
          userId: created.id,
        },
      });

      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      return created;
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      organizationId: user.organizationId,
    });

    res.status(201).json({
      success: true,
      message: `Bienvenue dans ${user.organization?.name || "l'équipe"} !`,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: null,
        role: user.role,
        orgRole: user.orgRole,
        status: user.status,
        organization: user.organization,
        maxDailyInvites: user.maxDailyInvites,
        maxDailyMsg: user.maxDailyMsg,
        hasLinkedInAccount: false,
        linkedInAccount: null,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
      return;
    }
    console.error("[auth.controller:acceptInvitation]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

// ==========================================
// MOT DE PASSE OUBLIÉ
// ==========================================

const ForgotPasswordSchema = z.object({
  email: z.string().email("Adresse email invalide"),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Lien invalide."),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

const RESET_TOKEN_PURPOSE = "password_reset";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 heure

/**
 * Empreinte courte du hash actuel : intégrée au jeton, elle rend le lien à usage
 * unique (le hash change dès que le mot de passe est modifié) sans stockage en base.
 */
function passwordFingerprint(passwordHash: string): string {
  return crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

/**
 * POST /api/auth/forgot-password  { email }
 * Répond toujours 200 (sauf échec d'envoi SMTP) pour ne pas révéler si l'adresse existe.
 */
export async function forgotPassword(req: AuthenticatedRequest, res: Response) {
  try {
    const body = ForgotPasswordSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, passwordHash: true, status: true },
    });

    // Comptes inexistants, suspendus ou sans mot de passe (connexion LinkedIn uniquement) : on ne fait rien
    if (!user || !user.passwordHash || user.status !== "ACTIVE") {
      res.json({ success: true });
      return;
    }

    const token = jwt.sign(
      { sub: user.id, purpose: RESET_TOKEN_PURPOSE, pwh: passwordFingerprint(user.passwordHash) },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    const frontendBase = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const resetUrl = `${frontendBase}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name || user.email,
        resetUrl,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      });
    } catch (mailErr: any) {
      console.error("[auth.controller:forgotPassword] Échec d'envoi de l'e-mail:", mailErr?.message || mailErr);
      res.status(502).json({
        success: false,
        error: "L'envoi de l'e-mail a échoué. Veuillez réessayer dans quelques instants.",
      });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues[0].message });
      return;
    }
    console.error("[auth.controller:forgotPassword]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

/**
 * POST /api/auth/reset-password  { token, password }
 */
export async function resetPassword(req: AuthenticatedRequest, res: Response) {
  const INVALID = "Ce lien est invalide ou a expiré. Veuillez demander un nouveau lien.";
  try {
    const body = ResetPasswordSchema.parse(req.body);

    let payload: any;
    try {
      payload = jwt.verify(body.token, JWT_SECRET);
    } catch {
      res.status(400).json({ success: false, error: INVALID });
      return;
    }
    if (!payload || payload.purpose !== RESET_TOKEN_PURPOSE || typeof payload.sub !== "string") {
      res.status(400).json({ success: false, error: INVALID });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, passwordHash: true, status: true },
    });
    if (
      !user ||
      !user.passwordHash ||
      user.status !== "ACTIVE" ||
      payload.pwh !== passwordFingerprint(user.passwordHash)
    ) {
      res.status(400).json({ success: false, error: INVALID });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    res.json({ success: true, message: "Votre mot de passe a été réinitialisé. Vous pouvez vous connecter." });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues[0].message });
      return;
    }
    console.error("[auth.controller:resetPassword]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}
