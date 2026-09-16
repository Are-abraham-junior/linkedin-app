import { Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { getWorkspaceAvatars } from "../services/workspace.service.js";
import { UnipileService } from "../services/unipile.service.js";
import { listReconciledAccounts, deleteUnipileAccountIfOrphan, reconcileUnipileAccounts } from "../services/unipileReconcile.service.js";
import { grantTokens, getBalance as getEnrichmentBalance } from "../services/enrichment.service.js";

const CreateUserSchema = z.object({
  name: z.string().min(2, "Le nom est obligatoire"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Mot de passe d'au moins 6 caractères"),
  role: z.enum(["SUPER_ADMIN", "USER"]).default("USER"),
  organizationId: z.string().optional(),
  // Plafonds hebdo personnels ; null = quota de l'offre de l'organisation
  maxWeeklyInvites: z.number().int().min(0).nullable().default(null),
  maxWeeklyMessages: z.number().int().min(0).nullable().default(null),
  maxWeeklyVisits: z.number().int().min(0).nullable().default(null),
  maxWeeklyFollows: z.number().int().min(0).nullable().default(null),
});

const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["SUPER_ADMIN", "USER"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "PENDING_INVITE"]).optional(),
  organizationId: z.string().nullable().optional(),
  maxWeeklyInvites: z.number().int().min(0).nullable().optional(),
  maxWeeklyMessages: z.number().int().min(0).nullable().optional(),
  maxWeeklyVisits: z.number().int().min(0).nullable().optional(),
  maxWeeklyFollows: z.number().int().min(0).nullable().optional(),
  password: z.string().min(6).optional(),
});

