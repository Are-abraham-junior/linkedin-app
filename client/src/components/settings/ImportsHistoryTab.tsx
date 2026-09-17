import React, { useState, useEffect } from "react";
import { apiRequest } from "../../services/api";
import {
  FileSpreadsheet,
  Search,
  History,
  CheckCircle2,
  AlertTriangle,
  Users,
  ShieldCheck,
  RefreshCw,
  Eye,
  X,
  ArrowUpRight,
  Loader2,
} from "lucide-react";

interface ImportRecord {
  id: string;
  source: string;
  filename: string | null;
  listName: string | null;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  collisionCount: number;
  status: string;
  createdAt: string;
  user?: { name: string; email: string };
}

export const ImportsHistoryTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [stats, setStats] = useState({
    totalImports: 0,
    totalImportedLeads: 0,
    totalDuplicatesFiltered: 0,
    totalCollisionsBlocked: 0,
  });

  const [selectedImport, setSelectedImport] = useState<ImportRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        imports: ImportRecord[];
        stats: any;
      }>("/settings/imports");

      if (res.success) {
        setImports(res.imports || []);
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (err: any) {
      console.warn("Notice loading import history:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredImports = imports.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      (item.filename && item.filename.toLowerCase().includes(q)) ||
      (item.listName && item.listName.toLowerCase().includes(q)) ||
      (item.source && item.source.toLowerCase().includes(q))
    );
  });

  const formatSourceBadge = (source: string) => {
    const s = (source || "").toUpperCase();
    if (s.includes("LINKEDIN")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0077b5]/10 text-[#0077b5] text-xs font-medium">
          Recherche LinkedIn
        </span>
      );
    }
    if (s.includes("XLSX") || s.includes("EXCEL")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-2 text-ok text-xs font-medium">
          Fichier Excel (XLSX)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-2 text-ink text-xs font-medium">
        Fichier CSV
      </span>
    );
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Cartes Métriques Globales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-line/80">
          <div className="flex items-center justify-between text-muted text-xs font-semibold mb-1">
            <span>Lots traités</span>
            <FileSpreadsheet className="w-4 h-4 text-ink" />
          </div>
          <p className="text-xl font-semibold text-ink">{stats.totalImports}</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-line/80">
          <div className="flex items-center justify-between text-muted text-xs font-semibold mb-1">
            <span>Leads qualifiés</span>
            <Users className="w-4 h-4 text-ok" />
          </div>
          <p className="text-xl font-semibold text-ok">{stats.totalImportedLeads}</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-line/80">
          <div className="flex items-center justify-between text-muted text-xs font-semibold mb-1">
            <span>Doublons filtrés</span>
            <ShieldCheck className="w-4 h-4 text-ink" />
          </div>
          <p className="text-xl font-semibold text-ink">{stats.totalDuplicatesFiltered}</p>
        </div>
      </div>

      {/* Tableau des imports */}
      <div className="rounded-2xl border border-line bg-surface bg-white rounded-2xl border border-line/80 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#f0f0f4] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-medium text-ink">Journal des Importations</h3>
            <p className="text-xs text-muted">Historique complet de vos fichiers et recherches de leads</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#9ca3af] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un fichier ou une liste..."
                className="w-full pl-8 pr-3 py-2 bg-surface-2 border border-line rounded-xl text-xs text-ink placeholder-[#9ca3af] focus:outline-none focus:border-ink"
              />
            </div>

            <button
              type="button"
              onClick={fetchHistory}
              disabled={loading}
              className="p-2 rounded-xl text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
              title="Rafraîchir l'historique"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-ink" : ""}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-ink" />
            <span className="text-xs text-muted font-medium">Chargement de l'historique...</span>
          </div>
        ) : filteredImports.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#f0edf9] text-ink flex items-center justify-center mx-auto mb-3">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-medium text-ink">Aucun import enregistré</h4>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              Lorsque vous importez des prospects par fichier CSV/Excel ou via la recherche LinkedIn, ils apparaissent ici avec le bilan complet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2 text-xs font-medium text-muted-2 border-b border-line/60">
                  <th className="py-3 px-4 sm:px-6">Date</th>
                  <th className="py-3 px-4">Fichier / Source</th>
                  <th className="py-3 px-4">Liste de destination</th>
                  <th className="py-3 px-4 text-center">Prospects Importés</th>
                  <th className="py-3 px-4 text-center">Doublons / Filtrés</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f4] text-xs">
                {filteredImports.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-2/80 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-ink whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {formatSourceBadge(item.source)}
                        <span className="font-semibold text-ink truncate max-w-[180px]">
                          {item.filename || "Sans nom"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-muted">
                      {item.listName || "Liste principale"}
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium text-ok">
                      +{item.importedCount}
                    </td>
                    <td className="py-3.5 px-4 text-center text-muted-2">
                      {item.duplicateCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-surface-2 text-warn font-semibold text-xs">
                          {item.duplicateCount} doublon(s)
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2 text-ok font-medium text-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        Terminé
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedImport(item)}
                        className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                        title="Consulter le rapport détaillé"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modale de Détails d'un lot d'import */}
      {selectedImport && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl border border-line bg-surface bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 border border-line relative">
            <button
              type="button"
              onClick={() => setSelectedImport(null)}
              className="absolute right-5 top-5 p-1.5 rounded-full hover:bg-surface-2 text-muted hover:text-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-surface-2 text-ink flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-medium text-ink">Détails du lot d'importation</h3>
                <p className="text-xs text-muted">{selectedImport.filename || "Import sans nom"}</p>
              </div>
            </div>

            <div className="space-y-3 bg-surface-2 p-4 rounded-2xl border border-line/60 text-xs">
              <div className="flex justify-between py-1 border-b border-line/40">
                <span className="text-muted-2">Date d'exécution :</span>
                <span className="font-medium text-ink">
                  {new Date(selectedImport.createdAt).toLocaleString("fr-FR")}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/40">
                <span className="text-muted-2">Source :</span>
                <span className="font-medium text-ink">{selectedImport.source}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/40">
                <span className="text-muted-2">Liste cible :</span>
                <span className="font-medium text-ink">{selectedImport.listName || "Liste principale"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/40">
                <span className="text-muted-2">Total de lignes traitées :</span>
                <span className="font-medium text-ink">{selectedImport.totalRows}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/40">
                <span className="text-muted-2">Prospects ajoutés avec succès :</span>
                <span className="font-medium text-ok">+{selectedImport.importedCount}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-2">Doublons filtrés :</span>
                <span className="font-medium text-ink">{selectedImport.duplicateCount}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedImport(null)}
                className="px-5 py-2 bg-[#f0f0f4] hover:bg-[#e4e4e9] text-ink font-medium text-xs rounded-xl transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
