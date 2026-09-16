import { prisma } from "../../../lib/prisma.js";
import {
  ACTION_KINDS,
  WARMUP_DAYS,
  dailySafetyCap,
  getPlanActionLimits,
  type ActionKind,
  type PlanActionLimits,
  type QuotaWindow,
} from "../config/plans.js";

/**
 * Quotas d'actions LinkedIn : usage hebdo/mensuel par compte (source de vérité :
 * ActionQueue), répartition journalière aléatoire, montée en charge des comptes
 * neufs et plafonds de sécurité Unipile. Utilisé par le worker de campagne et
 * par les écrans Réglages / Facturation.
 */

const EXECUTED_STATUSES = ["SUCCESS", "EXECUTED"];

const ACTION_TYPE_TO_KIND: Record<string, ActionKind> = {
  INVITATION: "invites",
  MESSAGE: "messages",
  VISIT_PROFILE: "visits",
  VISIT: "visits",
  FOLLOW: "follows",
};

const WEEKDAY_INDEX: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DEFAULT_WORKING_DAYS = ["MON", "TUE", "WED", "THU", "FRI"];
const DEFAULT_TZ = "Africa/Abidjan";

/** Facteur aléatoire appliqué à la cible journalière : 0,75 → 1,15. */
const JITTER_MIN = 0.75;
const JITTER_SPAN = 0.4;

export function actionKindOf(actionType: string | null | undefined): ActionKind | null {
  return ACTION_TYPE_TO_KIND[actionType || ""] ?? null;
}

// ---------------------------------------------------------------------------
// Dates dans le fuseau de l'utilisateur (sans dépendance externe)
// ---------------------------------------------------------------------------

interface ZonedParts {
  year: number;
  month: number; // 1..12
  day: number;
  weekday: number; // 0 = dimanche
}

function zonedParts(date: Date, tz: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAY_INDEX[(parts.weekday || "Mon").toUpperCase().slice(0, 3)] ?? date.getDay(),
  };
}

/** Décalage (ms) entre l'heure locale du fuseau et UTC à l'instant donné. */
function tzOffsetMs(date: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const p: Record<string, number> = {};
  for (const part of fmt.formatToParts(date)) p[part.type] = Number(part.value);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instant UTC correspondant à `y-m-d h:00` dans le fuseau donné. */
export function zonedDateTime(tz: string, year: number, month: number, day: number, hour = 0): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour));
  return new Date(guess.getTime() - tzOffsetMs(guess, tz));
}

export interface QuotaPeriods {
  dayStart: Date;
  weekStart: Date;
  monthStart: Date;
  /** Demain 9h locale */
  nextDay: Date;
  /** Lundi prochain 9h locale */
  nextWeek: Date;
  /** 1er du mois prochain 9h locale */
  nextMonth: Date;
  today: ZonedParts;
}

export function quotaPeriods(now: Date, tz: string): QuotaPeriods {
  const safeTz = tz || DEFAULT_TZ;
  const today = zonedParts(now, safeTz);
  const daysSinceMonday = (today.weekday + 6) % 7;
  const base = Date.UTC(today.year, today.month - 1, today.day);
  const monday = new Date(base - daysSinceMonday * 86_400_000);
  const nextMonday = new Date(base + (7 - daysSinceMonday) * 86_400_000);
  const tomorrow = new Date(base + 86_400_000);

  return {
    dayStart: zonedDateTime(safeTz, today.year, today.month, today.day),
    weekStart: zonedDateTime(safeTz, monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate()),
    monthStart: zonedDateTime(safeTz, today.year, today.month, 1),
    nextDay: zonedDateTime(safeTz, tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), 9),
    nextWeek: zonedDateTime(safeTz, nextMonday.getUTCFullYear(), nextMonday.getUTCMonth() + 1, nextMonday.getUTCDate(), 9),
    nextMonth: today.month === 12
      ? zonedDateTime(safeTz, today.year + 1, 1, 1, 9)
      : zonedDateTime(safeTz, today.year, today.month + 1, 1, 9),
    today,
  };
}

