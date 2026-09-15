import { randomUUID } from "crypto";
import { prisma } from "../../../lib/prisma.js";
/**
 * Stockage des paramètres de rapports (fréquence d'e-mail par utilisateur,
 * historique des exports).
 *
 * TEMPORAIRE — ces données vivent dans `IntegrationConfig.config` (JSON) avec
 * `provider = "BLEADIN_REPORTS"`, une ligne par organisation, afin d'éviter
 * une modification du schéma Prisma (impossible à pousser en prod sans accès
 * SSH au moment de l'implémentation). À migrer vers de vrais champs
 * (`User.reportEmailFrequency`, modèle `ReportHistory`)
 * dès que `prisma db push` pourra être exécuté sur le serveur.
 */
export const REPORTS_PROVIDER = "BLEADIN_REPORTS";
export const HISTORY_LIMIT = 100;
function normalize(raw) {
    const cfg = raw && typeof raw === "object" ? raw : {};
    return {
        users: cfg.users && typeof cfg.users === "object" ? cfg.users : {},
        history: Array.isArray(cfg.history) ? cfg.history : [],
    };
}
export async function getReportsConfig(organizationId) {
    const row = await prisma.integrationConfig.findUnique({
        where: { organizationId_provider: { organizationId, provider: REPORTS_PROVIDER } },
        select: { config: true },
    });
    return normalize(row?.config);
}
export async function saveReportsConfig(organizationId, config) {
    await prisma.integrationConfig.upsert({
        where: { organizationId_provider: { organizationId, provider: REPORTS_PROVIDER } },
        create: { organizationId, provider: REPORTS_PROVIDER, config: config, status: "CONNECTED" },
        update: { config: config },
    });
}
export function getUserPrefs(config, userId) {
    const p = config.users[userId];
    return { emailFrequency: p?.emailFrequency || "NONE", lastSentAt: p?.lastSentAt || null };
}
export async function setUserPrefs(organizationId, userId, patch) {
    const config = await getReportsConfig(organizationId);
    const next = { ...getUserPrefs(config, userId), ...patch };
    config.users[userId] = next;
    await saveReportsConfig(organizationId, config);
    return next;
}
export async function appendHistory(organizationId, entry) {
    const config = await getReportsConfig(organizationId);
    const full = { ...entry, id: randomUUID(), createdAt: new Date().toISOString() };
    config.history = [full, ...config.history].slice(0, HISTORY_LIMIT);
    await saveReportsConfig(organizationId, config);
    return full;
}
/** Liste toutes les organisations ayant une configuration de rapports (pour le planificateur). */
export async function listReportsConfigs() {
    const rows = await prisma.integrationConfig.findMany({
        where: { provider: REPORTS_PROVIDER },
        select: { organizationId: true, config: true },
    });
    return rows.map((r) => ({ organizationId: r.organizationId, config: normalize(r.config) }));
}
