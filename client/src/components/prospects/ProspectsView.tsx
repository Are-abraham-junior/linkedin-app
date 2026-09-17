import React, { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { apiRequest } from "../../services/api";
import { ExcelImportModal } from "./ExcelImportModal";
import { LinkedInSearchModal } from "./LinkedInSearchModal";
import { ProspectDetailDrawer } from "./ProspectDetailDrawer";
import { ListsSidebar } from "./ListsSidebar";
import { useAuth } from "../../context/AuthContext";
import { LinkedInRequiredModal } from "../common/LinkedInRequiredModal";
import { ConfirmModal } from "../common/ConfirmModal";
import {
  Users,
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Trash2,
  ExternalLink,
  Mail,
  Phone,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Calendar,
  Building,
  Briefcase,
  Megaphone,
  Tag,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  X,
  GripVertical,
  ChevronDown,
  Edit2,
  Check,
  Send,
  ArrowRightLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { popoverClass } from "../layout/Header";
import { Avatar } from "../ui/Avatar";
import { Badge, StatusDot } from "../ui/Badge";
import { Button, buttonClass } from "../ui/Button";
import { Callout } from "../ui/Callout";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Checkbox, Field, Input, Select, labelClass } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Modal } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import { Pagination, Table, Td, TdActions, Th, Tr } from "../ui/Table";
import { useMediaQuery } from "../ui/hooks";
import { extractCompanyFromHeadline } from "../../utils/companyExtractor";
import {
  enrichProspects,
  enrichmentEstimate,
  enrichmentCostFor,
  fetchEnrichmentBalance,
  publishEnrichmentBalance,
} from "../../services/enrichment";
import type { EnrichmentBalance, EnrichmentProspectResult } from "../../types";
import { TokenGlyph } from "../common/TokenGlyph";

// Def de la structure des colonnes personnalisables
export type ColumnKey =
  | "prospect"
  | "headline"
  | "company"
  | "list"
  | "status"
  | "campaigns"
  | "tags"
  | "importedAt";

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  minWidth?: string;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: "prospect", label: "Prospect" },
  { key: "headline", label: "Poste" },
  { key: "company", label: "Entreprise" },
  { key: "list", label: "Liste" },
  { key: "status", label: "Statut LinkedIn" },
  { key: "campaigns", label: "Campagnes" },
  { key: "tags", label: "Tags" },
  { key: "importedAt", label: "Date d'importation" },
];

const STORAGE_KEY = "bleadin_prospects_columns_order_v1";

interface ProspectsViewProps {
  onStartCampaign?: () => void;
}

