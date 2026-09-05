import { prisma } from "../../../lib/prisma.js";
import { handleProspectReply } from "./inbox.controller.js";
/**
 * Webhook Unipile pour la réception d'événements asynchrones
 * Événements supportés :
 * - message_received / chat_message_received : nouveau message LinkedIn reçu
 * - message_sent : message envoyé
 */
export async function handleUnipileWebhook(req, res) {
    try {
        const event = req.body;
        console.log("[Webhook Unipile] Événement reçu :", event?.event || event?.type);
        const eventType = event?.event || event?.type;
        const data = event?.data || event;
        if (eventType === "message_received" ||
            eventType === "chat_message_received" ||
            eventType === "new_message") {
            const chatId = data.chat_id || data.chatId;
            const text = data.text || data.message || "";
            const senderId = data.sender_id || data.senderId;
            const accountId = data.account_id || data.accountId;
            if (chatId) {
                // 1. Trouver la conversation
                let conv = await prisma.conversation.findUnique({
                    where: { unipileChatId: chatId },
                    include: { prospect: true },
                });
                // 2. Si la conversation n'existe pas encore, la créer avec un prospect associé
                if (!conv) {
                    // Trouver l'utilisateur associé au compte LinkedIn
                    let user = null;
                    if (accountId) {
                        const acc = await prisma.linkedInAccount.findUnique({
                            where: { unipileAccountId: accountId },
                            include: { user: true },
                        });
                        user = acc?.user;
                    }
                    if (!user) {
                        console.warn(`[Webhook Unipile] Compte LinkedIn introuvable pour accountId=${accountId}. Message ignoré pour protéger l'étanchéité des données.`);
                        res.status(200).json({ success: true, ignored: true });
                        return;
                    }
                    if (user) {
                        const senderName = data.sender_name || data.name || "Contact LinkedIn";
                        const nameParts = senderName.split(" ");
                        const firstName = nameParts[0] || "Contact";
                        const lastName = nameParts.slice(1).join(" ") || "";
                        const prospect = await prisma.prospect.create({
                            data: {
                                userId: user.id,
                                listId: null,
                                providerProfileId: senderId || `user_${Date.now()}`,
                                firstName,
                                lastName,
                                linkedinUrl: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(senderName)}`,
                                avatarUrl: data.sender_picture_url || data.picture_url || null,
                                headline: data.sender_headline || "Contact LinkedIn",
                                connectionStatus: "CONNECTED",
                            },
                        });
                        conv = await prisma.conversation.create({
                            data: {
                                userId: user.id,
                                prospectId: prospect.id,
                                unipileChatId: chatId,
                                lastMessageText: text,
                                lastMessageAt: new Date(),
                                unreadCount: 1,
                            },
                            include: { prospect: true },
                        });
                    }
                }
                if (conv) {
                    const now = new Date();
                    const messageId = data.id || data.message_id || `msg_${Date.now()}`;
                    // Enregistrer ou màj le message
                    await prisma.message.upsert({
                        where: { unipileMessageId: messageId },
                        update: { text, sentAt: now },
                        create: {
                            conversationId: conv.id,
                            unipileMessageId: messageId,
                            senderType: data.is_sender ? "USER" : "PROSPECT",
                            text,
                            sentAt: now,
                        },
                    });
                    // Mettre à jour la conversation
                    await prisma.conversation.update({
                        where: { id: conv.id },
                        data: {
                            lastMessageText: text,
                            lastMessageAt: now,
                            unreadCount: data.is_sender ? conv.unreadCount : { increment: 1 },
                        },
                    });
                    // Arrêter la séquence de campagne pour ce prospect si c'est un message reçu
                    if (!data.is_sender) {
                        await handleProspectReply(conv.prospectId, text);
                    }
                }
            }
        }
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error("[Webhook Unipile] Erreur de traitement :", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
