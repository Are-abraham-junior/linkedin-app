import { Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { z } from "zod";
import bcrypt from "bcryptjs";

const UpdateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  avatarUrl: z.string().url().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
});

export async function getProfile(req: AuthenticatedRequest, res: Response) {
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
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "Utilisateur introuvable" });
      return;
    }

    res.json({
      success: true,
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        organization: user.organization,
        maxDailyInvites: user.maxDailyInvites,
        maxDailyMsg: user.maxDailyMsg,
        linkedInAccount: user.accounts[0] || null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Non authentifié" });
      return;
    }

    const body = UpdateProfileSchema.parse(req.body);
    const updateData: any = {};

    if (body.name) updateData.name = body.name;
    if (body.avatarUrl) updateData.avatarUrl = body.avatarUrl;

    if (body.newPassword) {
      if (!body.currentPassword) {
        res.status(400).json({ success: false, error: "Mot de passe actuel requis pour changer de mot de passe." });
        return;
      }

      const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!currentUser || !currentUser.passwordHash) {
        res.status(400).json({ success: false, error: "Impossible de vérifier le mot de passe actuel." });
        return;
      }

      const isMatch = await bcrypt.compare(body.currentPassword, currentUser.passwordHash);
      if (!isMatch) {
        res.status(400).json({ success: false, error: "Mot de passe actuel incorrect." });
        return;
      }

      updateData.passwordHash = await bcrypt.hash(body.newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      include: { organization: true, accounts: true },
    });

    res.json({
      success: true,
      message: "Profil mis à jour avec succès.",
      profile: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        avatarUrl: updated.avatarUrl,
        role: updated.role,
        organization: updated.organization,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
      return;
    }
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getUserDashboardStats(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Non authentifié" });
      return;
    }

    const userId = req.user.id;

    // 1. Métriques globales réelles
    const [
      listsCount,
      prospectsCount,
      connectedProspects,
      pendingProspects,
      notConnectedProspects,
      doNotContactProspects,
      repliedProspects,
      activeCampaignsCount,
      totalCampaignsCount,
      queuedActionsCount,
      executedActionsCount,
      emailsFoundCount,
      phonesFoundCount,
      linkedInAccount,
    ] = await Promise.all([
      prisma.prospectList.count({ where: { userId } }),
      prisma.prospect.count({ where: { list: { userId } } }),
      prisma.prospect.count({ where: { list: { userId }, connectionStatus: "CONNECTED" } }),
      prisma.prospect.count({ where: { list: { userId }, connectionStatus: "PENDING" } }),
      prisma.prospect.count({ where: { list: { userId }, connectionStatus: "NOT_CONNECTED" } }),
      prisma.prospect.count({ where: { list: { userId }, doNotContact: true } }),
      prisma.prospectCampaignState.count({ where: { campaign: { userId }, status: "REPLIED" } }),
      prisma.campaign.count({ where: { userId, status: "ACTIVE" } }),
      prisma.campaign.count({ where: { userId } }),
      prisma.actionQueue.count({ where: { campaign: { userId }, status: "QUEUED" } }),
      prisma.actionQueue.count({ where: { campaign: { userId }, status: "EXECUTED" } }),
      prisma.prospect.count({ where: { list: { userId }, email: { not: null } } }),
      prisma.prospect.count({ where: { list: { userId }, phone: { not: null } } }),
      prisma.linkedInAccount.findFirst({ where: { userId } }),
    ]);

    // Taux réels (0 si aucune donnée)
    const acceptanceRate = prospectsCount > 0 ? Number(((connectedProspects / prospectsCount) * 100).toFixed(1)) : 0;
    const totalActions = executedActionsCount + (linkedInAccount?.dailyInvitesSent || 0) + (linkedInAccount?.dailyMsgSent || 0);
    const responseRate = totalActions > 0 
      ? Number(((repliedProspects / totalActions) * 100).toFixed(1))
      : (prospectsCount > 0 && repliedProspects > 0 ? Number(((repliedProspects / prospectsCount) * 100).toFixed(1)) : 0);

    // 2. Calcul des séries temporelles réelles sur les 7 derniers jours et 30 derniers jours
    const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    
    // Générer les 7 derniers jours
    const last7DaysPromises = Array.from({ length: 7 }, (_, idx) => {
      const dayOffset = 6 - idx;
      const date = new Date();
      date.setDate(date.getDate() - dayOffset);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
      const dayLabel = `${dayNames[date.getDay()]} ${date.getDate()}`;
      const fullDate = start.toISOString().split("T")[0];

      return Promise.all([
        prisma.prospect.count({
          where: { list: { userId }, createdAt: { gte: start, lte: end } },
        }),
        prisma.actionQueue.count({
          where: { campaign: { userId }, status: "EXECUTED", executedAt: { gte: start, lte: end } },
        }),
        prisma.actionQueue.count({
          where: { campaign: { userId }, actionType: "INVITATION", status: "EXECUTED", executedAt: { gte: start, lte: end } },
        }),
        prisma.actionQueue.count({
          where: { campaign: { userId }, actionType: "MESSAGE", status: "EXECUTED", executedAt: { gte: start, lte: end } },
        }),
        prisma.message.count({
          where: {
            conversation: { prospect: { list: { userId } } },
            senderType: "PROSPECT",
            sentAt: { gte: start, lte: end },
          },
        }),
      ]).then(([prospectsAdded, actionsExecuted, invitesSent, messagesSent, repliesReceived]) => ({
        date: fullDate,
        dayLabel,
        prospectsAdded,
        actionsExecuted,
        invitesSent,
        messagesSent,
        repliesReceived,
      }));
    });

    const evolution7d = await Promise.all(last7DaysPromises);

    // Générer les 30 derniers jours (agrégés par tranches de 3-5 jours ou journaliers)
    const last30DaysPromises = Array.from({ length: 15 }, (_, idx) => {
      const dayOffset = (14 - idx) * 2;
      const date = new Date();
      date.setDate(date.getDate() - dayOffset);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 23, 59, 59, 999);
      const dayLabel = `${date.getDate()} ${monthNames[date.getMonth()]}`;
      const fullDate = start.toISOString().split("T")[0];

      return Promise.all([
        prisma.prospect.count({
          where: { list: { userId }, createdAt: { gte: start, lte: end } },
        }),
        prisma.actionQueue.count({
          where: { campaign: { userId }, status: "EXECUTED", executedAt: { gte: start, lte: end } },
        }),
        prisma.actionQueue.count({
          where: { campaign: { userId }, actionType: "INVITATION", status: "EXECUTED", executedAt: { gte: start, lte: end } },
        }),
        prisma.actionQueue.count({
          where: { campaign: { userId }, actionType: "MESSAGE", status: "EXECUTED", executedAt: { gte: start, lte: end } },
        }),
      ]).then(([prospectsAdded, actionsExecuted, invitesSent, messagesSent]) => ({
        date: fullDate,
        dayLabel,
        prospectsAdded,
        actionsExecuted,
        invitesSent,
        messagesSent,
      }));
    });

    const evolution30d = await Promise.all(last30DaysPromises);

    res.json({
      success: true,
      stats: {
        listsCount,
        prospectsCount,
        connectedProspects,
        pendingProspects,
        notConnectedProspects,
        doNotContactProspects,
        repliedProspects,
        acceptanceRate,
        responseRate,
        activeCampaignsCount,
        totalCampaignsCount,
        queuedActionsCount,
        executedActionsCount,
        emailsFoundCount,
        phonesFoundCount,
        evolution: evolution7d,
        evolution30d,
        linkedInAccount: linkedInAccount
          ? {
              status: linkedInAccount.status,
              accountName: linkedInAccount.accountName,
              headline: linkedInAccount.headline,
              profilePicture: linkedInAccount.profilePicture,
              dailyInvitesSent: linkedInAccount.dailyInvitesSent,
              dailyMsgSent: linkedInAccount.dailyMsgSent,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("[Stats] Erreur getUserDashboardStats:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
