import { prisma } from "../../../lib/prisma.js";
import { z } from "zod";
const CreateCampaignSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Le nom de la campagne est requis"),
    type: z.string().default("INVITATION_AND_MESSAGES"),
    listIds: z.array(z.string()).default([]),
    steps: z.array(z.object({
        stepOrder: z.number(),
        actionType: z.preprocess((val) => (val === "VISIT" ? "VISIT_PROFILE" : val), z.enum(["INVITATION", "MESSAGE", "VISIT_PROFILE", "FOLLOW", "DELAY"])),
        delayDays: z.number().default(0),
        messageText: z.string().optional().nullable(),
    })).min(1, "La campagne doit contenir au moins une étape"),
    startImmediately: z.boolean().default(false),
});
const UpdateCampaignSchema = z.object({
    name: z.string().min(1).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
    steps: z.array(z.object({
        id: z.string().optional(),
        stepOrder: z.number(),
        actionType: z.preprocess((val) => (val === "VISIT" ? "VISIT_PROFILE" : val), z.enum(["INVITATION", "MESSAGE", "VISIT_PROFILE", "FOLLOW", "DELAY"])),
        delayDays: z.number().default(0),
        messageText: z.string().optional().nullable(),
    })).optional(),
});
/**
 * Récupère toutes les campagnes de l'utilisateur avec statistiques consolidées
 */
