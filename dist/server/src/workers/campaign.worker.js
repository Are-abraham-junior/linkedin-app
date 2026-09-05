import { prisma } from "../../../lib/prisma.js";
import { UnipileService } from "../services/unipile.service.js";
/**
 * Remplace les variables dynamiques dans les modèles de messages
 */
function personalizeMessage(template, prospect) {
    if (!template)
        return "";
    return template
        .replace(/\{\{firstName\}\}/gi, prospect.firstName || "")
        .replace(/\{\{lastName\}\}/gi, prospect.lastName || "")
        .replace(/\{\{company\}\}/gi, prospect.company || "votre entreprise")
        .replace(/\{\{headline\}\}/gi, prospect.headline || "")
        .trim();
}
/**
 * Résout le provider_id LinkedIn (ACo...) à partir de l'URL LinkedIn du prospect.
 * Si le providerProfileId existe déjà, le retourne directement.
 * Sinon, interroge Unipile pour le récupérer et le sauvegarde en base.
 */
async function resolveProviderId(prospect, accountId) {
    // Si on a déjà un provider_id LinkedIn valide (commence par ACo)
    if (prospect.providerProfileId && prospect.providerProfileId.startsWith("ACo")) {
        return prospect.providerProfileId;
    }
    // Extraire le slug LinkedIn depuis l'URL
    const linkedinUrl = prospect.linkedinUrl || "";
    let slug = "";
    if (linkedinUrl.includes("linkedin.com/in/")) {
        slug = linkedinUrl.split("linkedin.com/in/")[1].split("/")[0].split("?")[0];
    }
    if (!slug) {
        console.warn(`[CampaignWorker] Impossible de résoudre le provider_id pour ${prospect.firstName} ${prospect.lastName}: pas d'URL LinkedIn valide`);
        return null;
    }
    try {
        const result = await UnipileService.getProfile({
            accountId,
            identifier: slug,
        });
        if (result.success && result.profile?.provider_id) {
            const providerId = result.profile.provider_id;
            console.log(`[CampaignWorker] Provider ID résolu pour ${prospect.firstName} ${prospect.lastName}: ${providerId}`);
            // Sauvegarder en base pour les prochaines fois
            await prisma.prospect.update({
                where: { id: prospect.id },
                data: { providerProfileId: providerId },
            });
            return providerId;
        }
    }
    catch (err) {
        console.error(`[CampaignWorker] Erreur résolution provider_id pour ${slug}:`, err.message);
    }
    return null;
}
const DAY_MAP = {
    0: "SUN",
    1: "MON",
    2: "TUE",
    3: "WED",
    4: "THU",
    5: "FRI",
    6: "SAT",
};
/**
 * Vérifie si l'heure actuelle est dans les jours et heures ouvrées configurés par l'utilisateur
 */
function isUserInWorkingHours(user) {
    if (!user)
        return true;
    const now = new Date();
    const currentDay = DAY_MAP[now.getDay()];
    const workingDays = user.workingDays?.length
        ? user.workingDays
        : ["MON", "TUE", "WED", "THU", "FRI"];
    // Vérifier si le jour actuel est actif
    if (!workingDays.includes(currentDay)) {
        return false;
    }
    // Vérifier la plage horaire
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = (user.workingHoursStart || "08:00").split(":").map(Number);
    const [endH, endM] = (user.workingHoursEnd || "19:00").split(":").map(Number);
    const startTotal = (startH || 8) * 60 + (startM || 0);
    const endTotal = (endH || 19) * 60 + (endM || 0);
    return currentMinutes >= startTotal && currentMinutes <= endTotal;
}
function categorizeUnipileError(errorMsg) {
    if (!errorMsg)
        return { action: "CONTINUE", reason: "Erreur inconnue" };
    const lower = errorMsg.toLowerCase();
    // Déconnexion ou checkpoint selon doc Unipile (https://developer.unipile.com/reference)
    if (lower.includes("checkpoint") ||
        lower.includes("unauthorized") ||
        lower.includes("401") ||
        lower.includes("reconnect") ||
        lower.includes("session expired") ||
        lower.includes("disconnected") ||
        lower.includes("invalid account") ||
        lower.includes("not connected")) {
        return { action: "DISCONNECT_ACCOUNT", reason: "Compte LinkedIn déconnecté ou checkpoint requis" };
    }
    // Rate limits / 429
    if (lower.includes("429") ||
        lower.includes("too many requests") ||
        lower.includes("rate limit") ||
        lower.includes("resource_exhausted") ||
        lower.includes("throttled")) {
        return { action: "DEFER_ACTION", reason: "Limite de taux Unipile / LinkedIn atteinte (429)" };
    }
    return { action: "CONTINUE", reason: errorMsg };
}
/**
 * Gère les échecs d'action Unipile avec protection de compte et gestion du rate-limit
 */
