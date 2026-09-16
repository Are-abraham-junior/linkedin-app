import type { LinkedInAccount } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { UnipileService } from "../services/unipile.service.js";
import { actionKindOf, getQuotaSnapshot, QUOTA_REASON_LABELS } from "../services/quota.service.js";

/** Remet une action en file pour plus tard (quota atteint, compte indisponible…). */
async function deferAction(actionId: string, until: Date): Promise<void> {
  await prisma.actionQueue.update({
    where: { id: actionId },
    data: { scheduledFor: until, status: "QUEUED" },
  });
}

/**
 * Remplace les variables dynamiques dans les modèles de messages
 */
function personalizeMessage(template: string, prospect: any): string {
  if (!template) return "";
  return template
    .replace(/\{\{firstName\}\}/gi, prospect.firstName || "")
    .replace(/\{\{lastName\}\}/gi, prospect.lastName || "")
    .replace(/\{\{company\}\}/gi, prospect.company || "votre entreprise")
    .replace(/\{\{headline\}\}/gi, prospect.headline || "")
    .trim();
}

/**
 * Bascule une campagne (et ses actions encore en file) vers le compte LinkedIn
 * CONNECTED de son propriétaire lorsque son compte actuel n'est plus utilisable.
 *
 * Une reconnexion LinkedIn via Unipile crée souvent un nouvel `account_id`, donc
 * une nouvelle ligne `LinkedInAccount` : la campagne et sa file restaient alors
 * accrochées à l'ancienne ligne DISCONNECTED (actions différées indéfiniment,
 * acceptations d'invitation jamais détectées). Renvoie le compte utilisable,
 * ou null si l'utilisateur n'a aucun compte connecté.
 */
async function ensureCampaignAccount<T extends { id: string; status: string; unipileAccountId: string }>(
  campaign: { id: string; userId: string; accountId: string | null },
  current: T | null
): Promise<T | LinkedInAccount | null> {
  if (current && current.status === "CONNECTED") return current;

  const replacement = await prisma.linkedInAccount.findFirst({
    where: { userId: campaign.userId, status: "CONNECTED", unipileAccountId: { not: "" } },
    orderBy: { updatedAt: "desc" },
  });
  if (!replacement) return null;

  const [, requeued] = await prisma.$transaction([
    prisma.campaign.update({ where: { id: campaign.id }, data: { accountId: replacement.id } }),
    prisma.actionQueue.updateMany({
      where: { campaignId: campaign.id, status: "QUEUED", accountId: { not: replacement.id } },
      data: { accountId: replacement.id },
    }),
  ]);
  console.warn(
    `[CampaignWorker] Campagne ${campaign.id} basculée du compte ${current?.id ?? "(aucun)"} (${current?.status ?? "-"}) vers ${replacement.id} (CONNECTED) — ${requeued.count} action(s) en file réaffectée(s).`
  );
  return replacement;
}

/**
 * Résout le provider_id LinkedIn (ACo...) à partir de l'URL LinkedIn du prospect.
 * Si le providerProfileId existe déjà, le retourne directement.
 * Sinon, interroge Unipile pour le récupérer et le sauvegarde en base.
 */
async function resolveProviderId(prospect: any, accountId: string): Promise<string | null> {
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
  } catch (err: any) {
    console.error(`[CampaignWorker] Erreur résolution provider_id pour ${slug}:`, err.message);
  }

  return null;
}

const DAY_MAP: Record<number, string> = {
  0: "SUN",
  1: "MON",
  2: "TUE",
  3: "WED",
  4: "THU",
  5: "FRI",
  6: "SAT",
};

const WEEKDAY_ABBR: Record<string, string> = {
  Sun: "SUN",
  Mon: "MON",
  Tue: "TUE",
  Wed: "WED",
  Thu: "THU",
  Fri: "FRI",
  Sat: "SAT",
};

/**
 * Vérifie si l'heure actuelle est dans les jours et heures ouvrées configurés par l'utilisateur
 * en respectant scrupuleusement son fuseau horaire (ex: Africa/Abidjan, Europe/Paris, etc.)
 */
