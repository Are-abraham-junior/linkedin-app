import { Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import { z } from "zod";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

const CreateCampaignSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Le nom de la campagne est requis"),
  type: z.string().default("INVITATION_AND_MESSAGES"),
  listIds: z.array(z.string()).default([]),
  selectedProspectIds: z.array(z.string()).optional(),
  steps: z.array(
    z.object({
      stepOrder: z.number(),
      actionType: z.preprocess(
        (val) => (val === "VISIT" ? "VISIT_PROFILE" : val),
        z.enum(["INVITATION", "MESSAGE", "VISIT_PROFILE", "FOLLOW", "DELAY"])
      ),
      delayDays: z.number().default(0),
      messageText: z.string().optional().nullable(),
    })
  ).min(1, "La campagne doit contenir au moins une étape"),
  startImmediately: z.boolean().default(false),
});

const UpdateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  steps: z.array(
    z.object({
      id: z.string().optional(),
      stepOrder: z.number(),
      actionType: z.preprocess(
        (val) => (val === "VISIT" ? "VISIT_PROFILE" : val),
        z.enum(["INVITATION", "MESSAGE", "VISIT_PROFILE", "FOLLOW", "DELAY"])
      ),
      delayDays: z.number().default(0),
      messageText: z.string().optional().nullable(),
    })
  ).optional(),
});

/**
 * Récupère toutes les campagnes de l'utilisateur avec statistiques consolidées
 */
