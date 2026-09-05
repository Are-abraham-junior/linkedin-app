import { prisma } from "../../../lib/prisma.js";
import { UnipileService } from "../services/unipile.service.js";
// Caches mémoire pour éviter le spam réseau vers l'API Unipile et les temps de réponse de 15s
const lastSyncByUser = new Map();
const syncInFlight = new Set();
const lastMessagesSyncByChat = new Map();
/**
 * Récupère l'account_id Unipile actif strictement lié à l'utilisateur connecté
 */
async function getValidLinkedInAccountId(userId) {
    try {
        const account = await prisma.linkedInAccount.findFirst({
            where: {
                userId,
                status: "CONNECTED",
                unipileAccountId: { not: "" },
            },
            orderBy: { updatedAt: "desc" },
        });
        if (account?.unipileAccountId) {
            return account.unipileAccountId;
        }
    }
    catch (dbErr) {
        console.warn("[Inbox] Erreur lecture BDD linkedInAccount:", dbErr);
    }
    return null;
}
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
 * Synchronise les discussions Unipile pour un utilisateur donné avec throttling
 */
export async function syncUserChatsWithUnipile(userId, limit = 50, force = false) {
    const now = Date.now();
    const lastSync = lastSyncByUser.get(userId) || 0;
    // Throttling : si synchronisé il y a moins de 60s ou déjà en cours, servir la BDD immédiatement
    if (!force && (now - lastSync < 60_000 || syncInFlight.has(userId))) {
        return { synced: 0, cached: true };
    }
    syncInFlight.add(userId);
    try {
        const unipileAccountId = await getValidLinkedInAccountId(userId);
        if (!unipileAccountId) {
            return { synced: 0 };
        }
        const unipileChats = await UnipileService.getChats({
            accountId: unipileAccountId,
            limit,
        });
        if (!unipileChats.success || !Array.isArray(unipileChats.items)) {
            return { synced: 0, error: unipileChats.error };
        }
        let count = 0;
        for (const item of unipileChats.items) {
            const chatId = item.id;
            if (!chatId)
                continue;
            // Détecter si c'est un message publicitaire ou InMail sponsorisé
            const subject = (item.subject || "").toLowerCase();
            if (subject.includes("invitation") ||
                subject.includes("découvrez") ||
                subject.includes("odoo") ||
                subject.includes("gartner") ||
                subject.includes("mba") ||
                subject.includes("synergies") ||
                subject.includes("conférence")) {
                continue;
            }
            const attendeeProviderId = item.attendee_provider_id;
            const attendees = Array.isArray(item.attendees) ? item.attendees : [];
            let otherAttendee = attendees.find((a) => !a.is_self && (a.provider_id || a.id || a.name)) ||
                attendees[0] ||
                {};
            let providerId = attendeeProviderId ||
                otherAttendee.provider_id ||
                otherAttendee.id ||
                item.provider_id;
            let attendeeName = (otherAttendee.name || item.name || "").trim();
            let attendeePicture = otherAttendee.picture_url ||
                otherAttendee.avatar_url ||
                otherAttendee.picture ||
                item.picture_url ||
                null;
            let attendeeHeadline = otherAttendee.headline || otherAttendee.occupation || "";
            let profileUrl = otherAttendee.profile_url || null;
            // Si la conversation existe déjà avec un prospect bien nommé, réutiliser ses données pour éviter un appel réseau Unipile
            const existingConvForChat = await prisma.conversation.findFirst({
                where: { unipileChatId: chatId },
                include: { prospect: true },
            });
            if (existingConvForChat?.prospect && existingConvForChat.prospect.firstName && existingConvForChat.prospect.firstName !== "Contact") {
                attendeeName = `${existingConvForChat.prospect.firstName} ${existingConvForChat.prospect.lastName}`.trim();
                if (!attendeePicture)
                    attendeePicture = existingConvForChat.prospect.avatarUrl;
                if (!attendeeHeadline)
                    attendeeHeadline = existingConvForChat.prospect.headline || "";
                if (!profileUrl)
                    profileUrl = existingConvForChat.prospect.linkedinUrl;
            }
            // Si le nom du participant est absent ou générique, interroger l'API Unipile des participants
            if (!attendeeName || attendeeName === "Contact LinkedIn" || attendeeName === "LinkedIn Member") {
                try {
                    const attendeesRes = await UnipileService.getChatAttendees(chatId);
                    if (attendeesRes.success && Array.isArray(attendeesRes.items) && attendeesRes.items.length > 0) {
                        const realOther = attendeesRes.items.find((a) => !a.is_self && (a.name || a.provider_id)) ||
                            attendeesRes.items[0];
                        if (realOther) {
                            // Ignorer s'il s'agit d'une page entreprise ou d'un compte masqué
                            if (realOther.specifics?.is_company || realOther.hidden) {
                                continue;
                            }
                            if (realOther.name && realOther.name.trim() !== "Contact LinkedIn") {
                                attendeeName = realOther.name.trim();
                            }
                            if (realOther.picture_url)
                                attendeePicture = realOther.picture_url;
                            if (realOther.specifics?.occupation)
                                attendeeHeadline = realOther.specifics.occupation;
                            if (realOther.provider_id)
                                providerId = realOther.provider_id;
                            if (realOther.profile_url)
                                profileUrl = realOther.profile_url;
                        }
                    }
                }
                catch (attErr) {
                    console.warn(`[Inbox] Impossible de récupérer les participants du chat ${chatId}:`, attErr);
                }
            }
            // Si aucun nom humain valide n'a pu être identifié, ignorer pour ne pas polluer la messagerie
            if (!attendeeName ||
                attendeeName === "Contact LinkedIn" ||
                attendeeName === "LinkedIn Member" ||
                attendeeName.toLowerCase().startsWith("invitation") ||
                attendeeName.toLowerCase().startsWith("découvrez") ||
                attendeeName.toLowerCase().startsWith("échange")) {
                continue;
            }
            const nameParts = attendeeName.split(" ");
            const firstName = nameParts[0] || "Contact";
            const lastName = nameParts.slice(1).join(" ") || "";
            // Chercher si le prospect existe déjà
            const orConditions = [];
            if (providerId)
                orConditions.push({ providerProfileId: providerId });
            if (attendeeProviderId)
                orConditions.push({ providerProfileId: attendeeProviderId });
            if (attendeeName) {
                orConditions.push({
                    firstName: { equals: firstName, mode: "insensitive" },
                    lastName: { equals: lastName, mode: "insensitive" },
                });
            }
            let prospect = orConditions.length > 0
                ? await prisma.prospect.findFirst({
                    where: {
                        OR: orConditions,
                    },
                })
                : null;
            if (!prospect) {
                prospect = await prisma.prospect.create({
                    data: {
                        userId,
                        listId: null,
                        providerProfileId: providerId || `chat_${chatId}`,
                        firstName,
                        lastName,
                        linkedinUrl: profileUrl ||
                            (providerId && (providerId.startsWith("ACo") || providerId.startsWith("ACw"))
                                ? `https://www.linkedin.com/in/${providerId}`
                                : `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(attendeeName)}`),
                        avatarUrl: attendeePicture,
                        headline: attendeeHeadline || "Contact LinkedIn",
                        connectionStatus: "CONNECTED",
                    },
                });
            }
            else {
                // Mettre à jour les informations manquantes
                const updates = {};
                if (!prospect.userId)
                    updates.userId = userId;
                if (!prospect.avatarUrl && attendeePicture)
                    updates.avatarUrl = attendeePicture;
                if ((!prospect.headline || prospect.headline === "Contact LinkedIn") && attendeeHeadline) {
                    updates.headline = attendeeHeadline;
                }
                if (!prospect.providerProfileId && providerId)
                    updates.providerProfileId = providerId;
                if (profileUrl && !prospect.linkedinUrl.includes("/in/"))
                    updates.linkedinUrl = profileUrl;
                if (Object.keys(updates).length > 0) {
                    prospect = await prisma.prospect.update({
                        where: { id: prospect.id },
                        data: updates,
                    });
                }
            }
            const lastMsgObj = item.last_message;
            const lastText = typeof lastMsgObj === "string" ? lastMsgObj : lastMsgObj?.text || item.snippet || "";
            const lastTime = lastMsgObj?.timestamp
                ? new Date(lastMsgObj.timestamp)
                : item.timestamp
                    ? new Date(item.timestamp)
                    : new Date();
            const unreadCount = typeof item.unread_count === "number" ? item.unread_count : 0;
            // Rechercher la conversation par unipileChatId ou par prospectId
            const existingConv = await prisma.conversation.findFirst({
                where: {
                    OR: [{ unipileChatId: chatId }, { prospectId: prospect.id }],
                },
            });
            if (existingConv) {
                // Protection anti-écrasement du statut "lu" :
                // Si la conversation a été lue en local (unreadCount === 0), on ne remet non-lu que si un NOUVEAU message est arrivé
                const isNewerMessage = existingConv.lastMessageAt &&
                    lastTime &&
                    lastTime.getTime() > existingConv.lastMessageAt.getTime();
                const finalUnread = existingConv.unreadCount === 0 && !isNewerMessage ? 0 : unreadCount;
                await prisma.conversation.update({
                    where: { id: existingConv.id },
                    data: {
                        userId,
                        unipileChatId: chatId,
                        lastMessageText: lastText || existingConv.lastMessageText,
                        lastMessageAt: lastTime || existingConv.lastMessageAt,
                        unreadCount: finalUnread,
                        prospectId: prospect.id,
                    },
                });
            }
            else {
                await prisma.conversation.create({
                    data: {
                        userId,
                        prospectId: prospect.id,
                        unipileChatId: chatId,
                        lastMessageText: lastText,
                        lastMessageAt: lastTime,
                        unreadCount,
                    },
                });
            }
            count++;
        }
        lastSyncByUser.set(userId, Date.now());
        return { synced: count };
    }
    finally {
        syncInFlight.delete(userId);
    }
}
/**
 * GET /api/inbox/conversations
 * Récupère la liste des conversations avec prospects liés et synchronisation
 */
