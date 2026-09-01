import React, { useState, useEffect } from "react";
import { apiRequest } from "../../services/api";
import {
  Search,
  Users,
  MapPin,
  Building,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Plus,
  RefreshCw,
  Sparkles,
  Link,
  Sliders,
  ShieldCheck,
} from "lucide-react";

interface LinkedInSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: Array<{ id: string; name: string; color?: string }>;
  defaultListId?: string;
  onSuccess: () => void;
}

export const LinkedInSearchModal: React.FC<LinkedInSearchModalProps> = ({
  isOpen,
  onClose,
  lists,
  defaultListId,
  onSuccess,
}) => {
  // Garantir que la liste sélectionnée est un vrai ID de liste et non "ALL"
  const getInitialListId = () => {
    if (defaultListId && defaultListId !== "ALL") return defaultListId;
    if (lists && lists.length > 0) return lists[0].id;
    return "";
  };

  const [selectedListId, setSelectedListId] = useState<string>(getInitialListId());

  useEffect(() => {
    if (!selectedListId || selectedListId === "ALL") {
      const valid = getInitialListId();
      if (valid) setSelectedListId(valid);
    }
  }, [defaultListId, lists]);

  // Mode: KEYWORDS vs URL
  const [searchMode, setSearchMode] = useState<"CRITERIA" | "URL">("CRITERIA");

  // Search parameters
  const [title, setTitle] = useState("commercial");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("Abidjan");
  const [searchUrl, setSearchUrl] = useState("");

  // Import limit
  const [importLimit, setImportLimit] = useState<number>(25);

  // State
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (searchMode === "CRITERIA" && !title.trim() && !company.trim() && !location.trim()) {
      setError("Veuillez saisir au moins un critère de recherche (poste, lieu ou entreprise).");
      return;
    }

    if (searchMode === "URL" && !searchUrl.trim().includes("linkedin.com")) {
      setError("Veuillez coller une URL de recherche LinkedIn valide.");
      return;
    }

    setSearching(true);
    setResults([]);
    setSelectedProfileIds(new Set<string>());

    try {
      const payload: any = {
        limit: importLimit,
      };

      if (searchMode === "URL") {
        payload.url = searchUrl.trim();
      } else {
        payload.title = title.trim();
        payload.company = company.trim();
        payload.location = location.trim();
      }

      const res = await apiRequest<{
        count: number;
        totalCount: number;
        profiles: any[];
      }>("/linkedin/search", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.success && res.profiles) {
        setResults(res.profiles);

        // Sélectionner par défaut tous les profils retournés
        const allIds = new Set<string>(res.profiles.map((p: any) => String(p.providerProfileId)));
        setSelectedProfileIds(allIds);

        if (res.profiles.length === 0) {
          setError(
            "Aucun profil trouvé avec ces critères. Simplifiez votre recherche (ex: enlevez l'entreprise)."
          );
        }
      } else {
        setError(res.error || "Erreur lors de la recherche LinkedIn.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur réseau avec l'API Unipile.");
    } finally {
      setSearching(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedProfileIds.size === results.length) {
      setSelectedProfileIds(new Set<string>());
    } else {
      const allIds = new Set<string>(results.map((p: any) => String(p.providerProfileId)));
      setSelectedProfileIds(allIds);
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set<string>(selectedProfileIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedProfileIds(next);
  };

  const handleImportSelected = async () => {
    let targetList = selectedListId;
    if (!targetList || targetList === "ALL") {
      targetList = lists.length > 0 ? lists[0].id : "";
    }

    if (!targetList) {
      setError("Veuillez d'abord créer une liste de prospects pour y importer ces profils.");
      return;
    }

    const selectedProfiles = results.filter((p) =>
      selectedProfileIds.has(String(p.providerProfileId))
    );

    if (selectedProfiles.length === 0) {
      setError("Veuillez cocher au moins un profil à importer.");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await apiRequest<{
        createdCount: number;
        duplicateCount: number;
        message: string;
      }>("/prospects/bulk", {
        method: "POST",
        body: JSON.stringify({
          listId: targetList,
          importLimit,
          prospects: selectedProfiles.map((p) => ({
            firstName: p.firstName || "Contact",
            lastName: p.lastName || "LinkedIn",
            linkedinUrl: p.linkedinUrl,
            headline: p.headline,
            company: p.company,
            location: p.location,
            avatarUrl: p.avatarUrl,
            tags: ["Recherche LinkedIn"],
          })),
        }),
      });

      if (res.success) {
        setSuccessMsg(
          `🎉 ${res.createdCount} prospect(s) importé(s) dans la liste ! (${res.duplicateCount} doublon(s) ignoré(s))`
        );
        onSuccess();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(res.error || "Erreur lors de l'importation.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur réseau.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#21164c]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="adora-card bg-white w-full max-w-4xl max-h-[92vh] flex flex-col p-6 sm:p-8 shadow-2xl relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full hover:bg-[#f5f5f7] text-[#5f5f69]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e0e0db]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0a66c2]/10 text-[#0a66c2] flex items-center justify-center">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.2a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#21164c]">Recherche de Profils LinkedIn</h2>
              
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#f5f5f7] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setSearchMode("CRITERIA")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                searchMode === "CRITERIA"
                  ? "bg-white text-[#592eff] shadow-sm"
                  : "text-[#5f5f69] hover:text-[#21164c]"
              }`}
            >
              Par Critères
            </button>
            <button
              type="button"
              onClick={() => setSearchMode("URL")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                searchMode === "URL"
                  ? "bg-white text-[#592eff] shadow-sm"
                  : "text-[#5f5f69] hover:text-[#21164c]"
              }`}
            >
              <Link className="w-3 h-3" /> Coller URL LinkedIn
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-4 p-4 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]">
          {searchMode === "CRITERIA" ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#21164c] uppercase mb-1">
                  Poste / Titre
                </label>
                <input
                  type="text"
                  placeholder="ex: commercial, directeur, rh..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#21164c] uppercase mb-1">
                  Localisation
                </label>
                <input
                  type="text"
                  placeholder="ex: Abidjan, Côte d'Ivoire, Paris..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#21164c] uppercase mb-1">
                  Entreprise (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="ex: Orange, MTN, Total..."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={searching}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {searching ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recherche...
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" /> Lancer la recherche
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold text-[#21164c] uppercase mb-1">
                  URL de Recherche LinkedIn (Waalaxy Style)
                </label>
                <input
                  type="url"
                  placeholder="Collez l'URL de votre recherche LinkedIn (ex: https://www.linkedin.com/search/results/people/?keywords=...)"
                  value={searchUrl}
                  onChange={(e) => setSearchUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="py-2.5 px-6 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {searching ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Extraction...
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" /> Extraire les profils
                  </>
                )}
              </button>
            </div>
          )}

          {/* Import Limit Selector */}
          <div className="mt-3 pt-3 border-t border-[#e0e0db]/60 flex flex-wrap items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#592eff]" />
              <span className="font-bold text-[#21164c]">
                Nombre de profils à extraire :
              </span>
              <select
                value={importLimit}
                onChange={(e) => setImportLimit(parseInt(e.target.value) || 25)}
                className="px-2.5 py-1 rounded-lg border border-[#e0e0db] bg-white font-bold text-[#592eff] focus:outline-none focus:border-[#592eff]"
              >
                <option value={10}>10 profils</option>
                <option value={25}>25 profils</option>
                <option value={50}>50 profils</option>
                <option value={100}>100 profils</option>
              </select>
            </div>
            <span className="text-[11px] text-[#5f5f69] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Agrégation multi-pages active
            </span>
          </div>
        </form>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[380px] space-y-2 border border-[#e0e0db] rounded-2xl p-3 bg-white">
          {searching ? (
            <div className="h-48 flex flex-col items-center justify-center text-[#5f5f69]">
              <RefreshCw className="w-6 h-6 animate-spin text-[#592eff] mb-2" />
              <p className="text-xs font-semibold">Extraction en cours depuis LinkedIn ({importLimit} profils demandés)...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-[#5f5f69]">
              <Search className="w-8 h-8 text-[#e0e0db] mb-2" />
              <p className="text-xs font-medium">
                Lancez la recherche pour extraire les profils LinkedIn correspondants.
              </p>
            </div>
          ) : (
            <>
              {/* Header row in results */}
              <div className="flex items-center justify-between px-2 py-1.5 bg-[#f8f9fc] rounded-lg text-xs font-bold text-[#5f5f69]">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 hover:text-[#21164c]"
                >
                  {selectedProfileIds.size === results.length ? (
                    <CheckSquare className="w-4 h-4 text-[#592eff]" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>Tout sélectionner / Décocher tout</span>
                </button>
                <span className="text-[#592eff] font-bold">
                  {selectedProfileIds.size} sélectionné(s) sur {results.length} extrait(s)
                </span>
              </div>

              {/* Profile rows */}
              {results.map((p) => {
                const id = String(p.providerProfileId);
                const isSelected = selectedProfileIds.has(id);

                return (
                  <div
                    key={id}
                    onClick={() => toggleSelectOne(id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#592eff]/5 border-[#592eff]/30"
                        : "bg-white border-[#e0e0db] hover:bg-[#f8f9fc]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#592eff]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#5f5f69]" />
                        )}
                      </div>

                      <img
                        src={p.avatarUrl}
                        alt={p.fullName}
                        className="w-10 h-10 rounded-full object-cover border border-[#e0e0db]"
                      />

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-[#21164c] text-xs">{p.fullName}</p>
                          {p.networkDistance && (
                            <span className="text-[10px] bg-[#f5f5f7] px-1.5 py-0.2 rounded font-semibold text-[#5f5f69]">
                              {p.networkDistance.replace("DISTANCE_", "")}°
                            </span>
                          )}
                          {p.linkedinUrl && (
                            <a
                              href={p.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[#592eff] hover:text-[#4d25e0]"
                              title="Ouvrir le profil LinkedIn"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-[11px] text-[#5f5f69] line-clamp-1">{p.headline}</p>
                        <div className="flex items-center gap-3 text-[10px] text-[#5f5f69] mt-0.5">
                          {p.company && (
                            <span className="flex items-center gap-1">
                              <Building className="w-3 h-3 text-[#592eff]" /> {p.company}
                            </span>
                          )}
                          {p.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {p.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer: Destination List & Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#e0e0db] mt-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-[#21164c] whitespace-nowrap">
              Ajouter dans la liste :
            </span>
            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#e0e0db] bg-white text-xs text-[#353241] font-semibold focus:outline-none focus:border-[#592eff]"
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  📁 {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#e0e0db] text-xs font-semibold text-[#5f5f69] hover:bg-[#f5f5f7]"
            >
              Fermer
            </button>
            <button
              type="button"
              disabled={importing || selectedProfileIds.size === 0}
              onClick={handleImportSelected}
              className="px-5 py-2 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 flex items-center gap-1.5 disabled:opacity-50"
            >
              {importing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Importation...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Importer ({selectedProfileIds.size} profils)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
