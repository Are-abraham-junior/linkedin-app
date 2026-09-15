import { prisma } from "../../../lib/prisma.js";
/**
 * Agrégation des statistiques de campagnes, partagée entre l'endpoint
 * GET /api/reports/campaigns et l'envoi planifié de rapports par e-mail.
 */
const EXECUTED_STATUSES = ["EXECUTED", "SUCCESS"];
const ACCEPTED_STATES = ["IN_PROGRESS", "WAITING_DELAY", "REPLIED", "COMPLETED"];
export function emptyCounters() {
    return { invitesSent: 0, messagesSent: 0, visits: 0, follows: 0, failedActions: 0, queued: 0, repliesReceived: 0 };
}
export function toDayKey(d) {
    return d.toISOString().slice(0, 10);
}
export function rate(num, den) {
    return den > 0 ? Math.round((num / den) * 100) : 0;
}
/** Variation en % entre deux valeurs (null si la référence est 0). */
export function delta(current, previous) {
    if (previous === 0)
        return null;
    return Math.round(((current - previous) / previous) * 100);
}
/**
 * Compte les actions exécutées / échouées / en attente et les réponses reçues
 * par campagne sur une fenêtre de temps, en 2 requêtes.
 */
async function aggregateActions(ids, from, to, withQueued) {
    const counters = new Map();
    const timeline = new Map();
    if (ids.length === 0)
        return { counters, timeline };
    const periodFilter = { gte: from, lte: to };
    const or = [
        { status: { in: EXECUTED_STATUSES }, executedAt: periodFilter },
        { status: "FAILED", executedAt: periodFilter },
    ];
    if (withQueued)
        or.push({ status: "QUEUED" });
    const [actions, replies] = await Promise.all([
        prisma.actionQueue.findMany({
            where: { campaignId: { in: ids }, OR: or },
            select: { campaignId: true, actionType: true, status: true, executedAt: true },
        }),
        prisma.message.findMany({
            where: {
                senderType: "PROSPECT",
                sentAt: periodFilter,
                conversation: { prospect: { campaignStates: { some: { campaignId: { in: ids } } } } },
            },
            select: {
                sentAt: true,
                conversation: {
                    select: {
                        prospect: {
                            select: {
                                campaignStates: { where: { campaignId: { in: ids } }, select: { campaignId: true } },
                            },
                        },
                    },
                },
            },
        }),
    ]);
    const get = (campaignId) => {
        let c = counters.get(campaignId);
        if (!c) {
            c = emptyCounters();
            counters.set(campaignId, c);
        }
        return c;
    };
    const bump = (campaignId, day, key) => {
        let days = timeline.get(campaignId);
        if (!days) {
            days = new Map();
            timeline.set(campaignId, days);
        }
        let point = days.get(day);
        if (!point) {
            point = { date: day, invitesSent: 0, messagesSent: 0, replies: 0 };
            days.set(day, point);
        }
        point[key] += 1;
    };
    for (const a of actions) {
        const c = get(a.campaignId);
        if (a.status === "QUEUED") {
            c.queued += 1;
            continue;
        }
        if (a.status === "FAILED") {
            c.failedActions += 1;
            continue;
        }
        const day = a.executedAt ? toDayKey(a.executedAt) : null;
        switch (a.actionType) {
            case "INVITATION":
                c.invitesSent += 1;
                if (day)
                    bump(a.campaignId, day, "invitesSent");
                break;
            case "MESSAGE":
                c.messagesSent += 1;
                if (day)
                    bump(a.campaignId, day, "messagesSent");
                break;
            case "VISIT_PROFILE":
                c.visits += 1;
                break;
            case "FOLLOW":
                c.follows += 1;
                break;
        }
    }
    for (const m of replies) {
        const day = toDayKey(m.sentAt);
        for (const st of m.conversation.prospect.campaignStates) {
            get(st.campaignId).repliesReceived += 1;
            bump(st.campaignId, day, "replies");
        }
    }
    return { counters, timeline };
}
function emptySummary() {
    return {
        campaigns: 0,
        activeCampaigns: 0,
        totalProspects: 0,
        acceptedCount: 0,
        repliedCount: 0,
        completedCount: 0,
        failed: 0,
        ...emptyCounters(),
        acceptanceRate: 0,
        replyRate: 0,
    };
}
export async function buildCampaignsReport(opts) {
    const { scope, from, to, includeDetails = false, compare = false } = opts;
    const now = new Date();
    const where = { ...scope };
    if (opts.campaignIds && opts.campaignIds.length > 0)
        where.id = { in: opts.campaignIds };
    const campaigns = await prisma.campaign.findMany({
        where,
        include: {
            user: { select: { id: true, name: true, email: true, orgRole: true } },
            steps: { orderBy: { stepOrder: "asc" } },
            prospectStates: includeDetails
                ? {
                    include: {
                        currentStep: { select: { stepOrder: true, actionType: true } },
                        prospect: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                headline: true,
                                company: true,
                                location: true,
                                email: true,
                                phone: true,
                                linkedinUrl: true,
                                connectionStatus: true,
                            },
                        },
                    },
                    orderBy: { updatedAt: "desc" },
                }
                : { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
    });
    const ids = campaigns.map((c) => c.id);
    const spanMs = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - spanMs);
    const [current, previous] = await Promise.all([
        aggregateActions(ids, from, to, true),
        compare ? aggregateActions(ids, prevFrom, prevTo, false) : Promise.resolve(null),
    ]);
    const summary = emptySummary();
    summary.campaigns = campaigns.length;
    summary.activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
    const previousSummary = compare ? emptyCounters() : null;
    const formatted = campaigns.map((c) => {
        const states = c.prospectStates || [];
        const total = states.length;
        const accepted = states.filter((s) => ACCEPTED_STATES.includes(s.status)).length;
        const replied = states.filter((s) => s.status === "REPLIED").length;
        const completed = states.filter((s) => s.status === "COMPLETED").length;
        const failed = states.filter((s) => s.status === "FAILED").length;
        const waitingCondition = states.filter((s) => s.status === "WAITING_CONDITION" || s.status === "PENDING").length;
        const waitingDelay = states.filter((s) => s.status === "WAITING_DELAY").length;
        const counters = current.counters.get(c.id) || emptyCounters();
        const prevCounters = previous ? previous.counters.get(c.id) || emptyCounters() : null;
        const timeline = Array.from(current.timeline.get(c.id)?.values() || []).sort((a, b) => a.date.localeCompare(b.date));
        summary.totalProspects += total;
        summary.acceptedCount += accepted;
        summary.repliedCount += replied;
        summary.completedCount += completed;
        summary.failed += failed;
        for (const k of Object.keys(counters)) {
            summary[k] += counters[k];
            if (previousSummary && prevCounters)
                previousSummary[k] += prevCounters[k];
        }
        return {
            id: c.id,
            name: c.name,
            status: c.status,
            type: c.type,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            author: c.user ? { id: c.user.id, name: c.user.name || c.user.email, orgRole: c.user.orgRole } : null,
            steps: c.steps.map((s) => ({
                id: s.id,
                stepOrder: s.stepOrder,
                actionType: s.actionType,
                delayDays: s.delayDays,
                messageText: s.messageText,
            })),
            stats: {
                totalProspects: total,
                acceptedCount: accepted,
                repliedCount: replied,
                completedCount: completed,
                waitingCondition,
                waitingDelay,
                failed,
                acceptanceRate: rate(accepted, total),
                replyRate: rate(replied, accepted),
                ...counters,
            },
            previousStats: prevCounters,
            timeline,
            prospects: includeDetails
                ? states.map((s) => ({
                    id: s.prospect.id,
                    firstName: s.prospect.firstName,
                    lastName: s.prospect.lastName,
                    headline: s.prospect.headline,
                    company: s.prospect.company,
                    location: s.prospect.location,
                    email: s.prospect.email,
                    phone: s.prospect.phone,
                    linkedinUrl: s.prospect.linkedinUrl,
                    connectionStatus: s.prospect.connectionStatus,
                    status: s.status,
                    currentStepOrder: s.currentStep?.stepOrder ?? null,
                    currentStepType: s.currentStep?.actionType ?? null,
                    lastActionAt: s.lastActionAt,
                    enrolledAt: s.createdAt,
                }))
                : undefined,
        };
    });
    summary.acceptanceRate = rate(summary.acceptedCount, summary.totalProspects);
    summary.replyRate = rate(summary.repliedCount, summary.acceptedCount);
    const comparison = previousSummary
        ? {
            period: { from: toDayKey(prevFrom), to: toDayKey(prevTo) },
            summary: previousSummary,
            deltas: Object.fromEntries(Object.keys(previousSummary).map((k) => [k, delta(summary[k], previousSummary[k])])),
        }
        : null;
    return {
        generatedAt: now.toISOString(),
        period: { from: toDayKey(from), to: toDayKey(to) },
        summary,
        comparison,
        campaigns: formatted,
    };
}
