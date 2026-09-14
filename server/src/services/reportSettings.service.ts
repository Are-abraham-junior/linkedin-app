import { randomUUID } from "crypto";
import { prisma } from "../../../lib/prisma.js";

/**
 * Paramètres de rapports.
 *
 * - Préférences d'envoi automatique par e-mail : vrais champs sur `User`
 *   (`reportEmailFrequency`, `reportEmails`, `reportHour`, `reportDay`,
 *   `reportLastSentAt`), heure/jour interprétés dans `User.timezone`.
 * - Historique des exports : toujours dans `IntegrationConfig.config` (JSON)
 *   avec `provider = "BLEADIN_REPORTS"`, une ligne par organisation.
 *   À migrer vers un modèle `ReportHistory` dédié.
 */

export const REPORTS_PROVIDER = "BLEADIN_REPORTS";
export const HISTORY_LIMIT = 100;
export const MAX_REPORT_EMAILS = 10;

export type ReportEmailFrequency = "NONE" | "DAILY" | "WEEKLY";
export const REPORT_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type ReportDay = (typeof REPORT_DAYS)[number];

export interface ReportUserPrefs {
  emailFrequency: ReportEmailFrequency;
  emails: string[];
  hour: number;
  day: ReportDay;
  lastSentAt: string | null;
  /** Fuseau du compte (`User.timezone`), dans lequel `hour`/`day` sont interprétés. */
  timezone: string;
}

export interface ReportHistoryEntry {
  id: string;
  userId: string;
  userName: string;
  kind: "PDF" | "XLSX" | "CONTACTS";
  filename: string;
  periodFrom: string;
  periodTo: string;
  campaignIds: string[];
  campaignsCount: number;
  prospectsCount?: number;
  createdAt: string;
}

export interface ReportsConfig {
  history: ReportHistoryEntry[];
}

function normalize(raw: any): ReportsConfig {
  const cfg = raw && typeof raw === "object" ? raw : {};
  return {
    history: Array.isArray(cfg.history) ? cfg.history : [],
  };
}

export async function getReportsConfig(organizationId: string): Promise<ReportsConfig> {
  const row = await prisma.integrationConfig.findUnique({
    where: { organizationId_provider: { organizationId, provider: REPORTS_PROVIDER } },
    select: { config: true },
  });
  return normalize(row?.config);
}

export async function saveReportsConfig(organizationId: string, config: ReportsConfig): Promise<void> {
  await prisma.integrationConfig.upsert({
    where: { organizationId_provider: { organizationId, provider: REPORTS_PROVIDER } },
    create: { organizationId, provider: REPORTS_PROVIDER, config: config as any, status: "CONNECTED" },
    update: { config: config as any },
  });
}

// ---------------------------------------------------------------------------
// Préférences d'envoi (champs `User.report*`)
// ---------------------------------------------------------------------------

export const REPORT_PREFS_SELECT = {
  timezone: true,
  reportEmailFrequency: true,
  reportEmails: true,
  reportHour: true,
  reportDay: true,
  reportLastSentAt: true,
} as const;

type UserReportRow = {
  timezone: string;
  reportEmailFrequency: string;
  reportEmails: string[];
  reportHour: number;
  reportDay: string;
  reportLastSentAt: Date | null;
};

function asFrequency(v: string): ReportEmailFrequency {
  return v === "DAILY" || v === "WEEKLY" ? v : "NONE";
}

function asDay(v: string): ReportDay {
  return (REPORT_DAYS as readonly string[]).includes(v) ? (v as ReportDay) : "MON";
}

export function toReportPrefs(u: UserReportRow): ReportUserPrefs {
  return {
    emailFrequency: asFrequency(u.reportEmailFrequency),
    emails: Array.isArray(u.reportEmails) ? u.reportEmails : [],
    hour: Number.isInteger(u.reportHour) && u.reportHour >= 0 && u.reportHour <= 23 ? u.reportHour : 8,
    day: asDay(u.reportDay),
    lastSentAt: u.reportLastSentAt ? u.reportLastSentAt.toISOString() : null,
    timezone: u.timezone || "Africa/Abidjan",
  };
}

export async function getUserReportPrefs(userId: string): Promise<ReportUserPrefs> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: REPORT_PREFS_SELECT });
  if (!u) return { emailFrequency: "NONE", emails: [], hour: 8, day: "MON", lastSentAt: null, timezone: "Africa/Abidjan" };
  return toReportPrefs(u);
}

export async function updateUserReportPrefs(
  userId: string,
  patch: Partial<Pick<ReportUserPrefs, "emailFrequency" | "emails" | "hour" | "day">>
): Promise<ReportUserPrefs> {
  const u = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(patch.emailFrequency !== undefined && { reportEmailFrequency: patch.emailFrequency }),
      ...(patch.emails !== undefined && { reportEmails: patch.emails }),
      ...(patch.hour !== undefined && { reportHour: patch.hour }),
      ...(patch.day !== undefined && { reportDay: patch.day }),
    },
    select: REPORT_PREFS_SELECT,
  });
  return toReportPrefs(u);
}

/** Destinataires effectifs : adresses configurées, sinon l'e-mail du compte. */
export function resolveRecipients(user: { email: string; reportEmails: string[] }): string[] {
  const configured = (user.reportEmails || []).map((e) => e.trim()).filter(Boolean);
  return configured.length > 0 ? configured : [user.email];
}

/**
 * Migration unique : les anciennes préférences vivaient dans le blob JSON
 * (`config.users[userId] = { emailFrequency, lastSentAt }`). On les recopie
 * vers `User` (sans écraser un réglage déjà fait) puis on nettoie le blob.
 * Idempotent : ne fait rien si aucun blob ne contient encore `users`.
 */
export async function migrateLegacyReportPrefs(): Promise<void> {
  const rows = await prisma.integrationConfig.findMany({
    where: { provider: REPORTS_PROVIDER },
    select: { organizationId: true, config: true },
  });
  let migrated = 0;
  for (const row of rows) {
    const cfg: any = row.config && typeof row.config === "object" ? row.config : {};
    if (!cfg.users || typeof cfg.users !== "object") continue;

    for (const [userId, raw] of Object.entries<any>(cfg.users)) {
      const frequency = asFrequency(raw?.emailFrequency);
      const lastSentAt = raw?.lastSentAt ? new Date(raw.lastSentAt) : null;
      const current = await prisma.user.findUnique({ where: { id: userId }, select: { reportEmailFrequency: true } });
      if (!current || current.reportEmailFrequency !== "NONE") continue;
      await prisma.user.update({
        where: { id: userId },
        data: {
          reportEmailFrequency: frequency,
          ...(lastSentAt && !Number.isNaN(lastSentAt.getTime()) && { reportLastSentAt: lastSentAt }),
        },
      });
      migrated++;
    }

    const { users: _legacy, ...rest } = cfg;
    await saveReportsConfig(row.organizationId, normalize(rest));
  }
  if (migrated > 0) console.log(`📧 [ReportWorker] ${migrated} préférence(s) de rapport migrée(s) vers User.report*`);
}

// ---------------------------------------------------------------------------
// Historique des exports
// ---------------------------------------------------------------------------

export async function appendHistory(
  organizationId: string,
  entry: Omit<ReportHistoryEntry, "id" | "createdAt">
): Promise<ReportHistoryEntry> {
  const config = await getReportsConfig(organizationId);
  const full: ReportHistoryEntry = { ...entry, id: randomUUID(), createdAt: new Date().toISOString() };
  config.history = [full, ...config.history].slice(0, HISTORY_LIMIT);
  await saveReportsConfig(organizationId, config);
  return full;
}