// ---------------------------------------------------------------------------
// Usage réel (ActionQueue)
// ---------------------------------------------------------------------------

export type UsageWindow = Record<ActionKind, number>;

export interface QuotaUsage {
  today: UsageWindow;
  week: UsageWindow;
  month: UsageWindow;
}

function emptyWindow(): UsageWindow {
  return { invites: 0, messages: 0, visits: 0, follows: 0 };
}

async function countSince(accountId: string, since: Date): Promise<UsageWindow> {
  const [rows, enrichmentLookups] = await Promise.all([
    prisma.actionQueue.groupBy({
      by: ["actionType"],
      where: { accountId, status: { in: EXECUTED_STATUSES }, executedAt: { gte: since } },
      _count: { _all: true },
    }),
    // Chaque lookup d'enrichissement (e-mail / téléphone) est une lecture de profil : compté comme une visite
    prisma.enrichmentLedger.count({
      where: { accountId, kind: "LOOKUP", status: { not: "FAILED" }, createdAt: { gte: since } },
    }),
  ]);
  const window = emptyWindow();
  for (const row of rows) {
    const kind = actionKindOf(row.actionType as string);
    if (kind) window[kind] += row._count._all;
  }
  window.visits += enrichmentLookups;
  return window;
}

export async function getUsage(accountId: string, periods: QuotaPeriods): Promise<QuotaUsage> {
  const [today, week, month] = await Promise.all([
    countSince(accountId, periods.dayStart),
    countSince(accountId, periods.weekStart),
    countSince(accountId, periods.monthStart),
  ]);
  return { today, week, month };
}

// ---------------------------------------------------------------------------
// Cibles journalières
// ---------------------------------------------------------------------------

export interface QuotaUserSettings {
  maxWeeklyInvites?: number | null;
  maxWeeklyMessages?: number | null;
  maxWeeklyVisits?: number | null;
  maxWeeklyFollows?: number | null;
  workingDays?: string[] | null;
  timezone?: string | null;
}

export interface QuotaAccountInfo {
  id: string;
  accountType?: string | null;
  createdAt: Date;
}

export interface ActionQuotaStatus {
  /** Cible du jour (après aléa, warm-up et plafond de sécurité). */
  target: number;
  usedToday: number;
  usedWeek: number;
  usedMonth: number;
  /** Quotas effectifs = min(plan, réglage utilisateur). */
  limitWeek: number;
  limitMonth: number;
  /** Quotas de l'offre, avant réglage utilisateur. */
  planWeek: number;
  planMonth: number;
  /** Renseigné lorsque l'action doit être différée. */
  blocked: { reason: "DAY" | "WEEK" | "MONTH"; until: Date } | null;
}

export interface QuotaSnapshot {
  actions: Record<ActionKind, ActionQuotaStatus>;
  warmup: { active: boolean; dayIndex: number; totalDays: number };
  periods: QuotaPeriods;
}

/** Hash FNV-1a → nombre dans [0, 1). Stable pour une même graine. */
function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Jours ouvrés restants dans la semaine, aujourd'hui inclus (au moins 1). */
function workingDaysLeftInWeek(todayWeekday: number, workingDays: string[]): number {
  const days = workingDays.length ? workingDays : DEFAULT_WORKING_DAYS;
  let count = 0;
  // De aujourd'hui jusqu'à dimanche
  for (let wd = todayWeekday; ; wd = (wd + 1) % 7) {
    if (days.includes(DAY_NAMES[wd])) count++;
    if (wd === 0) break; // dimanche = fin de semaine
  }
  return Math.max(1, count);
}

function userWeeklyOverride(user: QuotaUserSettings, kind: ActionKind): number | null | undefined {
  switch (kind) {
    case "invites":
      return user.maxWeeklyInvites;
    case "messages":
      return user.maxWeeklyMessages;
    case "visits":
      return user.maxWeeklyVisits;
    case "follows":
      return user.maxWeeklyFollows;
  }
}

