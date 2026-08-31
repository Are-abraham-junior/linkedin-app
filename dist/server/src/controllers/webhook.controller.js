import { prisma } from "../../../lib/prisma.js";
import { handleProspectReply } from "./inbox.controller.js";
/**
 * Webhook Unipile pour la réception d'événements asynchrones
 * Événements supportés :
 * - message_received : nouveau message LinkedIn reçu
 * - message_sent : message envoyé
 */
export async function handleUnipileWebhook(req, res) {
    try {
        const event = req.body;
        console.log("[Webhook Unipile] Événement reçu :", event?.event || event?.type);
        const eventType = event?.event || event?.type;
        const data = event?.data || event;
        if (eventType === "message_received" || eventType === "chat_message_received") {
            const chatId = data.chat_id || data.chatId;
            const text = data.text || data.message || "";
            const senderId = data.sender_id || data.senderId;
            if (chatId) {
                // Trouver la conversation
                const conv = await prisma.conversation.findUnique({
                    where: { unipileChatId: chatId },
                    include: { prospect: true },
                });
                if (conv) {
                    const now = new Date();
                    // Enregistrer le message
                    await prisma.message.create({
                        data: {
                            conversationId: conv.id,
                            unipileMessageId: data.id || data.message_id,
                            senderType: "PROSPECT",
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
                            unreadCount: { increment: 1 },
                        },
                    });
                    // Arrêter la séquence de campagne pour ce prospect
                    await handleProspectReply(conv.prospectId, text);
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
