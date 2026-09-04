import { prisma } from "../../../lib/prisma.js";
import { z } from "zod";
const UpdateScheduleSchema = z.object({
    workingDays: z.array(z.string()).min(1, "Sélectionnez au moins un jour de travail"),
    workingHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format HH:mm invalide (ex: 08:00)"),
    workingHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format HH:mm invalide (ex: 19:00)"),
    timezone: z.string().default("Africa/Abidjan"),
    maxDailyInvites: z.number().int().min(1).max(100).optional(),
    maxDailyMsg: z.number().int().min(1).max(150).optional(),
});
const BatchRescheduleSchema = z.object({
    ids: z.array(z.string()).min(1, "Aucune action sélectionnée"),
    mode: z.enum(["hours", "tomorrow_morning", "custom"]),
    hours: z.number().optional(),
    customDate: z.string().optional(),
});
/**
 * Récupère la liste des actions de la file d'attente pour l'utilisateur connecté,
 * avec filtres, pagination et quotas journaliers en temps réel.
 */
export async function getQueue(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Non authentifié" });
            return;
        }
        const userId = req.user.id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const campaignId = req.query.campaignId || undefined;
        const actionType = req.query.actionType || undefined;
        const statusParam = req.query.status || "QUEUED";
        const search = (req.query.search || "").trim().toLowerCase();
        // 1. Récupérer les comptes et préférences utilisateur
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                accounts: true,
            },
        });
        if (!user) {
            res.status(404).json({ success: false, error: "Utilisateur introuvable" });
            return;
        }
        const accountIds = user.accounts.map((a) => a.id);
        const primaryAccount = user.accounts[0];
        // 2. Construire les conditions de filtre
        const where = {
            accountId: { in: accountIds },
        };
        if (statusParam !== "ALL") {
            where.status = statusParam;
        }
        if (campaignId && campaignId !== "ALL") {
            where.campaignId = campaignId;
        }
        if (actionType && actionType !== "ALL") {
            where.actionType = actionType;
        }
        if (search) {
            where.OR = [
                {
                    prospect: {
                        OR: [
                            { firstName: { contains: search, mode: "insensitive" } },
                            { lastName: { contains: search, mode: "insensitive" } },
                            { company: { contains: search, mode: "insensitive" } },
                            { headline: { contains: search, mode: "insensitive" } },
                        ],
                    },
                },
                {
                    campaign: {
                        name: { contains: search, mode: "insensitive" },
                    },
                },
            ];
        }
        // 3. Exécuter les requêtes en parallèle pour la performance
        const [totalCount, items, activeCampaignsCount] = await Promise.all([
            prisma.actionQueue.count({ where }),
            prisma.actionQueue.findMany({
                where,
                include: {
                    prospect: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            headline: true,
                            company: true,
                            avatarUrl: true,
                            linkedinUrl: true,
                            connectionStatus: true,
                        },
                    },
                    campaign: {
                        select: {
                            id: true,
                            name: true,
                            status: true,
                            type: true,
                        },
                    },
                },
                orderBy: { scheduledFor: "asc" },
                skip,
                take: limit,
            }),
            prisma.campaign.count({
                where: {
                    userId,
                    status: "ACTIVE",
                },
            }),
        ]);
        // 4. Calculer les quotas réels
        const dailyInvitesSent = primaryAccount?.dailyInvitesSent || 0;
        const dailyMsgSent = primaryAccount?.dailyMsgSent || 0;
        const maxDailyInvites = user.maxDailyInvites || 30;
        const maxDailyMsg = user.maxDailyMsg || 70;
        const quotas = {
            invitations: {
                sent: dailyInvitesSent,
                max: maxDailyInvites,
                remaining: Math.max(0, maxDailyInvites - dailyInvitesSent),
            },
            messages: {
                sent: dailyMsgSent,
                max: maxDailyMsg,
                remaining: Math.max(0, maxDailyMsg - dailyMsgSent),
            },
            profileVisits: {
                sent: 0,
                max: 120,
                remaining: 120,
            },
            profileFollows: {
                sent: 0,
                max: 80,
                remaining: 80,
            },
        };
        // 5. Total des actions en attente par plateforme
        const totalQueuedLinkedIn = await prisma.actionQueue.count({
            where: {
                accountId: { in: accountIds },
                status: "QUEUED",
            },
        });
        res.json({
            success: true,
            data: {
                items,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit) || 1,
                },
                stats: {
                    totalQueuedLinkedIn,
                    totalQueuedEmail: 0,
                    isQueueActive: activeCampaignsCount > 0,
                    quotas,
                },
            },
        });
    }
    catch (error) {
        console.error("[QueueController] Erreur getQueue:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * Supprime une action unique de la file d'attente
 */
export async function deleteQueueItem(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Non authentifié" });
            return;
        }
        const id = req.params.id;
        const action = await prisma.actionQueue.findUnique({
            where: { id },
            include: {
                campaign: true,
            },
        });
        if (!action || action.campaign.userId !== req.user.id) {
            res.status(404).json({ success: false, error: "Action introuvable ou non autorisée" });
            return;
        }
        await prisma.actionQueue.delete({
            where: { id },
        });
        // Mettre à jour l'état de la campagne du prospect si nécessaire
        await prisma.prospectCampaignState.updateMany({
            where: {
                campaignId: action.campaignId,
                prospectId: action.prospectId,
                status: { in: ["PENDING", "WAITING_DELAY"] },
            },
            data: {
                status: "FAILED",
                errorLog: "Action annulée manuellement par l'utilisateur",
            },
        });
        res.json({ success: true, message: "Action supprimée de la file d'attente" });
    }
    catch (error) {
        console.error("[QueueController] Erreur deleteQueueItem:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * Réessaye une action échouée en la remettant en statut QUEUED pour exécution immédiate
 */
export async function retryQueueItem(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Non authentifié" });
            return;
        }
        const id = req.params.id;
        const action = await prisma.actionQueue.findUnique({
            where: { id },
            include: {
                campaign: true,
            },
        });
        if (!action || action.campaign.userId !== req.user.id) {
            res.status(404).json({ success: false, error: "Action introuvable ou non autorisée" });
            return;
        }
        await prisma.actionQueue.update({
            where: { id },
            data: {
                status: "QUEUED",
                scheduledFor: new Date(),
                errorMessage: null,
            },
        });
        await prisma.prospectCampaignState.updateMany({
            where: {
                campaignId: action.campaignId,
                prospectId: action.prospectId,
            },
            data: {
                status: "PENDING",
                errorLog: null,
            },
        });
        res.json({ success: true, message: "Action remise en file d'attente pour exécution immédiate" });
    }
    catch (error) {
        console.error("[QueueController] Erreur retryQueueItem:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * Suppression groupée d'actions de la file d'attente
 */
export async function batchDeleteQueueItems(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Non authentifié" });
            return;
        }
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ success: false, error: "Liste d'identifiants requise" });
            return;
        }
        // Vérifier les comptes de l'utilisateur
        const userAccounts = await prisma.linkedInAccount.findMany({
            where: { userId: req.user.id },
            select: { id: true },
        });
        const accountIds = userAccounts.map((a) => a.id);
        const deleted = await prisma.actionQueue.deleteMany({
            where: {
                id: { in: ids },
                accountId: { in: accountIds },
            },
        });
        res.json({
            success: true,
            message: `${deleted.count} action(s) supprimée(s) de la file d'attente`,
            deletedCount: deleted.count,
        });
    }
    catch (error) {
        console.error("[QueueController] Erreur batchDeleteQueueItems:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * Décalage / report groupé des actions de la file d'attente
 */
export async function batchRescheduleQueueItems(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Non authentifié" });
            return;
        }
        const parsed = BatchRescheduleSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
            return;
        }
        const { ids, mode, hours, customDate } = parsed.data;
        // Calculer la nouvelle date de base
        let baseDate = new Date();
        if (mode === "hours") {
            const h = hours || 2;
            baseDate = new Date(Date.now() + h * 3600 * 1000);
        }
        else if (mode === "tomorrow_morning") {
            baseDate = new Date();
            baseDate.setDate(baseDate.getDate() + 1);
            baseDate.setHours(9, 0, 0, 0);
        }
        else if (mode === "custom" && customDate) {
            baseDate = new Date(customDate);
        }
        // Vérifier les comptes autorisés
        const userAccounts = await prisma.linkedInAccount.findMany({
            where: { userId: req.user.id },
            select: { id: true },
        });
        const accountIds = userAccounts.map((a) => a.id);
        // Mettre à jour chaque action en échelonnant les délais (90s entre chaque)
        const updates = ids.map((id, index) => {
            const scheduledFor = new Date(baseDate.getTime() + index * 90 * 1000);
            return prisma.actionQueue.updateMany({
                where: {
                    id,
                    accountId: { in: accountIds },
                },
                data: {
                    scheduledFor,
                    status: "QUEUED",
                    errorMessage: null,
                },
            });
        });
        await prisma.$transaction(updates);
        res.json({
            success: true,
            message: `${ids.length} action(s) reprogrammée(s) avec succès`,
            newScheduledDate: baseDate,
        });
    }
    catch (error) {
        console.error("[QueueController] Erreur batchRescheduleQueueItems:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * Récupère les paramètres de planning et quotas de l'utilisateur
 */
export async function getScheduleSettings(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Non authentifié" });
            return;
        }
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                workingDays: true,
                workingHoursStart: true,
                workingHoursEnd: true,
                timezone: true,
                maxDailyInvites: true,
                maxDailyMsg: true,
            },
        });
        if (!user) {
            res.status(404).json({ success: false, error: "Utilisateur introuvable" });
            return;
        }
        res.json({
            success: true,
            schedule: {
                workingDays: user.workingDays?.length ? user.workingDays : ["MON", "TUE", "WED", "THU", "FRI"],
                workingHoursStart: user.workingHoursStart || "08:00",
                workingHoursEnd: user.workingHoursEnd || "19:00",
                timezone: user.timezone || "Africa/Abidjan",
                maxDailyInvites: user.maxDailyInvites || 30,
                maxDailyMsg: user.maxDailyMsg || 70,
            },
        });
    }
    catch (error) {
        console.error("[QueueController] Erreur getScheduleSettings:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * Met à jour les paramètres de planning et quotas de l'utilisateur
 */
export async function updateScheduleSettings(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Non authentifié" });
            return;
        }
        const parsed = UpdateScheduleSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
            return;
        }
        const { workingDays, workingHoursStart, workingHoursEnd, timezone, maxDailyInvites, maxDailyMsg } = parsed.data;
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                workingDays,
                workingHoursStart,
                workingHoursEnd,
                timezone,
                ...(maxDailyInvites !== undefined ? { maxDailyInvites } : {}),
                ...(maxDailyMsg !== undefined ? { maxDailyMsg } : {}),
            },
        });
        res.json({
            success: true,
            message: "Horaires d'activité et quotas mis à jour avec succès",
            schedule: {
                workingDays: updatedUser.workingDays,
                workingHoursStart: updatedUser.workingHoursStart,
                workingHoursEnd: updatedUser.workingHoursEnd,
                timezone: updatedUser.timezone,
                maxDailyInvites: updatedUser.maxDailyInvites,
                maxDailyMsg: updatedUser.maxDailyMsg,
            },
        });
    }
    catch (error) {
        console.error("[QueueController] Erreur updateScheduleSettings:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
