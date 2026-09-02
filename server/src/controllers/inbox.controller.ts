import { Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { UnipileService } from "../services/unipile.service.js";

/**
 * Récupère l'account_id Unipile actif de l'utilisateur
 */
async function getValidLinkedInAccountId(userId: string): Promise<string> {
  const account = await prisma.linkedInAccount.findFirst({
    where: {
      userId,
      status: "CONNECTED",
      accountName: { not: null },
    },
    orderBy: { updatedAt: "desc" },
  });
  return account?.unipileAccountId || process.env.UNIPILE_ACCOUNT_ID || "FxLKTO1HTWuSk4ibfehPAg";
}

/**
 * Arrêt automatique de la campagne dès qu'une réponse est détectée
 */
export async function handleProspectReply(prospectId: string, text?: string) {
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

        console.log(
          `[Inbox] Réponse détectée pour prospect ${prospectId} : Séquence arrêtée automatiquement sur la campagne "${state.campaign.name}".`
        );
      }
    }
  } catch (err) {
    console.error("[Inbox] Erreur handleProspectReply:", err);
  }
}

/**
 * Synchronise les discussions Unipile pour un utilisateur donné
 */
async function syncUserChatsWithUnipile(userId: string, limit: number = 50) {
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

  // Liste par défaut "Messagerie LinkedIn"
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

  let count = 0;

  for (const item of unipileChats.items) {
    const chatId = item.id;
    if (!chatId) continue;

    const attendeeProviderId = item.attendee_provider_id;
    const attendees = Array.isArray(item.attendees) ? item.attendees : [];
    const otherAttendee =
      attendees.find((a: any) => !a.is_self && (a.provider_id || a.id)) ||
      attendees[0] ||
      {};

    const providerId =
      attendeeProviderId ||
      otherAttendee.provider_id ||
      otherAttendee.id ||
      item.provider_id;

    const attendeeName = (otherAttendee.name || item.name || "Contact LinkedIn").trim();
    const attendeePicture =
      otherAttendee.picture_url ||
      otherAttendee.avatar_url ||
      otherAttendee.picture ||
      item.picture_url ||
      null;
    const attendeeHeadline =
      otherAttendee.headline || otherAttendee.occupation || item.subject || "Contact LinkedIn";

    const nameParts = attendeeName.split(" ");
    const firstName = nameParts[0] || "Contact";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Chercher si le prospect existe déjà
    const orConditions: any[] = [];
    if (providerId) orConditions.push({ providerProfileId: providerId });
    if (attendeeProviderId) orConditions.push({ providerProfileId: attendeeProviderId });
    if (attendeeName && attendeeName !== "Contact LinkedIn") {
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
          listId: defaultList.id,
          providerProfileId: providerId || `chat_${chatId}`,
          firstName,
          lastName,
          linkedinUrl:
            otherAttendee.profile_url ||
            (providerId && (providerId.startsWith("ACo") || providerId.startsWith("ACw"))
              ? `https://www.linkedin.com/in/${providerId}`
              : `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(attendeeName)}`),
          avatarUrl: attendeePicture,
          headline: attendeeHeadline,
          connectionStatus: "CONNECTED",
        },
      });
    } else {
      // Mettre à jour les informations manquantes
      const updates: any = {};
      if (!prospect.avatarUrl && attendeePicture) updates.avatarUrl = attendeePicture;
      if (!prospect.headline && attendeeHeadline) updates.headline = attendeeHeadline;
      if (!prospect.providerProfileId && providerId) updates.providerProfileId = providerId;
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
      await prisma.conversation.update({
        where: { id: existingConv.id },
        data: {
          unipileChatId: chatId,
          lastMessageText: lastText || existingConv.lastMessageText,
          lastMessageAt: lastTime,
          unreadCount,
          prospectId: prospect.id,
        },
      });
    } else {
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

    count++;
  }

  return { synced: count };
}

/**
 * GET /api/inbox/conversations
 * Récupère la liste des conversations avec prospects liés et synchronisation
 */