async function handleActionResultFailure(action, prospect, account, errorMessage, defaultMessage = "Erreur exécution action") {
    const errInfo = categorizeUnipileError(errorMessage);
    if (errInfo.action === "DISCONNECT_ACCOUNT") {
        console.error(`[CampaignWorker] Compte ${account.id} déconnecté ou checkpoint requis. Mise en pause du compte.`);
        await prisma.linkedInAccount.update({
            where: { id: account.id },
            data: { status: "DISCONNECTED" },
        });
        // Reprogrammer l'action pour dans 2h (en attente de reconnexion de session)
        await prisma.actionQueue.update({
            where: { id: action.id },
            data: {
                status: "QUEUED",
                scheduledFor: new Date(Date.now() + 2 * 3600 * 1000),
                errorMessage: errInfo.reason,
            },
        });
        return "BREAK";
    }
    if (errInfo.action === "DEFER_ACTION") {
        console.warn(`[CampaignWorker] Rate limit Unipile/LinkedIn détecté pour le compte ${account.id}. Pause de 15 minutes.`);
        await prisma.actionQueue.update({
            where: { id: action.id },
            data: {
                status: "QUEUED",
                scheduledFor: new Date(Date.now() + 15 * 60 * 1000),
                errorMessage: errInfo.reason,
            },
        });
        return "BREAK";
    }
    // Erreur réelle et non récupérable sur ce prospect spécifique
    await prisma.actionQueue.update({
        where: { id: action.id },
        data: {
            status: "FAILED",
            executedAt: new Date(),
            errorMessage: errorMessage || defaultMessage,
        },
    });
    await prisma.prospectCampaignState.updateMany({
        where: { campaignId: action.campaignId, prospectId: prospect.id },
        data: {
            status: "FAILED",
            errorLog: errorMessage || defaultMessage,
        },
    });
    return "CONTINUE";
}
let isRunning = false;
/**
 * Traite les actions en attente dans la queue
 */
