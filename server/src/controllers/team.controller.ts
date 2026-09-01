import { Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import { z } from "zod";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

const InviteMemberSchema = z.object({
  email: z.string().email("Email invalide"),
});

/**
 * POST /api/team/invite
 * Envoie une invitation email à un membre. Owner uniquement.
 */
export async function inviteMember(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Non authentifié" });
      return;
    }

    const body = InviteMemberSchema.parse(req.body);

    // Vérifier que l'utilisateur est owner de son organisation
    const inviter = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { organization: true },
    });

    if (!inviter || !inviter.organizationId) {
      res.status(400).json({ success: false, error: "Vous devez appartenir à une organisation pour inviter des membres." });
      return;
    }

    if (inviter.orgRole !== "OWNER" && inviter.role !== "SUPER_ADMIN") {
      res.status(403).json({ success: false, error: "Seul le propriétaire de l'espace peut inviter des membres." });
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
      where: { linkedinEmail: body.email.toLowerCase(), organizationId: inviter.organizationId },
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
      },
    });

    // En production, envoyer un vrai email.
    // En dev, on log le lien d'invitation.
    const inviteUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/join?token=${invitation.token}`;
    console.log(`[INVITE] Lien d'invitation pour ${body.email}: ${inviteUrl}`);

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

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { organizationId: true },
    });

    if (!currentUser?.organizationId) {
      res.json({ success: true, members: [], invitations: [] });
      return;
    }

    const [members, pendingInvitations] = await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId: currentUser.organizationId,
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
          organizationId: currentUser.organizationId,
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
    res.status(500).json({ success: false, error: error.message });
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
    if (!requester || (requester.orgRole !== "OWNER" && requester.role !== "SUPER_ADMIN")) {
      res.status(403).json({ success: false, error: "Seul le propriétaire peut retirer des membres." });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.organizationId !== requester.organizationId) {
      res.status(404).json({ success: false, error: "Membre introuvable dans votre organisation." });
      return;
    }

    // Retirer le membre de l'organisation (on ne supprime pas le compte)
    await prisma.user.update({
      where: { id: userId },
      data: { organizationId: null },
    });

    res.json({ success: true, message: "Membre retiré de l'équipe." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
}