export const ProspectsView: React.FC<ProspectsViewProps> = ({ onStartCampaign }) => {
  const { user, selectedMemberId, setSelectedMemberId, openLinkedInModal, impersonatedOrg } = useAuth();
  const navigate = useNavigate();
  const isNarrow = useMediaQuery("(max-width: 1023px)");
  const [lists, setLists] = useState<any[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("ALL");
  const [prospects, setProspects] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalGlobalCount, setTotalGlobalCount] = useState(0);
  const [doNotContactCount, setDoNotContactCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showLinkedInRequiredModal, setShowLinkedInRequiredModal] = useState(false);
  const [requiredFeatureName, setRequiredFeatureName] = useState("");

  // Team transfer states
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [targetMemberId, setTargetMemberId] = useState<string>("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user?.orgRole === "OWNER" || user?.role === "SUPER_ADMIN") {
      apiRequest<{ members: any[] }>("/team/members")
        .then((res) => {
          if (res.success && res.members) {
            setTeamMembers(res.members);
            if (res.members.length > 0) {
              const other = res.members.find((m: any) => m.id !== user.id);
              if (other) setTargetMemberId(other.id);
            }
          }
        })
        .catch(() => {});
    }
  }, [user?.id, user?.orgRole, impersonatedOrg?.id]);

  // Pagination state (Waalaxy style)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Column order state
  const [columnsOrder, setColumnsOrder] = useState<ColumnKey[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_COLUMNS.length) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to load stored column order", e);
    }
    return DEFAULT_COLUMNS.map((c) => c.key);
  });

  const [isColumnOrganizerOpen, setIsColumnOrganizerOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [hasEmailFilter, setHasEmailFilter] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState<"ALL" | "WITH_CAMPAIGN" | "NO_CAMPAIGN">("ALL");
  const [isSyncingStatus, setIsSyncingStatus] = useState(false);

  // Modals & Drawers
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListColor, setNewListColor] = useState("#592eff");

  // Rename modal & inline edit state
  const [renameListModal, setRenameListModal] = useState<{ id: string; name: string; color?: string } | null>(null);
  const [renameInputText, setRenameInputText] = useState("");
  const [isInlineEditingTitle, setIsInlineEditingTitle] = useState(false);
  const [inlineTitleText, setInlineTitleText] = useState("");

  // Delete list modal state (Adora popup)
  const [listToDeleteModal, setListToDeleteModal] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingList, setIsDeletingList] = useState(false);

  // Delete prospects modal state (Adora ConfirmModal)
  const [prospectsToDelete, setProspectsToDelete] = useState<{
    ids: string[];
    singleProspect?: any;
  } | null>(null);
  const [isDeletingProspects, setIsDeletingProspects] = useState(false);

  // Import dropdown menu
  const [isImportDropdownOpen, setIsImportDropdownOpen] = useState(false);
  const importDropdownRef = useRef<HTMLDivElement>(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Enrichissement (tokens) : solde, lignes en cours, retour inline par ligne, panneau de confirmation
  const [enrichBalance, setEnrichBalance] = useState<EnrichmentBalance | null>(null);
  const [enrichBusyIds, setEnrichBusyIds] = useState<Set<string>>(new Set());
  const [enrichRowNotes, setEnrichRowNotes] = useState<Record<string, { tone: "ok" | "muted" | "error"; text: string }>>({});
  const [enrichPanel, setEnrichPanel] = useState<{ thenExport: boolean } | null>(null);
  const [enrichRunning, setEnrichRunning] = useState(false);
  const [enrichPanelError, setEnrichPanelError] = useState<string | null>(null);
  const [enrichSummary, setEnrichSummary] = useState<string | null>(null);

  // Animation ref for table rows
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (importDropdownRef.current && !importDropdownRef.current.contains(e.target as Node)) {
        setIsImportDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Save column order to localStorage
  const updateColumnsOrder = (newOrder: ColumnKey[]) => {
    setColumnsOrder(newOrder);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
    } catch (e) {
      console.error("Failed to save column order", e);
    }
  };

  const moveColumn = (index: number, direction: "LEFT" | "RIGHT") => {
    const targetIndex = direction === "LEFT" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columnsOrder.length) return;

    const next = [...columnsOrder];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    updateColumnsOrder(next);
  };

  // Drag & Drop state for column headers
  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);
  const [dragOverColIndex, setDragOverColIndex] = useState<number | null>(null);
  const [dropIndicator, setDropIndicator] = useState<"before" | "after" | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedColIndex === null) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position = e.clientX < midX ? "before" : "after";

    setDragOverColIndex(index);
    setDropIndicator(position);
  };

  const handleDragLeave = () => {
    setDragOverColIndex(null);
    setDropIndicator(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedColIndex === null || draggedColIndex === undefined) return;

    if (draggedColIndex !== targetIndex) {
      const next = [...columnsOrder];
      const [movedItem] = next.splice(draggedColIndex, 1);

      let insertIndex = targetIndex;
      if (dropIndicator === "after") {
        insertIndex = draggedColIndex < targetIndex ? targetIndex : targetIndex + 1;
      } else {
        insertIndex = draggedColIndex < targetIndex ? targetIndex - 1 : targetIndex;
      }
      insertIndex = Math.max(0, Math.min(next.length, insertIndex));

      next.splice(insertIndex, 0, movedItem);
      updateColumnsOrder(next);
    }

    setDraggedColIndex(null);
    setDragOverColIndex(null);
    setDropIndicator(null);
  };

  const handleDragEnd = () => {
    setDraggedColIndex(null);
    setDragOverColIndex(null);
    setDropIndicator(null);
  };

  // Modal drag & drop reorder
  const [modalDraggedIndex, setModalDraggedIndex] = useState<number | null>(null);
  const [modalDragOverIndex, setModalDragOverIndex] = useState<number | null>(null);

  const handleModalDragStart = (e: React.DragEvent, index: number) => {
    setModalDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleModalDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setModalDragOverIndex(index);
  };

  const handleModalDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (modalDraggedIndex === null || modalDraggedIndex === undefined || modalDraggedIndex === targetIndex) return;

    const next = [...columnsOrder];
    const [moved] = next.splice(modalDraggedIndex, 1);
    next.splice(targetIndex, 0, moved);
    updateColumnsOrder(next);

    setModalDraggedIndex(null);
    setModalDragOverIndex(null);
  };

  const handleModalDragEnd = () => {
    setModalDraggedIndex(null);
    setModalDragOverIndex(null);
  };

  const resetColumnsOrder = () => {
    const defaultKeys = DEFAULT_COLUMNS.map((c) => c.key);
    updateColumnsOrder(defaultKeys);
  };

  const fetchLists = async () => {
    try {
      const query = selectedMemberId && selectedMemberId !== "ALL" ? `?memberId=${selectedMemberId}` : "";
      const res = await apiRequest<{ lists: any[] }>(`/lists${query}`);
      if (res.success && res.lists) {
        setLists(res.lists);
        // Calculate global count sum
        const sum = res.lists.reduce((acc: number, l: any) => acc + (l.prospectsCount || 0), 0);
        setTotalGlobalCount(sum);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProspects = async () => {
    setLoading(true);
    try {
      let query = `?page=${currentPage}&limit=${pageSize}&search=${encodeURIComponent(searchTerm)}`;
      if (selectedListId !== "ALL") query += `&listId=${selectedListId}`;
      if (statusFilter !== "ALL") query += `&connectionStatus=${statusFilter}`;
      if (hasEmailFilter) query += `&hasEmail=true`;
      if (selectedMemberId && selectedMemberId !== "ALL") query += `&memberId=${selectedMemberId}`;

      const res = await apiRequest<{
        total: number;
        totalPages?: number;
        doNotContactCount?: number;
        prospects: any[];
      }>(`/prospects${query}`);

      if (res.success) {
        let list = res.prospects || [];

        // Apply campaign filter client-side if needed
        if (campaignFilter === "WITH_CAMPAIGN") {
          list = list.filter((p: any) => (p.campaignStates || []).length > 0);
        } else if (campaignFilter === "NO_CAMPAIGN") {
          list = list.filter((p: any) => (p.campaignStates || []).length === 0);
        }

        setProspects(list);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || Math.max(1, Math.ceil((res.total || 0) / pageSize)));
        if (typeof res.doNotContactCount === "number") {
          setDoNotContactCount(res.doNotContactCount);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, [selectedMemberId, impersonatedOrg?.id]);

  // Reset to page 1 whenever any filter or list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedListId, statusFilter, hasEmailFilter, campaignFilter, searchTerm, selectedMemberId, impersonatedOrg?.id]);

  useEffect(() => {
    fetchProspects();
  }, [selectedListId, statusFilter, hasEmailFilter, campaignFilter, currentPage, pageSize, selectedMemberId, impersonatedOrg?.id]);

  // GSAP Stagger animation on prospects table rows
  useEffect(() => {
    if (tbodyRef.current && prospects.length > 0 && !loading) {
      gsap.fromTo(
        tbodyRef.current.children,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.28,
          stagger: 0.02,
          ease: "power2.out",
        }
      );
    }
  }, [prospects, loading]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProspects();
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const res = await apiRequest("/lists", {
        method: "POST",
        body: JSON.stringify({
          name: newListName.trim(),
          color: newListColor,
        }),
      });

      if (res.success && res.list) {
        setNewListName("");
        setIsCreateListModalOpen(false);
        fetchLists();
        setSelectedListId(res.list.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRenameList = async (listId: string, name: string) => {
    if (!name.trim()) return;
    try {
      const res = await apiRequest(`/lists/${listId}`, {
        method: "PUT",
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.success) {
        fetchLists();
        setRenameListModal(null);
        setIsInlineEditingTitle(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteList = (listId: string) => {
    const target = lists.find((l) => l.id === listId);
    setListToDeleteModal({
      id: listId,
      name: target?.name || "cette liste",
    });
  };

  const confirmDeleteList = async () => {
    if (!listToDeleteModal) return;
    setIsDeletingList(true);
    try {
      const res = await apiRequest(`/lists/${listToDeleteModal.id}`, {
        method: "DELETE",
      });
      if (res.success) {
        if (selectedListId === listToDeleteModal.id) {
          setSelectedListId("ALL");
        }
        fetchLists();
        setListToDeleteModal(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeletingList(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === prospects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(prospects.map((p) => p.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleOpenDeleteModal = () => {
    if (selectedIds.size === 0) return;
    const single = selectedIds.size === 1 ? prospects.find((p) => selectedIds.has(p.id)) : undefined;
    setProspectsToDelete({
      ids: Array.from(selectedIds),
      singleProspect: single,
    });
  };

  const handleConfirmDeleteProspects = async () => {
    if (!prospectsToDelete || prospectsToDelete.ids.length === 0) return;

    setIsDeletingProspects(true);
    try {
      await apiRequest("/prospects/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids: prospectsToDelete.ids }),
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        prospectsToDelete.ids.forEach((id) => next.delete(id));
        return next;
      });
      if (selectedProspect && prospectsToDelete.ids.includes(selectedProspect.id)) {
        setSelectedProspect(null);
      }
      setProspectsToDelete(null);
      await Promise.all([fetchProspects(), fetchLists()]);
    } catch (e) {
      console.error("Erreur lors de la suppression des prospects:", e);
    } finally {
      setIsDeletingProspects(false);
    }
  };

  const handleSyncStatus = async () => {
    setIsSyncingStatus(true);
    try {
      const payload: any = {};
      if (selectedIds.size > 0) {
        payload.prospectIds = Array.from(selectedIds);
      } else if (selectedListId && selectedListId !== "ALL" && selectedListId !== "DO_NOT_CONTACT") {
        payload.listId = selectedListId;
      }

      await apiRequest("/prospects/sync-status", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await Promise.all([fetchProspects(), fetchLists()]);
    } catch (e) {
      console.error("Erreur lors de la synchronisation des statuts", e);
    } finally {
      setIsSyncingStatus(false);
    }
  };

  const handleExportCSV = (source: any[] = prospects) => {
    const dataToExport = source.filter(
      (p) => selectedIds.size === 0 || selectedIds.has(p.id)
    );

    if (dataToExport.length === 0) return;

    const headers = [
      "Prénom",
      "Nom",
      "Poste",
      "Entreprise",
      "Localisation",
      "Email",
      "Téléphone",
      "Statut LinkedIn",
      "URL LinkedIn",
      "Liste",
      "Date Import",
    ];

    const rows = dataToExport.map((p) => [
      p.firstName || "",
      p.lastName || "",
      p.headline || "",
      p.company || extractCompanyFromHeadline(p.headline) || "",
      p.location || "",
      p.email || "",
      p.phone || "",
      p.connectionStatus || "",
      p.linkedinUrl || "",
      p.list?.name || "",
      p.createdAt ? new Date(p.createdAt).toLocaleDateString("fr-FR") : "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(";"), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const a = document.createElement("a");
    a.href = encodedUri;
    a.download = `bleadin-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // ---- Enrichissement (tokens) ----

  /** Solde local + diffusion au chip du bandeau (Header). */
  const updateEnrichBalance = (balance: EnrichmentBalance | null) => {
    setEnrichBalance(balance);
    if (balance) publishEnrichmentBalance(balance);
  };

  const loadEnrichBalance = async () => {
    try {
      updateEnrichBalance(await fetchEnrichmentBalance());
    } catch {
      /* sans solde, les boutons restent actifs et le panneau affiche « — » */
    }
  };

  useEffect(() => {
    loadEnrichBalance();
  }, [impersonatedOrg?.id]);

  /** Applique les coordonnées trouvées aux lignes affichées et renvoie la liste mise à jour. */
  const applyEnrichmentResults = (results: EnrichmentProspectResult[]) => {
    const byId = new Map(results.map((r) => [r.prospectId, r]));
    const next = prospects.map((p) => {
      const r = byId.get(p.id);
      if (!r || (r.status !== "ENRICHED" && r.status !== "PARTIAL")) return p;
      return { ...p, email: r.email ?? p.email, phone: r.phone ?? p.phone };
    });
    setProspects(next);
    return next;
  };

  const noteFor = (r: EnrichmentProspectResult): { tone: "ok" | "muted" | "error"; text: string } => {
    switch (r.status) {
      case "ENRICHED":
        return { tone: "ok", text: `Trouvé · ${r.charged} token${r.charged > 1 ? "s" : ""}` };
      case "PARTIAL":
        return { tone: "ok", text: `${r.email && r.phone ? "" : r.email ? "E-mail trouvé" : "Téléphone trouvé"} · ${r.charged} débité${r.charged > 1 ? "s" : ""}, ${r.refunded} restitué${r.refunded > 1 ? "s" : ""}` };
      case "NOT_FOUND":
        return { tone: "muted", text: "Introuvable · tokens restitués" };
      case "FAILED":
        return { tone: "error", text: "Profil injoignable · tokens restitués" };
      default:
        switch (r.reason) {
          case "ALREADY_COMPLETE":
            return { tone: "muted", text: "Déjà complet" };
          case "INSUFFICIENT_TOKENS":
            return { tone: "error", text: "Solde insuffisant" };
          case "VISITS_QUOTA":
            return { tone: "error", text: "Quota de visites du jour atteint" };
          case "BATCH_LIMIT":
            return { tone: "muted", text: "Au-delà du lot de 50" };
          default:
            return { tone: "error", text: "Pas d'URL LinkedIn" };
        }
    }
  };

  const flashRowNotes = (results: EnrichmentProspectResult[]) => {
    const notes: typeof enrichRowNotes = {};
    for (const r of results) notes[r.prospectId] = noteFor(r);
    setEnrichRowNotes((prev) => ({ ...prev, ...notes }));
    window.setTimeout(() => {
      setEnrichRowNotes((prev) => {
        const copy = { ...prev };
        for (const r of results) delete copy[r.prospectId];
        return copy;
      });
    }, 6000);
  };

  const handleEnrichOne = async (p: any) => {
    if (enrichBusyIds.has(p.id)) return;
    setEnrichBusyIds((prev) => new Set(prev).add(p.id));
    try {
      const res = await enrichProspects([p.id]);
      if (!res.success) {
        setEnrichRowNotes((prev) => ({ ...prev, [p.id]: { tone: "error", text: res.error || "Échec de l'enrichissement" } }));
        window.setTimeout(() => setEnrichRowNotes((prev) => { const c = { ...prev }; delete c[p.id]; return c; }), 6000);
        return;
      }
      applyEnrichmentResults(res.results);
      flashRowNotes(res.results);
      if (res.balance) updateEnrichBalance(res.balance);
    } finally {
      setEnrichBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }
  };

  const selectedProspects = prospects.filter((p) => selectedIds.has(p.id));
  const enrichEstimate = enrichmentEstimate(selectedProspects);
  const enrichBatch = enrichEstimate.incomplete.slice(0, 50);
  const enrichBatchCost = enrichBatch.reduce((s, p) => s + enrichmentCostFor(p), 0);

  const openEnrichPanel = (thenExport: boolean) => {
    setEnrichPanelError(null);
    setEnrichSummary(null);
    setEnrichPanel({ thenExport });
  };

  const confirmEnrichSelection = async () => {
    if (!enrichPanel) return;
    const { thenExport } = enrichPanel;
    if (enrichBatch.length === 0) {
      if (thenExport) handleExportCSV();
      setEnrichPanel(null);
      return;
    }
    setEnrichRunning(true);
    setEnrichPanelError(null);
    try {
      const res = await enrichProspects(enrichBatch.map((p) => p.id));
      if (!res.success) {
        setEnrichPanelError(res.error || "Échec de l'enrichissement.");
        return;
      }
      const updated = applyEnrichmentResults(res.results);
      flashRowNotes(res.results);
      if (res.balance) updateEnrichBalance(res.balance);

      const found = res.results.filter((r) => r.status === "ENRICHED" || r.status === "PARTIAL").length;
      const charged = res.results.reduce((s, r) => s + r.charged, 0);
      const refunded = res.results.reduce((s, r) => s + r.refunded, 0);
      const skippedTokens = res.results.filter((r) => r.reason === "INSUFFICIENT_TOKENS").length;
      setEnrichSummary(
        `${found} prospect${found > 1 ? "s" : ""} complété${found > 1 ? "s" : ""} · ${charged} token${charged > 1 ? "s" : ""} débité${charged > 1 ? "s" : ""} · ${refunded} restitué${refunded > 1 ? "s" : ""}` +
          (skippedTokens ? ` · ${skippedTokens} non traité${skippedTokens > 1 ? "s" : ""} (solde insuffisant)` : "")
      );
      if (thenExport) handleExportCSV(updated);
      setEnrichPanel(null);
    } finally {
      setEnrichRunning(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!targetMemberId || selectedIds.size === 0) return;
    setTransferLoading(true);
    setTransferMessage(null);
    try {
      const res = await apiRequest<{ success: boolean; transferredCount: number; message?: string }>(
        "/prospects/transfer",
        {
          method: "POST",
          body: {
            prospectIds: Array.from(selectedIds),
            targetUserId: targetMemberId,
          },
        }
      );

      if (res.success) {
        setTransferMessage(`${res.transferredCount || selectedIds.size} prospect(s) transféré(s) avec succès.`);
        setSelectedIds(new Set());
        fetchProspects();
        fetchLists();
        setTimeout(() => {
          setIsTransferModalOpen(false);
          setTransferMessage(null);
        }, 1200);
      } else {
        setTransferMessage((res as any).error || "Erreur lors du transfert.");
      }
    } catch (e: any) {
      setTransferMessage(e.message || "Erreur réseau lors du transfert.");
    } finally {
      setTransferLoading(false);
    }
  };

  // Resolve current active list details
  const activeList = lists.find((l) => l.id === selectedListId);
  const activeListTitle =
    selectedListId === "ALL"
      ? "Tous les prospects"
      : selectedListId === "DO_NOT_CONTACT"
      ? "Ne pas contacter"
      : activeList?.name || "Liste de prospects";

  const activeListColor =
    selectedListId === "ALL"
      ? "#592eff"
      : selectedListId === "DO_NOT_CONTACT"
      ? "#ef4444"
      : activeList?.color || "#592eff";

  // Rendering individual table cell based on column key
  // Rendering individual table cell based on column key (CRM Pro Density)
  const renderCellContent = (p: any, key: ColumnKey) => {
    switch (key) {
      case "prospect":
        return (
          <div className="flex items-center gap-2">
            <Avatar name={`${p.firstName || ""} ${p.lastName || ""}`} src={p.avatarUrl} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                <p className="truncate text-sm font-medium leading-none text-ink">
                  {p.firstName} {p.lastName}
                </p>
                {p.list?.user?.id && p.list.user.id !== user?.id && (
                  <Badge size="sm">{p.list.user.firstName || p.list.user.name || "Collègue"}</Badge>
                )}
                {p.linkedinUrl && (
                  <a
                    href={p.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 p-0.5 leading-none text-muted transition-colors hover:text-ink"
                    title="Ouvrir le profil LinkedIn"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5 leading-none">
                <p className="text-xs text-muted truncate leading-none">{p.location || "Non renseigné"}</p>
                {p.email && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-xs leading-none text-muted"
                    title={`Email : ${p.email}`}
                  >
                    <Mail className="w-2.5 h-2.5" />
                    <span className="max-w-[120px] truncate">{p.email}</span>
                  </span>
                )}
                {p.phone && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-xs leading-none text-muted"
                    title={`Téléphone : ${p.phone}`}
                  >
                    <Phone className="w-2.5 h-2.5" />
                    <span className="max-w-[100px] truncate">{p.phone}</span>
                  </span>
                )}
                {(() => {
                  const note = enrichRowNotes[p.id];
                  const busy = enrichBusyIds.has(p.id);
                  const cost = enrichmentCostFor(p);
                  if (note) {
                    return (
                      <span
                        className={`text-xs font-medium leading-none shrink-0 ${
                          note.tone === "ok" ? "text-ok" : note.tone === "error" ? "text-danger" : "text-muted-2"
                        }`}
                      >
                        {note.text}
                      </span>
                    );
                  }
                  if (busy) {
                    return (
                      <span className="inline-flex items-center gap-1 text-xs text-muted leading-none shrink-0">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Recherche…
                      </span>
                    );
                  }
                  if (cost === 0) return null;
                  const noTokens = enrichBalance !== null && enrichBalance.remaining < 1;
                  return (
                    <button
                      type="button"
                      disabled={noTokens}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEnrichOne(p);
                      }}
                      className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 inline-flex items-center gap-1 text-xs font-semibold text-ink border border-line rounded-md px-1.5 py-[2px] leading-none shrink-0 hover:border-ink transition-[opacity,border-color] disabled:cursor-not-allowed disabled:text-muted-2"
                      title={
                        noTokens
                          ? "Plus de tokens ce mois-ci"
                          : `Rechercher ${!p.email && !p.phone ? "l'e-mail et le téléphone" : !p.email ? "l'e-mail" : "le téléphone"} · ${cost} token${cost > 1 ? "s" : ""} maximum, restitués si introuvables`
                      }
                    >
                      Enrichir · {cost} <TokenGlyph />
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        );

      case "headline":
        return (
          <p className="line-clamp-1 text-sm leading-tight text-ink-2" title={p.headline || ""}>
            {p.headline || "Professionnel"}
          </p>
        );

      case "company": {
        const comp = (p.company && p.company !== "—" ? p.company.trim() : "") || extractCompanyFromHeadline(p.headline);
        return (
          <div className="flex items-center gap-1" title={comp || "Non renseigné"}>
            {comp ? (
              <span className="inline-flex max-w-[180px] items-center gap-1.5 text-sm leading-tight text-ink-2">
                <Building className="h-3.5 w-3.5 shrink-0 text-muted-2" strokeWidth={1.75} />
                <span className="truncate">{comp}</span>
              </span>
            ) : (
              <span className="text-sm leading-tight text-muted-2">—</span>
            )}
          </div>
        );
      }

      case "list":
        return (
          <span className="inline-flex max-w-[160px] items-center gap-1.5 text-sm text-ink-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.list?.color || "#592eff" }} aria-hidden />
            <span className="truncate">{p.list?.name || "Sans liste"}</span>
          </span>
        );

      case "status":
        return (
          <StatusDot tone={p.connectionStatus === "CONNECTED" ? "ok" : p.connectionStatus === "PENDING" ? "warn" : "neutral"}>
            {p.connectionStatus === "CONNECTED" ? "Connecté" : p.connectionStatus === "PENDING" ? "En attente" : "Non connecté"}
          </StatusDot>
        );

      case "campaigns": {
        const campaignsList = p.campaignStates || [];
        return (
          <div>
            {campaignsList.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {campaignsList.map((cp: any) => (
                  <span
                    key={cp.campaign?.id || Math.random()}
                    className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs text-ink-2"
                  >
                    <Megaphone className="h-3 w-3 text-muted" strokeWidth={1.75} /> {cp.campaign?.name || "Campagne"}
                  </span>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/campaigns");
                }}
                className="flex items-center gap-1 text-xs text-muted hover:text-ink hover:underline"
              >
                <Plus className="h-3 w-3" /> Ajouter à une campagne
              </button>
            )}
          </div>
        );
      }

      case "tags":
        return (
          <div className="flex flex-wrap gap-1">
            {(p.tags || []).slice(0, 2).map((t: string) => (
              <span
                key={t}
                className="px-1.5 py-0.5 bg-surface-2 text-muted border border-line rounded font-medium text-xs flex items-center gap-1"
              >
                <Tag className="h-3 w-3 text-muted-2" strokeWidth={1.75} /> {t}
              </span>
            ))}
            {(p.tags || []).length > 2 && (
              <span className="text-xs text-muted font-bold">
                +{p.tags.length - 2}
              </span>
            )}
          </div>
        );

      case "importedAt": {
        const dateStr = p.createdAt
          ? new Date(p.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "—";
        return (
          <span className="text-xs text-muted font-medium flex items-center gap-1">
            {dateStr}
          </span>
        );
      }

      default:
        return null;
    }
  };

  const isCustomList = selectedListId !== "ALL" && selectedListId !== "DO_NOT_CONTACT";
  const canFilterMembers = (user?.role === "SUPER_ADMIN" || user?.orgRole === "OWNER") && teamMembers.length > 0;
  const allSelected = selectedIds.size > 0 && selectedIds.size === prospects.length;
  const enrichDisabled = enrichEstimate.incomplete.length === 0 || (enrichBalance !== null && enrichBalance.remaining < 1);

  const startCampaign = () => {
    if (!user?.hasLinkedInAccount) {
      setRequiredFeatureName("Lancement de campagne");
      setShowLinkedInRequiredModal(true);
      return;
    }
    if (onStartCampaign) onStartCampaign();
    else navigate("/campaigns");
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1640px] flex-col overflow-hidden px-4 py-4 sm:px-6">
      <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-hidden">
        <ListsSidebar
          lists={lists}
          selectedListId={selectedListId}
          onSelectList={(id) => setSelectedListId(id)}
          totalProspects={totalGlobalCount || total}
          doNotContactCount={doNotContactCount}
          onCreateList={() => setIsCreateListModalOpen(true)}
          onRenameList={(list) => {
            setRenameListModal(list);
            setRenameInputText(list.name);
          }}
          onDeleteList={(id) => handleDeleteList(id)}
          isCollapsed={isSidebarCollapsed || isNarrow}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <div className="flex h-full min-w-0 flex-1 flex-col gap-3 overflow-hidden">
          {/* En-tête de la liste active */}
          <div className="flex shrink-0 flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isInlineEditingTitle && isCustomList ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRenameList(selectedListId, inlineTitleText);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <Input
                      autoFocus
                      value={inlineTitleText}
                      onChange={(e) => setInlineTitleText(e.target.value)}
                      onBlur={() => handleRenameList(selectedListId, inlineTitleText)}
                      className="display h-9 w-64 text-lg"
                    />
                    <IconButton label="Valider" icon={Check} type="submit" />
                  </form>
                ) : (
                  <div className="group flex items-center gap-1.5">
                    <h1 className="display truncate text-xl">{activeListTitle}</h1>
                    {isCustomList && (
                      <IconButton
                        label="Renommer cette liste"
                        icon={Edit2}
                        onClick={() => {
                          setInlineTitleText(activeListTitle);
                          setIsInlineEditingTitle(true);
                        }}
                        className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                      />
                    )}
                  </div>
                )}
                <Badge>{total}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted">
                {selectedListId === "ALL"
                  ? "Tous les prospects importés dans votre espace."
                  : selectedListId === "DO_NOT_CONTACT"
                    ? "Contacts exclus des automatisations et des envois."
                    : `${total} prospect(s) dans cette liste.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" icon={Send} onClick={startCampaign}>
                Démarrer une campagne
              </Button>
              <div className="relative" ref={importDropdownRef}>
                <Button icon={Plus} iconRight={ChevronDown} onClick={() => setIsImportDropdownOpen((v) => !v)} aria-expanded={isImportDropdownOpen} aria-haspopup="menu">
                  Importer
                </Button>
                {isImportDropdownOpen && (
                  <div className={`${popoverClass} z-50 w-72`} role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsImportDropdownOpen(false);
                        if (!user?.hasLinkedInAccount) {
                          setRequiredFeatureName("Recherche de profils LinkedIn");
                          setShowLinkedInRequiredModal(true);
                          return;
                        }
                        setIsSearchModalOpen(true);
                      }}
                      className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                    >
                      <Search className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
                      <span>
                        <span className="block text-sm font-medium text-ink">Recherche LinkedIn</span>
                        <span className="block text-xs text-muted">Par poste, ville ou entreprise</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsImportDropdownOpen(false);
                        setIsExcelModalOpen(true);
                      }}
                      className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                    >
                      <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
                      <span>
                        <span className="block text-sm font-medium text-ink">Fichier Excel ou CSV</span>
                        <span className="block text-xs text-muted">Import avec mise en correspondance des colonnes</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recherche + filtres */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="min-w-[240px] flex-1">
              <Input
                size="sm"
                leftIcon={Search}
                placeholder="Rechercher par nom, poste, entreprise, localisation ou e-mail…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </form>
            <Select inline size="sm" aria-label="Statut LinkedIn" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Tous les statuts</option>
              <option value="CONNECTED">Connecté</option>
              <option value="PENDING">En attente</option>
              <option value="NOT_CONNECTED">Non connecté</option>
            </Select>
            <Button
              variant={hasEmailFilter ? "secondary" : "ghost"}
              size="sm"
              icon={Mail}
              onClick={() => setHasEmailFilter(!hasEmailFilter)}
              aria-pressed={hasEmailFilter}
              className={hasEmailFilter ? "border-ink" : undefined}
            >
              E-mail trouvé
            </Button>
            <Select inline size="sm" aria-label="Campagne" value={campaignFilter} onChange={(e: any) => setCampaignFilter(e.target.value)}>
              <option value="ALL">Toutes les campagnes</option>
              <option value="WITH_CAMPAIGN">En campagne</option>
              <option value="NO_CAMPAIGN">Sans campagne</option>
            </Select>
            {canFilterMembers && (
              <Select inline size="sm" aria-label="Collaborateur" value={selectedMemberId || "ALL"} onChange={(e) => setSelectedMemberId(e.target.value === "ALL" ? null : e.target.value)}>
                <option value="ALL">Toute l'équipe</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email} {m.orgRole === "OWNER" ? "(Propriétaire)" : ""}
                  </option>
                ))}
              </Select>
            )}
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" icon={SlidersHorizontal} onClick={() => setIsColumnOrganizerOpen(true)}>
                Colonnes
              </Button>
              <IconButton label="Exporter en CSV" icon={Download} onClick={() => handleExportCSV()} />
              <IconButton
                label="Synchroniser le statut LinkedIn"
                icon={RefreshCw}
                onClick={handleSyncStatus}
                disabled={isSyncingStatus || loading}
                className={isSyncingStatus ? "[&>svg]:animate-spin" : undefined}
              />
            </div>
          </div>

          {/* Barre de sélection */}
          {selectedIds.size > 0 && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2 shadow-pop">
              <span className="text-sm text-ink">
                <span className="font-medium">{selectedIds.size}</span> prospect(s) sélectionné(s)
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => openEnrichPanel(false)}
                  disabled={enrichDisabled}
                  title={
                    enrichEstimate.incomplete.length === 0
                      ? "Tous les prospects sélectionnés ont déjà e-mail et téléphone"
                      : enrichBalance !== null && enrichBalance.remaining < 1
                        ? "Plus de tokens ce mois-ci"
                        : "Rechercher l'e-mail et le téléphone des prospects sélectionnés"
                  }
                >
                  {enrichBalance !== null && enrichBalance.remaining < 1 ? (
                    "Plus de tokens ce mois-ci"
                  ) : (
                    <>
                      Enrichir ({enrichEstimate.incomplete.length}) · ≈ {enrichEstimate.maxCost} <TokenGlyph />
                    </>
                  )}
                </Button>
                {teamMembers.length > 1 && (
                  <Button variant="secondary" size="sm" icon={ArrowRightLeft} onClick={() => setIsTransferModalOpen(true)}>
                    Transférer
                  </Button>
                )}
                <details className="group/export relative">
                  <summary className={`${buttonClass("secondary", "sm")} list-none [&::-webkit-details-marker]:hidden`}>
                    <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Exporter <ChevronDown className="h-4 w-4 opacity-70" strokeWidth={1.75} aria-hidden />
                  </summary>
                  <div className={`${popoverClass} z-30 min-w-[260px]`}>
                    <button
                      type="button"
                      onClick={(e) => {
                        (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                        handleExportCSV();
                      }}
                      className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-ink hover:bg-surface-2"
                    >
                      Exporter tel quel
                      <span className="block text-xs text-muted">CSV des {selectedIds.size} prospects sélectionnés</span>
                    </button>
                    <button
                      type="button"
                      disabled={enrichDisabled}
                      onClick={(e) => {
                        (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                        openEnrichPanel(true);
                      }}
                      className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Enrichir puis exporter
                      <span className="block text-xs text-muted">
                        {enrichEstimate.incomplete.length === 0
                          ? "Toutes les coordonnées sont déjà présentes"
                          : `${enrichEstimate.incomplete.length} sans coordonnées · ≈ ${enrichEstimate.maxCost} tokens maximum`}
                      </span>
                    </button>
                  </div>
                </details>
                <Button variant="danger" size="sm" icon={Trash2} onClick={handleOpenDeleteModal}>
                  Supprimer
                </Button>
              </div>
            </div>
          )}

          {/* Panneau de confirmation d'enrichissement — inline, jamais en modale */}
          {enrichPanel && selectedIds.size > 0 && (
            <div className="shrink-0 rounded-xl border border-line bg-surface px-4 py-3">
              <div className="flex flex-col gap-4 md:flex-row md:items-start">
                <div className="min-w-0 max-w-[65ch] flex-1">
                  <p className="text-sm font-medium text-ink">
                    {enrichPanel.thenExport ? "Enrichir puis exporter" : "Enrichir"} {enrichBatch.length} prospect{enrichBatch.length > 1 ? "s" : ""}
                    {enrichEstimate.incomplete.length > enrichBatch.length && (
                      <span className="font-normal text-muted"> — {enrichEstimate.incomplete.length - enrichBatch.length} au-delà du lot de 50, à relancer ensuite</span>
                    )}
                  </p>
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted">
                    <dt>Coût maximum</dt>
                    <dd className="text-ink">
                      {enrichBatchCost} <TokenGlyph /> <span className="text-muted">— 1 par e-mail, 5 par téléphone, uniquement ce qui manque</span>
                    </dd>
                    <dt>Solde après</dt>
                    <dd className="text-ink">
                      {enrichBalance ? Math.max(0, enrichBalance.remaining - enrichBatchCost) : "—"} <TokenGlyph />
                      {enrichBalance && enrichBalance.remaining < enrichBatchCost && (
                        <span className="text-warn"> — solde insuffisant pour tout le lot, les derniers prospects ne seront pas traités</span>
                      )}
                    </dd>
                  </dl>
                  <p className="mt-1.5 text-xs text-muted">Les tokens des coordonnées introuvables vous sont restitués. Chaque recherche compte comme une visite de profil.</p>
                  {enrichPanelError && <p className="mt-1.5 text-xs text-danger">{enrichPanelError}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEnrichPanel(null)} disabled={enrichRunning}>
                    Annuler
                  </Button>
                  <Button size="sm" onClick={confirmEnrichSelection} loading={enrichRunning}>
                    {enrichRunning ? "Recherche en cours…" : "Confirmer"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {enrichSummary && (
            <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-2 text-sm text-ink">
              <span>
                <span className="font-medium">Enrichissement terminé.</span> {enrichSummary}
              </span>
              <IconButton label="Fermer" icon={X} onClick={() => setEnrichSummary(null)} />
            </div>
          )}

          {/* Tableau */}
          <Card padding="none" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
              <Table>
                <thead>
                  <tr className="select-none">
                    <Th className="w-10">
                      <Checkbox checked={allSelected} onChange={toggleSelectAll} aria-label="Tout sélectionner" />
                    </Th>
                    {columnsOrder.map((colKey, index) => {
                      const colDef = DEFAULT_COLUMNS.find((c) => c.key === colKey);
                      if (!colDef) return null;
                      const isFirst = index === 0;
                      const isLast = index === columnsOrder.length - 1;
                      const isDragging = draggedColIndex === index;
                      const isDragOver = dragOverColIndex === index;
                      const isBefore = isDragOver && dropIndicator === "before";
                      const isAfter = isDragOver && dropIndicator === "after";
                      return (
                        <Th
                          key={colKey}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          title="Glissez pour déplacer cette colonne"
                          className={`group cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""} ${isBefore ? "border-l-2 border-l-ink" : ""} ${isAfter ? "border-r-2 border-r-ink" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="flex items-center gap-1">
                              <GripVertical className="h-3 w-3 shrink-0 text-muted-2" strokeWidth={1.75} aria-hidden />
                              <span className="whitespace-nowrap">{colDef.label}</span>
                            </span>
                            <span className="ml-1 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                disabled={isFirst}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveColumn(index, "LEFT");
                                }}
                                className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-20"
                                title="Déplacer vers la gauche"
                              >
                                <ArrowLeft className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                disabled={isLast}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveColumn(index, "RIGHT");
                                }}
                                className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-20"
                                title="Déplacer vers la droite"
                              >
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            </span>
                          </div>
                        </Th>
                      );
                    })}
                    <Th />
                  </tr>
                </thead>
                <tbody ref={tbodyRef}>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        <Td colSpan={columnsOrder.length + 2}>
                          <Skeleton className="h-4 w-full" />
                        </Td>
                      </tr>
                    ))
                  ) : prospects.length === 0 ? (
                    <tr>
                      <Td colSpan={columnsOrder.length + 2} className="border-b-0">
                        <EmptyState
                          bare
                          icon={Users}
                          title="Aucun prospect dans cette vue"
                          description="Importez un fichier ou lancez une recherche LinkedIn pour alimenter cette liste."
                        />
                      </Td>
                    </tr>
                  ) : (
                    prospects.map((p) => {
                      const isSelected = selectedIds.has(p.id);
                      return (
                        <Tr key={p.id} selected={isSelected} clickable onClick={() => setSelectedProspect(p)}>
                          <Td
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectOne(p.id);
                            }}
                          >
                            <Checkbox checked={isSelected} onChange={() => toggleSelectOne(p.id)} aria-label="Sélectionner" />
                          </Td>
                          {columnsOrder.map((colKey) => (
                            <Td key={colKey} className="py-2">
                              {renderCellContent(p, colKey)}
                            </Td>
                          ))}
                          <TdActions>
                            <IconButton
                              label="Supprimer ce prospect"
                              icon={Trash2}
                              tone="danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProspectsToDelete({ ids: [p.id], singleProspect: p });
                              }}
                            />
                            <IconButton
                              label="Ouvrir la fiche"
                              icon={ChevronRight}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProspect(p);
                              }}
                            />
                          </TdActions>
                        </Tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </div>

            <Pagination
              page={currentPage}
              pageCount={totalPages}
              onPage={(p) => setCurrentPage(p)}
              summary={
                <span>
                  {total === 0
                    ? "Aucun prospect"
                    : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} sur ${total}`}
                </span>
              }
              extra={
                <Select
                  inline
                  size="sm"
                  aria-label="Par page"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={10}>10 par page</option>
                  <option value={20}>20 par page</option>
                  <option value={50}>50 par page</option>
                </Select>
              }
            />
          </Card>
        </div>
      </div>

      {/* Renommer une liste */}
      <Modal
        open={Boolean(renameListModal)}
        onClose={() => setRenameListModal(null)}
        title="Renommer la liste"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameListModal(null)}>
              Annuler
            </Button>
            <Button type="submit" form="rename-list-form">
              Enregistrer
            </Button>
          </>
        }
      >
        <form
          id="rename-list-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (renameListModal) handleRenameList(renameListModal.id, renameInputText);
          }}
          className="pb-2"
        >
          <Field label="Nom de la liste">
            <Input required autoFocus value={renameInputText} onChange={(e) => setRenameInputText(e.target.value)} />
          </Field>
        </form>
      </Modal>

      {/* Organisation des colonnes */}
      <Modal
        open={isColumnOrganizerOpen}
        onClose={() => setIsColumnOrganizerOpen(false)}
        title="Colonnes du tableau"
        description="Glissez-déposez ou utilisez les flèches pour changer l'ordre."
        size="md"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={resetColumnsOrder}>
              Réinitialiser
            </Button>
            <Button onClick={() => setIsColumnOrganizerOpen(false)}>Terminé</Button>
          </>
        }
      >
        <ol className="max-h-[360px] space-y-1.5 overflow-y-auto pb-2">
          {columnsOrder.map((colKey, index) => {
            const colDef = DEFAULT_COLUMNS.find((c) => c.key === colKey);
            if (!colDef) return null;
            const isFirst = index === 0;
            const isLast = index === columnsOrder.length - 1;
            const isDragging = modalDraggedIndex === index;
            const isDragOver = modalDragOverIndex === index;
            return (
              <li
                key={colKey}
                draggable
                onDragStart={(e) => handleModalDragStart(e, index)}
                onDragOver={(e) => handleModalDragOver(e, index)}
                onDrop={(e) => handleModalDrop(e, index)}
                onDragEnd={handleModalDragEnd}
                className={`flex cursor-grab select-none items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors active:cursor-grabbing ${
                  isDragging ? "border-dashed border-ink opacity-40" : isDragOver ? "border-ink bg-surface-2" : "border-line hover:border-ink"
                }`}
              >
                <span className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-2" strokeWidth={1.75} aria-hidden />
                  <span className="w-5 tabular-nums text-xs text-muted">{index + 1}</span>
                  <span className="font-medium text-ink">{colDef.label}</span>
                </span>
                <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <IconButton label="Monter" icon={ArrowLeft} disabled={isFirst} onClick={() => moveColumn(index, "LEFT")} className="[&>svg]:rotate-90" />
                  <IconButton label="Descendre" icon={ArrowRight} disabled={isLast} onClick={() => moveColumn(index, "RIGHT")} className="[&>svg]:rotate-90" />
                </span>
              </li>
            );
          })}
        </ol>
      </Modal>

      {/* Créer une liste */}
      <Modal
        open={isCreateListModalOpen}
        onClose={() => setIsCreateListModalOpen(false)}
        title="Nouvelle liste"
        description="Organisez vos prospects par persona, secteur ou campagne."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateListModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" form="create-list-form">
              Créer la liste
            </Button>
          </>
        }
      >
        <form id="create-list-form" onSubmit={handleCreateList} className="space-y-4 pb-2">
          <Field label="Nom de la liste">
            <Input required autoFocus placeholder="Ex. : Directeurs commerciaux, Fondateurs SaaS…" value={newListName} onChange={(e) => setNewListName(e.target.value)} />
          </Field>
          <div>
            <p className={labelClass}>Couleur</p>
            <div className="flex items-center gap-2" role="radiogroup" aria-label="Couleur">
              {["#592eff", "#21164c", "#1f7a4d", "#9a5b00", "#b42318", "#8a8a94"].map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={newListColor === c}
                  aria-label={c}
                  onClick={() => setNewListColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                    newListColor === c ? "border-ink" : "border-transparent hover:border-line-2"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* Transférer à un collaborateur */}
      <Modal
        open={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setTransferMessage(null);
        }}
        title="Transférer les prospects"
        description={`${selectedIds.size} prospect(s) sélectionné(s) à réassigner.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsTransferModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmTransfer} loading={transferLoading} disabled={!targetMemberId} iconRight={ArrowRight}>
              Confirmer le transfert
            </Button>
          </>
        }
      >
        <div className="space-y-4 pb-2">
          {transferMessage && <Callout tone={transferMessage.includes("succès") ? "ok" : "danger"}>{transferMessage}</Callout>}
          <Field label="Collaborateur destinataire">
            <Select value={targetMemberId} onChange={(e) => setTargetMemberId(e.target.value)}>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.email} ({m.orgRole === "OWNER" ? "Propriétaire" : "Membre"})
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-muted">Les prospects sont déplacés dans une liste du collaborateur ; l'historique est conservé.</p>
        </div>
      </Modal>

      {/* DELETE LIST CONFIRMATION MODAL (ADORA STYLE) */}
      <ConfirmModal
        isOpen={Boolean(listToDeleteModal)}
        onClose={() => {
          if (!isDeletingList) setListToDeleteModal(null);
        }}
        onConfirm={confirmDeleteList}
        isLoading={isDeletingList}
        variant="danger"
        title="Supprimer la liste"
        description="Êtes-vous sûr de vouloir supprimer cette liste ? Les prospects associés ne seront pas supprimés et resteront conservés dans votre base générale."
        itemName={listToDeleteModal?.name}
        itemType="Liste"
        confirmText="Supprimer définitivement"
        cancelText="Annuler"
        warningMessage="Les prospects associés ne seront pas supprimés et resteront conservés dans votre base générale (Tous les prospects)."
      />

      {/* DELETE PROSPECTS CONFIRMATION MODAL (ADORA STYLE) */}
      <ConfirmModal
        isOpen={Boolean(prospectsToDelete)}
        onClose={() => {
          if (!isDeletingProspects) setProspectsToDelete(null);
        }}
        onConfirm={handleConfirmDeleteProspects}
        isLoading={isDeletingProspects}
        variant="danger"
        title={
          prospectsToDelete?.ids.length === 1
            ? "Supprimer le prospect"
            : `Supprimer les ${prospectsToDelete?.ids.length} prospects`
        }
        description={
          prospectsToDelete?.ids.length === 1
            ? "Êtes-vous sûr de vouloir supprimer définitivement ce prospect ? Cette action retirera également ce contact de vos campagnes et de vos listes."
            : `Êtes-vous sûr de vouloir supprimer définitivement ces ${prospectsToDelete?.ids.length} prospects sélectionnés ? Cette action retirera également ces contacts de vos campagnes et de vos listes.`
        }
        itemName={
          prospectsToDelete?.singleProspect
            ? `${prospectsToDelete.singleProspect.firstName || ""} ${prospectsToDelete.singleProspect.lastName || ""}`.trim() ||
              prospectsToDelete.singleProspect.headline ||
              "Prospect"
            : prospectsToDelete
            ? `${prospectsToDelete.ids.length} prospects sélectionnés`
            : undefined
        }
        itemType={prospectsToDelete?.ids.length === 1 ? "Prospect" : "Sélection"}
        confirmText={
          prospectsToDelete?.ids.length === 1
            ? "Supprimer définitivement"
            : `Supprimer les ${prospectsToDelete?.ids.length} prospects`
        }
        cancelText="Annuler"
        warningMessage="Cette action est irréversible. Les prospects supprimés seront retirés de toutes les campagnes en cours et de vos listes."
      />

      {/* EXCEL IMPORT MODAL */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        lists={lists}
        defaultListId={
          selectedListId !== "ALL" && selectedListId !== "DO_NOT_CONTACT"
            ? selectedListId
            : lists[0]?.id
        }
        onSuccess={() => {
          fetchProspects();
          fetchLists();
        }}
      />

      {/* LINKEDIN SEARCH MODAL */}
      <LinkedInSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        lists={lists}
        defaultListId={
          selectedListId !== "ALL" && selectedListId !== "DO_NOT_CONTACT"
            ? selectedListId
            : lists[0]?.id
        }
        onSuccess={() => {
          fetchProspects();
          fetchLists();
        }}
      />

      {/* PROSPECT DETAIL DRAWER */}
      <ProspectDetailDrawer
        prospect={selectedProspect}
        isOpen={Boolean(selectedProspect)}
        onClose={() => setSelectedProspect(null)}
        onUpdate={() => {
          fetchProspects();
        }}
        onDelete={(p) => {
          setProspectsToDelete({
            ids: [p.id],
            singleProspect: p,
          });
        }}
      />

      {/* LINKEDIN REQUIRED MODAL */}
      <LinkedInRequiredModal
        isOpen={showLinkedInRequiredModal}
        onClose={() => setShowLinkedInRequiredModal(false)}
        onConnectLinkedIn={() => openLinkedInModal()}
        featureName={requiredFeatureName}
      />
    </div>
  );
};