function isUserInWorkingHours(user: any): boolean {
  if (!user) return true;

  const workingDays: string[] = user.workingDays?.length
    ? user.workingDays
    : ["MON", "TUE", "WED", "THU", "FRI"];

  const timezone = user.timezone || "Africa/Abidjan";

  try {
    const now = new Date();
    // Convertir l'heure actuelle dans le fuseau horaire configuré par l'utilisateur
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    let weekdayStr = "";
    let hour = 0;
    let minute = 0;

    for (const part of parts) {
      if (part.type === "weekday") {
        weekdayStr = WEEKDAY_ABBR[part.value] || part.value.toUpperCase().slice(0, 3);
      } else if (part.type === "hour") {
        hour = parseInt(part.value, 10);
      } else if (part.type === "minute") {
        minute = parseInt(part.value, 10);
      }
    }

    if (!weekdayStr) {
      weekdayStr = DAY_MAP[now.getDay()] || "MON";
      hour = now.getHours();
      minute = now.getMinutes();
    }

    // 1. Vérifier si le jour actuel fait partie des jours autorisés
    if (!workingDays.includes(weekdayStr)) {
      return false;
    }

    // 2. Vérifier la plage horaire
    const currentMinutes = hour * 60 + minute;
    const [startH, startM] = (user.workingHoursStart || "08:00").split(":").map(Number);
    const [endH, endM] = (user.workingHoursEnd || "19:00").split(":").map(Number);

    const startTotal = (startH || 8) * 60 + (startM || 0);
    const endTotal = (endH || 19) * 60 + (endM || 0);

    return currentMinutes >= startTotal && currentMinutes <= endTotal;
  } catch (err) {
    console.error("[CampaignWorker] Erreur de calcul de fuseau horaire:", err);
    return true;
  }
}

/**
 * Calcule la date d'exécution de l'étape suivante.
 * Un délai de 0 jour est respecté (pas de "|| 1" qui le transformait en 1 jour) :
 * l'action est alors planifiée dans 1 à 3 minutes (jitter anti-détection),
 * et jamais avant `minDelayMs`.
 */
function computeNextExecution(delayDays: number | null | undefined, minDelayMs = 0): Date {
  const days = typeof delayDays === "number" && delayDays > 0 ? delayDays : 0;
  const jitterMs = 60 * 1000 + Math.floor(Math.random() * 120 * 1000);
  const delayMs = days > 0 ? days * 24 * 60 * 60 * 1000 : jitterMs;
  return new Date(Date.now() + Math.max(delayMs, minDelayMs));
}

type UnipileErrorAction = "CONTINUE" | "DEFER_ACTION" | "DISCONNECT_ACCOUNT";

function categorizeUnipileError(errorMsg?: string): { action: UnipileErrorAction; reason: string } {
  if (!errorMsg) return { action: "CONTINUE", reason: "Erreur inconnue" };
  const lower = errorMsg.toLowerCase();

  // Déconnexion ou checkpoint selon doc Unipile (https://developer.unipile.com/reference)
  if (
    lower.includes("checkpoint") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("reconnect") ||
    lower.includes("session expired") ||
    lower.includes("disconnected") ||
    lower.includes("invalid account") ||
    lower.includes("not connected")
  ) {
    return { action: "DISCONNECT_ACCOUNT", reason: "Compte LinkedIn déconnecté ou checkpoint requis" };
  }

  // Rate limits / 429
  if (
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("rate limit") ||
    lower.includes("resource_exhausted") ||
    lower.includes("throttled")
  ) {
    return { action: "DEFER_ACTION", reason: "Limite de taux Unipile / LinkedIn atteinte (429)" };
  }

  return { action: "CONTINUE", reason: errorMsg };
}

/**
 * Gère les échecs d'action Unipile avec protection de compte et gestion du rate-limit
 */
