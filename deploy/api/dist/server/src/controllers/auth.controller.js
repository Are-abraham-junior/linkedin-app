import { prisma } from "../../../lib/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { generateToken } from "../middlewares/auth.middleware.js";
import { UnipileService } from "../services/unipile.service.js";
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
export async function register(req, res) {
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
        const primaryAccount = user.accounts.find((a) => a.status === "CONNECTED") || user.accounts[0] || null;
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
        const actualUserId = req.user.originalSuperAdminId || req.user.id;
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
        const primaryAccount = user.accounts.find((a) => a.status === "CONNECTED") || user.accounts[0];
        if (primaryAccount && primaryAccount.status === "CONNECTED" && primaryAccount.unipileAccountId && (!user.avatarUrl || !primaryAccount.profilePicture)) {
            try {
                const profileResult = await UnipileService.getConnectedAccountProfile(primaryAccount.unipileAccountId);
                if (profileResult.success && profileResult.profile) {
                    const p = profileResult.profile;
                    const userUpdates = {};
                    if (p.avatarUrl)
                        userUpdates.avatarUrl = p.avatarUrl;
                    if (p.name && (!user.name || user.name === user.email.split("@")[0]))
                        userUpdates.name = p.name;
                    if (p.linkedinProfileId)
                        userUpdates.linkedinProfileId = p.linkedinProfileId;
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
                        },
                    });
                }
            }
            catch (err) {
                console.error("Failed to auto-sync LinkedIn profile in getMe:", err);
            }
        }
        let userOrg = user.organization;
        let linkedAcc = user.accounts.find((a) => a.status === "CONNECTED") || user.accounts[0] || null;
        if (req.user?.organizationId && req.user?.isImpersonating) {
            const org = await prisma.organization.findUnique({
                where: { id: req.user.organizationId },
            });
            if (org)
                userOrg = org;
            if (req.user.ownerId) {
                const ownerAcc = await prisma.linkedInAccount.findFirst({
                    where: { userId: req.user.ownerId, status: "CONNECTED" },
                });
                linkedAcc = ownerAcc || null;
            }
        }
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
                role: req.user.originalSuperAdminId ? "SUPER_ADMIN" : user.role,
                orgRole: user.orgRole,
                status: user.status,
                organization: userOrg,
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
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
export async function linkedinAuth(req, res) {
    try {
        const body = LinkedInAuthSchema.parse(req.body);
        // 1. Connecter le compte LinkedIn via Unipile
        const connectResult = await UnipileService.connectLinkedInAccount(body.linkedinEmail, body.linkedinPassword);
        if (!connectResult.success) {
            if (connectResult.status === "CHECKPOINT") {
                res.status(202).json({
                    success: false,
                    status: "CHECKPOINT",
                    message: "LinkedIn demande une vérification supplémentaire (2FA ou CAPTCHA). Veuillez valider sur LinkedIn puis réessayer.",
                    checkpoint: connectResult.checkpoint,
                });
                return;
            }
            res.status(401).json({
                success: false,
                error: connectResult.error || "Identifiants LinkedIn incorrects.",
            });
            return;
        }
        // 2. Récupérer le profil LinkedIn
        const profileResult = await UnipileService.getConnectedAccountProfile(connectResult.accountId);
        const profile = profileResult.profile;
        // Détecter si l'appelant est déjà authentifié (ex: Onboarding après inscription)
        let authenticatedUserId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            try {
                const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET || "bime-link-super-secret-jwt-key-2026");
                if (decoded?.id)
                    authenticatedUserId = decoded.id;
            }
            catch { }
        }
        // 3. Chercher l'utilisateur : soit l'utilisateur connecté, soit par linkedinEmail/email
        let user = null;
        if (authenticatedUserId) {
            user = await prisma.user.findUnique({
                where: { id: authenticatedUserId },
                include: {
                    organization: true,
                    accounts: { select: { id: true, accountName: true, status: true, unipileAccountId: true } },
                },
            });
        }
        if (!user) {
            user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { linkedinEmail: body.linkedinEmail },
                        { email: body.linkedinEmail },
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
            if (!user.linkedinEmail || user.linkedinEmail !== body.linkedinEmail) {
                const existingHolder = await prisma.user.findFirst({
                    where: {
                        linkedinEmail: body.linkedinEmail,
                        id: { not: user.id },
                    },
                    include: { organization: true },
                });
                if (existingHolder) {
                    res.status(400).json({
                        success: false,
                        error: `Ce compte LinkedIn (${body.linkedinEmail}) est déjà associé à l'espace "${existingHolder.organization?.name || existingHolder.email}". Chaque compte LinkedIn doit avoir son propre espace dédié.`,
                    });
                    return;
                }
            }
            const updateData = {};
            if (profile?.avatarUrl)
                updateData.avatarUrl = profile.avatarUrl;
            if (profile?.name)
                updateData.name = profile.name;
            if (!user.linkedinEmail)
                updateData.linkedinEmail = body.linkedinEmail;
            if (profile?.linkedinProfileId && !user.linkedinProfileId)
                updateData.linkedinProfileId = profile.linkedinProfileId;
            // Si l'utilisateur existant n'a pas encore d'organisation, on lui en crée une
            if (!user.organizationId) {
                const slug = `org-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                const org = await prisma.organization.create({
                    data: {
                        name: `${profile?.name || user.name || body.linkedinEmail}'s workspace`,
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
            }
            catch (dbErr) {
                if (dbErr.code === "P2002") {
                    res.status(400).json({
                        success: false,
                        error: `Ce compte LinkedIn est déjà rattaché à un autre espace. Chaque compte a son propre espace dédié.`,
                    });
                    return;
                }
                throw dbErr;
            }
            // Nettoyer les anciennes sessions Unipile de cet utilisateur pour éviter les comptes fantômes et la surfacturation
            const oldAccounts = await prisma.linkedInAccount.findMany({
                where: { userId: user.id },
            });
            for (const oldAcc of oldAccounts) {
                if (oldAcc.unipileAccountId && oldAcc.unipileAccountId !== connectResult.accountId) {
                    console.log(`[Reconnexion] Nettoyage ancien compte Unipile ${oldAcc.unipileAccountId}...`);
                    UnipileService.deleteAccount(oldAcc.unipileAccountId).catch((err) => console.warn(`[Reconnexion] Échec suppression Unipile ${oldAcc.unipileAccountId}:`, err.message));
                }
            }
            await prisma.linkedInAccount.deleteMany({
                where: {
                    userId: user.id,
                    unipileAccountId: { not: connectResult.accountId },
                },
            });
            // Mise à jour ou création du LinkedInAccount actif
            await prisma.linkedInAccount.upsert({
                where: { unipileAccountId: connectResult.accountId },
                create: {
                    userId: user.id,
                    unipileAccountId: connectResult.accountId,
                    accountName: profile?.name,
                    profilePicture: profile?.avatarUrl,
                    headline: profile?.headline,
                    status: "CONNECTED",
                },
                update: {
                    userId: user.id,
                    accountName: profile?.name,
                    profilePicture: profile?.avatarUrl,
                    headline: profile?.headline,
                    status: "CONNECTED",
                },
            });
        }
        else {
            // --- INSCRIPTION : création du compte ---
            const slug = `org-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const org = await prisma.organization.create({
                data: {
                    name: `${profile?.name || body.linkedinEmail}'s workspace`,
                    slug,
                    plan: "ENTERPRISE",
                },
            });
            user = await prisma.user.create({
                data: {
                    email: body.linkedinEmail,
                    linkedinEmail: body.linkedinEmail,
                    linkedinProfileId: profile?.linkedinProfileId,
                    name: profile?.name || body.linkedinEmail.split("@")[0],
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
            await prisma.linkedInAccount.create({
                data: {
                    userId: user.id,
                    unipileAccountId: connectResult.accountId,
                    accountName: profile?.name,
                    profilePicture: profile?.avatarUrl,
                    headline: profile?.headline,
                    status: "CONNECTED",
                },
            });
        }
        // 4. Générer le JWT
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
                orgRole: user.orgRole,
                status: user.status,
                organization: user.organization,
                maxDailyInvites: user.maxDailyInvites,
                maxDailyMsg: user.maxDailyMsg,
                linkedInAccount: user.accounts?.[0] || null,
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
const AcceptInvitationSchema = z.object({
    token: z.string().min(1, "Token requis"),
    linkedinEmail: z.string().email("Email LinkedIn invalide"),
    linkedinPassword: z.string().min(1, "Mot de passe LinkedIn requis"),
});
/**
 * POST /api/auth/join
 * Un membre accepte une invitation et connecte son LinkedIn.
 */
export async function acceptInvitation(req, res) {
    try {
        const body = AcceptInvitationSchema.parse(req.body);
        // 1. Valider l'invitation
        const invitation = await prisma.teamInvitation.findUnique({
            where: { token: body.token },
            include: { organization: true, invitedBy: { select: { name: true } } },
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
        // 2. Connecter LinkedIn via Unipile
        const connectResult = await UnipileService.connectLinkedInAccount(body.linkedinEmail, body.linkedinPassword);
        if (!connectResult.success) {
            if (connectResult.status === "CHECKPOINT") {
                res.status(202).json({
                    success: false,
                    status: "CHECKPOINT",
                    message: "LinkedIn demande une vérification supplémentaire. Validez sur LinkedIn puis réessayez.",
                });
                return;
            }
            res.status(401).json({ success: false, error: connectResult.error || "Identifiants LinkedIn incorrects." });
            return;
        }
        const profileResult = await UnipileService.getConnectedAccountProfile(connectResult.accountId);
        const profile = profileResult.profile;
        // 3. Vérifier si l'utilisateur existe déjà (peut-être il a déjà un compte owner)
        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { linkedinEmail: body.linkedinEmail },
                    { email: body.linkedinEmail },
                ],
            },
            include: { organization: true, accounts: true },
        });
        if (user && user.organizationId !== invitation.organizationId) {
            // L'utilisateur appartient déjà à une autre org → refus
            res.status(409).json({
                success: false,
                error: "Ce compte LinkedIn est déjà associé à un autre espace de travail.",
            });
            return;
        }
        if (!user) {
            // Créer le nouveau membre
            user = await prisma.user.create({
                data: {
                    email: body.linkedinEmail,
                    linkedinEmail: body.linkedinEmail,
                    linkedinProfileId: profile?.linkedinProfileId,
                    name: profile?.name || body.linkedinEmail.split("@")[0],
                    avatarUrl: profile?.avatarUrl,
                    role: "USER",
                    orgRole: "MEMBER",
                    status: "ACTIVE",
                    organizationId: invitation.organizationId,
                    maxDailyInvites: 30,
                    maxDailyMsg: 70,
                },
                include: { organization: true, accounts: true },
            });
        }
        else {
            // Mise à jour si déjà dans la même org
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    name: profile?.name || user.name,
                    avatarUrl: profile?.avatarUrl || user.avatarUrl,
                    status: "ACTIVE",
                    organizationId: invitation.organizationId,
                    orgRole: "MEMBER",
                },
                include: { organization: true, accounts: true },
            });
        }
        // Nettoyer les anciennes sessions Unipile de cet utilisateur s'il en avait
        const oldInviteAccounts = await prisma.linkedInAccount.findMany({
            where: { userId: user.id },
        });
        for (const oldAcc of oldInviteAccounts) {
            if (oldAcc.unipileAccountId && oldAcc.unipileAccountId !== connectResult.accountId) {
                UnipileService.deleteAccount(oldAcc.unipileAccountId).catch((err) => console.warn(`[Reconnexion Invite] Échec suppression Unipile ${oldAcc.unipileAccountId}:`, err.message));
            }
        }
        await prisma.linkedInAccount.deleteMany({
            where: {
                userId: user.id,
                unipileAccountId: { not: connectResult.accountId },
            },
        });
        // 4. Créer/màj le LinkedInAccount
        await prisma.linkedInAccount.upsert({
            where: { unipileAccountId: connectResult.accountId },
            create: {
                userId: user.id,
                unipileAccountId: connectResult.accountId,
                accountName: profile?.name,
                profilePicture: profile?.avatarUrl,
                headline: profile?.headline,
                status: "CONNECTED",
            },
            update: {
                userId: user.id,
                accountName: profile?.name,
                profilePicture: profile?.avatarUrl,
                headline: profile?.headline,
                status: "CONNECTED",
            },
        });
        // 5. Marquer l'invitation comme acceptée
        await prisma.teamInvitation.update({
            where: { id: invitation.id },
            data: { status: "ACCEPTED" },
        });
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
                orgRole: user.orgRole,
                status: user.status,
                organization: user.organization,
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