export async function getCampaigns(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;

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
      const accepted = states.filter((s) =>
        ["IN_PROGRESS", "WAITING_DELAY", "REPLIED", "COMPLETED"].includes(s.status)
      ).length;
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
  } catch (error: any) {
    console.error("Error getCampaigns:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Récupère les détails complets d'une campagne avec son funnel de conversion
 */
export async function getCampaignDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

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

    const campData: any = campaign;
    const prospectStatesList: any[] = campData.prospectStates || [];
    const stepsList: any[] = campData.steps || [];

    const total = prospectStatesList.length;
    const waitingCondition = prospectStatesList.filter(
      (p: any) => p.status === "WAITING_CONDITION" || p.status === "PENDING"
    ).length;
    const waitingDelay = prospectStatesList.filter((p: any) => p.status === "WAITING_DELAY").length;
    const replied = prospectStatesList.filter((p: any) => p.status === "REPLIED").length;
    const completed = prospectStatesList.filter((p: any) => p.status === "COMPLETED").length;
    const failed = prospectStatesList.filter((p: any) => p.status === "FAILED").length;
    const accepted = prospectStatesList.filter((p: any) =>
      ["IN_PROGRESS", "WAITING_DELAY", "REPLIED", "COMPLETED"].includes(p.status)
    ).length;

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
        prospects: prospectStatesList.map((ps: any) => ({
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
  } catch (error: any) {
    console.error("Error getCampaignDetails:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Création ou Enregistrement (Brouillon / Lancement) d'une campagne
 */
export async function createCampaign(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
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

    let campaign: any;

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

    // Récupérer et filtrer les prospects des listes sélectionnées selon les règles d'éligibilité
    let prospectsEnrolled = 0;
    if (body.listIds && body.listIds.length > 0) {
      const step1 = campaign.steps[0];
      const firstActionType = step1?.actionType || "INVITATION";

      // Récupérer les IDs de prospects déjà engagés dans une campagne active ou en attente
      const activeStates = await prisma.prospectCampaignState.findMany({
        where: {
          status: { in: ["PENDING", "IN_PROGRESS", "WAITING_DELAY", "WAITING_CONDITION"] },
        },
        select: { prospectId: true },
      });
      const busyProspectIds = new Set(activeStates.map((s) => s.prospectId));

      const prospectWhere: any = {
        listId: { in: body.listIds },
        doNotContact: false,
      };

      // Si sélection manuelle d'IDs spécifique
      if (body.selectedProspectIds && body.selectedProspectIds.length > 0) {
        prospectWhere.id = { in: body.selectedProspectIds };
      }

      const candidateProspects = await prisma.prospect.findMany({
        where: prospectWhere,
      });

      // Filtrer les candidats selon les règles strictes d'éligibilité
      const eligibleProspects = candidateProspects.filter((p) => {
        // 1. Exclure si déjà dans une campagne active
        if (busyProspectIds.has(p.id)) return false;

        // 2. Règles selon le type d'action initiale
        if (firstActionType === "MESSAGE") {
          // Campagne de message direct -> DOIT être déjà connecté
          return p.connectionStatus === "CONNECTED";
        } else if (firstActionType === "INVITATION" || firstActionType === "VISIT_PROFILE" || firstActionType === "FOLLOW") {
          // Campagne d'invitation/visite -> NE DOIT PAS être déjà connecté
          return p.connectionStatus !== "CONNECTED";
        }
        return true;
      });

      const now = new Date();

      if (eligibleProspects.length > 0 && step1) {
        const statesData = eligibleProspects.map((p, index) => {
          const scheduledTime = new Date(now.getTime() + (index * 90 + Math.floor(Math.random() * 60)) * 1000);
          return {
            campaignId: campaign.id,
            prospectId: p.id,
            currentStepId: step1.id,
            status: "PENDING" as const,
            nextExecutionAt: body.startImmediately ? scheduledTime : null,
          };
        });

        await prisma.prospectCampaignState.createMany({
          data: statesData,
          skipDuplicates: true,
        });

        prospectsEnrolled = eligibleProspects.length;

        // Si démarrage immédiat et compte présent, programmer dans ActionQueue
        if (body.startImmediately && account) {
          const queueEntries = eligibleProspects.map((p, index) => {
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
  } catch (error: any) {
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
export async function toggleCampaignStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Met à jour les informations ou étapes d'une campagne
 */
export async function updateCampaign(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const body = UpdateCampaignSchema.parse(req.body);

    const existing = await prisma.campaign.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: "Campagne introuvable." });
      return;
    }

    // Mettre à jour les informations de base de la campagne
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        name: body.name ? body.name.trim() : undefined,
        status: body.status,
      },
    });

    // Mettre à jour les étapes si fournies
    if (body.steps && Array.isArray(body.steps)) {
      for (const stepInput of body.steps) {
        let stepId = stepInput.id;

        // Si l'id n'est pas fourni, trouver l'étape par ordre
        if (!stepId) {
          const existingStep = await prisma.campaignStep.findFirst({
            where: {
              campaignId: id,
              stepOrder: stepInput.stepOrder,
            },
          });
          if (existingStep) {
            stepId = existingStep.id;
          }
        }

        if (stepId) {
          // 1. Mettre à jour l'étape dans CampaignStep
          await prisma.campaignStep.update({
            where: { id: stepId },
            data: {
              delayDays: stepInput.delayDays !== undefined ? stepInput.delayDays : undefined,
              messageText: stepInput.messageText !== undefined ? stepInput.messageText : undefined,
            },
          });

          // 2. Synchroniser les actions en file d'attente (ActionQueue)
          const queuedActions = await prisma.actionQueue.findMany({
            where: {
              campaignId: id,
              status: "QUEUED",
            },
          });

          for (const action of queuedActions) {
            const payload: any = action.payload || {};
            if (payload.stepId === stepId) {
              const dataToUpdate: any = {};

              // Mettre à jour le texte du message si modifié
              if (stepInput.messageText !== undefined) {
                payload.messageText = stepInput.messageText;
                dataToUpdate.payload = payload;
              }

              // Mettre à jour la date d'exécution (scheduledFor) si le délai a été modifié
              if (stepInput.delayDays !== undefined) {
                const now = new Date();
                let newScheduled: Date;

                if (stepInput.delayDays === 0) {
                  newScheduled = now;
                } else {
                  const state = await prisma.prospectCampaignState.findUnique({
                    where: {
                      campaignId_prospectId: {
                        campaignId: id,
                        prospectId: action.prospectId,
                      },
                    },
                  });
                  const baseTime = state?.lastActionAt || action.createdAt || now;
                  const targetTime = new Date(baseTime.getTime() + stepInput.delayDays * 24 * 60 * 60 * 1000);
                  newScheduled = targetTime.getTime() < now.getTime() ? now : targetTime;
                }

                dataToUpdate.scheduledFor = newScheduled;

                // Mettre à jour également prospectCampaignState.nextExecutionAt
                await prisma.prospectCampaignState.updateMany({
                  where: {
                    campaignId: id,
                    prospectId: action.prospectId,
                  },
                  data: {
                    nextExecutionAt: newScheduled,
                  },
                });
              }

              if (Object.keys(dataToUpdate).length > 0) {
                await prisma.actionQueue.update({
                  where: { id: action.id },
                  data: dataToUpdate,
                });
              }
            }
          }
        }
      }
    }

    // Récupérer la campagne complète avec étapes ordonnées
    const fullCampaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
      },
    });

    res.json({
      success: true,
      message: "Campagne et séquence mises à jour avec succès.",
      campaign: fullCampaign || updated,
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
 * Supprime une campagne et ses états
 */
export async function deleteCampaign(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