export async function processActionQueue() {
    if (isRunning)
        return;
    isRunning = true;
    try {
        const now = new Date();
        // 1. Récupérer les 10 prochaines actions éligibles
        const pendingActions = await prisma.actionQueue.findMany({
            where: {
                status: "QUEUED",
                scheduledFor: { lte: now },
            },
            include: {
                linkedInAccount: {
                    include: {
                        user: true,
                    },
                },
            },
            orderBy: { scheduledFor: "asc" },
            take: 10,
        });
        if (pendingActions.length === 0) {
            isRunning = false;
            return;
        }
        console.log(`[CampaignWorker] Traitement de ${pendingActions.length} action(s) planifiée(s)...`);
        for (const action of pendingActions) {
            try {
                const account = action.linkedInAccount;
                const user = account.user;
                // Si le compte est déconnecté, différer l'action et ne pas exécuter
                if (account.status === "DISCONNECTED") {
                    console.warn(`[CampaignWorker] Compte LinkedIn ${account.id} déconnecté. Action différée.`);
                    const nextCheck = new Date(now.getTime() + 60 * 60 * 1000);
                    await prisma.actionQueue.update({
                        where: { id: action.id },
                        data: { scheduledFor: nextCheck, status: "QUEUED" },
                    });
                    continue;
                }
                // Vérifier si nous sommes dans les horaires d'activité autorisés par l'utilisateur
                if (!isUserInWorkingHours(user)) {
                    // Reprogrammer pour la prochaine fenêtre (décaler de 30 minutes)
                    const nextCheck = new Date(now.getTime() + 30 * 60 * 1000);
                    await prisma.actionQueue.update({
                        where: { id: action.id },
                        data: { scheduledFor: nextCheck },
                    });
                    continue;
                }
                // Vérifier si la campagne est toujours active
                const campaign = await prisma.campaign.findUnique({
                    where: { id: action.campaignId },
                });
                if (!campaign || campaign.status !== "ACTIVE") {
                    continue;
                }
                // Calcul dynamique et fiable des quotas exécutés aujourd'hui (source de vérité : ActionQueue)
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const [invitesSentToday, messagesSentToday] = await Promise.all([
                    prisma.actionQueue.count({
                        where: {
                            accountId: account.id,
                            actionType: "INVITATION",
                            status: { in: ["SUCCESS", "EXECUTED"] },
                            executedAt: { gte: todayStart },
                        },
                    }),
                    prisma.actionQueue.count({
                        where: {
                            accountId: account.id,
                            actionType: "MESSAGE",
                            status: { in: ["SUCCESS", "EXECUTED"] },
                            executedAt: { gte: todayStart },
                        },
                    }),
                ]);
                // Synchroniser les compteurs sur le compte LinkedIn si décalage détecté
                if (account.dailyInvitesSent !== invitesSentToday || account.dailyMsgSent !== messagesSentToday) {
                    await prisma.linkedInAccount.update({
                        where: { id: account.id },
                        data: { dailyInvitesSent: invitesSentToday, dailyMsgSent: messagesSentToday },
                    });
                    account.dailyInvitesSent = invitesSentToday;
                    account.dailyMsgSent = messagesSentToday;
                }
                const maxDailyInvites = user?.maxDailyInvites || 30;
                const maxDailyMsg = user?.maxDailyMsg || 70;
                if (action.actionType === "INVITATION" && invitesSentToday >= maxDailyInvites) {
                    console.warn(`[CampaignWorker] Quota d'invitations journalières atteint (${invitesSentToday}/${maxDailyInvites}) pour le compte ${account.id}. Action différée.`);
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(9, 0, 0, 0);
                    await prisma.actionQueue.update({
                        where: { id: action.id },
                        data: { scheduledFor: tomorrow, status: "QUEUED" },
                    });
                    continue;
                }
                if (action.actionType === "MESSAGE" && messagesSentToday >= maxDailyMsg) {
                    console.warn(`[CampaignWorker] Quota de messages journaliers atteint (${messagesSentToday}/${maxDailyMsg}) pour le compte ${account.id}. Action différée.`);
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(9, 0, 0, 0);
                    await prisma.actionQueue.update({
                        where: { id: action.id },
                        data: { scheduledFor: tomorrow, status: "QUEUED" },
                    });
                    continue;
                }
                // Marquer comme en cours
                await prisma.actionQueue.update({
                    where: { id: action.id },
                    data: { status: "EXECUTING" },
                });
                const prospect = await prisma.prospect.findUnique({
                    where: { id: action.prospectId },
                });
                if (!prospect || prospect.doNotContact) {
                    await prisma.actionQueue.update({
                        where: { id: action.id },
                        data: { status: "SKIPPED", executedAt: new Date(), errorMessage: "Prospect introuvable ou blacklisté" },
                    });
                    continue;
                }
                const payload = action.payload || {};
                if (action.actionType === "INVITATION") {
                    const rawMessage = payload.messageText || "";
                    const personalized = personalizeMessage(rawMessage, prospect);
                    const targetIdentifier = await resolveProviderId(prospect, account.unipileAccountId);
                    if (!targetIdentifier) {
                        await prisma.actionQueue.update({
                            where: { id: action.id },
                            data: { status: "FAILED", executedAt: new Date(), errorMessage: "Impossible de résoudre le provider_id LinkedIn" },
                        });
                        continue;
                    }
                    const result = await UnipileService.sendInvitation({
                        accountId: account.unipileAccountId,
                        providerId: targetIdentifier,
                        message: personalized || undefined,
                    });
                    if (result.success) {
                        await prisma.actionQueue.update({
                            where: { id: action.id },
                            data: { status: "SUCCESS", executedAt: new Date() },
                        });
                        // Mettre à jour le prospect et son état de campagne
                        await prisma.prospect.update({
                            where: { id: prospect.id },
                            data: { connectionStatus: "PENDING" },
                        });
                        await prisma.prospectCampaignState.updateMany({
                            where: { campaignId: action.campaignId, prospectId: prospect.id },
                            data: {
                                status: "WAITING_CONDITION", // Attend acceptation
                                lastActionAt: new Date(),
                            },
                        });
                        // Incrémenter les invitations envoyées
                        await prisma.linkedInAccount.update({
                            where: { id: account.id },
                            data: { dailyInvitesSent: { increment: 1 } },
                        });
                        console.log(`[CampaignWorker] Invitation envoyée avec succès à ${prospect.firstName} ${prospect.lastName}`);
                    }
                    else {
                        const outcome = await handleActionResultFailure(action, prospect, account, result.error, "Erreur envoi invitation");
                        if (outcome === "BREAK")
                            break;
                    }
                }
                else if (action.actionType === "MESSAGE") {
                    const rawMessage = payload.messageText || "";
                    const personalized = personalizeMessage(rawMessage, prospect);
                    const attendeeId = await resolveProviderId(prospect, account.unipileAccountId);
                    if (!attendeeId) {
                        await prisma.actionQueue.update({
                            where: { id: action.id },
                            data: { status: "FAILED", executedAt: new Date(), errorMessage: "Impossible de résoudre le provider_id LinkedIn" },
                        });
                        continue;
                    }
                    const result = await UnipileService.sendMessage({
                        accountId: account.unipileAccountId,
                        attendeeId,
                        text: personalized,
                    });
                    if (result.success) {
                        await prisma.actionQueue.update({
                            where: { id: action.id },
                            data: { status: "SUCCESS", executedAt: new Date() },
                        });
                        // Incrémenter les messages envoyés
                        await prisma.linkedInAccount.update({
                            where: { id: account.id },
                            data: { dailyMsgSent: { increment: 1 } },
                        });
                        // Vérifier s'il y a une étape suivante après ce message
                        const currentStep = await prisma.campaignStep.findFirst({
                            where: { campaignId: action.campaignId, id: payload.stepId },
                        });
                        const nextStep = await prisma.campaignStep.findFirst({
                            where: {
                                campaignId: action.campaignId,
                                stepOrder: { gt: currentStep?.stepOrder || 1 },
                            },
                            orderBy: { stepOrder: "asc" },
                        });
                        if (nextStep) {
                            const delayDays = nextStep.delayDays || 2;
                            const nextExec = new Date(now.getTime() + delayDays * 24 * 60 * 60 * 1000);
                            await prisma.prospectCampaignState.updateMany({
                                where: { campaignId: action.campaignId, prospectId: prospect.id },
                                data: {
                                    currentStepId: nextStep.id,
                                    status: "WAITING_DELAY",
                                    nextExecutionAt: nextExec,
                                    lastActionAt: new Date(),
                                },
                            });
                            await prisma.actionQueue.create({
                                data: {
                                    accountId: account.id,
                                    prospectId: prospect.id,
                                    campaignId: action.campaignId,
                                    actionType: nextStep.actionType,
                                    scheduledFor: nextExec,
                                    status: "QUEUED",
                                    payload: {
                                        stepId: nextStep.id,
                                        messageText: nextStep.messageText,
                                    },
                                },
                            });
                        }
                        else {
                            // Fin de séquence pour ce prospect
                            await prisma.prospectCampaignState.updateMany({
                                where: { campaignId: action.campaignId, prospectId: prospect.id },
                                data: {
                                    status: "COMPLETED",
                                    lastActionAt: new Date(),
                                },
                            });
                        }
                        console.log(`[CampaignWorker] Message envoyé à ${prospect.firstName} ${prospect.lastName}`);
                    }
                    else {
                        const outcome = await handleActionResultFailure(action, prospect, account, result.error, "Erreur envoi message");
                        if (outcome === "BREAK")
                            break;
                    }
                }
                else if (action.actionType === "VISIT_PROFILE" || action.actionType === "VISIT") {
                    const targetIdentifier = (await resolveProviderId(prospect, account.unipileAccountId)) || prospect.linkedinUrl;
                    const result = await UnipileService.visitProfile({
                        accountId: account.unipileAccountId,
                        identifier: targetIdentifier,
                    });
                    if (result.success) {
                        await prisma.actionQueue.update({
                            where: { id: action.id },
                            data: { status: "SUCCESS", executedAt: new Date() },
                        });
                        // Trouver l'étape suivante dans la séquence
                        const currentStep = await prisma.campaignStep.findFirst({
                            where: { campaignId: action.campaignId, id: payload.stepId },
                        });
                        const nextStep = await prisma.campaignStep.findFirst({
                            where: {
                                campaignId: action.campaignId,
                                stepOrder: { gt: currentStep?.stepOrder || 1 },
                            },
                            orderBy: { stepOrder: "asc" },
                        });
                        if (nextStep) {
                            const delayDays = nextStep.delayDays || 1;
                            const nextExec = new Date(now.getTime() + delayDays * 24 * 60 * 60 * 1000);
                            await prisma.prospectCampaignState.updateMany({
                                where: { campaignId: action.campaignId, prospectId: prospect.id },
                                data: {
                                    currentStepId: nextStep.id,
                                    status: "WAITING_DELAY",
                                    nextExecutionAt: nextExec,
                                    lastActionAt: new Date(),
                                },
                            });
                            await prisma.actionQueue.create({
                                data: {
                                    accountId: account.id,
                                    prospectId: prospect.id,
                                    campaignId: action.campaignId,
                                    actionType: nextStep.actionType,
                                    scheduledFor: nextExec,
                                    status: "QUEUED",
                                    payload: {
                                        stepId: nextStep.id,
                                        messageText: nextStep.messageText,
                                    },
                                },
                            });
                        }
                        else {
                            await prisma.prospectCampaignState.updateMany({
                                where: { campaignId: action.campaignId, prospectId: prospect.id },
                                data: {
                                    status: "COMPLETED",
                                    lastActionAt: new Date(),
                                },
                            });
                        }
                        console.log(`[CampaignWorker] Profil visité avec succès : ${prospect.firstName} ${prospect.lastName}`);
                    }
                    else {
                        const outcome = await handleActionResultFailure(action, prospect, account, result.error, "Erreur visite profil");
                        if (outcome === "BREAK")
                            break;
                    }
                }
                else if (action.actionType === "FOLLOW") {
                    const targetIdentifier = (await resolveProviderId(prospect, account.unipileAccountId)) || prospect.linkedinUrl;
                    const result = await UnipileService.followProfile({
                        accountId: account.unipileAccountId,
                        providerId: targetIdentifier,
                    });
                    if (result.success) {
                        await prisma.actionQueue.update({
                            where: { id: action.id },
                            data: { status: "SUCCESS", executedAt: new Date() },
                        });
                        // Trouver l'étape suivante dans la séquence
                        const currentStep = await prisma.campaignStep.findFirst({
                            where: { campaignId: action.campaignId, id: payload.stepId },
                        });
                        const nextStep = await prisma.campaignStep.findFirst({
                            where: {
                                campaignId: action.campaignId,
                                stepOrder: { gt: currentStep?.stepOrder || 1 },
                            },
                            orderBy: { stepOrder: "asc" },
                        });
                        if (nextStep) {
                            const delayDays = nextStep.delayDays || 1;
                            const nextExec = new Date(now.getTime() + delayDays * 24 * 60 * 60 * 1000);
                            await prisma.prospectCampaignState.updateMany({
                                where: { campaignId: action.campaignId, prospectId: prospect.id },
                                data: {
                                    currentStepId: nextStep.id,
                                    status: "WAITING_DELAY",
                                    nextExecutionAt: nextExec,
                                    lastActionAt: new Date(),
                                },
                            });
                            await prisma.actionQueue.create({
                                data: {
                                    accountId: account.id,
                                    prospectId: prospect.id,
                                    campaignId: action.campaignId,
                                    actionType: nextStep.actionType,
                                    scheduledFor: nextExec,
                                    status: "QUEUED",
                                    payload: {
                                        stepId: nextStep.id,
                                        messageText: nextStep.messageText,
                                    },
                                },
                            });
                        }
                        else {
                            await prisma.prospectCampaignState.updateMany({
                                where: { campaignId: action.campaignId, prospectId: prospect.id },
                                data: {
                                    status: "COMPLETED",
                                    lastActionAt: new Date(),
                                },
                            });
                        }
                        console.log(`[CampaignWorker] Profil suivi (follow) avec succès : ${prospect.firstName} ${prospect.lastName}`);
                    }
                    else {
                        const outcome = await handleActionResultFailure(action, prospect, account, result.error, "Erreur follow profil");
                        if (outcome === "BREAK")
                            break;
                    }
                }
            }
            catch (innerErr) {
                console.error(`[CampaignWorker] Erreur traitement action ${action.id}:`, innerErr);
                await prisma.actionQueue.update({
                    where: { id: action.id },
                    data: { status: "FAILED", errorMessage: innerErr.message },
                });
            }
        }
    }
    catch (error) {
        console.error("[CampaignWorker] Exception globale dans le worker:", error);
    }
    finally {
        isRunning = false;
    }
}
/**
 * Tâche de synchronisation périodique des acceptations LinkedIn
 */