export async function getCampaigns(req, res) {
    try {
        const userId = req.user.id;
        const campaigns = await prisma.campaign.findMany({
            where: { userId },
            include: {
                steps: { orderBy: { stepOrder: "asc" } },
                prospectStates: {
                    select: { status: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        const formatted = campaigns.map((c) => {
            const states = c.prospectStates || [];
            const total = states.length;
            const accepted = states.filter((s) => ["IN_PROGRESS", "WAITING_DELAY", "REPLIED", "COMPLETED"].includes(s.status)).length;
            const replied = states.filter((s) => s.status === "REPLIED").length;
            const completed = states.filter((s) => s.status === "COMPLETED").length;
            return {
                id: c.id,
                name: c.name,
                status: c.status,
                type: c.type,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                stepsCount: c.steps.length,
                steps: c.steps,
                stats: {
                    totalProspects: total,
                    acceptedCount: accepted,
                    repliedCount: replied,
                    completedCount: completed,
                    acceptanceRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
                    replyRate: accepted > 0 ? Math.round((replied / accepted) * 100) : 0,
                },
            };
        });
        res.json({ success: true, campaigns: formatted });
    }
    catch (error) {
        console.error("Error getCampaigns:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * Récupère les détails complets d'une campagne avec son funnel de conversion
 */
export async function getCampaignDetails(req, res) {
    try {
        const id = req.params.id;
        const userId = req.user.id;
        const campaign = await prisma.campaign.findFirst({
            where: { id, userId },
            include: {
                steps: {
                    orderBy: { stepOrder: "asc" },
                },
                prospectStates: {
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
                        currentStep: true,
                    },
                    orderBy: { updatedAt: "desc" },
                },
            },
        });
        if (!campaign) {
            res.status(404).json({ success: false, error: "Campagne introuvable." });
            return;
        }
        const campData = campaign;
        const prospectStatesList = campData.prospectStates || [];
        const stepsList = campData.steps || [];
        const total = prospectStatesList.length;
        const waitingCondition = prospectStatesList.filter((p) => p.status === "WAITING_CONDITION" || p.status === "PENDING").length;
        const waitingDelay = prospectStatesList.filter((p) => p.status === "WAITING_DELAY").length;
        const replied = prospectStatesList.filter((p) => p.status === "REPLIED").length;
        const completed = prospectStatesList.filter((p) => p.status === "COMPLETED").length;
        const failed = prospectStatesList.filter((p) => p.status === "FAILED").length;
        const accepted = prospectStatesList.filter((p) => ["IN_PROGRESS", "WAITING_DELAY", "REPLIED", "COMPLETED"].includes(p.status)).length;
        res.json({
            success: true,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                type: campaign.type,
                createdAt: campaign.createdAt,
                updatedAt: campaign.updatedAt,
                steps: stepsList,
                stats: {
                    total,
                    accepted,
                    waitingCondition,
                    waitingDelay,
                    replied,
                    completed,
                    failed,
                    acceptanceRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
                    replyRate: accepted > 0 ? Math.round((replied / accepted) * 100) : 0,
                },
                prospects: prospectStatesList.map((ps) => ({
                    id: ps.prospect?.id,
                    stateId: ps.id,
                    firstName: ps.prospect?.firstName,
                    lastName: ps.prospect?.lastName,
                    headline: ps.prospect?.headline,
                    company: ps.prospect?.company,
                    avatarUrl: ps.prospect?.avatarUrl,
                    linkedinUrl: ps.prospect?.linkedinUrl,
                    connectionStatus: ps.prospect?.connectionStatus,
                    currentStepOrder: ps.currentStep?.stepOrder || 1,
                    currentStepType: ps.currentStep?.actionType || "INVITATION",
                    status: ps.status,
                    nextExecutionAt: ps.nextExecutionAt,
                    lastActionAt: ps.lastActionAt,
                    errorLog: ps.errorLog,
                })),
            },
        });
    }
    catch (error) {
        console.error("Error getCampaignDetails:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * Création ou Enregistrement (Brouillon / Lancement) d'une campagne
 */
export async function createCampaign(req, res) {
    try {
        const userId = req.user.id;
        const body = CreateCampaignSchema.parse(req.body);
        if (body.startImmediately && (!body.listIds || body.listIds.length === 0)) {
            res.status(400).json({
                success: false,
                error: "Veuillez sélectionner au moins une liste de prospects avant de lancer la campagne.",
            });
            return;
        }
        // Récupérer le compte LinkedIn de l'utilisateur ou le compte par défaut
        const account = await prisma.linkedInAccount.findFirst({
            where: { userId },
        });
        const campaignStatus = body.startImmediately ? "ACTIVE" : "DRAFT";
        let campaign;
        if (body.id) {
            // Mise à jour d'un brouillon existant
            const existing = await prisma.campaign.findFirst({
                where: { id: body.id, userId },
            });
            if (existing) {
                // Supprimer les anciennes étapes pour réécrire la configuration propre
                await prisma.campaignStep.deleteMany({
                    where: { campaignId: existing.id },
                });
                campaign = await prisma.campaign.update({
                    where: { id: existing.id },
                    data: {
                        name: body.name.trim(),
                        type: body.type,
                        status: campaignStatus,
                        steps: {
                            create: body.steps.map((step) => ({
                                stepOrder: step.stepOrder,
                                actionType: step.actionType,
                                delayDays: step.delayDays,
                                messageText: step.messageText?.trim() || null,
                            })),
                        },
                    },
                    include: {
                        steps: { orderBy: { stepOrder: "asc" } },
                    },
                });
            }
        }
        if (!campaign) {
            // Nouvelle création
            campaign = await prisma.campaign.create({
                data: {
                    userId,
                    accountId: account?.id || null,
                    name: body.name.trim(),
                    type: body.type,
                    status: campaignStatus,
                    steps: {
                        create: body.steps.map((step) => ({
                            stepOrder: step.stepOrder,
                            actionType: step.actionType,
                            delayDays: step.delayDays,
                            messageText: step.messageText?.trim() || null,
                        })),
                    },
                },
                include: {
                    steps: { orderBy: { stepOrder: "asc" } },
                },
            });
        }
        // Récupérer les prospects des listes sélectionnées (s'il y en a)
        let prospectsEnrolled = 0;
        if (body.listIds && body.listIds.length > 0) {
            const prospects = await prisma.prospect.findMany({
                where: {
                    listId: { in: body.listIds },
                    doNotContact: false,
                },
            });
            const step1 = campaign.steps[0];
            const now = new Date();
            if (prospects.length > 0 && step1) {
                const statesData = prospects.map((p, index) => {
                    const scheduledTime = new Date(now.getTime() + (index * 90 + Math.floor(Math.random() * 60)) * 1000);
                    return {
                        campaignId: campaign.id,
                        prospectId: p.id,
                        currentStepId: step1.id,
                        status: "PENDING",
                        nextExecutionAt: body.startImmediately ? scheduledTime : null,
                    };
                });
                await prisma.prospectCampaignState.createMany({
                    data: statesData,
                    skipDuplicates: true,
                });
                prospectsEnrolled = prospects.length;
                // Si démarrage immédiat et compte présent, programmer dans ActionQueue
                if (body.startImmediately && account) {
                    const queueEntries = prospects.map((p, index) => {
                        const scheduledTime = new Date(now.getTime() + (index * 90 + Math.floor(Math.random() * 60)) * 1000);
                        return {
                            accountId: account.id,
                            prospectId: p.id,
                            campaignId: campaign.id,
                            actionType: step1.actionType,
                            status: "QUEUED",
                            scheduledFor: scheduledTime,
                            payload: {
                                stepId: step1.id,
                                messageText: step1.messageText,
                            },
                        };
                    });
                    await prisma.actionQueue.createMany({
                        data: queueEntries,
                    });
                }
            }
        }
        res.status(201).json({
            success: true,
            message: body.startImmediately
                ? "Campagne créée et lancée avec succès."
                : "Brouillon sauvegardé avec succès dans vos campagnes.",
            campaign,
            prospectsEnrolled,
        });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
            return;
        }
        console.error("Error createCampaign:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * Met à jour le statut d'une campagne (Play / Pause / Archive)
 */
export async function toggleCampaignStatus(req, res) {
    try {
        const id = req.params.id;
        const userId = req.user.id;
        const { status } = req.body;
        const existing = await prisma.campaign.findFirst({
            where: { id, userId },
        });
        if (!existing) {
            res.status(404).json({ success: false, error: "Campagne introuvable." });
            return;
        }
        let newStatus = status;
        if (!newStatus) {
            newStatus = existing.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
        }
        const updated = await prisma.campaign.update({
            where: { id },
            data: { status: newStatus },
        });
        res.json({
            success: true,
            message: `Statut de la campagne mis à jour : ${newStatus}`,
            campaign: updated,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * Met à jour les informations ou étapes d'une campagne
 */
export async function updateCampaign(req, res) {
    try {
        const id = req.params.id;
        const userId = req.user.id;
        const body = UpdateCampaignSchema.parse(req.body);
        const existing = await prisma.campaign.findFirst({
            where: { id, userId },
        });
        if (!existing) {
            res.status(404).json({ success: false, error: "Campagne introuvable." });
            return;
        }
        const updated = await prisma.campaign.update({
            where: { id },
            data: {
                name: body.name ? body.name.trim() : undefined,
                status: body.status,
            },
        });
        res.json({
            success: true,
            message: "Campagne mise à jour avec succès.",
            campaign: updated,
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
/**
 * Supprime une campagne et ses états
 */
export async function deleteCampaign(req, res) {
    try {
        const id = req.params.id;
        const userId = req.user.id;
        const existing = await prisma.campaign.findFirst({
            where: { id, userId },
        });
        if (!existing) {
            res.status(404).json({ success: false, error: "Campagne introuvable." });
            return;
        }
        // Supprimer les éléments associés en queue
        await prisma.actionQueue.deleteMany({
            where: { campaignId: id },
        });
        await prisma.campaign.delete({
            where: { id },
        });
        res.json({
            success: true,
            message: "Campagne supprimée avec succès.",
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
