import React, { useEffect, useState } from "react";
import { Server, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Loader2, Copy } from "lucide-react";
import { apiRequest } from "../../services/api";
import { ConfirmModal } from "../common/ConfirmModal";

interface UnipileAccountRow {
  id: string;
  name: string;
  type: string;
  created_at: string;
  status: string;
  providerId: string | null;
  publicIdentifier: string | null;
  user: { id: string; email: string; name: string | null; organizationName: string | null } | null;
  dbStatus: string | null;
  orphan: boolean;
  duplicateOf: string[];
}

const STATUS_CLS: Record<string, string> = {
  OK: "bg-surface-2 text-ok border-line",
  CREDENTIALS: "bg-surface-2 text-danger border-line",
  CONNECTING: "bg-surface-2 text-muted border-line",
};

/**
 * Plateforme Hub › Comptes Unipile : chaque compte est facturé. La carte signale les orphelins
 * (non rattachés à un utilisateur) et les doublons d'identité LinkedIn, et permet de les supprimer.
 */
export const UnipileAccountsCard: React.FC = () => {
  const [accounts, setAccounts] = useState<UnipileAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<UnipileAccountRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await apiRequest<{ accounts: UnipileAccountRow[] }>("/admin/unipile/accounts");
    if (res.success && Array.isArray(res.accounts)) setAccounts(res.accounts);
    else setError(res.error || "Impossible de lister les comptes Unipile.");
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const res = await apiRequest(`/admin/unipile/accounts/${toDelete.id}`, { method: "DELETE" });
    if (res.success) {
      setNotice(`Compte ${toDelete.id} supprimé chez Unipile.`);
      setToDelete(null);
      await load();
    } else {
      setError(res.error || "Suppression impossible.");
    }
    setDeleting(false);
  };

  const handleReconcile = async () => {
    setReconciling(true);
    setError(null);
    setNotice(null);
    const res = await apiRequest<{ deleted: string[]; orphans: string[]; duplicates: string[] }>("/admin/unipile/reconcile", {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (res.success) {
      const d = (res as any).deleted?.length || 0;
      const o = (res as any).orphans?.length || 0;
      setNotice(`Réconciliation terminée : ${d} doublon(s) supprimé(s), ${o} orphelin(s) détecté(s).`);
      await load();
    } else {
      setError(res.error || "Réconciliation impossible.");
    }
    setReconciling(false);
  };

  const orphans = accounts.filter((a) => a.orphan).length;
  const duplicates = accounts.filter((a) => a.duplicateOf.length > 0).length;

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-ink" />
            <h3 className="text-lg font-semibold text-ink">Comptes Unipile</h3>
            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-xs font-medium bg-surface-2 text-muted border border-line">
              {accounts.length} facturé{accounts.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Chaque compte est facturé par Unipile : un seul compte par personne, aucun compte sans utilisateur.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReconcile}
            disabled={reconciling || loading}
            title="Supprime les doublons d'identité LinkedIn et liste les orphelins"
            className="py-2 px-3.5 rounded-xl bg-white hover:bg-surface-2 border border-line text-ink text-xs font-medium flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {reconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-ok" />}
            Réconcilier
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-2 rounded-xl bg-white hover:bg-surface-2 border border-line text-muted hover:text-ink transition-all cursor-pointer disabled:opacity-50"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {(orphans > 0 || duplicates > 0) && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-surface-2 border border-line text-warn text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {orphans > 0 && <span>{orphans} compte{orphans > 1 ? "s" : ""} orphelin{orphans > 1 ? "s" : ""} (facturé{orphans > 1 ? "s" : ""} sans utilisateur)</span>}
          {orphans > 0 && duplicates > 0 && <span>·</span>}
          {duplicates > 0 && <span>{duplicates} compte{duplicates > 1 ? "s" : ""} en doublon d'identité LinkedIn</span>}
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-2xl bg-surface-2 border border-line text-danger text-xs font-semibold">{error}</div>
      )}
      {notice && !error && (
        <div className="px-4 py-3 rounded-2xl bg-surface-2 border border-line text-ok text-xs font-semibold">{notice}</div>
      )}

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted text-xs font-medium">
              <th className="text-left px-2 py-2">Compte LinkedIn</th>
              <th className="text-left px-2 py-2">Identifiant Unipile</th>
              <th className="text-left px-2 py-2">Statut</th>
              <th className="text-left px-2 py-2">Utilisateur Bleadin</th>
              <th className="text-left px-2 py-2">Créé le</th>
              <th className="text-right px-2 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-8 text-center text-muted">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Chargement…
                </td>
              </tr>
            )}
            {!loading && accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-8 text-center text-muted">Aucun compte Unipile.</td>
              </tr>
            )}
            {accounts.map((a) => (
              <tr key={a.id} className={`border-t border-[#f0f0ed] ${a.orphan ? "bg-surface-2" : ""}`}>
                <td className="px-2 py-2.5">
                  <div className="font-medium text-ink">{a.name}</div>
                  <div className="text-xs text-[#9a9aa5]">
                    {a.publicIdentifier ? `linkedin.com/in/${a.publicIdentifier}` : a.providerId || "—"}
                    {a.duplicateOf.length > 0 && (
                      <span className="ml-1.5 text-warn font-medium">· doublon de {a.duplicateOf.join(", ")}</span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2.5">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(a.id)}
                    title="Copier"
                    className="inline-flex items-center gap-1 font-mono text-xs text-ink-2 hover:text-ink cursor-pointer"
                  >
                    {a.id} <Copy className="w-3 h-3" />
                  </button>
                </td>
                <td className="px-2 py-2.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-xs font-medium border ${STATUS_CLS[a.status] || "bg-surface-2 text-muted border-line"}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-2 py-2.5">
                  {a.user ? (
                    <div>
                      <div className="font-semibold text-ink">{a.user.name || a.user.email}</div>
                      <div className="text-xs text-[#9a9aa5]">
                        {a.user.organizationName || "—"} · base : {a.dbStatus}
                      </div>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-warn font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" /> Orphelin
                    </span>
                  )}
                </td>
                <td className="px-2 py-2.5 whitespace-nowrap text-muted">{new Date(a.created_at).toLocaleDateString("fr-FR")}</td>
                <td className="px-2 py-2.5 text-right">
                  {a.orphan ? (
                    <button
                      type="button"
                      onClick={() => setToDelete(a)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-white hover:bg-surface-2 text-danger font-medium text-xs transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Supprimer
                    </button>
                  ) : (
                    <span className="text-xs text-[#9a9aa5]">via le profil utilisateur</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="Supprimer ce compte Unipile ?"
        itemName={toDelete ? `${toDelete.name} (${toDelete.id})` : ""}
        itemType="Compte Unipile"
        variant="danger"
        confirmText="Supprimer chez Unipile"
        cancelText="Annuler"
        isLoading={deleting}
        description="Le compte n'est rattaché à aucun utilisateur Bleadin : sa suppression arrête sa facturation. La personne pourra se reconnecter depuis l'application si nécessaire."
      />
    </div>
  );
};