export async function checkAcceptedInvitations() {
    try {
        const activeStates = await prisma.prospectCampaignState.findMany({
            where: {
                status: "WAITING_CONDITION",
                campaign: { status: "ACTIVE" },
            },
            include: {
                prospect: true,
                campaign: {
                    include: {
                        steps: { orderBy: { stepOrder: "asc" } },
                        linkedInAccount: true,
                    },
                },
            },
            orderBy: { lastActionAt: "asc" }, // Évite la famine des prospects non vérifiés
            take: 20,
        });
        if (activeStates.length === 0)
            return;
        for (const state of activeStates) {
            let account = state.campaign.linkedInAccount;
            if (!account) {
                account = await prisma.linkedInAccount.findFirst({
                    where: { userId: state.campaign.userId, status: "CONNECTED" },
                });
            }
            if (!account) {
                // Mettre à jour lastActionAt pour permettre la rotation vers d'autres campagnes
                await prisma.prospectCampaignState.update({
                    where: { id: state.id },
                    data: { lastActionAt: new Date() },
                });
                continue;
            }
            const profileRes = await UnipileService.getProfile({
                accountId: account.unipileAccountId,
                identifier: state.prospect.providerProfileId || state.prospect.linkedinUrl,
            });
            // Gestion des déconnexions/checkpoints Unipile
            if (!profileRes.success && profileRes.error) {
                const errInfo = categorizeUnipileError(profileRes.error);
                if (errInfo.action === "DISCONNECT_ACCOUNT") {
                    console.warn(`[CampaignWorker] Compte ${account.id} déconnecté lors de la vérification d'invitations.`);
                    await prisma.linkedInAccount.update({
                        where: { id: account.id },
                        data: { status: "DISCONNECTED" },
                    });
                    break;
                }
            }
            if (profileRes.success && profileRes.profile) {
                const isConnected = profileRes.profile.network_distance === "DISTANCE_1" ||
                    profileRes.profile.connection_status === "CONNECTED";
                if (isConnected) {
                    console.log(`[CampaignWorker] Connexion acceptée confirmée pour ${state.prospect.firstName} ${state.prospect.lastName} !`);
                    await prisma.prospect.update({
                        where: { id: state.prospect.id },
                        data: { connectionStatus: "CONNECTED" },
                    });
                    // Trouver l'étape suivant l'invitation dans cette campagne
                    const currentStep = state.campaign.steps.find((s) => s.id === state.currentStepId) ||
                        state.campaign.steps.find((s) => s.actionType === "INVITATION");
                    const currentOrder = currentStep ? currentStep.stepOrder : 1;
                    const nextStep = state.campaign.steps.find((s) => s.stepOrder > currentOrder);
                    if (nextStep) {
                        const delayDays = nextStep.delayDays || 0;
                        const scheduledFor = new Date(Date.now() + Math.max(delayDays * 24 * 3600 * 1000, 5 * 60 * 1000));
                        await prisma.prospectCampaignState.update({
                            where: { id: state.id },
                            data: {
                                currentStepId: nextStep.id,
                                status: "WAITING_DELAY",
                                nextExecutionAt: scheduledFor,
                                lastActionAt: new Date(),
                            },
                        });
                        await prisma.actionQueue.create({
                            data: {
                                accountId: account.id,
                                prospectId: state.prospect.id,
                                campaignId: state.campaignId,
                                actionType: nextStep.actionType,
                                scheduledFor,
                                status: "QUEUED",
                                payload: {
                                    stepId: nextStep.id,
                                    messageText: nextStep.messageText,
                                },
                            },
                        });
                    }
                    else {
                        await prisma.prospectCampaignState.update({
                            where: { id: state.id },
                            data: { status: "COMPLETED", lastActionAt: new Date() },
                        });
                    }
                }
                else {
                    // Pas encore accepté : mettre à jour lastActionAt pour passer au prospect suivant lors du prochain cycle
                    await prisma.prospectCampaignState.update({
                        where: { id: state.id },
                        data: { lastActionAt: new Date() },
                    });
                }
            }
            else {
                // En cas d'erreur transitoire sur le profil, mettre à jour lastActionAt pour éviter le blocage
                await prisma.prospectCampaignState.update({
                    where: { id: state.id },
                    data: { lastActionAt: new Date() },
                });
            }
        }
    }
    catch (err) {
        console.error("[CampaignWorker] Erreur checkAcceptedInvitations:", err.message);
    }
}
/**
 * Démarre le planificateur de tâches de campagne
 */
export function startCampaignScheduler() {
    console.log("⚡ [CampaignWorker] Initialisation du planificateur de campagnes Bime Link...");
    // Exécution de la file d'attente chaque minute
    setInterval(() => {
        processActionQueue().catch((err) => console.error("[CampaignWorker] Interval error:", err));
    }, 60 * 1000);
    // Vérification des invitations acceptées toutes les 5 minutes
    setInterval(() => {
        checkAcceptedInvitations().catch((err) => console.error("[CampaignWorker] Check accepted error:", err));
    }, 5 * 60 * 1000);
}
