import React, { useState, useEffect, useRef } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
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
  Briefcase,
  ChevronDown,
  Info,
  Check,
} from "lucide-react";

interface LinkedInSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: Array<{ id: string; name: string; color?: string }>;
  defaultListId?: string;
  onSuccess: () => void;
}

interface SectorOption {
  id: string;
  title: string;
}

interface HeadcountTier {
  id: string;
  label: string;
  sub: string;
  min: number;
  max?: number;
}

const COMMON_SECTORS: SectorOption[] = [
  { id: "4", title: "Logiciels & Services informatiques" },
  { id: "6", title: "Technologies, Internet & Médias" },
  { id: "43", title: "Banque, Finance & Assurance" },
  { id: "14", title: "Santé, Hôpitaux & Pharmaceutique" },
  { id: "27", title: "Commerce de détail & E-commerce" },
  { id: "106", title: "Conseil en gestion & Stratégie" },
  { id: "104", title: "Recrutement & Ressources Humaines" },
  { id: "8", title: "Télécommunications" },
  { id: "48", title: "BTP, Immobilier & Construction" },
  { id: "69", title: "Enseignement & Formation" },
  { id: "80", title: "Marketing & Publicité" },
  { id: "53", title: "Énergie, Pétrole & Renouvelables" },
  { id: "96", title: "Transports, Logistique & Supply Chain" },
  { id: "112", title: "Industrie manufacturière & Ingénierie" },
  { id: "3", title: "Agroalimentaire & Agriculture" },
  { id: "25", title: "Droit, Juridique & Avocats" },
];

