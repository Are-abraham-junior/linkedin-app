import React, { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { apiRequest } from "../../services/api";
import { ExcelImportModal } from "./ExcelImportModal";
import { LinkedInSearchModal } from "./LinkedInSearchModal";
import { ProspectDetailDrawer } from "./ProspectDetailDrawer";
import { ListsSidebar } from "./ListsSidebar";
import { useAuth } from "../../context/AuthContext";
import { LinkedInRequiredModal } from "../common/LinkedInRequiredModal";
import {
  Users,
  Search,
  Filter,
  Plus,
  FileSpreadsheet,
  Download,
  Trash2,
  FolderPlus,
  ExternalLink,
  Mail,
  Phone,
  CheckSquare,
  Square,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Building,
  Briefcase,
  Megaphone,
  Tag,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sliders,
  X,
  GripVertical,
  ChevronDown,
  Rocket,
  Edit2,
  Check,
  ShieldAlert,
  Folder,
  ArrowRightLeft,
  ShieldCheck,
} from "lucide-react";
import { extractCompanyFromHeadline } from "../../utils/companyExtractor";

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

const STORAGE_KEY = "bime_prospects_columns_order_v1";

interface ProspectsViewProps {
  onStartCampaign?: () => void;
}

export const ProspectsView: React.FC<ProspectsViewProps> = ({ onStartCampaign }) => {
  const { user, selectedMemberId, setSelectedMemberId, openLinkedInModal, impersonatedOrg } = useAuth();
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

  // Import dropdown menu
  const [isImportDropdownOpen, setIsImportDropdownOpen] = useState(false);
  const importDropdownRef = useRef<HTMLDivElement>(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const handleBulkDelete = async () => {
    if (!window.confirm(`Supprimer les ${selectedIds.size} prospects sélectionnés ?`)) return;

    try {
      await apiRequest("/prospects/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      setSelectedIds(new Set());
      fetchProspects();
      fetchLists();
    } catch (e) {
      console.error(e);
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

  const handleExportCSV = () => {
    const dataToExport = prospects.filter(
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
    a.download = `bime-link-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
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
          <div className="flex items-center gap-2.5">
            <img
              src={
                p.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  p.firstName + " " + p.lastName
                )}&background=592eff&color=fff`
              }
              alt={p.firstName}
              className="w-7 h-7 rounded-full object-cover border border-[#e0e0db] shrink-0 shadow-2xs"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-bold text-[#21164c] text-xs hover:underline truncate">
                  {p.firstName} {p.lastName}
                </p>
                {p.list?.user?.id && p.list.user.id !== user?.id && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#592eff]/10 text-[#592eff] font-bold border border-[#592eff]/20 shrink-0">
                    👤 {p.list.user.firstName || p.list.user.name || "Collègue"}
                  </span>
                )}
                {p.linkedinUrl && (
                  <a
                    href={p.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[#0a66c2] hover:text-[#004182] transition-colors p-0.5 shrink-0"
                    title="Ouvrir le profil LinkedIn"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <p className="text-[10px] text-[#5f5f69] truncate">{p.location || "Non renseigné"}</p>
            </div>
          </div>
        );

      case "headline":
        return (
          <p className="font-medium text-[#21164c] line-clamp-1 text-[11px]" title={p.headline || ""}>
            {p.headline || "Professionnel"}
          </p>
        );

      case "company": {
        const comp = (p.company && p.company !== "—" ? p.company.trim() : "") || extractCompanyFromHeadline(p.headline);
        return (
          <div className="flex items-center gap-1" title={comp || "Non renseigné"}>
            {comp ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#592eff]/10 text-[#21164c] border border-[#592eff]/20 max-w-[180px] shadow-2xs group-hover:border-[#592eff]/40 transition-colors">
                <Building className="w-3 h-3 text-[#592eff] shrink-0" />
                <span className="truncate">{comp}</span>
              </span>
            ) : (
              <span className="text-[10px] text-[#8a8a93] italic flex items-center gap-1">
                <Building className="w-2.5 h-2.5 text-[#c4c4cc]" /> Indépendant
              </span>
            )}
          </div>
        );
      }

      case "list":
        return (
          <span
            className="badge-tag text-[9px] font-bold py-0.5 px-1.5"
            style={{
              backgroundColor: `${p.list?.color || "#592eff"}15`,
              color: p.list?.color || "#592eff",
              borderColor: `${p.list?.color || "#592eff"}30`,
            }}
          >
            📁 {p.list?.name || "Sans liste"}
          </span>
        );

      case "status":
        return (
          <span
            className={`badge-tag text-[9px] py-0.5 px-1.5 ${
              p.connectionStatus === "CONNECTED"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : p.connectionStatus === "PENDING"
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-[#f5f5f7] text-[#5f5f69] border border-[#e0e0db]"
            }`}
          >
            {p.connectionStatus === "CONNECTED"
              ? "Connecté"
              : p.connectionStatus === "PENDING"
              ? "En attente"
              : "Non connecté"}
          </span>
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
                    className="px-1.5 py-0.5 bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20 rounded font-semibold text-[9px] flex items-center gap-1"
                  >
                    <Megaphone className="w-2 h-2" /> {cp.campaign?.name || "Campagne"}
                  </span>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  alert(`Prêt à ajouter ${p.firstName} à une campagne !`);
                }}
                className="text-[10px] text-[#592eff] hover:text-[#4d25e0] hover:underline font-semibold flex items-center gap-1"
              >
                <Plus className="w-2.5 h-2.5" /> Ajouter à une campagne
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
                className="px-1.5 py-0.5 bg-[#f5f5f7] text-[#5f5f69] border border-[#e0e0db] rounded font-medium text-[9px] flex items-center gap-1"
              >
                <Tag className="w-2 h-2 text-[#592eff]" /> {t}
              </span>
            ))}
            {(p.tags || []).length > 2 && (
              <span className="text-[9px] text-[#5f5f69] font-bold">
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
          <span className="text-[11px] text-[#5f5f69] font-medium flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5 text-[#592eff]" /> {dateStr}
          </span>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="max-w-[1640px] w-full mx-auto px-4 sm:px-6 py-2.5 h-full min-h-0 flex flex-col overflow-hidden animate-in fade-in duration-300">
      {/* 2-Column Waalaxy Layout */}
      <div className="flex items-stretch gap-4 flex-1 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: Dedicated Waalaxy Lists Sidebar */}
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
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* RIGHT COLUMN: Active List Header, Waalaxy Filter Chips & Data Table */}
        <div className="flex-1 min-w-0 h-full flex flex-col gap-2.5 overflow-hidden">
          {/* HERO HEADER OF ACTIVE LIST (Waalaxy Style) */}
          <div className="adora-card p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[#e0e0db] shadow-xs shrink-0">
            <div className="flex items-center gap-3">
              {/* List Icon Avatar */}
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs shrink-0"
                style={{
                  backgroundColor: `${activeListColor}20`,
                  color: activeListColor,
                }}
              >
                {selectedListId === "ALL" ? (
                  <Users className="w-5 h-5" />
                ) : selectedListId === "DO_NOT_CONTACT" ? (
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                ) : (
                  <Folder className="w-5 h-5" />
                )}
              </div>

              {/* Title with Inline Edit option */}
              <div>
                <div className="flex items-center gap-2">
                  {isInlineEditingTitle && selectedListId !== "ALL" && selectedListId !== "DO_NOT_CONTACT" ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRenameList(selectedListId, inlineTitleText);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={inlineTitleText}
                        onChange={(e) => setInlineTitleText(e.target.value)}
                        onBlur={() => handleRenameList(selectedListId, inlineTitleText)}
                        className="text-lg font-extrabold text-[#21164c] px-2 py-0.5 rounded-lg border-2 border-[#592eff] focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="p-1 rounded-lg bg-[#592eff] text-white hover:bg-[#4d25e0]"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-1.5 group">
                      <h1 className="text-lg sm:text-xl font-extrabold text-[#21164c] tracking-tight">
                        {activeListTitle}
                      </h1>
                      {selectedListId !== "ALL" && selectedListId !== "DO_NOT_CONTACT" && (
                        <button
                          type="button"
                          onClick={() => {
                            setInlineTitleText(activeListTitle);
                            setIsInlineEditingTitle(true);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-[#f5f5f7] text-[#8a8a93] hover:text-[#592eff] transition-all"
                          title="Renommer cette liste"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Prospect Count Badge */}
                  <span className="badge-tag bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20 text-[11px] font-bold px-2 py-0.5">
                    👥 {total}
                  </span>
                </div>

                <p className="text-[11px] text-[#5f5f69] mt-0.5">
                  {selectedListId === "ALL"
                    ? "Tous les prospects importés dans votre compte Bime Link."
                    : selectedListId === "DO_NOT_CONTACT"
                    ? "Contacts exclus de vos automatisations et envois de messages."
                    : `Liste dédiée • ${total} prospect(s) qualifié(s).`}
                </p>
              </div>
            </div>

            {/* Top Right Action Buttons (Waalaxy Style) */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Button Start Campaign */}
              <button
                type="button"
                onClick={() => {
                  if (!user?.hasLinkedInAccount) {
                    setRequiredFeatureName("Lancement de campagne");
                    setShowLinkedInRequiredModal(true);
                    return;
                  }
                  if (onStartCampaign) {
                    onStartCampaign();
                  } else {
                    alert(
                      selectedIds.size > 0
                        ? `Lancement d'une campagne pour ${selectedIds.size} prospect(s) sélectionné(s) !`
                        : `Lancement d'une campagne pour la liste "${activeListTitle}" (${total} prospects) !`
                    );
                  }
                }}
                className="py-1.5 px-3 rounded-xl border border-[#592eff]/30 bg-[#592eff]/10 hover:bg-[#592eff]/20 text-[#592eff] text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
              >
                <Rocket className="w-3.5 h-3.5" /> Démarrer une campagne
              </button>

              {/* Primary Unified Import Button with Dropdown Menu */}
              <div className="relative" ref={importDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsImportDropdownOpen(!isImportDropdownOpen)}
                  className="py-1.5 px-3 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#592eff]/25 hover:shadow-lg transition-all active:scale-95"
                >
                  <span>Importer des prospects</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Dropdown Menu */}
                {isImportDropdownOpen && (
                  <div className="absolute right-0 top-11 z-50 w-64 bg-white rounded-2xl border border-[#e0e0db] shadow-2xl p-2 animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => {
                        setIsImportDropdownOpen(false);
                        if (!user?.hasLinkedInAccount) {
                          setRequiredFeatureName("Recherche de profils LinkedIn");
                          setShowLinkedInRequiredModal(true);
                          return;
                        }
                        setIsSearchModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#0a66c2]/10 text-left transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#0a66c2]/15 text-[#0a66c2] flex items-center justify-center shrink-0">
                        <Search className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#21164c] group-hover:text-[#0a66c2]">
                          Recherche LinkedIn
                        </p>
                        <p className="text-[10px] text-[#5f5f69]">
                          Extraction via Unipile par poste, ville ou entreprise
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsImportDropdownOpen(false);
                        setIsExcelModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50 text-left transition-colors group mt-1"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#21164c] group-hover:text-emerald-700">
                          Fichier Excel / CSV
                        </p>
                        <p className="text-[10px] text-[#5f5f69]">
                          Import avec mapping intelligent de colonnes
                        </p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* WAALAXY SEARCH & QUICK FILTER CHIPS BAR */}
          <div className="adora-card p-2.5 px-3.5 space-y-2 border border-[#e0e0db] shadow-xs shrink-0">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <Search className="w-3.5 h-3.5 text-[#8a8a93] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par nom, poste, entreprise, localisation ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#e0e0db] bg-[#fcfcfe] text-xs text-[#21164c] placeholder-[#8a8a93] focus:outline-none focus:border-[#592eff] transition-all"
              />
            </form>

            {/* Horizontal Filter Chips (Waalaxy Style) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 text-xs custom-scrollbar">
              {/* Statut LinkedIn Filter Chip */}
              <div className="relative shrink-0">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`px-2.5 py-1 rounded-xl border text-[11px] font-semibold focus:outline-none cursor-pointer transition-all ${
                    statusFilter !== "ALL"
                      ? "bg-[#592eff]/10 border-[#592eff] text-[#592eff]"
                      : "bg-white border-[#e0e0db] text-[#5f5f69] hover:bg-[#f8f9fc]"
                  }`}
                >
                  <option value="ALL">Statut : Tous</option>
                  <option value="CONNECTED">Connecté</option>
                  <option value="PENDING">En attente</option>
                  <option value="NOT_CONNECTED">Non connecté</option>
                </select>
              </div>

              {/* Email trouvé Toggle Chip */}
              <button
                type="button"
                onClick={() => setHasEmailFilter(!hasEmailFilter)}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-all ${
                  hasEmailFilter
                    ? "bg-sky-50 border-sky-400 text-sky-700 shadow-2xs"
                    : "bg-white border-[#e0e0db] text-[#5f5f69] hover:bg-[#f8f9fc]"
                }`}
              >
                <Mail className="w-3 h-3" /> Email Pro
              </button>

              {/* Campagne Filter Chip */}
              <div className="relative shrink-0">
                <select
                  value={campaignFilter}
                  onChange={(e: any) => setCampaignFilter(e.target.value)}
                  className={`px-2.5 py-1 rounded-xl border text-[11px] font-semibold focus:outline-none cursor-pointer transition-all ${
                    campaignFilter !== "ALL"
                      ? "bg-[#592eff]/10 border-[#592eff] text-[#592eff]"
                      : "bg-white border-[#e0e0db] text-[#5f5f69] hover:bg-[#f8f9fc]"
                  }`}
                >
                  <option value="ALL">Campagnes : Toutes</option>
                  <option value="WITH_CAMPAIGN">En campagne</option>
                  <option value="NO_CAMPAIGN">Sans campagne</option>
                </select>
              </div>

              {/* Collaborateur Filter Chip (Super Admin 360° ou Owner) */}
              {(user?.role === "SUPER_ADMIN" || user?.orgRole === "OWNER") && teamMembers.length > 0 && (
                <div className="relative shrink-0">
                  <select
                    value={selectedMemberId || "ALL"}
                    onChange={(e) => setSelectedMemberId(e.target.value === "ALL" ? null : e.target.value)}
                    className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold focus:outline-none cursor-pointer transition-all ${
                      selectedMemberId
                        ? "bg-[#592eff]/10 border-[#592eff] text-[#592eff]"
                        : "bg-white border-[#e0e0db] text-[#5f5f69] hover:bg-[#f8f9fc]"
                    }`}
                  >
                    <option value="ALL">🌟 Collaborateur : Toute l'équipe (360°)</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        👤 {m.name || m.email} {m.orgRole === "OWNER" ? "(Propriétaire)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1"></div>

              {/* Colonnes Switcher Chip */}
              <button
                type="button"
                onClick={() => setIsColumnOrganizerOpen(true)}
                className="px-2.5 py-1 rounded-xl border border-[#e0e0db] bg-white hover:bg-[#f5f5f7] text-[#5f5f69] text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition-all"
                title="Personnaliser et réorganiser les colonnes"
              >
                <SlidersHorizontal className="w-3 h-3 text-[#592eff]" /> Colonnes
              </button>

              {/* Export CSV Chip */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="p-1.5 rounded-xl border border-[#e0e0db] bg-white hover:bg-[#f5f5f7] text-[#5f5f69] shrink-0 transition-colors"
                title="Exporter en CSV"
              >
                <Download className="w-3 h-3" />
              </button>

              {/* Refresh & Sync Chip */}
              <button
                type="button"
                onClick={handleSyncStatus}
                disabled={isSyncingStatus || loading}
                className="p-1.5 rounded-xl border border-[#e0e0db] bg-white hover:bg-[#f5f5f7] text-[#5f5f69] shrink-0 transition-colors disabled:opacity-50"
                title="Synchroniser le statut de connexion LinkedIn réel depuis Unipile"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingStatus || loading ? "animate-spin text-[#592eff]" : ""}`} />
              </button>
            </div>
          </div>

          {/* Bulk Action Bar (When selected) */}
          {selectedIds.size > 0 && (
            <div className="p-2.5 px-4 rounded-xl bg-[#21164c] text-white flex items-center justify-between shadow-lg shadow-[#21164c]/15 animate-in slide-in-from-top-2 shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-[#a2ea13] animate-pulse"></span>
                <span>{selectedIds.size} prospect(s) sélectionné(s)</span>
              </div>

              <div className="flex items-center gap-2">
                {teamMembers.length > 1 && (
                  <button
                    onClick={() => setIsTransferModalOpen(true)}
                    className="py-1 px-2.5 rounded-lg bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Transférer les prospects à un collègue"
                  >
                    <ArrowRightLeft className="w-3 h-3" /> Transférer
                  </button>
                )}
                <button
                  onClick={handleExportCSV}
                  className="py-1 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3 h-3" /> Exporter
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="py-1 px-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Supprimer
                </button>
              </div>
            </div>
          )}

          {/* PROSPECTS TABLE WITH INTERNAL VERTICAL SCROLL & STICKY HEADER */}
          <div className="adora-card p-0 flex-1 min-h-0 flex flex-col border border-[#e0e0db] shadow-xs overflow-hidden">
            {/* Scrollable Container with Custom Scrollbar */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#fbfbfe] z-10 shadow-2xs border-b border-[#e0e0db]">
                  <tr className="text-[#5f5f69] uppercase font-bold tracking-wider select-none text-[11px]">
                    <th className="py-2 px-3 w-10">
                      <button onClick={toggleSelectAll}>
                        {selectedIds.size > 0 && selectedIds.size === prospects.length ? (
                          <CheckSquare className="w-3.5 h-3.5 text-[#592eff]" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-[#5f5f69]" />
                        )}
                      </button>
                    </th>

                    {/* En-têtes réorganisables par Drag & Drop avec curseur main */}
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
                        <th
                          key={colKey}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          title="Maintenez le clic pour déplacer cette colonne partout dans le tableau"
                          className={`relative py-2 px-2.5 transition-all duration-150 select-none group cursor-grab active:cursor-grabbing hover:bg-[#f3f0ff] rounded-lg ${
                            isDragging
                              ? "opacity-30 bg-[#592eff]/10 border-2 border-dashed border-[#592eff] cursor-grabbing"
                              : ""
                          } ${
                            isBefore
                              ? "border-l-4 border-l-[#592eff] bg-[#592eff]/10 pl-1.5"
                              : ""
                          } ${
                            isAfter
                              ? "border-r-4 border-r-[#592eff] bg-[#592eff]/10 pr-1.5"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 py-0.5">
                            <div className="flex items-center gap-1">
                              <GripVertical className="w-3 h-3 text-[#8a8a93] group-hover:text-[#592eff] transition-colors shrink-0 cursor-grab active:cursor-grabbing" />
                              <span className="font-bold tracking-wide text-[11px] text-[#5f5f69] group-hover:text-[#21164c] transition-colors whitespace-nowrap">
                                {colDef.label}
                              </span>
                            </div>

                            {/* Boutons rapides gauche/droite au survol */}
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-[#e0e0db] rounded p-0.5 shadow-xs ml-1">
                              <button
                                type="button"
                                disabled={isFirst}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveColumn(index, "LEFT");
                                }}
                                className="p-0.5 hover:bg-[#592eff]/10 text-[#5f5f69] hover:text-[#592eff] disabled:opacity-20 rounded"
                                title="Déplacer vers la gauche"
                              >
                                <ArrowLeft className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                disabled={isLast}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveColumn(index, "RIGHT");
                                }}
                                className="p-0.5 hover:bg-[#592eff]/10 text-[#5f5f69] hover:text-[#592eff] disabled:opacity-20 rounded"
                                title="Déplacer vers la droite"
                              >
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        </th>
                      );
                    })}

                    <th className="py-2 text-right pr-3 text-[11px]">Action</th>
                  </tr>
                </thead>
                <tbody ref={tbodyRef} className="divide-y divide-[#e0e0db]/50">
                  {loading ? (
                    <tr>
                      <td colSpan={columnsOrder.length + 2} className="py-10 text-center text-[#5f5f69]">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#592eff] mb-2" />
                        Chargement des prospects...
                      </td>
                    </tr>
                  ) : prospects.length === 0 ? (
                    <tr>
                      <td colSpan={columnsOrder.length + 2} className="py-10 text-center text-[#5f5f69]">
                        <Users className="w-8 h-8 mx-auto text-[#e0e0db] mb-2" />
                        <p className="font-bold text-[#21164c] text-xs">Aucun prospect dans cette vue</p>
                        <p className="text-[11px] text-[#5f5f69] mt-0.5">
                          Importez un fichier Excel ou lancez une recherche LinkedIn pour enrichir votre liste.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    prospects.map((p) => {
                      const isSelected = selectedIds.has(p.id);

                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedProspect(p)}
                          className={`hover:bg-[#f8f9fc] transition-colors cursor-pointer border-b border-[#e0e0db]/40 ${
                            isSelected ? "bg-[#592eff]/5" : ""
                          }`}
                        >
                          {/* Checkbox */}
                          <td
                            className="py-2 px-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectOne(p.id);
                            }}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-[#592eff]" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-[#5f5f69]" />
                            )}
                          </td>

                          {/* Cellules dynamiques ordonnées */}
                          {columnsOrder.map((colKey) => (
                            <td key={colKey} className="py-2 px-2.5">
                              {renderCellContent(p, colKey)}
                            </td>
                          ))}

                          {/* Action détail CRM */}
                          <td className="py-2 text-right pr-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProspect(p);
                              }}
                              className="p-1 rounded-lg border border-[#e0e0db] hover:bg-[#592eff]/10 hover:border-[#592eff]/30 text-[#353241] hover:text-[#592eff] transition-colors"
                              title="Ouvrir la fiche CRM"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PINNED BOTTOM WAALAXY PAGINATION & NAVIGATION BAR */}
            <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2 bg-white border-t border-[#e0e0db]/80 text-xs select-none">
              {/* Left: Rows Per Page & Display Range */}
              <div className="flex items-center gap-2.5 text-[#5f5f69]">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-[#8a8a93] text-[11px]">Afficher :</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-0.5 rounded-lg border border-[#e0e0db] bg-white text-[#21164c] font-bold text-xs focus:outline-none focus:border-[#592eff] cursor-pointer hover:border-[#592eff]/40 transition-colors shadow-2xs"
                  >
                    <option value={10}>10 par page</option>
                    <option value={20}>20 par page</option>
                    <option value={50}>50 par page</option>
                  </select>
                </div>

                <span className="text-[#e0e0db] font-light">•</span>

                <span className="font-semibold text-[#21164c] text-[11px]">
                  {total === 0
                    ? "0 prospect"
                    : `Affichage de ${(currentPage - 1) * pageSize + 1} à ${Math.min(
                        currentPage * pageSize,
                        total
                      )} sur ${total} prospects`}
                </span>
              </div>

              {/* Right: Page Navigation Controls (Waalaxy Style) */}
              <div className="flex items-center gap-1">
                {/* Previous Button */}
                <button
                  type="button"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-xl border border-[#e0e0db] bg-white text-[#5f5f69] hover:bg-[#f8f9fc] hover:text-[#592eff] disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-[#5f5f69] transition-all flex items-center gap-1 font-semibold shadow-2xs text-[11px]"
                  title="Page précédente"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Précédent</span>
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1 mx-0.5">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      return (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      );
                    })
                    .map((page, idx, arr) => {
                      const prevPage = arr[idx - 1];
                      const hasGap = prevPage && page - prevPage > 1;

                      return (
                        <React.Fragment key={page}>
                          {hasGap && (
                            <span className="px-1 text-[#8a8a93] font-bold text-xs">...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-all ${
                              currentPage === page
                                ? "bg-[#592eff] text-white shadow-sm shadow-[#592eff]/25 scale-105"
                                : "bg-white border border-[#e0e0db] text-[#5f5f69] hover:bg-[#f5f3ff] hover:text-[#592eff] hover:border-[#592eff]/30"
                            }`}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                {/* Next Button */}
                <button
                  type="button"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-xl border border-[#e0e0db] bg-white text-[#5f5f69] hover:bg-[#f8f9fc] hover:text-[#592eff] disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-[#5f5f69] transition-all flex items-center gap-1 font-semibold shadow-2xs text-[11px]"
                  title="Page suivante"
                >
                  <span className="hidden sm:inline">Suivant</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RENAME LIST MODAL */}
      {renameListModal && (
        <div className="fixed inset-0 bg-[#21164c]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="adora-card bg-white w-full max-w-md p-6 sm:p-8 shadow-2xl relative">
            <h2 className="text-lg font-bold text-[#21164c] mb-1">Renommer la liste</h2>
            <p className="text-xs text-[#5f5f69] mb-4">
              Modifiez le libellé de votre liste de prospects.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRenameList(renameListModal.id, renameInputText);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                  Nom de la liste
                </label>
                <input
                  type="text"
                  required
                  value={renameInputText}
                  onChange={(e) => setRenameInputText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs focus:outline-none focus:border-[#592eff]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e0e0db]">
                <button
                  type="button"
                  onClick={() => setRenameListModal(null)}
                  className="px-4 py-2 rounded-xl border border-[#e0e0db] text-xs font-semibold text-[#5f5f69] hover:bg-[#f5f5f7]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COLUMN ORGANIZER MODAL */}
      {isColumnOrganizerOpen && (
        <div className="fixed inset-0 bg-[#21164c]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="adora-card bg-white w-full max-w-lg p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setIsColumnOrganizerOpen(false)}
              className="absolute right-5 top-5 p-2 rounded-full hover:bg-[#f5f5f7] text-[#5f5f69]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#21164c]">
                  Organisation des Colonnes
                </h2>
                <p className="text-xs text-[#5f5f69]">
                  Glissez-déposez les colonnes pour personnaliser leur ordre d'affichage.
                </p>
              </div>
            </div>

            <div className="my-4 space-y-2 border border-[#e0e0db] rounded-2xl p-3 bg-[#f8f9fc] max-h-[340px] overflow-y-auto">
              <p className="text-[11px] text-[#5f5f69] italic mb-2 flex items-center gap-1">
                <GripVertical className="w-3.5 h-3.5 text-[#592eff]" />
                Glissez-déposez les colonnes ou utilisez les boutons pour modifier leur ordre.
              </p>
              {columnsOrder.map((colKey, index) => {
                const colDef = DEFAULT_COLUMNS.find((c) => c.key === colKey);
                if (!colDef) return null;

                const isFirst = index === 0;
                const isLast = index === columnsOrder.length - 1;
                const isDragging = modalDraggedIndex === index;
                const isDragOver = modalDragOverIndex === index;

                return (
                  <div
                    key={colKey}
                    draggable
                    onDragStart={(e) => handleModalDragStart(e, index)}
                    onDragOver={(e) => handleModalDragOver(e, index)}
                    onDrop={(e) => handleModalDrop(e, index)}
                    onDragEnd={handleModalDragEnd}
                    className={`flex items-center justify-between p-2.5 bg-white rounded-xl border text-xs shadow-2xs transition-all cursor-grab active:cursor-grabbing select-none ${
                      isDragging
                        ? "opacity-30 border-dashed border-[#592eff] bg-[#592eff]/10 cursor-grabbing"
                        : isDragOver
                        ? "border-[#592eff] ring-2 ring-[#592eff]/20 bg-[#592eff]/5"
                        : "border-[#e0e0db] hover:border-[#592eff]/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-[#8a8a93] group-hover:text-[#592eff] cursor-grab active:cursor-grabbing shrink-0" />
                      <span className="w-5 h-5 rounded-full bg-[#f5f5f7] text-[#5f5f69] font-bold text-[10px] flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="font-bold text-[#21164c]">{colDef.label}</span>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => moveColumn(index, "LEFT")}
                        className="px-2 py-1 rounded-lg border border-[#e0e0db] hover:bg-[#592eff]/10 hover:border-[#592eff]/30 text-[#353241] text-[11px] font-semibold flex items-center gap-1 disabled:opacity-30 transition-colors"
                      >
                        <ArrowLeft className="w-3 h-3" /> Monter
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => moveColumn(index, "RIGHT")}
                        className="px-2 py-1 rounded-lg border border-[#e0e0db] hover:bg-[#592eff]/10 hover:border-[#592eff]/30 text-[#353241] text-[11px] font-semibold flex items-center gap-1 disabled:opacity-30 transition-colors"
                      >
                        <ArrowRight className="w-3 h-3" /> Descendre
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#e0e0db]">
              <button
                type="button"
                onClick={resetColumnsOrder}
                className="text-xs font-bold text-[#5f5f69] hover:text-[#592eff] flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser l'ordre
              </button>
              <button
                type="button"
                onClick={() => setIsColumnOrganizerOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25"
              >
                Enregistrer & Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE LIST MODAL */}
      {isCreateListModalOpen && (
        <div className="fixed inset-0 bg-[#21164c]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="adora-card bg-white w-full max-w-md p-6 sm:p-8 shadow-2xl relative">
            <h2 className="text-xl font-bold text-[#21164c] mb-1">Créer une nouvelle liste</h2>
            <p className="text-xs text-[#5f5f69] mb-5">
              Organisez vos prospects par persona, secteur ou campagne.
            </p>

            <form onSubmit={handleCreateList} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                  Nom de la liste
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Directeurs Commerciaux CI, Fondateurs SaaS..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs focus:outline-none focus:border-[#592eff]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-2">
                  Couleur du dossier
                </label>
                <div className="flex items-center gap-3">
                  {["#592eff", "#2ed6ff", "#a2ea13", "#ff7a00", "#ff2e7a", "#8c52ff"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewListColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        newListColor === c ? "scale-125 ring-2 ring-offset-2 ring-[#592eff]" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    ></button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e0e0db]">
                <button
                  type="button"
                  onClick={() => setIsCreateListModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#e0e0db] text-xs font-semibold text-[#5f5f69] hover:bg-[#f5f5f7]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25"
                >
                  Créer la liste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEAM TRANSFER MODAL */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-[#21164c]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="adora-card bg-white w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setIsTransferModalOpen(false);
                setTransferMessage(null);
              }}
              className="absolute right-5 top-5 p-2 rounded-full hover:bg-[#f5f5f7] text-[#5f5f69] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#21164c]">Transférer les prospects</h3>
                <p className="text-xs text-[#5f5f69]">
                  {selectedIds.size} prospect(s) sélectionné(s) à réassigner
                </p>
              </div>
            </div>

            {transferMessage && (
              <div className={`mb-4 p-3 rounded-xl text-xs font-semibold ${
                transferMessage.includes("succès")
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {transferMessage}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-2">
                  Collaborateur destinataire
                </label>
                <select
                  value={targetMemberId}
                  onChange={(e) => setTargetMemberId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#e0e0db] bg-white text-xs font-semibold text-[#21164c] focus:outline-none focus:border-[#592eff] cursor-pointer"
                >
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.email} ({m.orgRole === "OWNER" ? "Propriétaire" : "Membre"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-xs text-[#5f5f69] space-y-1">
                <p className="font-semibold text-[#21164c] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#592eff]" />
                  Anti-collision conservé
                </p>
                <p className="text-[11px]">
                  Les prospects seront transférés dans une liste du collaborateur sans rupture d'historique ni risque de doublon.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e0e0db]">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#e0e0db] text-xs font-semibold text-[#5f5f69] hover:bg-[#f5f5f7] cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={transferLoading || !targetMemberId}
                  onClick={handleConfirmTransfer}
                  className="px-5 py-2 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {transferLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Transfert...
                    </>
                  ) : (
                    <>
                      <span>Confirmer le transfert</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE LIST CONFIRMATION MODAL (ADORA STYLE) */}
      {listToDeleteModal && (
        <div className="fixed inset-0 bg-[#21164c]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="adora-card bg-white w-full max-w-md p-6 sm:p-7 shadow-2xl relative animate-in zoom-in-95">
            <button
              onClick={() => setListToDeleteModal(null)}
              className="absolute right-5 top-5 p-2 rounded-full hover:bg-[#f5f5f7] text-[#5f5f69] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 shadow-sm">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#21164c]">Supprimer la liste</h3>
                <p className="text-xs text-[#5f5f69]">Action irréversible sur l'organisation</p>
              </div>
            </div>

            <div className="p-4 bg-rose-50/70 rounded-2xl border border-rose-100/80 text-xs text-rose-950 mb-5 space-y-1.5">
              <p className="font-semibold">
                Êtes-vous sûr de vouloir supprimer la liste <strong className="font-extrabold text-rose-600">« {listToDeleteModal.name} »</strong> ?
              </p>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                ℹ️ Les prospects associés ne seront pas supprimés et resteront conservés dans votre base générale (Tous les prospects).
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#e0e0db]/60">
              <button
                type="button"
                onClick={() => setListToDeleteModal(null)}
                className="px-4 py-2.5 rounded-xl border border-[#e0e0db] text-xs font-semibold text-[#5f5f69] hover:bg-[#f5f5f7] transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeletingList}
                onClick={confirmDeleteList}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/25 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingList ? "Suppression..." : "Supprimer définitivement"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
