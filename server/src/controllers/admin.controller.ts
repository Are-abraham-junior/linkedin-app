import { Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

const CreateUserSchema = z.object({
  name: z.string().min(2, "Le nom est obligatoire"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Mot de passe d'au moins 6 caractères"),
  role: z.enum(["SUPER_ADMIN", "USER"]).default("USER"),
  organizationId: z.string().optional(),
  maxDailyInvites: z.number().min(5).max(100).default(30),
  maxDailyMsg: z.number().min(10).max(200).default(70),
});

const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["SUPER_ADMIN", "USER"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "PENDING_INVITE"]).optional(),
  organizationId: z.string().nullable().optional(),
  maxDailyInvites: z.number().min(5).max(100).optional(),
  maxDailyMsg: z.number().min(10).max(200).optional(),
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
    res.status(500).json({ success: false, error: error.message });
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
        maxDailyInvites: u.maxDailyInvites,
        maxDailyMsg: u.maxDailyMsg,
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
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getUserDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

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
    res.status(500).json({ success: false, error: error.message });
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
        maxDailyInvites: body.maxDailyInvites,
        maxDailyMsg: body.maxDailyMsg,
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
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
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
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Protection : Ne pas se supprimer soi-même
    if (req.user && req.user.id === id) {
      res.status(400).json({ success: false, error: "Vous ne pouvez pas supprimer votre propre compte Super Admin." });
      return;
    }

    await prisma.user.delete({ where: { id } });

    res.json({ success: true, message: "Utilisateur supprimé avec succès." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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

    res.json({ success: true, organizations: orgs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