const HEADCOUNT_TIERS: HeadcountTier[] = [
  { id: "1-10", label: "1-10", sub: "TPE / Indép.", min: 1, max: 10 },
  { id: "11-50", label: "11-50", sub: "Petite ent.", min: 11, max: 50 },
  { id: "51-200", label: "51-200", sub: "PME", min: 51, max: 200 },
  { id: "201-500", label: "201-500", sub: "Moyenne ent.", min: 201, max: 500 },
  { id: "501-1000", label: "501-1k", sub: "ETI", min: 501, max: 1000 },
  { id: "1001-5000", label: "1k-5k", sub: "Grande ent.", min: 1001, max: 5000 },
  { id: "5001-10000", label: "5k-10k", sub: "Très grande", min: 5001, max: 10000 },
  { id: "10001+", label: "10k+", sub: "Multinationale", min: 10001 },
];

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

  const { openLinkedInModal } = useAuth();
  const [selectedListId, setSelectedListId] = useState<string>(getInitialListId());

  useEffect(() => {
    if (!selectedListId || selectedListId === "ALL") {
      const valid = getInitialListId();
      if (valid) setSelectedListId(valid);
    }
  }, [defaultListId, lists]);

  // Mode principal : CRITERIA vs URL
  const [searchMode, setSearchMode] = useState<"CRITERIA" | "URL">("CRITERIA");

  // Mode d'API LinkedIn : Classic vs Sales Navigator
  const [apiMode, setApiMode] = useState<"classic" | "sales_navigator">("classic");

  // Critères standards
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [searchUrl, setSearchUrl] = useState("");

  // Secteur d'activité
  const [selectedSector, setSelectedSector] = useState<SectorOption | null>(null);
  const [sectorSearchQuery, setSectorSearchQuery] = useState("");
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false);
  const [dynamicSectors, setDynamicSectors] = useState<SectorOption[]>([]);
  const [isSearchingSectors, setIsSearchingSectors] = useState(false);
  const sectorDropdownRef = useRef<HTMLDivElement>(null);

  // Taille de l'entreprise (Headcount)
  const [selectedHeadcounts, setSelectedHeadcounts] = useState<string[]>([]);

  // Limite d'extraction
  const [importLimit, setImportLimit] = useState<number>(25);

  // États d'exécution
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [resultFilterQuery, setResultFilterQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fermer le dropdown de secteur au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sectorDropdownRef.current && !sectorDropdownRef.current.contains(event.target as Node)) {
        setIsSectorDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Recherche dynamique de secteur via l'API Unipile (debounce 350ms)
  useEffect(() => {
    if (!sectorSearchQuery.trim() || sectorSearchQuery.trim().length < 2) {
      setDynamicSectors([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingSectors(true);
      try {
        const res = await apiRequest<{
          items: Array<{ id: string; title: string }>;
        }>(`/linkedin/parameters?type=INDUSTRY&keywords=${encodeURIComponent(sectorSearchQuery.trim())}`);
        if (res.success && res.items) {
          setDynamicSectors(res.items);
        }
      } catch (err) {
        console.error("Erreur chargement secteurs Unipile:", err);
      } finally {
        setIsSearchingSectors(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [sectorSearchQuery]);

  if (!isOpen) return null;

  const toggleHeadcount = (tierId: string) => {
    // Si on est en Classic et qu'on clique sur une tranche, on bascule automatiquement vers Sales Navigator
    if (apiMode === "classic") {
      setApiMode("sales_navigator");
      setSelectedHeadcounts([tierId]);
      return;
    }

    setSelectedHeadcounts((prev) =>
      prev.includes(tierId) ? prev.filter((id) => id !== tierId) : [...prev, tierId]
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (
      searchMode === "CRITERIA" &&
      !title.trim() &&
      !company.trim() &&
      !location.trim() &&
      !selectedSector &&
      selectedHeadcounts.length === 0
    ) {
      setError("Veuillez saisir au moins un critère de recherche (poste, lieu, entreprise ou secteur).");
      return;
    }

    if (searchMode === "URL" && !searchUrl.trim().includes("linkedin.com")) {
      setError("Veuillez coller une URL de recherche LinkedIn valide.");
      return;
    }

    setSearching(true);
    setResults([]);
    setResultFilterQuery("");
    setSelectedProfileIds(new Set<string>());

    try {
      const payload: any = {
        limit: importLimit,
        api: apiMode,
      };

      if (searchMode === "URL") {
        payload.url = searchUrl.trim();
      } else {
        if (title.trim()) payload.title = title.trim();
        if (company.trim()) payload.company = company.trim();
        if (location.trim()) payload.location = location.trim();

        if (selectedSector) {
          payload.industry = [selectedSector.id];
        }

        if (apiMode === "sales_navigator" && selectedHeadcounts.length > 0) {
          payload.companyHeadcount = selectedHeadcounts
            .map((id) => {
              const tier = HEADCOUNT_TIERS.find((t) => t.id === id);
              if (!tier) return null;
              const res: { min: number; max?: number } = { min: tier.min };
              if (tier.max !== undefined) res.max = tier.max;
              return res;
            })
            .filter(Boolean);
        }
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
            "Aucun profil trouvé avec ces critères. Essayez d'élargir votre recherche (ex: enlever l'entreprise ou le filtre d'effectif)."
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

  // Filtrage local dynamique parmi les profils déjà extraits
  const filteredResults = results.filter((p) => {
    if (!resultFilterQuery.trim()) return true;
    const q = resultFilterQuery.toLowerCase().trim();
    const fullName = (p.fullName || "").toLowerCase();
    const headline = (p.headline || "").toLowerCase();
    const company = (p.company || "").toLowerCase();
    const location = (p.location || "").toLowerCase();
    const industry = (p.industry || "").toLowerCase();
    return (
      fullName.includes(q) ||
      headline.includes(q) ||
      company.includes(q) ||
      location.includes(q) ||
      industry.includes(q)
    );
  });

  const toggleSelectAll = () => {
    const targetPool = resultFilterQuery.trim() ? filteredResults : results;
    if (targetPool.length === 0) return;

    const allSelected = targetPool.every((p) =>
      selectedProfileIds.has(String(p.providerProfileId))
    );

    const next = new Set<string>(selectedProfileIds);
    if (allSelected) {
      targetPool.forEach((p) => next.delete(String(p.providerProfileId)));
    } else {
      targetPool.forEach((p) => next.add(String(p.providerProfileId)));
    }
    setSelectedProfileIds(next);
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

    // Tags d'importation enrichis (Secteur & Taille d'entreprise)
    const customTags = ["Recherche LinkedIn"];
    if (selectedSector) {
      customTags.push(`Secteur: ${selectedSector.title}`);
    }
    if (apiMode === "sales_navigator" && selectedHeadcounts.length > 0) {
      selectedHeadcounts.forEach((hId) => {
        customTags.push(`Taille: ${hId} sal.`);
      });
    }

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
            tags: customTags,
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

  const displayedSectors = dynamicSectors.length > 0
    ? dynamicSectors
    : sectorSearchQuery.trim()
    ? COMMON_SECTORS.filter((s) =>
        s.title.toLowerCase().includes(sectorSearchQuery.toLowerCase().trim())
      )
    : COMMON_SECTORS;

  return (
    <div className="fixed inset-0 bg-[#21164c]/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in">
      <div className="adora-card bg-white w-full max-w-6xl h-[92vh] max-h-[92vh] flex flex-col p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-full hover:bg-[#f5f5f7] text-[#5f5f69] transition-colors z-20 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header (Full Width Top) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#e0e0db] gap-3 shrink-0 pr-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0a66c2]/10 text-[#0a66c2] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.2a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-[#21164c]">Recherche de Profils LinkedIn</h2>
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-[#592eff]/10 text-[#592eff] font-bold">
                  Split-View
                </span>
              </div>
              <p className="text-xs text-[#5f5f69]">
                Ciblez des décideurs par critères métier, secteur d'activité et taille d'entreprise
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#f5f5f7] p-1 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSearchMode("CRITERIA")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                searchMode === "CRITERIA"
                  ? "bg-white text-[#592eff] shadow-xs"
                  : "text-[#5f5f69] hover:text-[#21164c]"
              }`}
            >
              Par Critères
            </button>
            <button
              type="button"
              onClick={() => setSearchMode("URL")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                searchMode === "URL"
                  ? "bg-white text-[#592eff] shadow-xs"
                  : "text-[#5f5f69] hover:text-[#21164c]"
              }`}
            >
              <Link className="w-3 h-3" /> Coller URL LinkedIn
            </button>
          </div>
        </div>

        {/* Modal Body: Split-Pane on Large Screens */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden mt-3">

          {/* ========================================================================= */}
          {/* VOLET GAUCHE : FILTRES & PARAMÈTRES (Largeur fixe 360px sur Desktop)       */}
          {/* ========================================================================= */}
          <div className="w-full lg:w-[360px] shrink-0 flex flex-col h-full min-h-0 bg-[#f8f9fc] border border-[#e0e0db] rounded-2xl overflow-hidden shadow-2xs">
            {/* Header du volet filtres */}
            <div className="px-3.5 py-2.5 bg-white border-b border-[#e0e0db] flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-[#21164c] flex items-center gap-1.5 uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-[#592eff]" /> Paramètres de recherche
              </span>
              <span className="text-[10px] text-[#5f5f69] font-medium">
                {searchMode === "CRITERIA" ? (apiMode === "sales_navigator" ? "Sales Nav" : "Standard") : "URL"}
              </span>
            </div>

            {/* Formulaire défilant indépendamment */}
            <form onSubmit={handleSearch} className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
              {searchMode === "CRITERIA" ? (
                <>
                  {/* Moteur de recherche : Standard vs Sales Navigator */}
                  <div className="p-2 bg-white rounded-xl border border-[#e0e0db]/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#21164c] uppercase tracking-wider">
                        Moteur :
                      </span>
                      <span className="text-[10px] text-[#5f5f69]">
                        {apiMode === "sales_navigator" ? "Ciblage avancé" : "Gratuit"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#f5f5f7] rounded-lg">
                      <button
                        type="button"
                        onClick={() => setApiMode("classic")}
                        className={`py-1 rounded-md text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          apiMode === "classic"
                            ? "bg-[#21164c] text-white shadow-xs"
                            : "text-[#5f5f69] hover:text-[#21164c]"
                        }`}
                      >
                        <Users className="w-3 h-3" /> Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => setApiMode("sales_navigator")}
                        className={`py-1 rounded-md text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          apiMode === "sales_navigator"
                            ? "bg-[#592eff] text-white shadow-xs"
                            : "text-[#5f5f69] hover:text-[#592eff]"
                        }`}
                      >
                        <Sparkles className="w-3 h-3" /> Sales Nav
                      </button>
                    </div>
                  </div>

                  {/* Poste / Titre */}
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

                  {/* Localisation */}
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

                  {/* Entreprise (Optionnel) */}
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

                  {/* Secteur d'activité */}
                  <div className="relative" ref={sectorDropdownRef}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold text-[#21164c] uppercase flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-[#592eff]" /> Secteur d'activité
                      </label>
                      {selectedSector && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSector(null);
                            setSectorSearchQuery("");
                          }}
                          className="text-[10px] text-red-600 hover:underline font-semibold cursor-pointer"
                        >
                          Effacer
                        </button>
                      )}
                    </div>

                    {selectedSector ? (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-[#592eff]/10 border border-[#592eff]/30 text-xs">
                        <span className="font-bold text-[#21164c] flex items-center gap-1.5 truncate">
                          <Check className="w-3.5 h-3.5 text-[#592eff] shrink-0" />
                          <span className="truncate">{selectedSector.title}</span>
                          <span className="text-[10px] font-semibold text-[#592eff] bg-white px-1.5 py-0.2 rounded border border-[#592eff]/20 shrink-0">
                            #{selectedSector.id}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSector(null);
                            setSectorSearchQuery("");
                          }}
                          className="p-1 hover:bg-white rounded-lg text-[#5f5f69] hover:text-red-600 shrink-0 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Choisir ou chercher un secteur..."
                          value={sectorSearchQuery}
                          onFocus={() => setIsSectorDropdownOpen(true)}
                          onChange={(e) => {
                            setSectorSearchQuery(e.target.value);
                            setIsSectorDropdownOpen(true);
                          }}
                          className="w-full pl-3 pr-8 py-2 rounded-xl border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
                        />
                        <button
                          type="button"
                          onClick={() => setIsSectorDropdownOpen((prev) => !prev)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5f5f69] cursor-pointer"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Menu déroulant de suggestions */}
                        {isSectorDropdownOpen && (
                          <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-[#e0e0db] rounded-xl shadow-xl p-1">
                            {isSearchingSectors ? (
                              <div className="p-2.5 text-center text-xs text-[#5f5f69] flex items-center justify-center gap-1.5">
                                <RefreshCw className="w-3 h-3 animate-spin text-[#592eff]" /> Recherche...
                              </div>
                            ) : displayedSectors.length === 0 ? (
                              <div className="p-2.5 text-center text-xs text-[#5f5f69]">
                                Aucun secteur trouvé.
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                {displayedSectors.map((s) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSector(s);
                                      setIsSectorDropdownOpen(false);
                                      setSectorSearchQuery("");
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#21164c] hover:bg-[#592eff]/10 hover:text-[#592eff] flex items-center justify-between transition-colors cursor-pointer"
                                  >
                                    <span className="truncate pr-2">{s.title}</span>
                                    <span className="text-[10px] text-[#5f5f69] font-normal shrink-0">#{s.id}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Taille de l'entreprise (Headcount) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold text-[#21164c] uppercase flex items-center gap-1">
                        <Building className="w-3 h-3 text-[#592eff]" /> Taille d'entreprise
                      </label>
                      {apiMode === "classic" ? (
                        <button
                          type="button"
                          onClick={() => setApiMode("sales_navigator")}
                          className="text-[10px] font-bold text-[#592eff] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Sparkles className="w-2.5 h-2.5" /> Sales Nav
                        </button>
                      ) : (
                        selectedHeadcounts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedHeadcounts([])}
                            className="text-[10px] text-red-600 hover:underline font-semibold cursor-pointer"
                          >
                            Reset ({selectedHeadcounts.length})
                          </button>
                        )
                      )}
                    </div>

                    {/* Grille 4 colonnes compacte et lisible */}
                    <div className="grid grid-cols-4 gap-1">
                      {HEADCOUNT_TIERS.map((tier) => {
                        const isSelected = selectedHeadcounts.includes(tier.id);
                        const isClassic = apiMode === "classic";

                        return (
                          <button
                            key={tier.id}
                            type="button"
                            onClick={() => toggleHeadcount(tier.id)}
                            className={`px-1.5 py-1.5 rounded-lg border text-center transition-all flex flex-col justify-center cursor-pointer ${
                              isClassic
                                ? "bg-[#f5f5f7] border-[#e0e0db] text-[#5f5f69] hover:border-[#592eff]/50 hover:bg-[#592eff]/5 opacity-80"
                                : isSelected
                                ? "bg-[#592eff] border-[#592eff] text-white shadow-xs"
                                : "bg-white border-[#e0e0db] text-[#21164c] hover:border-[#592eff]/40 hover:bg-[#f8f9fc]"
                            }`}
                            title={
                              isClassic
                                ? "Cliquez pour activer Sales Navigator et filtrer par effectif"
                                : `${tier.label} salariés (${tier.sub})`
                            }
                          >
                            <span className={`text-[11px] font-bold leading-tight ${isSelected && !isClassic ? "text-white" : ""}`}>
                              {tier.label}
                            </span>
                            <span className={`text-[8px] leading-tight truncate ${isSelected && !isClassic ? "text-white/80" : "text-[#5f5f69]"}`}>
                              {tier.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                /* Mode URL LinkedIn */
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-[#21164c] uppercase">
                    URL Recherche LinkedIn
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Collez l'URL de votre recherche LinkedIn..."
                    value={searchUrl}
                    onChange={(e) => setSearchUrl(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff] resize-none"
                  />
                  <p className="text-[10px] text-[#5f5f69] italic">
                    Copiez directement l'URL d'une recherche filtrée depuis linkedin.com.
                  </p>
                </div>
              )}

              {/* Quota d'extraction */}
              <div className="pt-1.5 border-t border-[#e0e0db]/60 flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#21164c] flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-[#592eff]" /> Extraire :
                </span>
                <select
                  value={importLimit}
                  onChange={(e) => setImportLimit(parseInt(e.target.value) || 25)}
                  className="px-2 py-1 rounded-lg border border-[#e0e0db] bg-white text-xs font-bold text-[#592eff] focus:outline-none focus:border-[#592eff] cursor-pointer"
                >
                  <option value={10}>10 profils</option>
                  <option value={25}>25 profils</option>
                  <option value={50}>50 profils</option>
                  <option value={100}>100 profils</option>
                </select>
              </div>

              {/* Bouton CTA Principal */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={searching}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {searching ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recherche en cours...
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" /> Lancer la recherche
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ========================================================================= */}
          {/* VOLET DROIT : RÉSULTATS & SÉLECTION (Pleine Hauteur, Flex-1)               */}
          {/* ========================================================================= */}
          <div className="flex-1 flex flex-col h-full min-h-0 bg-white border border-[#e0e0db] rounded-2xl overflow-hidden shadow-2xs">
            
            {/* Toolbar Supérieure (Sticky Header) */}
            <div className="px-4 py-2.5 bg-[#f8f9fc] border-b border-[#e0e0db] flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={results.length === 0}
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-xs font-bold text-[#21164c] hover:text-[#592eff] transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {filteredResults.length > 0 && filteredResults.every((p) => selectedProfileIds.has(String(p.providerProfileId))) ? (
                    <CheckSquare className="w-4 h-4 text-[#592eff]" />
                  ) : (
                    <Square className="w-4 h-4 text-[#5f5f69]" />
                  )}
                  <span>Tout sélectionner</span>
                </button>

                {results.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#592eff]/10 text-[#592eff]">
                    {selectedProfileIds.size} / {results.length} sélectionné(s)
                  </span>
                )}
              </div>

              {/* Champ de filtrage instantané par mot-clé */}
              {results.length > 0 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#5f5f69] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={resultFilterQuery}
                    onChange={(e) => setResultFilterQuery(e.target.value)}
                    placeholder="Filtrer parmi les résultats..."
                    className="pl-8 pr-7 py-1 text-xs rounded-lg border border-[#e0e0db] bg-white text-[#21164c] placeholder-[#5f5f69] focus:outline-none focus:border-[#592eff] w-48 sm:w-60"
                  />
                  {resultFilterQuery && (
                    <button
                      type="button"
                      onClick={() => setResultFilterQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5f5f69] hover:text-red-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Alertes d'erreur ou de succès */}
            {error && (
              <div className="m-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
                {error.toLowerCase().includes("reconnecter") && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openLinkedInModal();
                    }}
                    className="px-3 py-1 bg-[#592eff] hover:bg-[#4722d4] text-white text-xs font-bold rounded-lg shadow-xs transition-all shrink-0 cursor-pointer"
                  >
                    Reconnecter LinkedIn
                  </button>
                )}
              </div>
            )}

            {successMsg && (
              <div className="m-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2 shrink-0">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Zone de défilement des profils (Pleine Hauteur) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#fbfbfe] custom-scrollbar">
              {searching ? (
                <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-[#5f5f69] space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#592eff]/10 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#592eff]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-[#21164c]">
                      Extraction en cours depuis LinkedIn...
                    </p>
                    <p className="text-xs text-[#5f5f69] mt-0.5">
                      Récupération de {importLimit} profils avec détails et photo.
                    </p>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-[#5f5f69] space-y-3 p-6 text-center">
                  <div className="w-14 h-14 rounded-3xl bg-[#f5f5f7] flex items-center justify-center">
                    <Search className="w-7 h-7 text-[#5f5f69]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#21164c]">Aucun profil extrait pour l'instant</h3>
                    <p className="text-xs text-[#5f5f69] max-w-sm mt-1">
                      Définissez vos critères dans le panneau de gauche et cliquez sur <strong>Lancer la recherche</strong> pour charger les profils LinkedIn.
                    </p>
                  </div>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-[#5f5f69] space-y-2 p-6 text-center">
                  <p className="text-xs font-bold text-[#21164c]">
                    Aucun profil extrait ne correspond à « {resultFilterQuery} »
                  </p>
                  <button
                    type="button"
                    onClick={() => setResultFilterQuery("")}
                    className="text-xs text-[#592eff] hover:underline font-semibold cursor-pointer"
                  >
                    Effacer le filtre
                  </button>
                </div>
              ) : (
                filteredResults.map((p) => {
                  const id = String(p.providerProfileId);
                  const isSelected = selectedProfileIds.has(id);

                  return (
                    <div
                      key={id}
                      onClick={() => toggleSelectOne(id)}
                      className={`flex items-start sm:items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#592eff]/5 border-[#592eff]/40 shadow-xs"
                          : "bg-white border-[#e0e0db] hover:border-[#592eff]/30 hover:bg-[#f8f9fc]"
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                        <div className="mt-1 sm:mt-0 flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#592eff]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#5f5f69]" />
                          )}
                        </div>

                        {/* Avatar */}
                        <div className="w-11 h-11 rounded-full overflow-hidden border border-[#e0e0db] shrink-0 bg-[#f5f5f7] flex items-center justify-center">
                          {p.avatarUrl ? (
                            <img
                              src={p.avatarUrl}
                              alt={p.fullName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <span className="text-xs font-bold text-[#5f5f69]">
                              {(p.fullName || "P").substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Text Infos */}
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-bold text-[#21164c] text-xs sm:text-sm truncate">
                              {p.fullName}
                            </p>
                            {p.networkDistance && (
                              <span className="text-[10px] bg-[#f5f5f7] px-1.5 py-0.2 rounded font-semibold text-[#5f5f69]">
                                {p.networkDistance.replace("DISTANCE_", "")}°
                              </span>
                            )}
                            {p.industry && (
                              <span className="text-[10px] bg-[#592eff]/10 text-[#592eff] px-2 py-0.5 rounded-full font-semibold truncate max-w-[200px]">
                                {p.industry}
                              </span>
                            )}
                            {p.linkedinUrl && (
                              <a
                                href={p.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[#592eff] hover:text-[#4d25e0] p-0.5 rounded transition-colors"
                                title="Ouvrir le profil LinkedIn"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>

                          <p className="text-[11px] text-[#5f5f69] line-clamp-1 mt-0.5">
                            {p.headline || "—"}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#5f5f69] mt-1">
                            {p.company && (
                              <span className="flex items-center gap-1 truncate">
                                <Building className="w-3 h-3 text-[#592eff] shrink-0" /> {p.company}
                              </span>
                            )}
                            {p.location && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 text-[#592eff] shrink-0" /> {p.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Barre d'action inférieure épinglée (Sticky Footer) */}
            <div className="p-3.5 bg-white border-t border-[#e0e0db] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-bold text-[#21164c] whitespace-nowrap">
                  Ajouter dans la liste :
                </span>
                <select
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-[#e0e0db] bg-white text-xs text-[#353241] font-semibold focus:outline-none focus:border-[#592eff] cursor-pointer max-w-[220px] truncate"
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
                  className="px-4 py-2 rounded-xl border border-[#e0e0db] text-xs font-semibold text-[#5f5f69] hover:bg-[#f5f5f7] cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  disabled={importing || selectedProfileIds.size === 0}
                  onClick={handleImportSelected}
                  className="px-5 py-2 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
      </div>
    </div>
  );
};