export async function getConversations(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { status, search } = req.query as { status?: string; search?: string };

    // Synchronisation automatique douce
    try {
      await syncUserChatsWithUnipile(userId, 30);
    } catch (syncErr) {
      console.warn("[Inbox] Erreur synchronisation douce Unipile:", syncErr);
    }

    // Récupérer les conversations depuis la base de données
    const whereClause: any = {
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
        { prospect: { headline: { contains: q, mode: "insensitive" } } },
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
      result = conversations.filter(
        (c) =>
          c.prospect.campaignStates &&
          c.prospect.campaignStates.some((cs) => cs.campaign.status === "ACTIVE")
      );
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
        prospect: { list: { userId } },
        unreadCount: { gt: 0 },
      },
      _sum: { unreadCount: true },
    });

    res.json({
      success: true,
      conversations: formatted,
      totalUnread: totalUnread._sum.unreadCount || 0,
    });
  } catch (error: any) {
    console.error("[Inbox] Erreur getConversations:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/inbox/sync
 * Forcer une synchronisation complète avec Unipile
 */
export async function syncAllConversations(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const syncRes = await syncUserChatsWithUnipile(userId, 100);

    res.json({
      success: true,
      synced: syncRes.synced,
      message: `${syncRes.synced} conversations synchronisées avec LinkedIn.`,
    });
  } catch (error: any) {
    console.error("[Inbox] Erreur syncAllConversations:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/inbox/conversations/:id/messages
 * Récupère les messages d'une conversation et marque comme lue
 */
export async function getMessages(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;

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

    // 1. Synchroniser les messages frais depuis Unipile si chatId présent
    if (conversation.unipileChatId) {
      try {
        const unipileMessages = await UnipileService.getChatMessages({
          chatId: conversation.unipileChatId,
          limit: 50,
        });

        if (unipileMessages.success && Array.isArray(unipileMessages.items)) {
          for (const m of unipileMessages.items) {
            const senderType =
              m.is_sender === true || m.sender_id === "self" || m.sender_id === "me"
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
      } catch (fetchErr) {
        console.warn("[Inbox] Erreur lecture messages Unipile:", fetchErr);
      }
    }

    // 2. Marquer la conversation comme lue en BDD et sur LinkedIn
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { unreadCount: 0 },
    });

    if (conversation.unipileChatId) {
      UnipileService.markChatAsRead(conversation.unipileChatId).catch(() => {});
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
        unipileChatId: conversation.unipileChatId,
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
  } catch (error: any) {
    console.error("[Inbox] Erreur getMessages:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/inbox/messages/send
 * Envoie un message dans une conversation et garantit la livraison LinkedIn
 */
export async function sendMessage(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
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
    let targetChatId = conversation.unipileChatId;

    // 1. Si pas de chat ID Unipile, tenter de le trouver ou d'initier le chat
    if (!targetChatId) {
      const attendeeId = conversation.prospect.providerProfileId;
      if (attendeeId) {
        const chatsList = await UnipileService.getChats({ accountId, limit: 50 });
        if (chatsList.success && Array.isArray(chatsList.items)) {
          const matchChat = chatsList.items.find(
            (c: any) => c.attendee_provider_id === attendeeId || c.provider_id === attendeeId
          );
          if (matchChat?.id) {
            targetChatId = matchChat.id;
          }
        }

        if (!targetChatId) {
          const startRes = await UnipileService.startChat({
            accountId,
            attendeeId,
            text: text.trim(),
          });
          if (startRes.success && startRes.chatId) {
            targetChatId = startRes.chatId;
          } else {
            res.status(500).json({
              success: false,
              error: startRes.error || "Impossible d'initier la conversation avec ce contact sur LinkedIn.",
            });
            return;
          }
        }
      }
    }

    if (!targetChatId) {
      res.status(400).json({
        success: false,
        error: "Identifiant LinkedIn du prospect introuvable pour l'envoi du message.",
      });
      return;
    }

    // Sauvegarder l'id Unipile dans la conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { unipileChatId: targetChatId },
    });

    // 2. Envoyer le message sur LinkedIn via Unipile
    const sendRes = await UnipileService.sendChatMessage({
      chatId: targetChatId,
      text: text.trim(),
      attachments,
    });

    if (!sendRes.success) {
      res.status(500).json({
        success: false,
        error: sendRes.error || "Erreur lors de l'envoi du message sur LinkedIn.",
      });
      return;
    }

    // 3. Persister le message confirmé en base de données locale
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
  } catch (error: any) {
    console.error("[Inbox] Erreur sendMessage:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/inbox/conversations/new
 * Démarre une nouvelle conversation avec un prospect ou un profil LinkedIn
 */
export async function startNewConversation(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { prospectId, linkedinUrl, text } = req.body;

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
    } else if (linkedinUrl) {
      let defaultList = await prisma.prospectList.findFirst({ where: { userId } });
      if (!defaultList) {
        defaultList = await prisma.prospectList.create({
          data: { userId, name: "Messagerie LinkedIn", color: "#592eff" },
        });
      }

      const accountId = await getValidLinkedInAccountId(userId);
      const profileData = await UnipileService.getProfileDetailsAndStatus(linkedinUrl, accountId);

      const p = profileData.profile;
      prospect = await prisma.prospect.create({
        data: {
          listId: defaultList.id,
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

    const accountId = await getValidLinkedInAccountId(userId);
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
          prospectId: prospect.id,
          unipileChatId: targetChatId,
          lastMessageText: text.trim(),
          lastMessageAt: now,
          unreadCount: 0,
        },
      });
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
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
  } catch (error: any) {
    console.error("[Inbox] Erreur startNewConversation:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * PATCH /api/inbox/conversations/:id/read
 * Marque manuellement une conversation comme lue
 */
export async function markAsRead(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const conversation = await prisma.conversation.findFirst({
      where: { OR: [{ id }, { unipileChatId: id }] },
    });

    if (conversation) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { unreadCount: 0 },
      });
      if (conversation.unipileChatId) {
        UnipileService.markChatAsRead(conversation.unipileChatId).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * PATCH /api/inbox/prospects/:id
 * Met à jour les informations prospect depuis le volet CRM de la messagerie
 */
export async function updateProspectDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const { tags, email, phone, company, headline, location, doNotContact } = req.body;

    const data: any = {};
    if (tags !== undefined) data.tags = tags;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (company !== undefined) data.company = company;
    if (headline !== undefined) data.headline = headline;
    if (location !== undefined) data.location = location;
    if (doNotContact !== undefined) data.doNotContact = doNotContact;

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
  } catch (error: any) {
    console.error("[Inbox] Erreur updateProspectDetails:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
