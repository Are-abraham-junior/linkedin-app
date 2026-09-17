import React, { useState, useEffect, useRef } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Modal } from "../ui/Modal";
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
  Lock,
  MessageCircle,
  ThumbsUp,
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

/** Récapitulatif du post renvoyé par POST /linkedin/post-engagers */
/** Réponse de POST /api/linkedin/search (pagination par curseur Unipile). */
interface SearchResponse {
  count: number;
  totalCount: number;
  profiles: any[];
  nextCursor?: string | null;
  excludedCount?: number;
}

interface PostSummary {
  postId: string;
  socialId: string;
  text: string;
  authorName: string;
  authorPublicIdentifier?: string;
  reactionCount: number;
  commentCount: number;
  shareUrl?: string;
  date?: string;
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
  // Garantir que la liste sélectionnée est un ID réellement présent dans `lists`.
  //
  // Il ne suffit PAS d'écarter les pseudo-identifiants "ALL" / "DO_NOT_CONTACT" :
  // `selectedListId` de ProspectsView n'est pas réinitialisé quand le périmètre
  // change (changement de membre, entrée/sortie du mode supervision), donc
  // `defaultListId` peut pointer vers une liste d'une AUTRE organisation, absente
  // de `lists`. Le <select> affiche alors sa première option — la valeur ne
  // correspondant à aucune option — et l'import partait avec cet identifiant
  // fantôme, que le serveur rejetait en 404 « Liste cible non trouvée. » alors
  // que la liste affichée existait bel et bien.
  //
  // On vérifie donc l'appartenance à `lists`, comme le fait déjà ExcelImportModal.
  const isSelectable = (id?: string) =>
    Boolean(id) && id !== "ALL" && id !== "DO_NOT_CONTACT" && lists.some((l) => l.id === id);

  const getInitialListId = () => {
    if (isSelectable(defaultListId)) return defaultListId as string;
    if (lists && lists.length > 0) return lists[0].id;
    return "";
  };

  const { user, openLinkedInModal, openReconnectModal } = useAuth();
  const linkedInAccount = user?.linkedInAccount;
  const hasSalesNavigator = Boolean(
    linkedInAccount?.hasSalesNavigator ||
    linkedInAccount?.accountType === "SALES_NAVIGATOR"
  );
  const isPremium = Boolean(
    linkedInAccount?.isPremium ||
    linkedInAccount?.accountType === "PREMIUM" ||
    hasSalesNavigator
  );
  const accountType =
    linkedInAccount?.accountType ||
    (hasSalesNavigator ? "SALES_NAVIGATOR" : isPremium ? "PREMIUM" : "STANDARD");

  const [selectedListId, setSelectedListId] = useState<string>(getInitialListId());
  const [showSalesNavLockedModal, setShowSalesNavLockedModal] = useState<boolean>(false);

  // Re-valider à chaque changement de `lists` : une sélection devenue orpheline
  // (liste supprimée, ou périmètre d'organisation changé) doit être remplacée,
  // sinon le <select> affiche une option qui ne correspond pas à son état.
  useEffect(() => {
    if (!isSelectable(selectedListId)) {
      const valid = getInitialListId();
      if (valid !== selectedListId) setSelectedListId(valid);
    }
  }, [defaultListId, lists]);

  // Mode principal : CRITERIA vs URL vs POST (personnes ayant liké / commenté un post)
  const [searchMode, setSearchMode] = useState<"CRITERIA" | "URL" | "POST">("CRITERIA");

  // Mode POST
  const [postUrl, setPostUrl] = useState("");
  const [includeReactions, setIncludeReactions] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const [postSummary, setPostSummary] = useState<PostSummary | null>(null);
  const [postTruncated, setPostTruncated] = useState(false);

  // Mode d'API LinkedIn : Classic vs Sales Navigator (verrouillé si pas Sales Nav)
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

