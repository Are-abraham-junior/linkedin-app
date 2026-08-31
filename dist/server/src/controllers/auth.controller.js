import { prisma } from "../../../lib/prisma.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { generateToken } from "../middlewares/auth.middleware.js";
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
let cachedSetupCompleted = true;
export async function getSetupStatus(req, res) {
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
    }
    catch (error) {
        res.json({
            success: true,
            setupCompleted: true,
        });
    }
}
export async function setupSuperAdmin(req, res) {
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
                name: body.organizationName || "Bime Link Technologies",
                slug: "bime-link-main",
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
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
            return;
        }
        res.status(500).json({ success: false, error: error.message });
    }
}
export async function login(req, res) {
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
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                role: user.role,
                status: user.status,
                organization: user.organization,
                maxDailyInvites: user.maxDailyInvites,
                maxDailyMsg: user.maxDailyMsg,
                linkedInAccount: user.accounts[0] || null,
            },
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
export async function getMe(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Non authentifié" });
            return;
        }
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
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
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                role: user.role,
                status: user.status,
                organization: user.organization,
                maxDailyInvites: user.maxDailyInvites,
                maxDailyMsg: user.maxDailyMsg,
                linkedInAccount: user.accounts[0] || null,
                stats: {
                    listsCount: user._count.prospectLists,
                    campaignsCount: user._count.campaigns,
                },
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
