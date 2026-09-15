import { prisma } from "../../../lib/prisma.js";
import { buildCampaignsReport } from "../services/report.service.js";
import { sendCampaignReportEmail } from "../services/mail.service.js";
import { listReportsConfigs, getUserPrefs, setUserPrefs, } from "../services/reportSettings.service.js";
/**
 * Planificateur des rapports périodiques par e-mail.
 * Tourne toutes les 15 minutes ; pour chaque utilisateur ayant activé un
 * rapport quotidien ou hebdomadaire, envoie le résumé HTML dès que l'heure
 * locale (fuseau de l'utilisateur) atteint SEND_HOUR et que le précédent
 * envoi date d'assez longtemps.
 */
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const SEND_HOUR = 8; // heure locale d'envoi
const STATUS_LABELS = {
    ACTIVE: "En cours",
    PAUSED: "En pause",
    COMPLETED: "Terminée",
    ARCHIVED: "Archivée",
    DRAFT: "Brouillon",
};
let isRunning = false;
const DAY_MS = 24 * 60 * 60 * 1000;
function localNow(timezone) {
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
    }
    catch {
        return { hour: new Date().getUTCHours(), weekday: "" };
    }
}
function fmt(d) {
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
function periodLabel(from, to) {
    const f = fmt(from);
    const t = fmt(to);
    return f === t ? f : `du ${f} au ${t}`;
}
/** Fenêtre couverte par un rapport : hier (quotidien) ou les 7 derniers jours (hebdo), en UTC. */
export function reportWindow(frequency, now = new Date()) {
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
export async function sendReportEmailToUser(userId, frequency) {
    if (frequency === "NONE")
        return { sent: false, reason: "Rapport désactivé." };
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, status: true },
    });
    if (!user || user.status !== "ACTIVE")
        return { sent: false, reason: "Utilisateur introuvable ou inactif." };
    const { from, to } = reportWindow(frequency);
    const report = await buildCampaignsReport({ scope: { userId }, from, to, compare: true });
    const s = report.summary;
    const d = report.comparison?.deltas;
    const frontendBase = (process.env.FRONTEND_URL || "https://bleadin.com").replace(/\/$/, "");
    await sendCampaignReportEmail({
        to: user.email,
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
    });
    return { sent: true };
}
function isDue(frequency, lastSentAt, timezone) {
    if (frequency === "NONE")
        return false;
    const { hour, weekday } = localNow(timezone);
    if (hour < SEND_HOUR)
        return false;
    if (frequency === "WEEKLY" && weekday !== "MON")
        return false;
    const last = lastSentAt ? new Date(lastSentAt).getTime() : 0;
    const minGap = frequency === "WEEKLY" ? 6 * DAY_MS : 20 * 60 * 60 * 1000;
    return Date.now() - last >= minGap;
}
async function processScheduledReports() {
    if (isRunning)
        return;
    isRunning = true;
    try {
        const configs = await listReportsConfigs();
        for (const { organizationId, config } of configs) {
            const userIds = Object.keys(config.users).filter((id) => config.users[id]?.emailFrequency && config.users[id].emailFrequency !== "NONE");
            if (userIds.length === 0)
                continue;
            const users = await prisma.user.findMany({
                where: { id: { in: userIds }, organizationId, status: "ACTIVE" },
                select: { id: true, timezone: true, email: true },
            });
            for (const u of users) {
                const prefs = getUserPrefs(config, u.id);
                if (!isDue(prefs.emailFrequency, prefs.lastSentAt, u.timezone))
                    continue;
                try {
                    const result = await sendReportEmailToUser(u.id, prefs.emailFrequency);
                    if (result.sent) {
                        await setUserPrefs(organizationId, u.id, { lastSentAt: new Date().toISOString() });
                        console.log(`📧 [ReportWorker] Rapport ${prefs.emailFrequency} envoyé à ${u.email}`);
                    }
                }
                catch (err) {
                    console.error(`❌ [ReportWorker] Échec d'envoi à ${u.email}:`, err?.message || err);
                }
            }
        }
    }
    catch (err) {
        console.error("❌ [ReportWorker] Erreur du planificateur:", err?.message || err);
    }
    finally {
        isRunning = false;
    }
}
export function startReportScheduler() {
    console.log("📧 [ReportWorker] Planificateur de rapports e-mail démarré (toutes les 15 min)");
    setTimeout(processScheduledReports, 2 * 60 * 1000);
    setInterval(processScheduledReports, CHECK_INTERVAL_MS);
}
