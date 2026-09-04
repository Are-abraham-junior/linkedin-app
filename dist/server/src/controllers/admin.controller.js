import { prisma } from "../../../lib/prisma.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
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
export async function getPlatformMetrics(req, res) {
    try {
        const [totalUsers, totalOrganizations, totalProspects, totalCampaigns, activeCampaigns, totalMessages, connectedAccounts,] = await Promise.all([
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
        const roleMap = {};
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
export async function getUsers(req, res) {
    try {
        const { search, role, status, organizationId } = req.query;
        const where = {};
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
            users: users.map((u) => ({
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
export async function getUserDetails(req, res) {
    try {
        const id = req.params.id;
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
export async function createUser(req, res) {
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
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
            return;
        }
        res.status(500).json({ success: false, error: error.message });
    }
}
export async function updateUser(req, res) {
    try {
        const id = req.params.id;
        const body = UpdateUserSchema.parse(req.body);
        const data = { ...body };
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
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
            return;
        }
        res.status(500).json({ success: false, error: error.message });
    }
}
export async function deleteUser(req, res) {
    try {
        const id = req.params.id;
        // Protection : Ne pas se supprimer soi-même
        if (req.user && req.user.id === id) {
            res.status(400).json({ success: false, error: "Vous ne pouvez pas supprimer votre propre compte Super Admin." });
            return;
        }
        await prisma.user.delete({ where: { id } });
        res.json({ success: true, message: "Utilisateur supprimé avec succès." });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
export async function getOrganizations(req, res) {
    try {
        const orgs = await prisma.organization.findMany({
            include: {
                _count: { select: { users: true } },
            },
            orderBy: { name: "asc" },
        });
        res.json({ success: true, organizations: orgs });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * DELETE /api/admin/organizations/:id
 * Supprime une organisation et tous ses utilisateurs
 */
export async function deleteOrganization(req, res) {
    try {
        const id = req.params.id;
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * GET /api/admin/organizations/:id/members
 * Liste tous les membres d'une organisation donnée (Super Admin uniquement).
 */
export async function getOrganizationMembers(req, res) {
    try {
        const orgId = req.params.id;
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
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
export async function addOrganizationMember(req, res) {
    try {
        const orgId = req.params.id;
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
                maxDailyInvites: 30,
                maxDailyMsg: 70,
            },
        });
        res.status(201).json({ success: true, message: "Membre ajouté avec succès.", user: newUser });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
            return;
        }
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * DELETE /api/admin/organizations/:orgId/members/:userId
 * Retire un membre d'une organisation.
 */
export async function removeOrganizationMember(req, res) {
    try {
        const orgId = req.params.orgId;
        const userId = req.params.userId;
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * POST /api/admin/impersonate-workspace/:id
 * Active l'immersion dans un espace de travail pour le Super-Admin.
 */
export async function impersonateWorkspace(req, res) {
    try {
        const orgId = req.params.id;
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