export async function getConversations(req, res) {
    try {
        const userId = req.user.id;
        const { status, search } = req.query;
        // 1. Vérifier si l'utilisateur possède un compte LinkedIn connecté actif
        const activeLinkedIn = await getValidLinkedInAccountId(userId);
        if (!activeLinkedIn) {
            res.json({
                success: true,
                conversations: [],
                totalUnread: 0,
            });
            return;
        }
        // Synchronisation en arrière-plan non bloquante (réponse BDD instantanée < 50ms)
        syncUserChatsWithUnipile(userId, 20).catch((syncErr) => {
            console.warn("[Inbox] Erreur background sync Unipile:", syncErr);
        });
        // Récupérer les conversations depuis la base de données
        const whereClause = {
            OR: [
                { userId },
                { prospect: { userId } },
                { prospect: { list: { userId } } },
            ],
        };
        if (status === "UNREAD") {
            whereClause.unreadCount = { gt: 0 };
        }
        if (search && search.trim()) {
            const q = search.trim();
            whereClause.AND = [
                {
                    OR: [
                        { lastMessageText: { contains: q, mode: "insensitive" } },
                        { prospect: { firstName: { contains: q, mode: "insensitive" } } },
                        { prospect: { lastName: { contains: q, mode: "insensitive" } } },
                        { prospect: { company: { contains: q, mode: "insensitive" } } },
                        { prospect: { headline: { contains: q, mode: "insensitive" } } },
                    ],
                },
            ];
        }
        const conversations = await prisma.conversation.findMany({
            where: whereClause,
            include: {
                prospect: {
                    include: {
                        list: { select: { id: true, name: true, color: true } },
                        campaignStates: {
                            include: {
                                campaign: { select: { id: true, name: true, status: true } },
                                currentStep: true,
                            },
                        },
                    },
                },
            },
            orderBy: { lastMessageAt: "desc" },
        });
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
                    location: c.prospect.location,
                    email: c.prospect.email,
                    phone: c.prospect.phone,
                    avatarUrl: c.prospect.avatarUrl,
                    linkedinUrl: c.prospect.linkedinUrl,
                    connectionStatus: c.prospect.connectionStatus,
                    tags: c.prospect.tags,
                    list: c.prospect.list,
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
        // Total non lus
        const totalUnread = await prisma.conversation.aggregate({
            where: {
                OR: [
                    { userId },
                    { prospect: { userId } },
                    { prospect: { list: { userId } } },
                ],
                unreadCount: { gt: 0 },
            },
            _sum: { unreadCount: true },
        });
        res.json({
            success: true,
            conversations: formatted,
            totalUnread: totalUnread._sum.unreadCount || 0,
        });
    }
    catch (error) {
        console.error("[Inbox] Erreur getConversations:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * POST /api/inbox/sync
 * Forcer une synchronisation complète avec Unipile
 */
export async function syncAllConversations(req, res) {
    try {
        const userId = req.user.id;
        const syncRes = await syncUserChatsWithUnipile(userId, 100, true);
        res.json({
            success: true,
            synced: syncRes.synced,
            message: `${syncRes.synced} conversations synchronisées avec LinkedIn.`,
        });
    }
    catch (error) {
        console.error("[Inbox] Erreur syncAllConversations:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * GET /api/inbox/conversations/:id/messages
 * Récupère les messages d'une conversation et marque comme lue
 */
export async function getMessages(req, res) {
    try {
        const userId = req.user.id;
        const id = req.params.id;
        const conversation = await prisma.conversation.findFirst({
            where: {
                OR: [{ id }, { unipileChatId: id }],
            },
            include: {
                prospect: {
                    include: {
                        list: true,
                        campaignStates: {
                            include: {
                                campaign: true,
                                currentStep: true,
                            },
                        },
                    },
                },
            },
        });
        if (!conversation) {
            res.status(404).json({ success: false, error: "Conversation introuvable." });
            return;
        }
        const accountId = await getValidLinkedInAccountId(userId);
        let activeChatId = conversation.unipileChatId;
        // 1. Synchroniser les messages frais depuis Unipile (avec cache de 15 secondes pour éviter le blocage)
        const lastMsgSync = activeChatId ? lastMessagesSyncByChat.get(activeChatId) || 0 : 0;
        const shouldSyncMessages = Date.now() - lastMsgSync > 15_000;
        if (activeChatId && shouldSyncMessages) {
            lastMessagesSyncByChat.set(activeChatId, Date.now());
            try {
                let unipileMessages = await UnipileService.getChatMessages({
                    chatId: activeChatId,
                    limit: 50,
                });
                // Si 404 (chat ID expiré / nouveau compte), tenter de retrouver le nouveau chat ID
                if (!unipileMessages.success && unipileMessages.error?.includes("404")) {
                    const attendeeId = conversation.prospect.providerProfileId;
                    if (attendeeId) {
                        const chatsList = await UnipileService.getChats({ accountId: accountId || undefined, limit: 50 });
                        if (chatsList.success && Array.isArray(chatsList.items)) {
                            const matchChat = chatsList.items.find((c) => c.attendee_provider_id === attendeeId ||
                                c.provider_id === attendeeId ||
                                (c.attendees && c.attendees.some((a) => a.provider_id === attendeeId)));
                            if (matchChat?.id) {
                                const newChatId = matchChat.id;
                                activeChatId = newChatId;
                                await prisma.conversation.update({
                                    where: { id: conversation.id },
                                    data: { unipileChatId: newChatId },
                                });
                                unipileMessages = await UnipileService.getChatMessages({
                                    chatId: newChatId,
                                    limit: 50,
                                });
                            }
                        }
                    }
                }
                if (unipileMessages.success && Array.isArray(unipileMessages.items)) {
                    for (const m of unipileMessages.items) {
                        const senderType = m.is_sender === true || m.sender_id === "self" || m.sender_id === "me"
                            ? "USER"
                            : "PROSPECT";
                        const text = m.text || "";
                        const sentAt = m.timestamp ? new Date(m.timestamp) : new Date();
                        const msgId = m.id || m.message_id;
                        if (msgId) {
                            await prisma.message.upsert({
                                where: { unipileMessageId: msgId },
                                update: { text, sentAt },
                                create: {
                                    conversationId: conversation.id,
                                    unipileMessageId: msgId,
                                    senderType,
                                    text,
                                    sentAt,
                                },
                            });
                        }
                        // Si c'est un message du prospect, vérifier l'arrêt automatique de la campagne
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
        // 2. Marquer la conversation comme lue en BDD et sur LinkedIn
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: { unreadCount: 0 },
        });
        if (activeChatId) {
            UnipileService.markChatAsRead(activeChatId).catch(() => { });
        }
        // 3. Récupérer les messages ordonnés chronologiquement
        const messages = await prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { sentAt: "asc" },
        });
        res.json({
            success: true,
            conversation: {
                id: conversation.id,
                unipileChatId: activeChatId,
                lastMessageText: conversation.lastMessageText,
                lastMessageAt: conversation.lastMessageAt,
                unreadCount: 0,
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
 * POST /api/inbox/messages/send
 * Envoie un message dans une conversation avec mécanisme d'auto-réparation et garantie de livraison LinkedIn
 */
export async function sendMessage(req, res) {
    try {
        const userId = req.user.id;
        const { conversationId, text, attachments } = req.body;
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
        const accountId = await getValidLinkedInAccountId(userId);
        if (!accountId) {
            res.status(400).json({
                success: false,
                error: "Veuillez connecter votre compte LinkedIn pour envoyer des messages.",
            });
            return;
        }
        let targetChatId = conversation.unipileChatId;
        let sendRes = null;
        // 1. Si nous avons un targetChatId existant, tenter l'envoi direct
        if (targetChatId) {
            sendRes = await UnipileService.sendChatMessage({
                chatId: targetChatId,
                text: text.trim(),
                attachments,
            });
        }
        // 2. Si pas de targetChatId OU si l'envoi a retourné 404 (chat introuvable / expiré sur Unipile)
        if (!targetChatId || (!sendRes?.success && sendRes?.error?.includes("404"))) {
            console.log(`[Inbox] Chat ID ${targetChatId} introuvable ou invalide. Auto-résolution sur le compte Unipile ${accountId}...`);
            const attendeeId = conversation.prospect.providerProfileId || conversation.prospect.linkedinUrl;
            if (!attendeeId) {
                res.status(400).json({
                    success: false,
                    error: "Identifiant LinkedIn du prospect introuvable pour l'envoi du message.",
                });
                return;
            }
            // Rechercher dans la liste des chats du compte actif
            let foundChatId = null;
            const chatsList = await UnipileService.getChats({ accountId, limit: 50 });
            if (chatsList.success && Array.isArray(chatsList.items)) {
                const matchChat = chatsList.items.find((c) => c.attendee_provider_id === attendeeId ||
                    c.provider_id === attendeeId ||
                    (c.attendees && c.attendees.some((a) => a.provider_id === attendeeId)));
                if (matchChat?.id) {
                    foundChatId = matchChat.id;
                }
            }
            // Si non trouvé, créer / initier le chat
            if (!foundChatId) {
                const startRes = await UnipileService.startChat({
                    accountId,
                    attendeeId,
                    text: text.trim(),
                });
                if (startRes.success && startRes.chatId) {
                    foundChatId = startRes.chatId;
                }
                else {
                    res.status(500).json({
                        success: false,
                        error: startRes.error || "Impossible d'initier la conversation avec ce contact sur LinkedIn.",
                    });
                    return;
                }
            }
            targetChatId = foundChatId;
            // Mettre à jour le chat ID valide en BDD
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: { unipileChatId: targetChatId },
            });
            // Envoyer le message sur le nouveau chat ID
            sendRes = await UnipileService.sendChatMessage({
                chatId: targetChatId,
                text: text.trim(),
                attachments,
            });
        }
        if (!sendRes || !sendRes.success) {
            res.status(500).json({
                success: false,
                error: sendRes?.error || "Erreur lors de l'envoi du message sur LinkedIn.",
            });
            return;
        }
        // 3. Persister le message confirmé en base locale
        const now = new Date();
        const createdMessage = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                unipileMessageId: sendRes.messageId,
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
/**
 * POST /api/inbox/conversations/new
 * Démarre une nouvelle conversation avec un prospect ou un profil LinkedIn
 */
export async function startNewConversation(req, res) {
    try {
        const userId = req.user.id;
        const { prospectId, linkedinUrl, text } = req.body;
        const accountId = await getValidLinkedInAccountId(userId);
        if (!accountId) {
            res.status(400).json({
                success: false,
                error: "Veuillez connecter votre compte LinkedIn pour initier une discussion.",
            });
            return;
        }
        if (!text || !text.trim()) {
            res.status(400).json({ success: false, error: "Le texte du message est requis." });
            return;
        }
        let prospect = null;
        if (prospectId) {
            prospect = await prisma.prospect.findUnique({
                where: { id: prospectId },
                include: { list: true },
            });
        }
        else if (linkedinUrl) {
            const profileData = await UnipileService.getProfileDetailsAndStatus(linkedinUrl, accountId);
            const p = profileData.profile;
            prospect = await prisma.prospect.create({
                data: {
                    userId,
                    listId: null,
                    linkedinUrl,
                    providerProfileId: p?.providerProfileId,
                    firstName: p?.firstName || "Contact",
                    lastName: p?.lastName || "LinkedIn",
                    avatarUrl: p?.avatarUrl,
                    headline: p?.headline || "Contact LinkedIn",
                    company: p?.company,
                    location: p?.location,
                    email: p?.email,
                    connectionStatus: profileData.connectionStatus || "CONNECTED",
                },
            });
        }
        if (!prospect) {
            res.status(400).json({ success: false, error: "Prospect ou URL LinkedIn valide requis." });
            return;
        }
        // Vérifier si une conversation existe déjà
        let conversation = await prisma.conversation.findFirst({
            where: { prospectId: prospect.id },
        });
        const attendeeId = prospect.providerProfileId || prospect.linkedinUrl;
        const startRes = await UnipileService.startChat({
            accountId,
            attendeeId,
            text: text.trim(),
        });
        if (!startRes.success || !startRes.chatId) {
            res.status(500).json({
                success: false,
                error: startRes.error || "Impossible d'initier la discussion sur LinkedIn.",
            });
            return;
        }
        const targetChatId = startRes.chatId;
        // S'assurer que le message est bien posté dans la discussion
        const sendRes = await UnipileService.sendChatMessage({
            chatId: targetChatId,
            text: text.trim(),
        });
        const now = new Date();
        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    userId,
                    prospectId: prospect.id,
                    unipileChatId: targetChatId,
                    lastMessageText: text.trim(),
                    lastMessageAt: now,
                    unreadCount: 0,
                },
            });
        }
        else {
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                    userId,
                    unipileChatId: targetChatId,
                    lastMessageText: text.trim(),
                    lastMessageAt: now,
                },
            });
        }
        // Enregistrer le message confirmé
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                unipileMessageId: sendRes.messageId,
                senderType: "USER",
                text: text.trim(),
                sentAt: now,
            },
        });
        res.status(201).json({
            success: true,
            conversation: {
                ...conversation,
                prospect,
            },
            message,
        });
    }
    catch (error) {
        console.error("[Inbox] Erreur startNewConversation:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * PATCH /api/inbox/conversations/:id/read
 * Marque manuellement une conversation comme lue
 */
export async function markAsRead(req, res) {
    try {
        const id = req.params.id;
        const conversation = await prisma.conversation.findFirst({
            where: { OR: [{ id }, { unipileChatId: id }] },
        });
        if (conversation) {
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: { unreadCount: 0 },
            });
            if (conversation.unipileChatId) {
                UnipileService.markChatAsRead(conversation.unipileChatId).catch(() => { });
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
/**
 * PATCH /api/inbox/prospects/:id
 * Met à jour les informations prospect depuis le volet CRM de la messagerie
 */
export async function updateProspectDetails(req, res) {
    try {
        const id = req.params.id;
        const { tags, email, phone, company, headline, location, doNotContact, listId } = req.body;
        const data = {};
        if (tags !== undefined)
            data.tags = tags;
        if (email !== undefined)
            data.email = email;
        if (phone !== undefined)
            data.phone = phone;
        if (company !== undefined)
            data.company = company;
        if (headline !== undefined)
            data.headline = headline;
        if (location !== undefined)
            data.location = location;
        if (doNotContact !== undefined)
            data.doNotContact = doNotContact;
        if (listId !== undefined)
            data.listId = listId;
        const updated = await prisma.prospect.update({
            where: { id },
            data,
            include: {
                list: true,
                campaignStates: {
                    include: {
                        campaign: true,
                        currentStep: true,
                    },
                },
            },
        });
        res.json({
            success: true,
            prospect: updated,
        });
    }
    catch (error) {
        console.error("[Inbox] Erreur updateProspectDetails:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