async function handleActionResultFailure(
  action: any,
  prospect: any,
  account: any,
  errorMessage?: string,
  defaultMessage = "Erreur exécution action"
): Promise<"CONTINUE" | "BREAK"> {
  const errInfo = categorizeUnipileError(errorMessage);

  if (errInfo.action === "DISCONNECT_ACCOUNT") {
    console.error(`[CampaignWorker] Compte ${account.id} déconnecté ou checkpoint requis. Mise en pause du compte et des campagnes.`);
    await prisma.linkedInAccount.update({
      where: { id: account.id },
      data: { status: "DISCONNECTED" },
    });
    // Mettre également en pause les campagnes actives de l'utilisateur pour éviter les échecs répétitifs
    await prisma.campaign.updateMany({
      where: { userId: account.userId, status: "ACTIVE" },
      data: { status: "PAUSED" },
    }).catch(() => {});

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

// Horodatages des derniers passages du planificateur (exposés par /api/health)
const workerStatus = {
  lastQueueRunAt: null as Date | null,
  lastAcceptCheckAt: null as Date | null,
};

export function getWorkerStatus() {
  return {
    lastQueueRunAt: workerStatus.lastQueueRunAt?.toISOString() || null,
    lastAcceptCheckAt: workerStatus.lastAcceptCheckAt?.toISOString() || null,
  };
}

/**
 * Traite les actions en attente dans la queue
 */
export async function processActionQueue(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  workerStatus.lastQueueRunAt = new Date();

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

    // Plan de chaque organisation, chargé une fois par passage
    const organizationPlans = new Map<string, string | null>();

    for (const action of pendingActions) {
      try {
        let account = action.linkedInAccount;
        const user = account.user;

        // Si le compte est déconnecté : basculer sur le compte reconnecté de l'utilisateur
        // (nouvelle ligne créée par Unipile à la reconnexion), sinon différer l'action.
        if (account.status === "DISCONNECTED") {
          const replacement = await ensureCampaignAccount(
            { id: action.campaignId, userId: user.id, accountId: account.id },
            account
          );
          if (!replacement) {
            console.warn(`[CampaignWorker] Compte LinkedIn ${account.id} déconnecté. Action différée.`);
            const nextCheck = new Date(now.getTime() + 60 * 60 * 1000);
            await prisma.actionQueue.update({
              where: { id: action.id },
              data: { scheduledFor: nextCheck, status: "QUEUED" },
            });
            continue;
          }
          account = { ...replacement, user };
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

        // Quotas hebdo/mensuels de l'offre + cible journalière aléatoire + warm-up
        // (source de vérité : ActionQueue, calculée dans le fuseau de l'utilisateur)
        const kind = actionKindOf(action.actionType);
        if (kind) {
          if (!organizationPlans.has(user.organizationId || "")) {
            const org = user.organizationId
              ? await prisma.organization.findUnique({ where: { id: user.organizationId }, select: { plan: true } })
              : null;
            organizationPlans.set(user.organizationId || "", org?.plan ?? null);
          }
          const snapshot = await getQuotaSnapshot({
            user,
            account,
            planRaw: organizationPlans.get(user.organizationId || ""),
            now,
          });

          // Synchroniser les compteurs d'affichage sur le compte LinkedIn si décalage détecté
          const invitesSentToday = snapshot.actions.invites.usedToday;
          const messagesSentToday = snapshot.actions.messages.usedToday;
          if (account.dailyInvitesSent !== invitesSentToday || account.dailyMsgSent !== messagesSentToday) {
            await prisma.linkedInAccount.update({
              where: { id: account.id },
              data: { dailyInvitesSent: invitesSentToday, dailyMsgSent: messagesSentToday },
            });
            account.dailyInvitesSent = invitesSentToday;
            account.dailyMsgSent = messagesSentToday;
          }

          const status = snapshot.actions[kind];
          if (status.blocked) {
            const used =
              status.blocked.reason === "MONTH"
                ? `${status.usedMonth}/${status.limitMonth}`
                : status.blocked.reason === "WEEK"
                  ? `${status.usedWeek}/${status.limitWeek}`
                  : `${status.usedToday}/${status.target}`;
            console.warn(
              `[CampaignWorker] Quota ${QUOTA_REASON_LABELS[status.blocked.reason]} ${kind} atteint (${used})` +
                `${snapshot.warmup.active ? ` [warm-up J${snapshot.warmup.dayIndex + 1}/${snapshot.warmup.totalDays}]` : ""}` +
                ` pour le compte ${account.id}. Action reportée au ${status.blocked.until.toISOString()}.`
            );
            await deferAction(action.id, status.blocked.until);
            continue;
          }
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

        const payload: any = action.payload || {};

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
          } else {
            const outcome = await handleActionResultFailure(action, prospect, account, result.error, "Erreur envoi invitation");
            if (outcome === "BREAK") break;
          }
        } else if (action.actionType === "MESSAGE") {
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
              const nextExec = computeNextExecution(nextStep.delayDays);

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
            } else {
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
          } else {
            const outcome = await handleActionResultFailure(action, prospect, account, result.error, "Erreur envoi message");
            if (outcome === "BREAK") break;
          }
        } else if (action.actionType === "VISIT_PROFILE" || (action.actionType as string) === "VISIT") {
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

            // Enrichissement automatique du prospect (photo, titre, entreprise).
            // E-mail et téléphone ne sont jamais copiés ici : ils se révèlent uniquement
            // via les tokens d'enrichissement (enrichment.service.ts).
            if (result.profile) {
              const profileData = result.profile;

              const enrichData: any = {};
              if (profileData?.profile_picture_url && (!prospect.avatarUrl || prospect.avatarUrl.includes("ui-avatars.com"))) {
                enrichData.avatarUrl = profileData.profile_picture_url;
              }
              if (profileData?.headline && (!prospect.headline || prospect.headline === "Professionnel")) {
                enrichData.headline = profileData.headline;
              }
              if (profileData?.company && (!prospect.company || prospect.company === "—")) {
                enrichData.company = profileData.company;
              }

              if (Object.keys(enrichData).length > 0) {
                await prisma.prospect.update({
                  where: { id: prospect.id },
                  data: enrichData,
                });
                console.log(`[CampaignWorker] Prospect ${prospect.firstName} ${prospect.lastName} enrichi via visite :`, Object.keys(enrichData).join(", "));
              }
            }

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
              const nextExec = computeNextExecution(nextStep.delayDays);

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
            } else {
              await prisma.prospectCampaignState.updateMany({
                where: { campaignId: action.campaignId, prospectId: prospect.id },
                data: {
                  status: "COMPLETED",
                  lastActionAt: new Date(),
                },
              });
            }

            console.log(`[CampaignWorker] Profil visité avec succès : ${prospect.firstName} ${prospect.lastName}`);
          } else {
            const outcome = await handleActionResultFailure(action, prospect, account, result.error, "Erreur visite profil");
            if (outcome === "BREAK") break;
          }
        } else if (action.actionType === "FOLLOW") {
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
              const nextExec = computeNextExecution(nextStep.delayDays);

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
            } else {
              await prisma.prospectCampaignState.updateMany({
                where: { campaignId: action.campaignId, prospectId: prospect.id },
                data: {
                  status: "COMPLETED",
                  lastActionAt: new Date(),
                },
              });
            }

            console.log(`[CampaignWorker] Profil suivi (follow) avec succès : ${prospect.firstName} ${prospect.lastName}`);
          } else {
            const outcome = await handleActionResultFailure(action, prospect, account, result.error, "Erreur follow profil");
            if (outcome === "BREAK") break;
          }
        }
      } catch (innerErr: any) {
        console.error(`[CampaignWorker] Erreur traitement action ${action.id}:`, innerErr);
        await prisma.actionQueue.update({
          where: { id: action.id },
          data: { status: "FAILED", errorMessage: innerErr.message },
        });
      }
    }
  } catch (error: any) {
    console.error("[CampaignWorker] Exception globale dans le worker:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Fait avancer un prospect dont l'invitation vient d'être acceptée :
 * enrichissement du profil, passage à l'étape suivante (ex: MESSAGE) et planification dans ActionQueue.
 * Utilisé par le polling `checkAcceptedInvitations` ET par le webhook Unipile `new_relation`.
 * `state` doit inclure `prospect` et `campaign.steps`.
 */
export async function onInvitationAccepted(state: any, account: any, profile: any = {}): Promise<void> {
  const p = profile || {};
  console.log(`[CampaignWorker] Connexion acceptée confirmée pour ${state.prospect.firstName} ${state.prospect.lastName} !`);

  // Extraction automatique des coordonnées du prospect (1er degré)
  const contactInfo = p.contact_info;
  const extractedEmail =
    contactInfo?.emails?.[0]?.address ||
    contactInfo?.emails?.[0] ||
    p.email;
  const rawPhone =
    contactInfo?.phones?.[0]?.number ||
    contactInfo?.phones?.[0] ||
    contactInfo?.phone_numbers?.[0]?.number ||
    contactInfo?.phone_numbers?.[0] ||
    p.phone;
  const extractedPhone = typeof rawPhone === "string" ? rawPhone.trim() : rawPhone ? String(rawPhone) : undefined;

  const updateData: any = { connectionStatus: "CONNECTED" };
  if (extractedEmail && !state.prospect.email) updateData.email = extractedEmail;
  if (extractedPhone && !state.prospect.phone) updateData.phone = extractedPhone;
  if (p.headline && (!state.prospect.headline || state.prospect.headline === "Professionnel")) {
    updateData.headline = p.headline;
  }
  if (p.company && (!state.prospect.company || state.prospect.company === "—")) {
    updateData.company = p.company;
  }
  if (p.profile_picture_url && (!state.prospect.avatarUrl || state.prospect.avatarUrl.includes("ui-avatars.com"))) {
    updateData.avatarUrl = p.profile_picture_url;
  }
  if (p.provider_id && !state.prospect.providerProfileId?.startsWith("ACo")) {
    updateData.providerProfileId = p.provider_id;
  }

  await prisma.prospect.update({
    where: { id: state.prospect.id },
    data: updateData,
  });

  if (extractedEmail || extractedPhone) {
    console.log(`[CampaignWorker] Coordonnées extraites pour ${state.prospect.firstName} : email=${extractedEmail || "non"}, phone=${extractedPhone || "non"}`);
  }

  // Trouver l'étape suivant l'invitation dans cette campagne
  const steps: any[] = state.campaign.steps || [];
  const currentStep =
    steps.find((s) => s.id === state.currentStepId) ||
    steps.find((s) => s.actionType === "INVITATION");
  const currentOrder = currentStep ? currentStep.stepOrder : 1;
  const nextStep = steps.find((s) => s.stepOrder > currentOrder);

  if (nextStep) {
    // Délai configuré sur l'étape (0 jour respecté), avec un minimum de 5 min après l'acceptation
    const scheduledFor = computeNextExecution(nextStep.delayDays, 5 * 60 * 1000);

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
    console.log(`[CampaignWorker] Étape ${nextStep.actionType} planifiée pour ${state.prospect.firstName} ${state.prospect.lastName} le ${scheduledFor.toISOString()}`);
  } else {
    await prisma.prospectCampaignState.update({
      where: { id: state.id },
      data: { status: "COMPLETED", lastActionAt: new Date() },
    });
  }
}

/**
 * Tâche de synchronisation périodique des acceptations LinkedIn
 */
export async function checkAcceptedInvitations(): Promise<void> {
  workerStatus.lastAcceptCheckAt = new Date();
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

    if (activeStates.length === 0) return;

    // Compte résolu par campagne (le lot chargé ci-dessus ne reflète pas une bascule faite en cours de boucle)
    const accountByCampaign = new Map<string, Awaited<ReturnType<typeof ensureCampaignAccount>>>();

    for (const state of activeStates) {
      // Compte de la campagne s'il est connecté, sinon bascule sur le compte reconnecté
      // de l'utilisateur (une reconnexion Unipile crée une nouvelle ligne LinkedInAccount).
      let account = accountByCampaign.get(state.campaignId);
      if (account === undefined) {
        account = await ensureCampaignAccount(state.campaign, state.campaign.linkedInAccount);
        accountByCampaign.set(state.campaignId, account);
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
        // GET /users/{id} renvoie network_distance = "FIRST_DEGREE" (et non "DISTANCE_1",
        // qui n'existe que dans les résultats de recherche) : on passe par le parseur commun.
        const isConnected =
          UnipileService.parseLinkedInConnectionStatus(profileRes.profile) === "CONNECTED" ||
          profileRes.profile.connection_status === "CONNECTED";

        if (isConnected) {
          await onInvitationAccepted(state, account, profileRes.profile);
        } else {
          // Pas encore accepté : mettre à jour lastActionAt pour passer au prospect suivant lors du prochain cycle
          await prisma.prospectCampaignState.update({
            where: { id: state.id },
            data: { lastActionAt: new Date() },
          });
        }
      } else {
        // En cas d'erreur transitoire sur le profil, mettre à jour lastActionAt pour éviter le blocage
        await prisma.prospectCampaignState.update({
          where: { id: state.id },
          data: { lastActionAt: new Date() },
        });
      }
    }
  } catch (err: any) {
    console.error("[CampaignWorker] Erreur checkAcceptedInvitations:", err.message);
  }
}

/**
 * Démarre le planificateur de tâches de campagne
 */
export function startCampaignScheduler(): void {
  console.log("⚡ [CampaignWorker] Initialisation du planificateur de campagnes Bleadin...");

  // Exécution de la file d'attente chaque minute
  setInterval(() => {
    processActionQueue().catch((err) =>
      console.error("[CampaignWorker] Interval error:", err)
    );
  }, 60 * 1000);

  // Vérification des invitations acceptées toutes les 5 minutes
  setInterval(() => {
    checkAcceptedInvitations().catch((err) =>
      console.error("[CampaignWorker] Check accepted error:", err)
    );
  }, 5 * 60 * 1000);
}
