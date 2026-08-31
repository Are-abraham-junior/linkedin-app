import { prisma } from "../../../lib/prisma.js";
import { UnipileService } from "../services/unipile.service.js";
/**
 * Arrêt automatique de la campagne dès qu'une réponse est détectée
 */
export async function handleProspectReply(prospectId, text) {
    try {
        const activeStates = await prisma.prospectCampaignState.findMany({
            where: {
                prospectId,
                status: { in: ["PENDING", "WAITING_CONDITION", "WAITING_DELAY", "IN_PROGRESS"] },
            },
            include: { campaign: true },
        });
        if (activeStates.length > 0) {
            for (const state of activeStates) {
                await prisma.prospectCampaignState.update({
                    where: { id: state.id },
                    data: {
                        status: "REPLIED",
                        lastActionAt: new Date(),
                    },
                });
                // Supprimer toutes les actions en attente dans la file d'attente
                await prisma.actionQueue.deleteMany({
                    where: {
                        prospectId,
                        campaignId: state.campaignId,
                        status: "QUEUED",
                    },
                });
                console.log(`[Inbox] Réponse détectée pour prospect ${prospectId} : Séquence arrêtée automatiquement sur la campagne "${state.campaign.name}".`);
            }
        }
    }
    catch (err) {
        console.error("[Inbox] Erreur handleProspectReply:", err);
    }
}
/**
 * Récupère la liste des conversations avec prospects liés et synchronisation
 */
