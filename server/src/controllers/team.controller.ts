import { Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import { z } from "zod";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { sendTeamInvitationEmail } from "../services/mail.service.js";

/**
 * Journalise l'erreur réelle côté serveur et renvoie un message générique au
 * client : les détails internes (requêtes Prisma, stack, etc.) ne doivent
 * jamais fuiter dans la réponse HTTP.
 */
function handleUnexpectedError(res: Response, context: string, error: any) {
  console.error(`[team.controller:${context}]`, error);
  res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
}

const InviteMemberSchema = z.object({
  email: z.string().email("Email invalide"),
  orgRole: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

/**
 * POST /api/team/invite
 * Envoie une invitation par email à un membre. Réservé au Propriétaire ou
 * Admin de l'espace.
 */
export async function inviteMember(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Non authentifié" });
      return;
    }

    const body = InviteMemberSchema.parse(req.body);

    const inviter = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { organization: true },
    });

    if (!inviter || !inviter.organizationId) {
      res.status(400).json({ success: false, error: "Vous devez appartenir à une organisation pour inviter des membres." });
      return;
    }

    if (inviter.orgRole !== "OWNER" && inviter.orgRole !== "ADMIN" && inviter.role !== "SUPER_ADMIN") {
      res.status(403).json({ success: false, error: "Seul le propriétaire ou un administrateur peut inviter des membres." });
      return;
    }

    // Vérifier si une invitation est déjà en attente pour cet email
    const existing = await prisma.teamInvitation.findFirst({
      where: {
        organizationId: inviter.organizationId,
        email: body.email.toLowerCase(),
        status: "PENDING",
      },
    });

    if (existing && new Date() < existing.expiresAt) {
      res.status(409).json({
        success: false,
        error: "Une invitation est déjà en attente pour cet email.",
        invitation: {
          id: existing.id,
          email: existing.email,
          expiresAt: existing.expiresAt,
        },
      });
      return;
    }

    // Vérifier si cet email est déjà membre de l'org
    const existingMember = await prisma.user.findFirst({
      where: {
        organizationId: inviter.organizationId,
        OR: [{ email: body.email.toLowerCase() }, { linkedinEmail: body.email.toLowerCase() }],
      },
    });
    if (existingMember) {
      res.status(409).json({ success: false, error: "Cet utilisateur est déjà membre de votre équipe." });
      return;
    }

    // Créer l'invitation (expiration 7 jours)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.teamInvitation.create({
      data: {
        organizationId: inviter.organizationId,
        email: body.email.toLowerCase(),
        invitedById: inviter.id,
        expiresAt,
        status: "PENDING",
        orgRole: body.orgRole,
      },
    });

    const inviteUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/join?token=${invitation.token}`;

    try {
      await sendTeamInvitationEmail({
        to: invitation.email,
        organizationName: inviter.organization?.name || "votre espace",
        invitedByName: inviter.name || inviter.email,
        inviteUrl,
        expiresAt: invitation.expiresAt,
      });
    } catch (mailError: any) {
      // On ne laisse pas une invitation "en attente" que le destinataire n'a
      // jamais reçue : on l'annule et on informe clairement l'admin.
      await prisma.teamInvitation.delete({ where: { id: invitation.id } });
      console.error(`[INVITE] Échec d'envoi de l'email à ${invitation.email}:`, mailError);
      res.status(502).json({
        success: false,
        error: "L'invitation n'a pas pu être envoyée par email. Vérifiez la configuration SMTP.",
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: `Invitation envoyée à ${body.email}.`,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        token: invitation.token,
        inviteUrl,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
        orgRole: invitation.orgRole,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues?.[0]?.message || error.message });
      return;
    }
    handleUnexpectedError(res, "inviteMember", error);
  }
}

/**
 * GET /api/team/members
 * Liste les membres de l'organisation de l'utilisateur connecté.
 */
export async function getTeamMembers(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Non authentifié" });
      return;
    }

    const organizationId =
      req.user.organizationId ||
      (
        await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { organizationId: true },
        })
      )?.organizationId;

    if (!organizationId) {
      res.json({ success: true, members: [], invitations: [] });
      return;
    }

    const [members, pendingInvitations] = await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId,
          role: { not: "SUPER_ADMIN" },
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          orgRole: true,
          status: true,
          createdAt: true,
          accounts: {
            select: {
              id: true,
              accountName: true,
              profilePicture: true,
              headline: true,
              status: true,
              dailyInvitesSent: true,
              dailyMsgSent: true,
            },
            take: 1,
          },
        },
        orderBy: [{ orgRole: "asc" }, { createdAt: "asc" }],
      }),
      prisma.teamInvitation.findMany({
        where: {
          organizationId,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          email: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          invitedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      success: true,
      members: members.map((m) => ({
        ...m,
        linkedInAccount: m.accounts[0] || null,
        accounts: undefined,
      })),
      invitations: pendingInvitations,
    });
  } catch (error: any) {
    handleUnexpectedError(res, "getTeamMembers", error);
  }
}

/**
 * DELETE /api/team/members/:userId
 * Retire un membre de l'organisation. Owner uniquement.
 */
export async function removeMember(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Non authentifié" });
      return;
    }

    const userId = String(req.params.userId);

    if (userId === req.user.id) {
      res.status(400).json({ success: false, error: "Vous ne pouvez pas vous retirer vous-même." });
      return;
    }

    const requester = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!requester || (requester.orgRole !== "OWNER" && requester.orgRole !== "ADMIN" && requester.role !== "SUPER_ADMIN")) {
      res.status(403).json({ success: false, error: "Seul le propriétaire ou un administrateur peut retirer des membres." });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.organizationId !== requester.organizationId) {
      res.status(404).json({ success: false, error: "Membre introuvable dans votre organisation." });
      return;
    }

    if (target.orgRole === "OWNER") {
      res.status(403).json({ success: false, error: "Le propriétaire de l'espace ne peut pas être retiré." });
      return;
    }

    // Retirer le membre de l'organisation (on ne supprime pas le compte)
    await prisma.user.update({
      where: { id: userId },
      data: { organizationId: null },
    });

    res.json({ success: true, message: "Membre retiré de l'équipe." });
  } catch (error: any) {
    handleUnexpectedError(res, "removeMember", error);
  }
}

/**
 * DELETE /api/team/invitations/:invitationId
 * Annule une invitation en attente.
 */
export async function cancelInvitation(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Non authentifié" });
      return;
    }

    const invitationId = String(req.params.invitationId);
    const requester = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!requester || (requester.orgRole !== "OWNER" && requester.role !== "SUPER_ADMIN")) {
      res.status(403).json({ success: false, error: "Accès refusé." });
      return;
    }

    const invitation = await prisma.teamInvitation.findFirst({
      where: { id: invitationId, organizationId: requester.organizationId! },
    });

    if (!invitation) {
      res.status(404).json({ success: false, error: "Invitation introuvable." });
      return;
    }

    await prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status: "EXPIRED" },
    });

    res.json({ success: true, message: "Invitation annulée." });
  } catch (error: any) {
    handleUnexpectedError(res, "cancelInvitation", error);
  }
}

/**
 * GET /api/team/invitation-info/:token
 * Retourne les infos publiques d'une invitation (pour la page /join).
 */
export async function getInvitationInfo(req: AuthenticatedRequest, res: Response) {
  try {
    const token = String(req.params.token);

    const invitation: any = await prisma.teamInvitation.findUnique({
      where: { token },
      include: {
        organization: { select: { name: true } },
        invitedBy: { select: { name: true, avatarUrl: true } },
      },
    });

    if (!invitation) {
      res.status(404).json({ success: false, error: "Invitation introuvable." });
      return;
    }

    if (invitation.status !== "PENDING" || new Date() > invitation.expiresAt) {
      res.status(400).json({ success: false, error: "Cette invitation est expirée ou déjà utilisée." });
      return;
    }

    res.json({
      success: true,
      invitation: {
        email: invitation.email,
        organizationName: invitation.organization?.name || "L'organisation",
        invitedBy: invitation.invitedBy?.name || "Un membre",
        invitedByAvatar: invitation.invitedBy?.avatarUrl,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error: any) {
    handleUnexpectedError(res, "getInvitationInfo", error);
  }
}

/**
 * GET /api/team/metrics
 * Métriques consolidées de l'espace de travail avec ventilation par membre.
 */
export async function getTeamMetrics(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Non authentifié" });
      return;
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { organizationId: true, orgRole: true, role: true },
    });

    if (!currentUser?.organizationId) {
      res.json({
        success: true,
        metrics: {
          totalMembers: 0,
          connectedAccounts: 0,
          totalProspects: 0,
          totalCampaigns: 0,
          activeCampaigns: 0,
          totalInvitesSent: 0,
          totalMsgSent: 0,
          membersBreakdown: [],
        },
      });
      return;
    }

    const orgId = currentUser.organizationId;

    // Récupérer tous les membres de l'organisation
    const members = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        orgRole: true,
        status: true,
        maxDailyInvites: true,
        maxDailyMsg: true,
        createdAt: true,
        accounts: {
          select: {
            id: true,
            accountName: true,
            profilePicture: true,
            status: true,
            dailyInvitesSent: true,
            dailyMsgSent: true,
          },
        },
        _count: {
          select: {
            campaigns: true,
            prospectLists: true,
          },
        },
      },
    });

    const memberIds = members.map((m) => m.id);

    // Compter les prospects dans toute l'organisation
    const totalProspects = await prisma.prospect.count({
      where: {
        list: {
          userId: { in: memberIds },
        },
      },
    });

    // Compter les campagnes
    const [totalCampaigns, activeCampaigns] = await Promise.all([
      prisma.campaign.count({
        where: { userId: { in: memberIds } },
      }),
      prisma.campaign.count({
        where: { userId: { in: memberIds }, status: "ACTIVE" },
      }),
    ]);

    // Calculer les totaux d'activité
    let totalInvitesSent = 0;
    let totalMsgSent = 0;
    let connectedAccounts = 0;

    const membersBreakdown = await Promise.all(
      members.map(async (m) => {
        const primaryAcc = m.accounts[0] || null;
        const isConnected = Boolean(primaryAcc && primaryAcc.status === "CONNECTED");
        if (isConnected) connectedAccounts++;

        const invites = primaryAcc?.dailyInvitesSent || 0;
        const msgs = primaryAcc?.dailyMsgSent || 0;
        totalInvitesSent += invites;
        totalMsgSent += msgs;

        const memberProspects = await prisma.prospect.count({
          where: { list: { userId: m.id } },
        });

        const memberActiveCampaigns = await prisma.campaign.count({
          where: { userId: m.id, status: "ACTIVE" },
        });

        return {
          id: m.id,
          name: m.name || m.email.split("@")[0],
          email: m.email,
          avatarUrl: m.avatarUrl || primaryAcc?.profilePicture,
          orgRole: m.orgRole,
          status: m.status,
          hasLinkedInAccount: isConnected,
          linkedInAccountName: primaryAcc?.accountName,
          dailyInvitesSent: invites,
          dailyMsgSent: msgs,
          maxDailyInvites: m.maxDailyInvites,
          maxDailyMsg: m.maxDailyMsg,
          totalCampaigns: m._count.campaigns,
          activeCampaigns: memberActiveCampaigns,
          totalProspects: memberProspects,
        };
      })
    );

    res.json({
      success: true,
      metrics: {
        totalMembers: members.length,
        connectedAccounts,
        totalProspects,
        totalCampaigns,
        activeCampaigns,
        totalInvitesSent,
        totalMsgSent,
        membersBreakdown,
      },
    });
  } catch (error: any) {
    handleUnexpectedError(res, "getTeamMetrics", error);
  }
}

/**
 * PUT /api/team/members/:userId/role
 * Met à jour le rôle (OWNER / MEMBER) d'un membre de l'espace.
 */
export async function updateMemberRole(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Non authentifié" });
      return;
    }

    const targetUserId = req.params.userId as string;
    const { orgRole } = req.body;

    if (!["OWNER", "ADMIN", "MEMBER"].includes(orgRole)) {
      res.status(400).json({ success: false, error: "Rôle invalide (OWNER, ADMIN ou MEMBER attendu)." });
      return;
    }

    const caller = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { organizationId: true, orgRole: true, role: true },
    });

    if (caller?.orgRole !== "OWNER" && caller?.role !== "SUPER_ADMIN") {
      res.status(403).json({ success: false, error: "Seul le propriétaire de l'espace peut modifier les rôles." });
      return;
    }

    const target = await prisma.user.findFirst({
      where: { id: targetUserId, organizationId: caller.organizationId },
    });

    if (!target) {
      res.status(404).json({ success: false, error: "Membre introuvable dans cet espace." });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { orgRole },
      select: { id: true, name: true, email: true, orgRole: true },
    });

    res.json({
      success: true,
      message: `Rôle de ${updated.name || updated.email} modifié en ${orgRole}.`,
      member: updated,
    });
  } catch (error: any) {
    handleUnexpectedError(res, "updateMemberRole", error);
  }
}
