import { prisma } from "../../../lib/prisma.js";
import { buildCampaignsReport } from "../services/report.service.js";
import { sendCampaignReportEmail } from "../services/mail.service.js";
import { buildReportExcel, buildReportPdf, fileStamp } from "../services/reportExport.service.js";
import {
  REPORT_PREFS_SELECT,
  toReportPrefs,
  resolveRecipients,
  migrateLegacyReportPrefs,
  type ReportEmailFrequency,
  type ReportUserPrefs,
} from "../services/reportSettings.service.js";

/**
 * Planificateur des rapports périodiques par e-mail.
 * Tourne toutes les 15 minutes ; pour chaque utilisateur ayant activé un
 * rapport quotidien ou hebdomadaire, envoie le résumé HTML (+ PDF et Excel
 * complets en pièces jointes) dès que l'heure
 * locale (fuseau de l'utilisateur) atteint `reportHour` (et, en hebdo, que
 * le jour local est `reportDay`), au plus une fois par jour local.
 */

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "En cours",
  PAUSED: "En pause",
  COMPLETED: "Terminée",
  ARCHIVED: "Archivée",
  DRAFT: "Brouillon",
};

let isRunning = false;
const DAY_MS = 24 * 60 * 60 * 1000;

function localNow(timezone: string): { hour: number; weekday: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value || "0") % 24;
    const weekday = (parts.find((p) => p.type === "weekday")?.value || "").toUpperCase();
    return { hour, weekday };
  } catch {
    return { hour: new Date().getUTCHours(), weekday: "" };
  }
}