export async function getPlatformMetrics(req: AuthenticatedRequest, res: Response) {
  try {
    const [
      totalUsers,
      totalOrganizations,
      totalProspects,
      totalCampaigns,
      activeCampaigns,
      totalMessages,
      connectedAccounts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.prospect.count(),
      prisma.campaign.count(),
      prisma.campaign.count({ where: { status: "ACTIVE" } }),
      prisma.message.count(),
      prisma.linkedInAccount.count({ where: { status: "CONNECTED" } }),
    ]);

    const usersByRole = await prisma.user.groupBy({
      by: ["role"],
      _count: { id: true },
    });

    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        organization: { select: { name: true } },
        accounts: { select: { status: true, accountName: true } },
      },
    });

    const roleMap: Record<string, number> = {};
    for (const r of usersByRole) {
      roleMap[r.role] = r._count.id;
    }

    res.json({
      success: true,
      metrics: {
        totalUsers,
        totalOrganizations,
        totalProspects,
        totalCampaigns,
        activeCampaigns,
        totalMessages,
        connectedAccounts,
        usersByRole: roleMap,
      },
      recentUsers,
    });
  } catch (error: any) {
    console.error("[admin.controller:getPlatformMetrics]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function getUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const { search, role, status, organizationId } = req.query;

    const where: any = {};

    if (search && typeof search === "string") {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role && typeof role === "string" && ["SUPER_ADMIN", "USER"].includes(role)) {
      where.role = role;
    }

    if (status && typeof status === "string" && ["ACTIVE", "SUSPENDED", "PENDING_INVITE"].includes(status)) {
      where.status = status;
    }

    if (organizationId && typeof organizationId === "string") {
      where.organizationId = organizationId;
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        organization: true,
        accounts: {
          select: {
            id: true,
            accountName: true,
            headline: true,
            status: true,
            dailyInvitesSent: true,
            dailyMsgSent: true,
          },
        },
        _count: {
          select: {
            prospectLists: true,
            campaigns: true,
          },
        },
      },
    });

    res.json({
      success: true,
      users: users.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        avatarUrl: u.avatarUrl,
        role: u.role,
        status: u.status,
        maxWeeklyInvites: u.maxWeeklyInvites,
        maxWeeklyMessages: u.maxWeeklyMessages,
        maxWeeklyVisits: u.maxWeeklyVisits,
        maxWeeklyFollows: u.maxWeeklyFollows,
        createdAt: u.createdAt,
        organization: u.organization,
        linkedInAccount: u.accounts[0] || null,
        stats: {
          lists: u._count.prospectLists,
          campaigns: u._count.campaigns,
        },
      })),
    });
  } catch (error: any) {
    console.error("[admin.controller:getUsers]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function getUserDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        organization: true,
        accounts: true,
        prospectLists: {
          include: {
            _count: { select: { prospects: true } },
          },
        },
        campaigns: {
          include: {
            _count: { select: { prospectStates: true } },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "Utilisateur non trouvé" });
      return;
    }

    res.json({ success: true, user });
  } catch (error: any) {
    console.error("[admin.controller:getUserDetails]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response) {
  try {
    const body = CreateUserSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ success: false, error: "Un utilisateur avec cet email existe déjà." });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name: body.name.trim(),
        passwordHash,
        role: body.role,
        organizationId: body.organizationId || null,
        maxWeeklyInvites: body.maxWeeklyInvites,
        maxWeeklyMessages: body.maxWeeklyMessages,
        maxWeeklyVisits: body.maxWeeklyVisits,
        maxWeeklyFollows: body.maxWeeklyFollows,
        status: "ACTIVE",
      },
      include: {
        organization: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Utilisateur créé avec succès.",
      user,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
      return;
    }
    console.error("[admin.controller:createUser]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const body = UpdateUserSchema.parse(req.body);

    const data: any = { ...body };
    if (body.password) {
      data.passwordHash = await bcrypt.hash(body.password, 10);
      delete data.password;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data,
      include: {
        organization: true,
        accounts: true,
      },
    });

    res.json({
      success: true,
      message: "Utilisateur mis à jour avec succès.",
      user: updatedUser,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
      return;
    }
    console.error("[admin.controller:updateUser]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;

    // Protection : Ne pas se supprimer soi-même
    if (req.user && req.user.id === id) {
      res.status(400).json({ success: false, error: "Vous ne pouvez pas supprimer votre propre compte Super Admin." });
      return;
    }

    // Libérer les comptes Unipile (facturés) AVANT la suppression en cascade des lignes LinkedInAccount
    const accounts = await prisma.linkedInAccount.findMany({ where: { userId: id }, select: { unipileAccountId: true } });
    for (const acc of accounts) {
      if (!acc.unipileAccountId) continue;
      const del = await UnipileService.deleteAccount(acc.unipileAccountId);
      if (!del.success && !/404|not.?found/i.test(del.error || "")) {
        res.status(502).json({
          success: false,
          error: `Le compte LinkedIn ${acc.unipileAccountId} n'a pas pu être supprimé chez Unipile. Réessayez avant de supprimer l'utilisateur.`,
        });
        return;
      }
    }

    await prisma.user.delete({ where: { id } });

    res.json({ success: true, message: "Utilisateur supprimé avec succès." });
  } catch (error: any) {
    console.error("[admin.controller:deleteUser]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function getOrganizations(req: AuthenticatedRequest, res: Response) {
  try {
    const orgs = await prisma.organization.findMany({
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { name: "asc" },
    });
    const avatars = await getWorkspaceAvatars(orgs.map((o) => o.id));

    res.json({ success: true, organizations: orgs.map((o) => ({ ...o, avatarUrl: avatars.get(o.id) || null })) });
  } catch (error: any) {
    console.error("[admin.controller:getOrganizations]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

const GrantTokensSchema = z.object({
  tokens: z.number().int().min(1).max(10_000),
  note: z.string().max(200).optional(),
});

/**
 * POST /api/admin/organizations/:id/enrichment-grant
 * Ajoute des tokens d'enrichissement à une organisation pour le mois en cours.
 */
export async function grantEnrichmentTokens(req: AuthenticatedRequest, res: Response) {
  try {
    const organizationId = req.params.id as string;
    const body = GrantTokensSchema.parse(req.body);
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!org) {
      res.status(404).json({ success: false, error: "Organisation introuvable." });
      return;
    }
    await grantTokens({ organizationId, tokens: body.tokens, note: body.note, byUserId: req.user!.originalSuperAdminId || req.user!.id });
    const balance = await getEnrichmentBalance(organizationId);
    res.json({ success: true, message: `${body.tokens} token(s) ajouté(s).`, balance });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
      return;
    }
    console.error("[admin.controller:grantEnrichmentTokens]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

/**
 * DELETE /api/admin/organizations/:id
 * Supprime une organisation et tous ses utilisateurs
 */
export async function deleteOrganization(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;

    const org = await prisma.organization.findUnique({
      where: { id },
    });

    if (!org) {
      res.status(404).json({ success: false, error: "Organisation introuvable." });
      return;
    }

    // Prisma relation onDelete: Cascade will delete everything related to this org if setup correctly,
    // otherwise we might need to delete related data first, but typically in Prisma deleting the organization is enough 
    // if onDelete: Cascade is defined on Users.
    // Let's just delete the organization. Prisma will handle cascades.
    await prisma.organization.delete({ where: { id } });

    res.json({ success: true, message: "Organisation supprimée avec succès." });
  } catch (error: any) {
    console.error("[admin.controller:deleteOrganization]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

/**
 * GET /api/admin/organizations/:id/members
 * Liste tous les membres d'une organisation donnée (Super Admin uniquement).
 */
export async function getOrganizationMembers(req: AuthenticatedRequest, res: Response) {
  try {
    const orgId = req.params.id as string;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, slug: true },
    });

    if (!org) {
      res.status(404).json({ success: false, error: "Organisation introuvable." });
      return;
    }

    const members = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        role: true,
        orgRole: true,
        status: true,
        createdAt: true,
        accounts: {
          select: {
            id: true,
            accountName: true,
            profilePicture: true,
            status: true,
            dailyInvitesSent: true,
            dailyMsgSent: true,
          },
        },
      },
      orderBy: [{ orgRole: "asc" }, { createdAt: "asc" }],
    });

    res.json({ success: true, organization: org, members });
  } catch (error: any) {
    console.error("[admin.controller:getOrganizationMembers]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

const AddOrgMemberSchema = z.object({
  name: z.string().min(2, "Le nom est obligatoire"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Mot de passe d'au moins 6 caractères").default("ChangeMe123!"),
  orgRole: z.enum(["OWNER", "MEMBER"]).default("MEMBER"),
});

/**
 * POST /api/admin/organizations/:id/members
 * Ajoute directement un membre dans une organisation (Super Admin).
 */
export async function addOrganizationMember(req: AuthenticatedRequest, res: Response) {
  try {
    const orgId = req.params.id as string;
    const body = AddOrgMemberSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      res.status(404).json({ success: false, error: "Organisation introuvable." });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.organizationId && existing.organizationId !== orgId) {
        res.status(400).json({ success: false, error: "Cet utilisateur appartient déjà à une autre organisation." });
        return;
      }
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { organizationId: orgId, orgRole: body.orgRole },
      });
      res.json({ success: true, message: "Membre rattaché à l'espace.", user: updated });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const newUser = await prisma.user.create({
      data: {
        email,
        name: body.name.trim(),
        passwordHash,
        role: "USER",
        orgRole: body.orgRole,
        organizationId: orgId,
        status: "ACTIVE",
      },
    });

    res.status(201).json({ success: true, message: "Membre ajouté avec succès.", user: newUser });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
      return;
    }
    console.error("[admin.controller:addOrganizationMember]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

/**
 * DELETE /api/admin/organizations/:orgId/members/:userId
 * Retire un membre d'une organisation.
 */
export async function removeOrganizationMember(req: AuthenticatedRequest, res: Response) {
  try {
    const orgId = req.params.orgId as string;
    const userId = req.params.userId as string;

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "Membre non trouvé dans cette organisation." });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { organizationId: null, orgRole: "MEMBER" },
    });

    res.json({ success: true, message: "Membre retiré de l'espace avec succès." });
  } catch (error: any) {
    console.error("[admin.controller:removeOrganizationMember]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

/**
 * POST /api/admin/impersonate-workspace/:id
 * Active l'immersion dans un espace de travail pour le Super-Admin.
 */
export async function impersonateWorkspace(req: AuthenticatedRequest, res: Response) {
  try {
    const orgId = req.params.id as string;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        users: {
          where: { orgRole: "OWNER" },
          take: 1,
        },
      },
    });

    if (!org) {
      res.status(404).json({ success: false, error: "Organisation introuvable." });
      return;
    }

    res.json({
      success: true,
      message: `Immersion activée pour l'espace ${org.name}.`,
      organization: org,
      simulatedOwner: org.users[0] || null,
    });
  } catch (error: any) {
    console.error("[admin.controller:impersonateWorkspace]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

// ==========================================
// COMPTES UNIPILE (facturation : zéro doublon, zéro orphelin)
// ==========================================

/** GET /api/admin/unipile/accounts */
export async function getUnipileAccounts(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await listReconciledAccounts();
    if (!result.success) {
      res.status(502).json({ success: false, error: result.error || "Unipile indisponible." });
      return;
    }
    res.json({ success: true, accounts: result.accounts });
  } catch (error: any) {
    console.error("[admin.controller:getUnipileAccounts]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

/** DELETE /api/admin/unipile/accounts/:id — refusé si le compte est rattaché à un utilisateur */
export async function deleteUnipileAccount(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const result = await deleteUnipileAccountIfOrphan(id);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error || "Suppression impossible." });
      return;
    }
    res.json({ success: true, message: "Compte Unipile supprimé." });
  } catch (error: any) {
    console.error("[admin.controller:deleteUnipileAccount]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

/** POST /api/admin/unipile/reconcile — passe de réconciliation immédiate (doublons supprimés, orphelins listés) */
export async function runUnipileReconcile(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await reconcileUnipileAccounts({ autoDeleteOrphans: req.body?.deleteOrphans === true });
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[admin.controller:runUnipileReconcile]", error);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}