  // Pagination Unipile : curseur de la page suivante + payload de la dernière recherche (rejoué tel quel)
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<any | null>(null);
  const [excludedCount, setExcludedCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

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


  const toggleHeadcount = (tierId: string) => {
    if (!hasSalesNavigator) {
      setShowSalesNavLockedModal(true);
      return;
    }

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
      (hasSalesNavigator ? selectedHeadcounts.length === 0 : true)
    ) {
      setError("Veuillez saisir au moins un critère de recherche (poste, lieu, entreprise ou secteur).");
      return;
    }

    if (searchMode === "URL" && !searchUrl.trim().includes("linkedin.com")) {
      setError("Veuillez coller une URL de recherche LinkedIn valide.");
      return;
    }

    if (searchMode === "POST") {
      if (!postUrl.trim()) {
        setError("Veuillez coller l'URL du post LinkedIn.");
        return;
      }
      if (!includeReactions && !includeComments) {
        setError("Sélectionnez au moins les likes ou les commentaires.");
        return;
      }
    }

    setSearching(true);
    setResults([]);
    setResultFilterQuery("");
    setSelectedProfileIds(new Set<string>());
    setPostSummary(null);
    setPostTruncated(false);
    setNextCursor(null);
    setLastPayload(null);
    setExcludedCount(0);

    try {
      if (searchMode === "POST") {
        const res = await apiRequest<{ post: PostSummary; count: number; truncated: boolean; profiles: any[] }>(
          "/linkedin/post-engagers",
          {
            method: "POST",
            body: JSON.stringify({ url: postUrl.trim(), includeReactions, includeComments, limit: importLimit }),
          }
        );
        if (res.success && res.profiles) {
          setResults(res.profiles);
          setPostSummary(res.post || null);
          setPostTruncated(Boolean(res.truncated));
          setSelectedProfileIds(new Set<string>(res.profiles.map((p: any) => String(p.providerProfileId))));
          if (res.profiles.length === 0) {
            setError("Aucune personne trouvée sur ce post (pas de like/commentaire, ou uniquement des pages entreprise).");
          }
        } else {
          setError(res.error || "Erreur lors de la récupération des interactions du post.");
        }
        return;
      }

      const payload = buildSearchPayload();
      setLastPayload(payload);

      const res = await apiRequest<SearchResponse>("/linkedin/search", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.success && res.profiles) {
        setResults(res.profiles);
        setNextCursor(res.nextCursor || null);
        setExcludedCount(res.excludedCount || 0);

        // Sélectionner par défaut tous les profils retournés
        const allIds = new Set<string>(res.profiles.map((p: any) => String(p.providerProfileId)));
        setSelectedProfileIds(allIds);

        if (res.profiles.length === 0) {
          setError(
            res.excludedCount
              ? "Tous les profils de cette page sont déjà dans vos listes — cliquez sur « Profils suivants » pour continuer."
              : "Aucun profil trouvé avec ces critères. Essayez d'élargir votre recherche (ex: enlever l'entreprise ou le filtre d'effectif)."
          );
        }
      } else {
        setError(res.error || "Erreur lors de la recherche LinkedIn.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur de connexion au service de recherche LinkedIn.");
    } finally {
      setSearching(false);
    }
  };

  /** Payload de recherche par critères / URL, rejoué à l'identique pour les pages suivantes. */
  const buildSearchPayload = () => {
    const effectiveApiMode = hasSalesNavigator ? apiMode : "classic";
    const payload: any = {
      limit: importLimit,
      api: effectiveApiMode,
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

      if (effectiveApiMode === "sales_navigator" && selectedHeadcounts.length > 0) {
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
    return payload;
  };

  /** Page suivante de la dernière recherche : les profils s'ajoutent à la liste (cochés par défaut). */
  const handleLoadMore = async () => {
    if (!nextCursor || !lastPayload || loadingMore) return;
    setLoadingMore(true);
    setError(null);

    try {
      const res = await apiRequest<SearchResponse>("/linkedin/search", {
        method: "POST",
        body: JSON.stringify({ ...lastPayload, cursor: nextCursor }),
      });

      if (res.success && res.profiles) {
        const knownIds = new Set(results.map((p) => String(p.providerProfileId)));
        const fresh = res.profiles.filter((p: any) => !knownIds.has(String(p.providerProfileId)));

        setResults((prev) => [...prev, ...fresh]);
        setSelectedProfileIds((prev) => {
          const next = new Set(prev);
          fresh.forEach((p: any) => next.add(String(p.providerProfileId)));
          return next;
        });
        setNextCursor(res.nextCursor || null);
        setExcludedCount((prev) => prev + (res.excludedCount || 0));

        if (fresh.length === 0 && !res.nextCursor) {
          setError("Plus aucun nouveau profil pour cette recherche.");
        }
      } else {
        setError(res.error || "Erreur lors du chargement des profils suivants.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur de connexion au service de recherche LinkedIn.");
    } finally {
      setLoadingMore(false);
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
    const commentText = (p.engagement?.commentText || "").toLowerCase();
    return (
      fullName.includes(q) ||
      headline.includes(q) ||
      company.includes(q) ||
      location.includes(q) ||
      industry.includes(q) ||
      commentText.includes(q)
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
    // Dernier filet : ne jamais envoyer au serveur un identifiant qui n'est pas
    // une liste réellement proposée dans le sélecteur (cf. isSelectable).
    const targetList = isSelectable(selectedListId)
      ? selectedListId
      : lists.length > 0
        ? lists[0].id
        : "";

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

    // Tags d'importation enrichis (Secteur & Taille d'entreprise, ou interaction avec le post)
    const isPostMode = searchMode === "POST";
    const customTags = [isPostMode ? "Post LinkedIn" : "Recherche LinkedIn"];
    if (!isPostMode && selectedSector) {
      customTags.push(`Secteur: ${selectedSector.title}`);
    }
    if (!isPostMode && apiMode === "sales_navigator" && selectedHeadcounts.length > 0) {
      selectedHeadcounts.forEach((hId) => {
        customTags.push(`Taille: ${hId} sal.`);
      });
    }
    const tagsFor = (p: any): string[] => {
      if (!isPostMode) return customTags;
      const t = [...customTags];
      if (p.engagement?.reacted) t.push("A liké");
      if (p.engagement?.commented) t.push("A commenté");
      return t;
    };

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
          ...(isPostMode && {
            source: "LINKEDIN_POST",
            filename: `Post de ${postSummary?.authorName || "LinkedIn"}`,
          }),
          prospects: selectedProfiles.map((p) => ({
            firstName: p.firstName || "Contact",
            lastName: p.lastName || "LinkedIn",
            linkedinUrl: p.linkedinUrl,
            // Identifiant LinkedIn interne (ACo…) : évite la résolution différée par le worker
            providerProfileId:
              typeof p.providerProfileId === "string" && p.providerProfileId.startsWith("ACo")
                ? p.providerProfileId
                : undefined,
            headline: p.headline,
            company: p.company,
            location: p.location,
            avatarUrl: p.avatarUrl,
            tags: tagsFor(p),
          })),
        }),
      });

      if (res.success) {
        setSuccessMsg(
          `${res.createdCount} prospect(s) importé(s) dans la liste ! (${res.duplicateCount} doublon(s) ignoré(s))`
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
    <Modal
      open={isOpen}
      onClose={onClose}
      size="xl"
      title="Recherche LinkedIn"
      description="Ciblez des décideurs par métier, secteur et taille d'entreprise."
      className="h-[calc(100vh-2rem)] max-w-[1200px]"
      bodyClassName="flex min-h-0 flex-1 flex-col px-6 pb-6"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-col justify-between gap-3 border-b border-line pb-3 sm:flex-row sm:items-center">
          <div />

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSearchMode("CRITERIA")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                searchMode === "CRITERIA"
                  ? "bg-white text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              Par Critères
            </button>
            <button
              type="button"
              onClick={() => setSearchMode("URL")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                searchMode === "URL"
                  ? "bg-white text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Link className="w-3 h-3" /> Coller URL LinkedIn
            </button>
            <button
              type="button"
              onClick={() => setSearchMode("POST")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                searchMode === "POST"
                  ? "bg-white text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              <MessageCircle className="w-3 h-3" /> Engagements d'un post
            </button>
          </div>
        </div>

        {/* Modal Body: Split-Pane on Large Screens */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden mt-3">

          {/* ========================================================================= */}
          {/* VOLET GAUCHE : FILTRES & PARAMÈTRES (Largeur fixe 360px sur Desktop)       */}
          {/* ========================================================================= */}
          <div className="w-full lg:w-[360px] shrink-0 flex flex-col h-full min-h-0 bg-surface-2 border border-line rounded-2xl overflow-hidden">
            {/* Header du volet filtres */}
            <div className="px-3.5 py-2.5 bg-white border-b border-line flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-ink flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-ink" /> Paramètres
              </span>
              <div className="flex items-center gap-1.5">
                {hasSalesNavigator ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-surface-2 text-muted border border-line"
                    title="Compte LinkedIn Sales Navigator actif"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-muted" /> Sales Nav
                  </span>
                ) : isPremium ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-surface-2 text-muted border border-line"
                    title="Compte LinkedIn Premium"
                  >
                    <ShieldCheck className="w-2.5 h-2.5 text-muted" /> Premium
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-surface-2 text-muted border border-line"
                    title="Compte LinkedIn Standard"
                  >
                    <Users className="w-2.5 h-2.5 text-muted" /> Standard
                  </span>
                )}
              </div>
            </div>

            {/* Formulaire défilant indépendamment */}
            <form onSubmit={handleSearch} className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
              {searchMode === "CRITERIA" ? (
                <>
                  {/* Moteur de recherche : Standard vs Sales Navigator */}
                  <div className="p-2 bg-white rounded-xl border border-line/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink">
                        Moteur :
                      </span>
                      <span className="text-xs text-muted">
                        {apiMode === "sales_navigator"
                          ? "Ciblage avancé"
                          : !hasSalesNavigator
                          ? "Recherche Standard"
                          : "Gratuit"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 p-0.5 bg-surface-2 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setApiMode("classic")}
                        className={`py-1 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          apiMode === "classic"
                            ? "bg-ink text-white"
                            : "text-muted hover:text-ink"
                        }`}
                      >
                        <Users className="w-3 h-3" /> Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!hasSalesNavigator) {
                            setShowSalesNavLockedModal(true);
                            return;
                          }
                          setApiMode("sales_navigator");
                        }}
                        className={`py-1 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          apiMode === "sales_navigator"
                            ? "bg-accent text-white"
                            : hasSalesNavigator
                            ? "text-muted hover:text-ink"
                            : "text-[#8e8e93] hover:text-muted hover:bg-surface-2"
                        }`}
                        title={
                          !hasSalesNavigator
                            ? "Nécessite un abonnement LinkedIn Sales Navigator (Cliquez pour en savoir plus)"
                            : "Activer les filtres Sales Navigator"
                        }
                      >
                        {!hasSalesNavigator ? (
                          <Lock className="w-3 h-3 text-muted shrink-0" />
                        ) : (
                          <Sparkles className="w-3 h-3 shrink-0" />
                        )}
                        <span>Sales Nav</span>
                        {!hasSalesNavigator && (
                          <span className="text-[8px] bg-surface-2 text-muted px-1 py-0.2 rounded font-medium">
                            Sales Nav
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Poste / Titre */}
                  <div>
                    <label className="block text-xs font-medium text-ink mb-1">
                      Poste / Titre
                    </label>
                    <input
                      type="text"
                      placeholder="ex: commercial, directeur, rh..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-line text-xs bg-white focus:outline-none focus:border-ink"
                    />
                  </div>

                  {/* Localisation */}
                  <div>
                    <label className="block text-xs font-medium text-ink mb-1">
                      Localisation
                    </label>
                    <input
                      type="text"
                      placeholder="ex: Abidjan, Côte d'Ivoire, Paris..."
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-line text-xs bg-white focus:outline-none focus:border-ink"
                    />
                  </div>

                  {/* Entreprise (Optionnel) */}
                  <div>
                    <label className="block text-xs font-medium text-ink mb-1">
                      Entreprise (Optionnel)
                    </label>
                    <input
                      type="text"
                      placeholder="ex: Orange, MTN, Total..."
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-line text-xs bg-white focus:outline-none focus:border-ink"
                    />
                  </div>

                  {/* Secteur d'activité */}
                  <div className="relative" ref={sectorDropdownRef}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-ink flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-ink" /> Secteur d'activité
                      </label>
                      {selectedSector && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSector(null);
                            setSectorSearchQuery("");
                          }}
                          className="text-xs text-danger hover:underline font-semibold cursor-pointer"
                        >
                          Effacer
                        </button>
                      )}
                    </div>

                    {selectedSector ? (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-surface-2 border border-ink text-xs">
                        <span className="font-medium text-ink flex items-center gap-1.5 truncate">
                          <Check className="w-3.5 h-3.5 text-ink shrink-0" />
                          <span className="truncate">{selectedSector.title}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSector(null);
                            setSectorSearchQuery("");
                          }}
                          className="p-1 hover:bg-white rounded-lg text-muted hover:text-danger shrink-0 cursor-pointer"
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
                          className="w-full pl-3 pr-8 py-2 rounded-xl border border-line text-xs bg-white focus:outline-none focus:border-ink"
                        />
                        <button
                          type="button"
                          onClick={() => setIsSectorDropdownOpen((prev) => !prev)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted cursor-pointer"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Menu déroulant de suggestions */}
                        {isSectorDropdownOpen && (
                          <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-line rounded-xl p-1">
                            {isSearchingSectors ? (
                              <div className="p-2.5 text-center text-xs text-muted flex items-center justify-center gap-1.5">
                                <RefreshCw className="w-3 h-3 animate-spin text-ink" /> Recherche...
                              </div>
                            ) : displayedSectors.length === 0 ? (
                              <div className="p-2.5 text-center text-xs text-muted">
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
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-surface-2 hover:text-ink flex items-center transition-colors cursor-pointer"
                                  >
                                    <span className="truncate">{s.title}</span>
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
                      <label className="block text-xs font-medium text-ink flex items-center gap-1.5">
                        <Building className="w-3 h-3 text-ink" /> Taille d'entreprise
                        {!hasSalesNavigator && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-surface-2 text-muted text-xs font-semibold border border-line">
                            <Lock className="w-2.5 h-2.5" /> Requis Sales Nav
                          </span>
                        )}
                      </label>
                      {!hasSalesNavigator ? (
                        <button
                          type="button"
                          onClick={() => setShowSalesNavLockedModal(true)}
                          className="text-xs text-muted hover:text-muted font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Info className="w-3 h-3" /> Pourquoi ?
                        </button>
                      ) : apiMode === "classic" ? (
                        <button
                          type="button"
                          onClick={() => setApiMode("sales_navigator")}
                          className="text-xs font-medium text-ink hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Sparkles className="w-2.5 h-2.5" /> Sales Nav
                        </button>
                      ) : (
                        selectedHeadcounts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedHeadcounts([])}
                            className="text-xs text-danger hover:underline font-semibold cursor-pointer"
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
                        const isLocked = !hasSalesNavigator;

                        return (
                          <button
                            key={tier.id}
                            type="button"
                            onClick={() => toggleHeadcount(tier.id)}
                            className={`px-1.5 py-1.5 rounded-lg border text-center transition-all flex flex-col justify-center cursor-pointer ${
                              isLocked
                                ? "bg-surface-2/60 border-line text-[#8e8e93] hover:border-amber-400 hover:bg-surface-2"
                                : isClassic
                                ? "bg-surface-2 border-line text-muted hover:border-ink hover:bg-surface-2 opacity-80"
                                : isSelected
                                ? "bg-accent border-ink text-white"
                                : "bg-white border-line text-ink hover:border-ink hover:bg-surface-2"
                            }`}
                            title={
                              isLocked
                                ? "Ce filtre requiert un abonnement LinkedIn Sales Navigator (Cliquez pour plus d'infos)"
                                : isClassic
                                ? "Cliquez pour activer Sales Navigator et filtrer par effectif"
                                : `${tier.label} salariés (${tier.sub})`
                            }
                          >
                            <span
                              className={`text-xs font-medium leading-tight ${
                                isSelected && !isClassic && !isLocked ? "text-white" : ""
                              }`}
                            >
                              {tier.label}
                            </span>
                            <span
                              className={`text-[8px] leading-tight truncate ${
                                isSelected && !isClassic && !isLocked ? "text-white/80" : "text-muted"
                              }`}
                            >
                              {tier.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {!hasSalesNavigator && (
                      <p className="text-xs text-muted flex items-center gap-1 mt-1.5 bg-surface-2 border border-line rounded-lg px-2 py-1">
                        <Lock className="w-3 h-3 text-muted shrink-0" />
                        <span>Filtre effectif réservé aux comptes Sales Navigator.</span>
                      </p>
                    )}
                  </div>
                </>
              ) : searchMode === "POST" ? (
                /* Mode Post LinkedIn : personnes ayant liké / commenté */
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-ink">URL du post LinkedIn</label>
                    <textarea
                      rows={3}
                      placeholder="https://www.linkedin.com/posts/…-activity-7332661864792528-…"
                      value={postUrl}
                      onChange={(e) => setPostUrl(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-line text-xs bg-white focus:outline-none focus:border-ink resize-none"
                    />
                    <p className="text-xs text-muted italic">
                      Ouvrez le post sur linkedin.com, puis « … » › Copier le lien du post.
                    </p>
                  </div>

                  <div className="p-2 bg-white rounded-xl border border-line/80 space-y-1.5">
                    <span className="block text-xs font-medium text-ink">Récupérer</span>
                    {[
                      { key: "reactions", label: "Personnes ayant liké / réagi", icon: ThumbsUp, checked: includeReactions, set: setIncludeReactions },
                      { key: "comments", label: "Personnes ayant commenté", icon: MessageCircle, checked: includeComments, set: setIncludeComments },
                    ].map(({ key, label, icon: Icon, checked, set }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => set(!checked)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          checked ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2"
                        }`}
                      >
                        {checked ? <CheckSquare className="w-4 h-4 text-ink" /> : <Square className="w-4 h-4 text-[#9a9aa5]" />}
                        <Icon className="w-3.5 h-3.5 text-ink" />
                        {label}
                      </button>
                    ))}
                    <p className="text-xs text-muted flex items-start gap-1 pt-0.5">
                      <Info className="w-3 h-3 text-ink shrink-0 mt-0.5" />
                      <span>Les pages entreprise sont ignorées. Un profil qui a liké et commenté n'apparaît qu'une fois.</span>
                    </p>
                  </div>
                </div>
              ) : (
                /* Mode URL LinkedIn */
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-ink">
                    URL Recherche LinkedIn
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Collez l'URL de votre recherche LinkedIn..."
                    value={searchUrl}
                    onChange={(e) => setSearchUrl(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-line text-xs bg-white focus:outline-none focus:border-ink resize-none"
                  />
                  <p className="text-xs text-muted italic">
                    Copiez directement l'URL d'une recherche filtrée depuis linkedin.com.
                  </p>
                </div>
              )}

              {/* Quota d'extraction */}
              <div className="pt-1.5 border-t border-line/60 flex items-center justify-between">
                <span className="text-xs font-medium text-ink flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-ink" /> Extraire :
                </span>
                <select
                  value={importLimit}
                  onChange={(e) => setImportLimit(parseInt(e.target.value) || 25)}
                  className="px-2 py-1 rounded-lg border border-line bg-white text-xs font-medium text-ink focus:outline-none focus:border-ink cursor-pointer"
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
                  className="w-full py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {searching ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recherche en cours...
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />{" "}
                      {searchMode === "POST" ? "Récupérer les interactions" : "Lancer la recherche"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ========================================================================= */}
          {/* VOLET DROIT : RÉSULTATS & SÉLECTION (Pleine Hauteur, Flex-1)               */}
          {/* ========================================================================= */}
          <div className="flex-1 flex flex-col h-full min-h-0 bg-white border border-line rounded-2xl overflow-hidden">
            
            {/* Toolbar Supérieure (Sticky Header) */}
            <div className="px-4 py-2.5 bg-surface-2 border-b border-line flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={results.length === 0}
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-xs font-medium text-ink hover:text-ink transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {filteredResults.length > 0 && filteredResults.every((p) => selectedProfileIds.has(String(p.providerProfileId))) ? (
                    <CheckSquare className="w-4 h-4 text-ink" />
                  ) : (
                    <Square className="w-4 h-4 text-muted" />
                  )}
                  <span>Tout sélectionner</span>
                </button>

                {results.length > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-surface-2 text-ink">
                    {selectedProfileIds.size} / {results.length} sélectionné(s)
                  </span>
                )}
              </div>

              {/* Champ de filtrage instantané par mot-clé */}
              {results.length > 0 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={resultFilterQuery}
                    onChange={(e) => setResultFilterQuery(e.target.value)}
                    placeholder="Filtrer parmi les résultats..."
                    className="pl-8 pr-7 py-1 text-xs rounded-lg border border-line bg-white text-ink placeholder-muted focus:outline-none focus:border-ink w-48 sm:w-60"
                  />
                  {resultFilterQuery && (
                    <button
                      type="button"
                      onClick={() => setResultFilterQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-danger cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Alertes d'erreur ou de succès */}
            {error && (
              <div className="m-3 p-3 rounded-xl bg-surface-2 border border-line text-danger text-xs font-semibold flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-danger" />
                  <span>{error}</span>
                </div>
                {error.toLowerCase().includes("reconnecter") && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openLinkedInModal();
                    }}
                    className="px-3 py-1 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-all shrink-0 cursor-pointer"
                  >
                    Reconnecter LinkedIn
                  </button>
                )}
              </div>
            )}

            {successMsg && (
              <div className="m-3 p-3 rounded-xl bg-surface-2 border border-line text-muted text-xs font-semibold flex items-center gap-2 shrink-0">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Récapitulatif du post analysé (mode POST) */}
            {searchMode === "POST" && postSummary && !searching && (
              <div className="mx-3 mt-3 p-3 rounded-xl bg-surface-2 border border-line text-xs shrink-0 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-ink" />
                    Post de {postSummary.authorName}
                    {postSummary.shareUrl && (
                      <a
                        href={postSummary.shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-ink hover:underline"
                        title="Ouvrir le post"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </span>
                  <span className="text-xs text-muted flex items-center gap-2">
                    <span className="inline-flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {postSummary.reactionCount}</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {postSummary.commentCount}</span>
                  </span>
                </div>
                {postSummary.text && (
                  <p className="text-xs text-muted line-clamp-2" title={postSummary.text}>
                    {postSummary.text}
                  </p>
                )}
                {postTruncated && (
                  <p className="text-xs text-muted">
                    Résultats limités à {importLimit} personnes — augmentez « Extraire » pour en récupérer davantage.
                  </p>
                )}
              </div>
            )}

            {/* Zone de défilement des profils (Pleine Hauteur) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-surface-2 custom-scrollbar">
              {searching ? (
                <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-muted space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-ink" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-ink">
                      Extraction en cours depuis LinkedIn...
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {searchMode === "POST"
                        ? `Lecture des likes et commentaires du post (jusqu'à ${importLimit} personnes).`
                        : `Récupération de ${importLimit} profils avec détails et photo.`}
                    </p>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-muted space-y-3 p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center">
                    <Search className="w-7 h-7 text-muted" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-ink">Aucun profil extrait pour l'instant</h3>
                    <p className="text-xs text-muted max-w-sm mt-1">
                      Définissez vos critères dans le panneau de gauche et cliquez sur <strong>Lancer la recherche</strong> pour charger les profils LinkedIn.
                    </p>
                  </div>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-muted space-y-2 p-6 text-center">
                  <p className="text-xs font-medium text-ink">
                    Aucun profil extrait ne correspond à « {resultFilterQuery} »
                  </p>
                  <button
                    type="button"
                    onClick={() => setResultFilterQuery("")}
                    className="text-xs text-ink hover:underline font-semibold cursor-pointer"
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
                          ? "bg-surface-2 border-ink"
                          : "bg-white border-line hover:border-ink hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                        <div className="mt-1 sm:mt-0 flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-ink" />
                          ) : (
                            <Square className="w-4 h-4 text-muted" />
                          )}
                        </div>

                        {/* Avatar */}
                        <div className="w-11 h-11 rounded-full overflow-hidden border border-line shrink-0 bg-surface-2 flex items-center justify-center">
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
                            <span className="text-xs font-medium text-muted">
                              {(p.fullName || "P").substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Text Infos */}
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-medium text-ink text-xs sm:text-sm truncate">
                              {p.fullName}
                            </p>
                            {p.networkDistance && (
                              <span className="text-xs bg-surface-2 px-1.5 py-0.2 rounded font-semibold text-muted">
                                {p.networkDistance.replace("DISTANCE_", "")}°
                              </span>
                            )}
                            {p.industry && (
                              <span className="text-xs bg-surface-2 text-ink px-2 py-0.5 rounded-full font-semibold truncate max-w-[200px]">
                                {p.industry}
                              </span>
                            )}
                            {p.engagement?.reacted && (
                              <span
                                className="text-xs bg-[#dfff9d] text-ink px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1"
                                title={`Réaction : ${p.engagement.reactionType || "LIKE"}`}
                              >
                                <ThumbsUp className="w-3 h-3" /> A liké
                              </span>
                            )}
                            {p.engagement?.commented && (
                              <span
                                className="text-xs bg-[#bcf2ff] text-ink px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1"
                                title={p.engagement.commentText || "A commenté"}
                              >
                                <MessageCircle className="w-3 h-3" /> A commenté
                              </span>
                            )}
                            {p.linkedinUrl && (
                              <a
                                href={p.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-ink hover:text-[#4d25e0] p-0.5 rounded transition-colors"
                                title="Ouvrir le profil LinkedIn"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>

                          <p className="text-xs text-muted line-clamp-1 mt-0.5">
                            {p.headline || "—"}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mt-1">
                            {p.company && (
                              <span className="flex items-center gap-1 truncate">
                                <Building className="w-3 h-3 text-ink shrink-0" /> {p.company}
                              </span>
                            )}
                            {p.location && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 text-ink shrink-0" /> {p.location}
                              </span>
                            )}
                          </div>
                          {p.engagement?.commentText && (
                            <p className="text-xs text-muted italic line-clamp-2 mt-1 pl-2 border-l-2 border-[#bcf2ff]">
                              « {p.engagement.commentText} »
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Pagination Unipile : page suivante de la même recherche + profils déjà connus ignorés */}
              {!searching && searchMode !== "POST" && (nextCursor || excludedCount > 0) && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 pb-1">
                  <p className="text-xs text-muted">
                    {excludedCount > 0
                      ? `${excludedCount} profil${excludedCount > 1 ? "s" : ""} déjà présent${excludedCount > 1 ? "s" : ""} dans vos listes ${excludedCount > 1 ? "ont" : "a"} été ignoré${excludedCount > 1 ? "s" : ""}.`
                      : `${results.length} profil${results.length > 1 ? "s" : ""} chargé${results.length > 1 ? "s" : ""}.`}
                  </p>
                  {nextCursor && (
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="px-4 py-2 rounded-xl border border-line bg-white text-xs font-semibold text-ink hover:bg-surface-2 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {loadingMore ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      Profils suivants ({importLimit})
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Barre d'action inférieure épinglée (Sticky Footer) */}
            <div className="p-3.5 bg-white border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-medium text-ink whitespace-nowrap">
                  Ajouter dans la liste :
                </span>
                <select
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-line bg-white text-xs text-ink-2 font-semibold focus:outline-none focus:border-ink cursor-pointer max-w-[220px] truncate"
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-muted hover:bg-surface-2 cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  disabled={importing || selectedProfileIds.size === 0}
                  onClick={handleImportSelected}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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

        {/* ========================================================================= */}
        {/* MODALE D'EXPLICATION : FONCTIONNALITÉ SALES NAVIGATOR REQUISE              */}
        {/* ========================================================================= */}
        {showSalesNavLockedModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-line space-y-4 relative">
              <button
                type="button"
                onClick={() => setShowSalesNavLockedModal(false)}
                className="absolute right-4 top-4 p-2 rounded-full hover:bg-surface-2 text-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-muted flex items-center justify-center shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-medium text-ink">
                    Sales Navigator requis
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted">Compte connecté :</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-2 text-ink border border-line">
                      {accountType === "PREMIUM" ? "LinkedIn Premium" : "LinkedIn Standard"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted space-y-2 leading-relaxed bg-surface-2 p-3.5 rounded-2xl border border-line">
                <p>
                  Le ciblage <strong>Sales Navigator</strong> et le filtre par <strong>taille d'entreprise (effectif)</strong> s'appuient sur l'API Sales Navigator de LinkedIn.
                </p>
                <p>
                  LinkedIn réserve ces critères avancés aux profils disposant d'un abonnement <strong>Sales Navigator</strong> actif.
                </p>
              </div>

              <div className="p-3 bg-surface-2 border border-line rounded-2xl text-xs text-muted flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                <span>
                  <strong>Votre recherche reste active :</strong> Vous pouvez continuer à cibler des profils par <strong>intitulé de poste</strong>, <strong>localisation</strong>, <strong>entreprise</strong>, <strong>secteur d'activité</strong> et <strong>mots-clés</strong> en mode Standard.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSalesNavLockedModal(false);
                    setApiMode("classic");
                  }}
                  className="px-4 py-2 rounded-xl border border-line text-xs font-medium text-ink hover:bg-surface-2 cursor-pointer"
                >
                  Continuer en Standard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSalesNavLockedModal(false);
                    if (openReconnectModal) {
                      openReconnectModal();
                    } else if (openLinkedInModal) {
                      openLinkedInModal();
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reconnecter un compte
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