/** Clé `YYYY-MM-DD` d'une date dans le fuseau donné (anti double-envoi le même jour local). */
function localDateKey(timezone: string, date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function fmt(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function periodLabel(from: Date, to: Date): string {
  const f = fmt(from);
  const t = fmt(to);
  return f === t ? f : `du ${f} au ${t}`;
}

/** Fenêtre couverte par un rapport : hier (quotidien) ou les 7 derniers jours (hebdo), en UTC. */
export function reportWindow(frequency: ReportEmailFrequency, now = new Date()): { from: Date; to: Date } {
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(todayUtc.getTime() - 1); // hier 23:59:59.999
  const days = frequency === "WEEKLY" ? 7 : 1;
  const from = new Date(todayUtc.getTime() - days * DAY_MS);
  return { from, to };
}

/**
 * Construit et envoie le rapport à un utilisateur. Utilisé par le planificateur
 * et par le bouton « Envoyer maintenant » de la page Rapports.
 */
export async function sendReportEmailToUser(
  userId: string,
  frequency: ReportEmailFrequency
): Promise<{ sent: boolean; reason?: string; recipients?: string[] }> {
  if (frequency === "NONE") return { sent: false, reason: "Rapport désactivé." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      reportEmails: true,
      organization: { select: { name: true } },
    },
  });
  if (!user || user.status !== "ACTIVE") return { sent: false, reason: "Utilisateur introuvable ou inactif." };
  const recipients = resolveRecipients(user);

  const { from, to } = reportWindow(frequency);
  const report = await buildCampaignsReport({ scope: { userId }, from, to, compare: true, includeDetails: true });
  const s = report.summary;
  const d = report.comparison?.deltas;

  const frontendBase = (process.env.FRONTEND_URL || "https://bleadin.com").replace(/\/$/, "");

  // Mêmes fichiers que les boutons « Exporter » de la page Rapports (prospects inclus).
  const exportable = {
    ...report,
    owner: { name: user.name || user.email, email: user.email, organizationName: user.organization?.name ?? null },
  };
  const stamp = fileStamp();
  const attachments = [
    { filename: `bleadin-rapport-${stamp}.pdf`, content: buildReportPdf(exportable, true), contentType: "application/pdf" },
    {
      filename: `bleadin-rapport-${stamp}.xlsx`,
      content: buildReportExcel(exportable, true),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  ];

  await sendCampaignReportEmail({
    to: recipients,
    recipientName: user.name || user.email,
    frequencyLabel: frequency === "WEEKLY" ? "hebdomadaire" : "quotidien",
    periodLabel: periodLabel(from, to),
    previousPeriodLabel: report.comparison
      ? periodLabel(new Date(report.comparison.period.from), new Date(report.comparison.period.to))
      : "période précédente",
    kpis: [
      { label: "Invitations envoyées", value: String(s.invitesSent), delta: d?.invitesSent ?? null },
      { label: "Messages envoyés", value: String(s.messagesSent), delta: d?.messagesSent ?? null },
      { label: "Réponses reçues", value: String(s.repliesReceived), delta: d?.repliesReceived ?? null },
      { label: "Visites de profil", value: String(s.visits), delta: d?.visits ?? null },
      { label: "Taux d'acceptation (cumul)", value: `${s.acceptanceRate} %`, delta: null },
      { label: "Taux de réponse (cumul)", value: `${s.replyRate} %`, delta: null },
    ],
    campaigns: report.campaigns
      .filter((c) => c.status !== "ARCHIVED" && c.status !== "DRAFT")
      .map((c) => ({
        name: c.name,
        status: STATUS_LABELS[c.status] || c.status,
        totalProspects: c.stats.totalProspects,
        invitesSent: c.stats.invitesSent,
        acceptanceRate: c.stats.acceptanceRate,
        messagesSent: c.stats.messagesSent,
        repliesReceived: c.stats.repliesReceived,
        replyRate: c.stats.replyRate,
      })),
    reportsUrl: `${frontendBase}/reports`,
    attachments,
  });

  return { sent: true, recipients };
}

export function isDue(prefs: ReportUserPrefs, timezone: string, now = new Date()): boolean {
  if (prefs.emailFrequency === "NONE") return false;
  const { hour, weekday } = localNow(timezone);
  if (hour < prefs.hour) return false;
  if (prefs.emailFrequency === "WEEKLY" && weekday !== prefs.day) return false;

  if (!prefs.lastSentAt) return true;
  const last = new Date(prefs.lastSentAt);
  if (Number.isNaN(last.getTime())) return true;
  // Jamais deux envois le même jour local (permet de changer l'heure sans doublon) ;
  // en hebdo, on exige en plus au moins 6 jours d'écart avec le précédent envoi.
  if (localDateKey(timezone, last) === localDateKey(timezone, now)) return false;
  if (prefs.emailFrequency === "WEEKLY" && now.getTime() - last.getTime() < 6 * DAY_MS) return false;
  return true;
}

export async function processScheduledReports() {
  if (isRunning) return;
  isRunning = true;
  try {
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE", reportEmailFrequency: { in: ["DAILY", "WEEKLY"] } },
      select: { id: true, email: true, ...REPORT_PREFS_SELECT },
    });

    for (const u of users) {
      const prefs = toReportPrefs(u);
      if (!isDue(prefs, u.timezone)) continue;
      try {
        const result = await sendReportEmailToUser(u.id, prefs.emailFrequency);
        if (result.sent) {
          await prisma.user.update({ where: { id: u.id }, data: { reportLastSentAt: new Date() } });
          console.log(`📧 [ReportWorker] Rapport ${prefs.emailFrequency} envoyé à ${(result.recipients || []).join(", ")}`);
        }
      } catch (err: any) {
        console.error(`❌ [ReportWorker] Échec d'envoi pour ${u.email}:`, err?.message || err);
      }
    }
  } catch (err: any) {
    console.error("❌ [ReportWorker] Erreur du planificateur:", err?.message || err);
  } finally {
    isRunning = false;
  }
}

export function startReportScheduler() {
  console.log("📧 [ReportWorker] Planificateur de rapports e-mail démarré (toutes les 15 min)");
  migrateLegacyReportPrefs().catch((err: any) =>
    console.error("❌ [ReportWorker] Migration des anciennes préférences échouée:", err?.message || err)
  );
  setTimeout(processScheduledReports, 2 * 60 * 1000);
  setInterval(processScheduledReports, CHECK_INTERVAL_MS);
}