/** Quotas effectifs pour un type d'action : min(plan, réglage utilisateur), mois au prorata. */
export function effectiveWindow(plan: QuotaWindow, override: number | null | undefined): QuotaWindow {
  if (override === null || override === undefined || override >= plan.week) return plan;
  const week = Math.max(0, override);
  return { week, month: Math.min(plan.month, Math.round((week * plan.month) / plan.week)) };
}

export function computeQuotaSnapshot(params: {
  user: QuotaUserSettings;
  account: QuotaAccountInfo;
  planRaw: string | null | undefined;
  usage: QuotaUsage;
  now?: Date;
}): QuotaSnapshot {
  const { user, account, planRaw, usage } = params;
  const now = params.now ?? new Date();
  const tz = user.timezone || DEFAULT_TZ;
  const periods = quotaPeriods(now, tz);
  const planLimits: PlanActionLimits = getPlanActionLimits(planRaw, account.accountType);

  const dayIndex = Math.max(0, Math.floor((now.getTime() - account.createdAt.getTime()) / 86_400_000));
  const warmupActive = dayIndex < WARMUP_DAYS;
  const daysLeft = workingDaysLeftInWeek(periods.today.weekday, user.workingDays || DEFAULT_WORKING_DAYS);
  const dateKey = `${periods.today.year}-${periods.today.month}-${periods.today.day}`;

  const actions = {} as Record<ActionKind, ActionQuotaStatus>;

  for (const kind of ACTION_KINDS) {
    const plan = planLimits[kind];
    const eff = effectiveWindow(plan, userWeeklyOverride(user, kind));
    const usedToday = usage.today[kind];
    const usedWeek = usage.week[kind];
    const usedMonth = usage.month[kind];
    const remainingWeek = Math.max(0, eff.week - usedWeek);
    const remainingMonth = Math.max(0, eff.month - usedMonth);

    // Cible du jour : part du restant hebdo, avec aléa déterministe (compte, action, date)
    const jitter = JITTER_MIN + JITTER_SPAN * seededUnit(`${account.id}|${kind}|${dateKey}`);
    let target = Math.round((remainingWeek / daysLeft) * jitter);
    if (remainingWeek > 0) target = Math.max(1, target);
    target = Math.min(target, dailySafetyCap(kind, account.accountType), remainingMonth);

    if (warmupActive) {
      const warmCap = kind === "invites" ? 10 + 5 * dayIndex : Math.ceil(target / 2);
      target = Math.min(target, warmCap);
    }

    let blocked: ActionQuotaStatus["blocked"] = null;
    if (remainingMonth <= 0) blocked = { reason: "MONTH", until: periods.nextMonth };
    else if (remainingWeek <= 0) blocked = { reason: "WEEK", until: periods.nextWeek };
    else if (usedToday >= target) blocked = { reason: "DAY", until: periods.nextDay };

    actions[kind] = {
      target,
      usedToday,
      usedWeek,
      usedMonth,
      limitWeek: eff.week,
      limitMonth: eff.month,
      planWeek: plan.week,
      planMonth: plan.month,
      blocked,
    };
  }

  return {
    actions,
    warmup: { active: warmupActive, dayIndex, totalDays: WARMUP_DAYS },
    periods,
  };
}

/** Charge l'usage réel et calcule l'état des quotas d'un compte LinkedIn. */
export async function getQuotaSnapshot(params: {
  user: QuotaUserSettings;
  account: QuotaAccountInfo;
  planRaw: string | null | undefined;
  now?: Date;
}): Promise<QuotaSnapshot> {
  const now = params.now ?? new Date();
  const periods = quotaPeriods(now, params.user.timezone || DEFAULT_TZ);
  const usage = await getUsage(params.account.id, periods);
  return computeQuotaSnapshot({ ...params, usage, now });
}

export const QUOTA_REASON_LABELS: Record<"DAY" | "WEEK" | "MONTH", string> = {
  DAY: "journalier",
  WEEK: "hebdomadaire",
  MONTH: "mensuel",
};
