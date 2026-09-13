import { prisma } from "../../../lib/prisma.js";
import { UnipileService } from "./unipile.service.js";
/** Un compte de moins de 10 min peut être en cours de checkpoint : on ne le touche jamais automatiquement. */
const GRACE_MS = 10 * 60 * 1000;
export async function listReconciledAccounts() {
    const list = await UnipileService.getAllAccounts();
    if (!list.success || !list.items)
        return { success: false, accounts: [], error: list.error };
    const rows = await prisma.linkedInAccount.findMany({
        select: {
            unipileAccountId: true,
            status: true,
            user: { select: { id: true, email: true, name: true, organization: { select: { name: true } } } },
        },
    });
    const byId = new Map(rows.map((r) => [r.unipileAccountId, r]));
    const byProvider = new Map();
    for (const a of list.items) {
        if (a.type !== "LINKEDIN" || !a.providerId)
            continue;
        byProvider.set(a.providerId, [...(byProvider.get(a.providerId) || []), a.id]);
    }
    const accounts = list.items.map((a) => {
        const row = byId.get(a.id);
        return {
            ...a,
            status: a.sources?.[0]?.status || "UNKNOWN",
            user: row
                ? { id: row.user.id, email: row.user.email, name: row.user.name, organizationName: row.user.organization?.name || null }
                : null,
            dbStatus: row?.status || null,
            orphan: !row,
            duplicateOf: (a.providerId ? byProvider.get(a.providerId) || [] : []).filter((id) => id !== a.id),
        };
    });
    return { success: true, accounts };
}
/**
 * Passe de réconciliation :
 *  - doublons d'identité LinkedIn : on garde le compte référencé en base (ou le plus récent), on supprime les autres ;
 *  - orphelins (aucune ligne en base) : supprimés seulement si UNIPILE_AUTO_DELETE_ORPHANS=true, sinon juste signalés.
 * Les comptes de moins de 10 minutes ne sont jamais touchés (checkpoint possible).
 */
export async function reconcileUnipileAccounts(opts = {}) {
    const autoDeleteOrphans = opts.autoDeleteOrphans ?? process.env.UNIPILE_AUTO_DELETE_ORPHANS === "true";
    const { success, accounts, error } = await listReconciledAccounts();
    if (!success) {
        console.warn("[UnipileReconcile] Liste des comptes indisponible:", error);
        return { deleted: [], orphans: [], duplicates: [] };
    }
    const now = Date.now();
    const recent = (a) => now - new Date(a.created_at).getTime() < GRACE_MS;
    const deleted = [];
    const orphans = [];
    const duplicates = [];
    // 1. Doublons par identité LinkedIn
    const groups = new Map();
    for (const a of accounts) {
        if (a.type === "LINKEDIN" && a.providerId)
            groups.set(a.providerId, [...(groups.get(a.providerId) || []), a]);
    }
    for (const [providerId, group] of groups) {
        if (group.length < 2)
            continue;
        const keep = group.find((a) => !a.orphan && a.status === "OK") ||
            group.find((a) => !a.orphan) ||
            [...group].sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())[0];
        for (const dup of group) {
            if (dup.id === keep.id || recent(dup))
                continue;
            duplicates.push(dup.id);
            console.warn(`[UnipileReconcile] Doublon ${dup.id} (identité ${providerId}, garde ${keep.id}) → suppression`);
            const del = await UnipileService.deleteAccount(dup.id);
            if (del.success) {
                deleted.push(dup.id);
                await prisma.linkedInAccount.deleteMany({ where: { unipileAccountId: dup.id } }).catch(() => { });
            }
        }
    }
    // 2. Orphelins
    for (const a of accounts) {
        if (!a.orphan || deleted.includes(a.id) || recent(a))
            continue;
        orphans.push(a.id);
        if (autoDeleteOrphans) {
            console.warn(`[UnipileReconcile] Orphelin ${a.id} (${a.name}) → suppression automatique`);
            const del = await UnipileService.deleteAccount(a.id);
            if (del.success)
                deleted.push(a.id);
        }
        else {
            console.warn(`[UnipileReconcile] Orphelin facturé détecté : ${a.id} (${a.name}) — à supprimer depuis Plateforme Hub`);
        }
    }
    if (deleted.length === 0 && orphans.length === 0) {
        console.log(`[UnipileReconcile] OK — ${accounts.length} compte(s) Unipile, aucun doublon ni orphelin`);
    }
    return { deleted, orphans, duplicates };
}
/** Suppression manuelle (admin) : refusée si le compte est référencé en base. */
export async function deleteUnipileAccountIfOrphan(accountId) {
    const row = await prisma.linkedInAccount.findUnique({ where: { unipileAccountId: accountId }, select: { id: true } });
    if (row)
        return { success: false, error: "Ce compte est rattaché à un utilisateur : déconnectez-le depuis son profil." };
    return UnipileService.deleteAccount(accountId);
}
