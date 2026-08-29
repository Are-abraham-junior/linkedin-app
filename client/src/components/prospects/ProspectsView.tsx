import React, { useState, useEffect } from "react";
import { apiRequest } from "../../services/api";
import { ExcelImportModal } from "./ExcelImportModal";
import { LinkedInSearchModal } from "./LinkedInSearchModal";
import { ProspectDetailDrawer } from "./ProspectDetailDrawer";
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

export const ProspectsView: React.FC = () => {
  const [lists, setLists] = useState<any[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("ALL");
  const [prospects, setProspects] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

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

  // Modals & Drawers
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListColor, setNewListColor] = useState("#592eff");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Drag handlers for table header
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
      const res = await apiRequest<{ lists: any[] }>("/lists");
      if (res.success && res.lists) {
        setLists(res.lists);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProspects = async () => {
    setLoading(true);
    try {
      let query = `?search=${encodeURIComponent(searchTerm)}`;
      if (selectedListId !== "ALL") query += `&listId=${selectedListId}`;
      if (statusFilter !== "ALL") query += `&connectionStatus=${statusFilter}`;
      if (hasEmailFilter) query += `&hasEmail=true`;

      const res = await apiRequest<{
        total: number;
        prospects: any[];
      }>(`/prospects${query}`);

      if (res.success) {
        setProspects(res.prospects || []);
        setTotal(res.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  useEffect(() => {
    fetchProspects();
  }, [selectedListId, statusFilter, hasEmailFilter]);

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

  const handleExportCSV = () => {
    const dataToExport = prospects.filter(
      (p) => selectedIds.size === 0 || selectedIds.has(p.id)
    );

    const headers = [
      "Prospect",
      "Nom",
      "Prénom",
      "Poste",
      "Entreprise",
      "Liste",
      "Statut LinkedIn",
      "Campagnes",
      "Tags",
      "Date d'importation",
      "Email",
      "Téléphone",
      "URL LinkedIn",
    ];
    const csvRows = [headers.join(",")];

    dataToExport.forEach((p) => {
      const importedDate = p.createdAt
        ? new Date(p.createdAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—";

      const campaignNames =
        p.campaignProspects && p.campaignProspects.length > 0
          ? p.campaignProspects.map((cp: any) => cp.campaign?.name).filter(Boolean).join(" ; ")
          : "Aucune";

      csvRows.push(
        [
          `"${p.firstName || ""} ${p.lastName || ""}"`,
          `"${p.lastName || ""}"`,
          `"${p.firstName || ""}"`,
          `"${p.headline || ""}"`,
          `"${p.company || ""}"`,
          `"${p.list?.name || ""}"`,
          `"${p.connectionStatus || ""}"`,
          `"${campaignNames}"`,
          `"${(p.tags || []).join(" ; ")}"`,
          `"${importedDate}"`,
          `"${p.email || ""}"`,
          `"${p.phone || ""}"`,
          `"${p.linkedinUrl || ""}"`,
        ].join(",")
      );
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospects-bime-link-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Rendering individual table cell based on column key
  const renderCellContent = (p: any, key: ColumnKey) => {
    switch (key) {
      case "prospect":
        return (
          <div className="flex items-center gap-3">
            <img
              src={
                p.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  p.firstName + " " + p.lastName
                )}&background=592eff&color=fff`
              }
              alt={p.firstName}
              className="w-9 h-9 rounded-full object-cover border border-[#e0e0db]"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-[#21164c] text-sm hover:underline">
                  {p.firstName} {p.lastName}
                </p>
                {p.linkedinUrl && (
                  <a
                    href={p.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[#592eff] hover:text-[#4d25e0]"
                    title="Ouvrir sur LinkedIn"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-[11px] text-[#5f5f69]">{p.location || "Non renseigné"}</p>
            </div>
          </div>
        );

      case "headline":
        return (
          <p className="font-semibold text-[#21164c] line-clamp-1">
            {p.headline || "Professionnel"}
          </p>
        );

      case "company": {
        const comp = (p.company && p.company !== "—" ? p.company.trim() : "") || extractCompanyFromHeadline(p.headline);
        return (
          <div className="flex items-center gap-1.5" title={comp || "Non renseigné"}>
            {comp ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#592eff]/10 text-[#21164c] border border-[#592eff]/20 max-w-[210px] shadow-2xs group-hover:border-[#592eff]/40 transition-colors">
                <Building className="w-3.5 h-3.5 text-[#592eff] shrink-0" />
                <span className="truncate">{comp}</span>
              </span>
            ) : (
              <span className="text-[11px] text-[#8a8a93] italic flex items-center gap-1">
                <Building className="w-3 h-3 text-[#c4c4cc]" /> Indépendant
              </span>
            )}
          </div>
        );
      }

      case "list":
        return (
          <span
            className="badge-tag text-[10px] font-bold"
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
            className={`badge-tag text-[10px] ${
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
        const campaignsList = p.campaignProspects || [];
        return (
          <div>
            {campaignsList.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {campaignsList.map((cp: any) => (
                  <span
                    key={cp.campaign?.id || Math.random()}
                    className="px-2 py-0.5 bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20 rounded font-semibold text-[10px] flex items-center gap-1"
                  >
                    <Megaphone className="w-2.5 h-2.5" /> {cp.campaign?.name || "Campagne"}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-[#5f5f69] italic">Aucune</span>
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
                className="px-1.5 py-0.5 bg-[#f5f5f7] text-[#5f5f69] border border-[#e0e0db] rounded font-medium text-[10px] flex items-center gap-1"
              >
                <Tag className="w-2.5 h-2.5 text-[#592eff]" /> {t}
              </span>
            ))}
            {(p.tags || []).length > 2 && (
              <span className="text-[10px] text-[#5f5f69] font-bold">
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
          <span className="text-xs text-[#5f5f69] font-medium flex items-center gap-1">
            <Calendar className="w-3 h-3 text-[#592eff]" /> {dateStr}
          </span>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge-tag bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20">
              <Users className="w-3.5 h-3.5" /> Base Prospects & Listes
            </span>
            <span className="text-xs text-[#5f5f69] font-semibold">
              {total} prospect(s) au total
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#21164c] tracking-tight">
            Mes Prospects LinkedIn
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="py-2.5 px-4 rounded-xl border border-[#0a66c2]/30 bg-[#0a66c2]/5 hover:bg-[#0a66c2]/10 text-[#0a66c2] text-xs font-bold flex items-center gap-2 transition-all"
          >
            <Search className="w-4 h-4" /> Recherche LinkedIn
          </button>

          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="py-2.5 px-4 rounded-xl border border-[#e0e0db] bg-white hover:bg-[#f5f5f7] text-[#353241] text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Importer Excel / CSV
          </button>

          <button
            onClick={() => setIsCreateListModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 flex items-center gap-2 transition-all transform active:scale-95"
          >
            <FolderPlus className="w-4 h-4" /> Nouvelle Liste
          </button>
        </div>
      </div>

      {/* Prospect Lists Navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedListId("ALL")}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            selectedListId === "ALL"
              ? "bg-[#21164c] text-white shadow-md shadow-[#21164c]/20"
              : "bg-white text-[#5f5f69] border border-[#e0e0db] hover:bg-[#f8f9fc]"
          }`}
        >
          <span>📁 Tous les prospects</span>
          <span className="text-[11px] opacity-75">({total})</span>
        </button>

        {lists.map((l) => {
          const isSelected = selectedListId === l.id;
          return (
            <div key={l.id} className="relative group">
              <button
                onClick={() => setSelectedListId(l.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  isSelected
                    ? "bg-[#592eff] text-white shadow-md shadow-[#592eff]/25"
                    : "bg-white text-[#353241] border border-[#e0e0db] hover:bg-[#f8f9fc]"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: l.color || "#592eff" }}
                ></span>
                <span>{l.name}</span>
                <span className="text-[11px] opacity-75">({l.prospectsCount || 0})</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Filter, Search & Column Switcher Bar */}
      <div className="adora-card p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom, entreprise, titre ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#e0e0db] bg-white text-xs text-[#353241] focus:outline-none focus:border-[#592eff]"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {/* Connection status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#e0e0db] bg-white text-xs text-[#353241] font-semibold focus:outline-none focus:border-[#592eff]"
          >
            <option value="ALL">Tous les statuts LinkedIn</option>
            <option value="CONNECTED">Connecté</option>
            <option value="PENDING">En attente</option>
            <option value="NOT_CONNECTED">Non connecté</option>
          </select>

          {/* Has email toggle */}
          <button
            onClick={() => setHasEmailFilter(!hasEmailFilter)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              hasEmailFilter
                ? "bg-[#2ed6ff]/15 border-[#2ed6ff]/40 text-[#0089a8]"
                : "bg-white border-[#e0e0db] text-[#5f5f69] hover:bg-[#f8f9fc]"
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Email trouvé
          </button>

          {/* Column Switcher / Organizer Button */}
          <button
            onClick={() => setIsColumnOrganizerOpen(true)}
            className="px-3 py-2 rounded-xl border border-[#592eff]/30 bg-[#592eff]/10 hover:bg-[#592eff]/20 text-[#592eff] text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Personnaliser et déplacer les colonnes"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Colonnes
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="p-2 rounded-xl border border-[#e0e0db] bg-white hover:bg-[#f5f5f7] text-[#353241] text-xs transition-colors"
            title="Exporter en CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={fetchProspects}
            className="p-2 rounded-xl border border-[#e0e0db] bg-white hover:bg-[#f5f5f7] text-[#353241] text-xs transition-colors"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Bulk Action Bar (When selected) */}
      {selectedIds.size > 0 && (
        <div className="p-3.5 rounded-2xl bg-[#21164c] text-white flex items-center justify-between shadow-lg shadow-[#21164c]/15 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-[#a2ea13] animate-pulse"></span>
            <span>{selectedIds.size} prospect(s) sélectionné(s)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Exporter
            </button>
            <button
              onClick={handleBulkDelete}
              className="py-1.5 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Supprimer
            </button>
          </div>
        </div>
      )}

      {/* Prospects Table */}
      <div className="adora-card p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#e0e0db] text-[#5f5f69] uppercase font-bold tracking-wider select-none">
                <th className="pb-3 w-10">
                  <button onClick={toggleSelectAll}>
                    {selectedIds.size > 0 && selectedIds.size === prospects.length ? (
                      <CheckSquare className="w-4 h-4 text-[#592eff]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#5f5f69]" />
                    )}
                  </button>
                </th>

                {/* En-têtes de colonnes réorganisables par Glisser-Déposer (Drag & Drop) ou flèches */}
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
                      className={`relative pb-3 px-3 transition-all duration-150 select-none group cursor-grab active:cursor-grabbing hover:bg-[#f3f0ff] rounded-xl ${
                        isDragging
                          ? "opacity-30 bg-[#592eff]/10 border-2 border-dashed border-[#592eff] cursor-grabbing"
                          : ""
                      } ${
                        isBefore
                          ? "border-l-4 border-l-[#592eff] bg-[#592eff]/10 pl-2"
                          : ""
                      } ${
                        isAfter
                          ? "border-r-4 border-r-[#592eff] bg-[#592eff]/10 pr-2"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 py-0.5">
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="w-3.5 h-3.5 text-[#8a8a93] group-hover:text-[#592eff] transition-colors shrink-0 cursor-grab active:cursor-grabbing" />
                          <span className="font-bold tracking-wide text-xs text-[#5f5f69] group-hover:text-[#21164c] transition-colors whitespace-nowrap">
                            {colDef.label}
                          </span>
                        </div>

                        {/* Boutons rapides gauche/droite au survol */}
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-[#e0e0db] rounded-lg p-0.5 shadow-xs ml-1">
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
                            <ArrowLeft className="w-3 h-3" />
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
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </th>
                  );
                })}

                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0db]/50">
              {loading ? (
                <tr>
                  <td colSpan={columnsOrder.length + 2} className="py-12 text-center text-[#5f5f69]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#592eff] mb-2" />
                    Chargement des prospects...
                  </td>
                </tr>
              ) : prospects.length === 0 ? (
                <tr>
                  <td colSpan={columnsOrder.length + 2} className="py-12 text-center text-[#5f5f69]">
                    <Users className="w-10 h-10 mx-auto text-[#e0e0db] mb-2" />
                    <p className="font-bold text-[#21164c] text-sm">Aucun prospect dans cette vue</p>
                    <p className="text-xs text-[#5f5f69] mt-1">
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
                      className={`hover:bg-[#f8f9fc] transition-colors cursor-pointer ${
                        isSelected ? "bg-[#592eff]/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectOne(p.id);
                        }}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#592eff]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#5f5f69]" />
                        )}
                      </td>

                      {/* Render cells in user's chosen column order */}
                      {columnsOrder.map((colKey) => (
                        <td key={colKey} className="py-3.5 px-2">
                          {renderCellContent(p, colKey)}
                        </td>
                      ))}

                      {/* Detail action */}
                      <td className="py-3.5 text-right pr-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProspect(p);
                          }}
                          className="p-1.5 rounded-lg border border-[#e0e0db] hover:bg-[#592eff]/10 hover:border-[#592eff]/30 text-[#353241] hover:text-[#592eff] transition-colors"
                          title="Ouvrir la fiche CRM"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  Modifiez l'ordre d'affichage des en-têtes du tableau selon vos préférences.
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

      {/* EXCEL IMPORT MODAL */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        lists={lists}
        defaultListId={selectedListId !== "ALL" ? selectedListId : undefined}
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
        defaultListId={selectedListId !== "ALL" ? selectedListId : undefined}
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
    </div>
  );
};