export async function getConversations(req, res) {
    try {
        const userId = req.user.id;
        const { status, search } = req.query;
        // 1. Récupérer le compte LinkedIn de l'utilisateur
        const account = await prisma.linkedInAccount.findFirst({
            where: { userId },
        });
        // 2. Synchronisation Unipile si un compte est configuré
        if (account?.unipileAccountId) {
            try {
                const unipileChats = await UnipileService.getChats({
                    accountId: account.unipileAccountId,
                    limit: 30,
                });
                if (unipileChats.success && Array.isArray(unipileChats.items)) {
                    for (const item of unipileChats.items) {
                        const chatId = item.id;
                        const attendees = item.attendees || [];
                        // Trouver le contact distant (qui n'est pas le compte utilisateur)
                        const otherAttendee = attendees.find((a) => !a.is_self && a.provider_id) || attendees[0];
                        if (!otherAttendee)
                            continue;
                        const providerId = otherAttendee.provider_id;
                        const attendeeName = otherAttendee.name || "";
                        const attendeePicture = otherAttendee.picture_url || otherAttendee.avatar_url;
                        // Chercher si un Prospect existe pour ce contact
                        let prospect = await prisma.prospect.findFirst({
                            where: {
                                OR: [
                                    { providerProfileId: providerId },
                                    {
                                        AND: [
                                            { firstName: { contains: attendeeName.split(" ")[0] || "", mode: "insensitive" } },
                                            { lastName: { contains: attendeeName.split(" ").slice(1).join(" ") || "", mode: "insensitive" } },
                                        ],
                                    },
                                ],
                            },
                        });
                        // Si aucun prospect n'existe, on le crée dans une liste par défaut
                        if (!prospect) {
                            let defaultList = await prisma.prospectList.findFirst({
                                where: { userId },
                            });
                            if (!defaultList) {
                                defaultList = await prisma.prospectList.create({
                                    data: {
                                        userId,
                                        name: "Messagerie LinkedIn",
                                        color: "#592eff",
                                    },
                                });
                            }
                            const nameParts = attendeeName.split(" ");
                            const firstName = nameParts[0] || "Contact";
                            const lastName = nameParts.slice(1).join(" ") || "LinkedIn";
                            prospect = await prisma.prospect.create({
                                data: {
                                    listId: defaultList.id,
                                    providerProfileId: providerId,
                                    firstName,
                                    lastName,
                                    linkedinUrl: otherAttendee.profile_url || `https://www.linkedin.com/in/${providerId}`,
                                    avatarUrl: attendeePicture,
                                    headline: otherAttendee.headline || "Contact LinkedIn",
                                    connectionStatus: "CONNECTED",
                                },
                            });
                        }
                        // Mettre à jour ou créer la conversation locale
                        const lastMsg = item.last_message;
                        const lastText = lastMsg?.text || "";
                        const lastTime = lastMsg?.timestamp ? new Date(lastMsg.timestamp) : new Date();
                        const unreadCount = item.unread_count || 0;
                        const existingConv = await prisma.conversation.findUnique({
                            where: { unipileChatId: chatId },
                        });
                        if (existingConv) {
                            await prisma.conversation.update({
                                where: { id: existingConv.id },
                                data: {
                                    lastMessageText: lastText || existingConv.lastMessageText,
                                    lastMessageAt: lastTime,
                                    unreadCount,
                                },
                            });
                        }
                        else {
                            await prisma.conversation.create({
                                data: {
                                    prospectId: prospect.id,
                                    unipileChatId: chatId,
                                    lastMessageText: lastText,
                                    lastMessageAt: lastTime,
                                    unreadCount,
                                },
                            });
                        }
                    }
                }
            }
            catch (syncErr) {
                console.warn("[Inbox] Erreur synchronisation Unipile:", syncErr);
            }
        }
        // 3. Récupérer les conversations depuis la BDD avec relations
        const whereClause = {
            prospect: {
                list: { userId },
            },
        };
        if (status === "UNREAD") {
            whereClause.unreadCount = { gt: 0 };
        }
        if (search && search.trim()) {
            const q = search.trim();
            whereClause.OR = [
                { lastMessageText: { contains: q, mode: "insensitive" } },
                { prospect: { firstName: { contains: q, mode: "insensitive" } } },
                { prospect: { lastName: { contains: q, mode: "insensitive" } } },
                { prospect: { company: { contains: q, mode: "insensitive" } } },
            ];
        }
        const conversations = await prisma.conversation.findMany({
            where: whereClause,
            include: {
                prospect: {
                    include: {
                        campaignStates: {
                            include: {
                                campaign: { select: { id: true, name: true, status: true } },
                                currentStep: true,
                            },
                        },
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });
        // Si filtre EN_CAMPAGNE
        let result = conversations;
        if (status === "IN_CAMPAIGN") {
            result = conversations.filter((c) => c.prospect.campaignStates &&
                c.prospect.campaignStates.some((cs) => cs.campaign.status === "ACTIVE"));
        }
        const formatted = result.map((c) => {
            const activeCampaignState = c.prospect.campaignStates?.[0];
            return {
                id: c.id,
                unipileChatId: c.unipileChatId,
                lastMessageText: c.lastMessageText,
                lastMessageAt: c.lastMessageAt,
                unreadCount: c.unreadCount,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                prospect: {
                    id: c.prospect.id,
                    firstName: c.prospect.firstName,
                    lastName: c.prospect.lastName,
                    headline: c.prospect.headline,
                    company: c.prospect.company,
                    avatarUrl: c.prospect.avatarUrl,
                    linkedinUrl: c.prospect.linkedinUrl,
                    connectionStatus: c.prospect.connectionStatus,
                    tags: c.prospect.tags,
                    campaignState: activeCampaignState
                        ? {
                            campaignId: activeCampaignState.campaign.id,
                            campaignName: activeCampaignState.campaign.name,
                            status: activeCampaignState.status,
                            currentStepOrder: activeCampaignState.currentStep?.stepOrder,
                        }
                        : null,
                },
            };
        });
        res.json({
            success: true,
            conversations: formatted,
            totalUnread: formatted.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
        });
    }
    catch (error) {
        console.error("[Inbox] Erreur getConversations:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * Récupère les messages d'une conversation
 */
export async function getMessages(req, res) {
    try {
        const id = req.params.id;
        const conversation = await prisma.conversation.findFirst({
            where: {
                OR: [{ id }, { unipileChatId: id }],
            },
            include: {
                prospect: true,
            },
        });
        if (!conversation) {
            res.status(404).json({ success: false, error: "Conversation introuvable." });
            return;
        }
        // 1. Récupérer les messages frais depuis Unipile si unipileChatId est présent
        if (conversation.unipileChatId) {
            try {
                const unipileMessages = await UnipileService.getChatMessages({
                    chatId: conversation.unipileChatId,
                    limit: 50,
                });
                if (unipileMessages.success && Array.isArray(unipileMessages.items)) {
                    for (const m of unipileMessages.items) {
                        const senderType = m.is_sender || m.sender_id === "self" ? "USER" : "PROSPECT";
                        const text = m.text || "";
                        const sentAt = m.timestamp ? new Date(m.timestamp) : new Date();
                        await prisma.message.upsert({
                            where: { unipileMessageId: m.id },
                            update: { text, sentAt },
                            create: {
                                conversationId: conversation.id,
                                unipileMessageId: m.id,
                                senderType,
                                text,
                                sentAt,
                            },
                        });
                        // Si c'est un message entrant du prospect, vérifier l'arrêt de campagne
                        if (senderType === "PROSPECT") {
                            await handleProspectReply(conversation.prospectId, text);
                        }
                    }
                }
            }
            catch (fetchErr) {
                console.warn("[Inbox] Erreur lecture messages Unipile:", fetchErr);
            }
        }
        // 2. Marquer la conversation comme lue
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: { unreadCount: 0 },
        });
        // 3. Retourner tous les messages enregistrés triés par date croissante
        const messages = await prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { sentAt: "asc" },
        });
        res.json({
            success: true,
            conversation: {
                id: conversation.id,
                unipileChatId: conversation.unipileChatId,
                prospect: conversation.prospect,
            },
            messages: messages.map((m) => ({
                id: m.id,
                unipileMessageId: m.unipileMessageId,
                senderType: m.senderType,
                text: m.text,
                sentAt: m.sentAt,
            })),
        });
    }
    catch (error) {
        console.error("[Inbox] Erreur getMessages:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * Envoie un message dans une conversation
 */
export async function sendMessage(req, res) {
    try {
        const userId = req.user.id;
        const { conversationId, text } = req.body;
        if (!text || !text.trim()) {
            res.status(400).json({ success: false, error: "Le texte du message est requis." });
            return;
        }
        const conversation = await prisma.conversation.findFirst({
            where: {
                OR: [{ id: conversationId }, { unipileChatId: conversationId }],
            },
            include: {
                prospect: true,
            },
        });
        if (!conversation) {
            res.status(404).json({ success: false, error: "Conversation introuvable." });
            return;
        }
        let unipileMsgId;
        // Envoi via Unipile
        if (conversation.unipileChatId) {
            const sendRes = await UnipileService.sendChatMessage({
                chatId: conversation.unipileChatId,
                text: text.trim(),
            });
            if (!sendRes.success) {
                res.status(500).json({
                    success: false,
                    error: sendRes.error || "Erreur d'envoi du message sur LinkedIn.",
                });
                return;
            }
            unipileMsgId = sendRes.messageId;
        }
        else {
            // Si pas encore de chat, démarrer un nouveau chat via Unipile
            const account = await prisma.linkedInAccount.findFirst({ where: { userId } });
            const attendeeId = conversation.prospect.providerProfileId || conversation.prospect.id;
            const startRes = await UnipileService.startChat({
                accountId: account?.unipileAccountId,
                attendeeId,
                text: text.trim(),
            });
            if (startRes.success && startRes.chatId) {
                await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: { unipileChatId: startRes.chatId },
                });
            }
        }
        // Persister en base locale
        const now = new Date();
        const createdMessage = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                unipileMessageId: unipileMsgId,
                senderType: "USER",
                text: text.trim(),
                sentAt: now,
            },
        });
        // Mettre à jour la conversation
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageText: text.trim(),
                lastMessageAt: now,
                updatedAt: now,
            },
        });
        res.status(201).json({
            success: true,
            message: createdMessage,
        });
    }
    catch (error) {
        console.error("[Inbox] Erreur sendMessage:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
