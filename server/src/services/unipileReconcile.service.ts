import { prisma } from "../../../lib/prisma.js";
import { UnipileService, type UnipileAccountSummary } from "./unipile.service.js";

/**
 * Réconciliation Unipile ↔ base : chaque compte Unipile est facturé, on veut
 * exactement un compte par utilisateur et aucun compte non référencé.
 */

export interface ReconciledAccount extends UnipileAccountSummary {
  status: string;
  /** Utilisateur Bleadin rattaché (null = orphelin) */
  user: { id: string; email: string; name: string | null; organizationName: string | null } | null;
  dbStatus: string | null;
  orphan: boolean;
  /** Autre(s) compte(s) Unipile ayant la même identité LinkedIn */
  duplicateOf: string[];
}

/** Un compte de moins de 10 min peut être en cours de checkpoint : on ne le touche jamais automatiquement. */
const GRACE_MS = 10 * 60 * 1000;

export async function listReconciledAccounts(): Promise<{ success: boolean; accounts: ReconciledAccount[]; error?: string }> {
  const list = await UnipileService.getAllAccounts();
  if (!list.success || !list.items) return { success: false, accounts: [], error: list.error };

  const rows = await prisma.linkedInAccount.findMany({
    select: {
      unipileAccountId: true,
      status: true,
      user: { select: { id: true, email: true, name: true, organization: { select: { name: true } } } },
    },
  });
  const byId = new Map(rows.map((r) => [r.unipileAccountId, r]));

  const byProvider = new Map<string, string[]>();
  for (const a of list.items) {
    if (a.type !== "LINKEDIN" || !a.providerId) continue;
    byProvider.set(a.providerId, [...(byProvider.get(a.providerId) || []), a.id]);
  }

  const accounts: ReconciledAccount[] = list.items.map((a) => {
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
export async function reconcileUnipileAccounts(opts: { autoDeleteOrphans?: boolean } = {}) {
  const autoDeleteOrphans = opts.autoDeleteOrphans ?? process.env.UNIPILE_AUTO_DELETE_ORPHANS === "true";
  const { success, accounts, error } = await listReconciledAccounts();
  if (!success) {
    console.warn("[UnipileReconcile] Liste des comptes indisponible:", error);
    return { deleted: [] as string[], orphans: [] as string[], duplicates: [] as string[] };
  }

  const now = Date.now();
  const recent = (a: ReconciledAccount) => now - new Date(a.created_at).getTime() < GRACE_MS;
  const deleted: string[] = [];
  const orphans: string[] = [];
  const duplicates: string[] = [];

  // 1. Doublons par identité LinkedIn
  const groups = new Map<string, ReconciledAccount[]>();
  for (const a of accounts) {
    if (a.type === "LINKEDIN" && a.providerId) groups.set(a.providerId, [...(groups.get(a.providerId) || []), a]);
  }
  for (const [providerId, group] of groups) {
    if (group.length < 2) continue;
    const keep =
      group.find((a) => !a.orphan && a.status === "OK") ||
      group.find((a) => !a.orphan) ||
      [...group].sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())[0];
    for (const dup of group) {
      if (dup.id === keep.id || recent(dup)) continue;
      duplicates.push(dup.id);
      console.warn(`[UnipileReconcile] Doublon ${dup.id} (identité ${providerId}, garde ${keep.id}) → suppression`);
      const del = await UnipileService.deleteAccount(dup.id);
      if (del.success) {
        deleted.push(dup.id);
        await prisma.linkedInAccount.deleteMany({ where: { unipileAccountId: dup.id } }).catch(() => {});
      }
    }
  }

  // 2. Orphelins
  for (const a of accounts) {
    if (!a.orphan || deleted.includes(a.id) || recent(a)) continue;
    orphans.push(a.id);
    if (autoDeleteOrphans) {
      console.warn(`[UnipileReconcile] Orphelin ${a.id} (${a.name}) → suppression automatique`);
      const del = await UnipileService.deleteAccount(a.id);
      if (del.success) deleted.push(a.id);
    } else {
      console.warn(`[UnipileReconcile] Orphelin facturé détecté : ${a.id} (${a.name}) — à supprimer depuis Plateforme Hub`);
    }
  }

  // 3. Lignes en base désynchronisées d'Unipile
  const healed = await healLinkedInAccountRows(accounts);

  if (deleted.length === 0 && orphans.length === 0 && healed === 0) {
    console.log(`[UnipileReconcile] OK — ${accounts.length} compte(s) Unipile, aucun doublon ni orphelin`);
  }
  return { deleted, orphans, duplicates };
}

/**
 * Remet la base en phase avec Unipile (`accounts` = liste complète des comptes Unipile) :
 *  - ligne DISCONNECTED/CHECKPOINT dont le compte Unipile est OK → CONNECTED (ligne rétrogradée à tort,
 *    typiquement par un check de statut tombé dans la fenêtre de création du compte) ;
 *  - ligne « fantôme » (account_id inconnu chez Unipile, ex. ancienne instance après changement de DSN)
 *    → supprimée si l'utilisateur possède une autre ligne, sinon conservée pour la reconnexion.
 * Retourne le nombre de lignes modifiées.
 */
async function healLinkedInAccountRows(accounts: ReconciledAccount[]): Promise<number> {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const rows = await prisma.linkedInAccount.findMany({
    where: { unipileAccountId: { not: "" } },
    select: { id: true, userId: true, unipileAccountId: true, status: true, updatedAt: true },
  });
  const rowsByUser = new Map<string, number>();
  for (const r of rows) rowsByUser.set(r.userId, (rowsByUser.get(r.userId) || 0) + 1);

  let changed = 0;
  for (const row of rows) {
    if (Date.now() - row.updatedAt.getTime() < GRACE_MS) continue;
    const live = byId.get(row.unipileAccountId);

    if (live && live.status === "OK" && row.status !== "CONNECTED") {
      console.warn(`[UnipileReconcile] Ligne ${row.id} en ${row.status} alors que le compte ${row.unipileAccountId} est OK chez Unipile → CONNECTED`);
      await prisma.linkedInAccount.update({ where: { id: row.id }, data: { status: "CONNECTED" } }).catch(() => {});
      changed++;
      continue;
    }

    if (!live && row.status !== "CONNECTED" && (rowsByUser.get(row.userId) || 0) > 1) {
      // Confirmation unitaire avant suppression : la liste peut être incomplète
      const probe = await UnipileService.getAccountStatus(row.unipileAccountId);
      if (probe?.errorStatus !== 404) continue;
      console.warn(`[UnipileReconcile] Ligne fantôme ${row.id} (compte ${row.unipileAccountId} inconnu chez Unipile) → suppression`);
      await prisma.linkedInAccount.delete({ where: { id: row.id } }).catch(() => {});
      rowsByUser.set(row.userId, (rowsByUser.get(row.userId) || 1) - 1);
      changed++;
    }
  }
  return changed;
}

/** Suppression manuelle (admin) : refusée si le compte est référencé en base. */
export async function deleteUnipileAccountIfOrphan(accountId: string): Promise<{ success: boolean; error?: string }> {
  const row = await prisma.linkedInAccount.findUnique({ where: { unipileAccountId: accountId }, select: { id: true } });
  if (row) return { success: false, error: "Ce compte est rattaché à un utilisateur : déconnectez-le depuis son profil." };
  return UnipileService.deleteAccount(accountId);
}
