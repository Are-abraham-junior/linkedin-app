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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0077b5]/10 text-[#0077b5] text-[11px] font-bold">
          Recherche LinkedIn
        </span>
      );
    }
    if (s.includes("XLSX") || s.includes("EXCEL")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
          Fichier Excel (XLSX)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#592eff]/10 text-[#592eff] text-[11px] font-bold">
        Fichier CSV
      </span>
    );
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Cartes Métriques Globales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-[#e0e0db]/80 shadow-xs">
          <div className="flex items-center justify-between text-[#5f5f69] text-xs font-semibold mb-1">
            <span>Lots traités</span>
            <FileSpreadsheet className="w-4 h-4 text-[#592eff]" />
          </div>
          <p className="text-xl font-extrabold text-[#21164c]">{stats.totalImports}</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e0e0db]/80 shadow-xs">
          <div className="flex items-center justify-between text-[#5f5f69] text-xs font-semibold mb-1">
            <span>Leads qualifiés</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-extrabold text-emerald-600">{stats.totalImportedLeads}</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e0e0db]/80 shadow-xs">
          <div className="flex items-center justify-between text-[#5f5f69] text-xs font-semibold mb-1">
            <span>Doublons filtrés</span>
            <ShieldCheck className="w-4 h-4 text-[#592eff]" />
          </div>
          <p className="text-xl font-extrabold text-[#21164c]">{stats.totalDuplicatesFiltered}</p>
        </div>
      </div>

      {/* Tableau des imports */}
      <div className="adora-card bg-white rounded-3xl border border-[#e0e0db]/80 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#f0f0f4] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#21164c]">Journal des Importations</h3>
            <p className="text-xs text-[#5f5f69]">Historique complet de vos fichiers et recherches de leads</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#9ca3af] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un fichier ou une liste..."
                className="w-full pl-8 pr-3 py-2 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-xs text-[#21164c] placeholder-[#9ca3af] focus:outline-none focus:border-[#592eff]"
              />
            </div>

            <button
              type="button"
              onClick={fetchHistory}
              disabled={loading}
              className="p-2 rounded-xl text-[#5f5f69] hover:text-[#592eff] hover:bg-[#f0edf9] transition-colors cursor-pointer"
              title="Rafraîchir l'historique"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#592eff]" : ""}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-[#592eff]" />
            <span className="text-xs text-[#5f5f69] font-medium">Chargement de l'historique...</span>
          </div>
        ) : filteredImports.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#f0edf9] text-[#592eff] flex items-center justify-center mx-auto mb-3">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-[#21164c]">Aucun import enregistré</h4>
            <p className="text-xs text-[#5f5f69] mt-1 max-w-sm mx-auto">
              Lorsque vous importez des prospects par fichier CSV/Excel ou via la recherche LinkedIn, ils apparaissent ici avec le bilan complet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8f9fc] text-[11px] font-bold text-[#7c7c88] border-b border-[#e0e0db]/60 uppercase tracking-wider">
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
                  <tr key={item.id} className="hover:bg-[#f8f9fc]/80 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-[#21164c] whitespace-nowrap">
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
                        <span className="font-semibold text-[#21164c] truncate max-w-[180px]">
                          {item.filename || "Sans nom"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#5f5f69]">
                      {item.listName || "Liste principale"}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                      +{item.importedCount}
                    </td>
                    <td className="py-3.5 px-4 text-center text-[#7c7c88]">
                      {item.duplicateCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold text-[11px]">
                          {item.duplicateCount} doublon(s)
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        Terminé
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedImport(item)}
                        className="p-1.5 rounded-lg text-[#5f5f69] hover:text-[#592eff] hover:bg-[#f0edf9] transition-colors cursor-pointer"
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="adora-card bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-[#e0e0db] relative animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setSelectedImport(null)}
              className="absolute right-5 top-5 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#21164c]">Détails du lot d'importation</h3>
                <p className="text-xs text-[#5f5f69]">{selectedImport.filename || "Import sans nom"}</p>
              </div>
            </div>

            <div className="space-y-3 bg-[#f8f9fc] p-4 rounded-2xl border border-[#e0e0db]/60 text-xs">
              <div className="flex justify-between py-1 border-b border-[#e0e0db]/40">
                <span className="text-[#7c7c88]">Date d'exécution :</span>
                <span className="font-bold text-[#21164c]">
                  {new Date(selectedImport.createdAt).toLocaleString("fr-FR")}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#e0e0db]/40">
                <span className="text-[#7c7c88]">Source :</span>
                <span className="font-bold text-[#21164c]">{selectedImport.source}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#e0e0db]/40">
                <span className="text-[#7c7c88]">Liste cible :</span>
                <span className="font-bold text-[#592eff]">{selectedImport.listName || "Liste principale"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#e0e0db]/40">
                <span className="text-[#7c7c88]">Total de lignes traitées :</span>
                <span className="font-bold text-[#21164c]">{selectedImport.totalRows}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#e0e0db]/40">
                <span className="text-[#7c7c88]">Prospects ajoutés avec succès :</span>
                <span className="font-bold text-emerald-600">+{selectedImport.importedCount}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#7c7c88]">Doublons filtrés :</span>
                <span className="font-bold text-[#21164c]">{selectedImport.duplicateCount}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedImport(null)}
                className="px-5 py-2 bg-[#f0f0f4] hover:bg-[#e4e4e9] text-[#21164c] font-bold text-xs rounded-xl transition-colors cursor-pointer"
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
