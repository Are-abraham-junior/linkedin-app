import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Send,
  UserPlus,
  Eye,
  UserCheck,
  Calendar,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  CheckSquare,
  Square,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Check,
  Sparkles,
} from "lucide-react";
import { apiRequest } from "../../services/api";
import { ScheduleActivityModal } from "./ScheduleActivityModal";

interface QueueItem {
  id: string;
  accountId: string;
  prospectId: string;
  campaignId: string;
  actionType: "INVITATION" | "MESSAGE" | "VISIT_PROFILE" | "FOLLOW" | "DELAY";
  payload: any;
  scheduledFor: string;
  status: string;
  executedAt?: string;
  errorMessage?: string;
  createdAt: string;
  prospect?: {
    id: string;
    firstName: string;
    lastName: string;
    headline?: string;
    company?: string;
    avatarUrl?: string;
    linkedinUrl?: string;
    connectionStatus?: string;
  };
  campaign?: {
    id: string;
    name: string;
    status: string;
    type: string;
  };
}

interface QuotaDetails {
  sent: number;
  max: number;
  remaining: number;
}

interface QueueStats {
  totalQueuedLinkedIn: number;
  totalQueuedEmail: number;
  isQueueActive: boolean;
  quotas: {
    invitations: QuotaDetails;
    messages: QuotaDetails;
    profileVisits: QuotaDetails;
    profileFollows: QuotaDetails;
  };
}

export const QueueView: React.FC = () => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [campaignsList, setCampaignsList] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [platformTab, setPlatformTab] = useState<"LINKEDIN" | "EMAIL">("LINKEDIN");
  const [statusFilter, setStatusFilter] = useState<string>("QUEUED");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("ALL");
  const [selectedActionType, setSelectedActionType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);

  // Fetch Queue Data
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        status: statusFilter,
      });

      if (selectedCampaignId !== "ALL") params.append("campaignId", selectedCampaignId);
      if (selectedActionType !== "ALL") params.append("actionType", selectedActionType);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await apiRequest<{
        items: QueueItem[];
        pagination: { page: number; limit: number; totalCount: number; totalPages: number };
        stats: QueueStats;
      }>(`/queue?${params.toString()}`);

      if (res.success && res.data) {
        setItems(res.data.items || []);
        setStats(res.data.stats || null);
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalCount(res.data.pagination.totalCount || 0);
      }
    } catch (err) {
      console.error("Erreur récupération file d'attente:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, selectedCampaignId, selectedActionType, searchQuery]);

  // Handle single item retry
  const handleRetryItem = async (id: string) => {
    try {
      const res = await apiRequest(`/queue/${id}/retry`, { method: "POST" });
      if (res.success) {
        fetchQueue();
      }
    } catch (err) {
      console.error("Erreur relance action:", err);
    }
  };

  // Fetch Campaigns for dropdown filter
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const res = await apiRequest<{ campaigns: { id: string; name: string }[] }>("/campaigns");
        if (res.success && Array.isArray(res.campaigns)) {
          setCampaignsList(res.campaigns);
        }
      } catch (err) {
        console.error("Erreur récupération listes campagnes:", err);
      }
    };
    fetchCampaigns();
  }, []);

  useEffect(() => {
    fetchQueue();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Handle single item deletion
  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir retirer cette action de la file d'attente ?")) return;

    try {
      const res = await apiRequest(`/queue/${id}`, { method: "DELETE" });
      if (res.success) {
        setItems((prev) => prev.filter((item) => item.id !== id));
        setSelectedIds((prev) => prev.filter((i) => i !== id));
        fetchQueue();
      }
    } catch (err) {
      console.error("Erreur suppression action:", err);
    }
  };

  // Handle batch deletion
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Retirer ${selectedIds.length} action(s) de la file d'attente ?`)) return;

    setActionInProgress(true);
    try {
      const res = await apiRequest("/queue/batch-delete", {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.success) {
        setSelectedIds([]);
        fetchQueue();
      }
    } catch (err) {
      console.error("Erreur suppression en lot:", err);
    } finally {
      setActionInProgress(false);
    }
  };

  // Handle batch rescheduling
  const handleBatchReschedule = async (mode: "hours" | "tomorrow_morning", hours?: number) => {
    if (selectedIds.length === 0) return;

    setActionInProgress(true);
    try {
      const res = await apiRequest("/queue/batch-reschedule", {
        method: "POST",
        body: JSON.stringify({
          ids: selectedIds,
          mode,
          hours,
        }),
      });
      if (res.success) {
        setSelectedIds([]);
        fetchQueue();
      }
    } catch (err) {
      console.error("Erreur report en lot:", err);
    } finally {
      setActionInProgress(false);
    }
  };

  // Select / Deselect all
  const handleToggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Helper formatting for execution relative time
  const formatExecutionTime = (dateString: string): { label: string; isImminent: boolean } => {
    const target = new Date(dateString);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / (60 * 1000));
    const diffHours = Math.round(diffMs / (60 * 60 * 1000));

    if (diffMs <= 30 * 1000) {
      return { label: "dans quelques secondes", isImminent: true };
    }
    if (diffMins < 60) {
      return { label: `dans ${diffMins} minute${diffMins > 1 ? "s" : ""}`, isImminent: diffMins <= 5 };
    }
    if (diffHours < 24 && target.getDate() === now.getDate()) {
      const timeStr = target.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      return { label: `aujourd'hui à ${timeStr}`, isImminent: false };
    }

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (target.getDate() === tomorrow.getDate()) {
      const timeStr = target.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      return { label: `demain à ${timeStr}`, isImminent: false };
    }

    const dateStr = target.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    const timeStr = target.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return { label: `${dateStr} à ${timeStr}`, isImminent: false };
  };

  // Render Action Type Icon & Badge
  const renderActionTypeBadge = (type: string) => {
    switch (type) {
      case "INVITATION":
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#592eff]/10 flex items-center justify-center text-[#592eff]">
              <UserPlus className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-[#21164c]">Invitation</span>
          </div>
        );
      case "MESSAGE":
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#2ed6ff]/10 flex items-center justify-center text-[#0284c7]">
              <Send className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-[#21164c]">Message</span>
          </div>
        );
      case "VISIT_PROFILE":
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Eye className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-[#21164c]">Visite de profil</span>
          </div>
        );
      case "FOLLOW":
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
              <UserCheck className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-[#21164c]">Suivi de profil</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-[#21164c]">{type}</span>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 max-w-[1640px] mx-auto w-full overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[#21164c] tracking-tight">File d'attente</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                stats?.isQueueActive
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  stats?.isQueueActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              {stats?.isQueueActive ? "Active" : "En pause"}
            </span>
          </div>
          <p className="text-xs text-[#5f5f69] mt-1">
            Suivi en temps réel des actions planifiées et cadence d'exécution
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchQueue()}
            disabled={loading}
            className="p-2.5 bg-white border border-[#e0e0db] hover:border-[#592eff]/40 rounded-2xl text-[#5f5f69] hover:text-[#592eff] transition-all shadow-sm"
            title="Rafraîchir la file"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#592eff]" : ""}`} />
          </button>

          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="px-4 py-2.5 bg-white hover:bg-[#fafaff] border border-[#e0e0db] hover:border-[#592eff]/40 text-[#21164c] font-bold text-xs rounded-2xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-[#592eff]" />
            Planifier l'activité
          </button>
        </div>
      </div>

      {/* Main Container : Grid 2 Columns (Left: Table ~72%, Right: Quotas Sidebar ~28%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-0">
        {/* Left Column (Table & Filters) */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-4 min-w-0">
          {/* Platform Tabs & Filter Bar */}
          <div className="bg-white p-3 rounded-2xl border border-[#e0e0db] shadow-sm flex flex-wrap items-center justify-between gap-3">
            {/* Platform selector */}
            <div className="flex items-center gap-1 bg-[#f5f5f7] p-1 rounded-xl">
              <button
                onClick={() => setPlatformTab("LINKEDIN")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  platformTab === "LINKEDIN"
                    ? "bg-white text-[#21164c] shadow-sm"
                    : "text-[#5f5f69] hover:text-[#21164c]"
                }`}
              >
                <span>LinkedIn</span>
                <span className="bg-[#592eff]/10 text-[#592eff] text-[10px] px-1.5 py-0.2 rounded-full">
                  {stats?.totalQueuedLinkedIn || 0}
                </span>
              </button>

              <button
                onClick={() => setPlatformTab("EMAIL")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  platformTab === "EMAIL"
                    ? "bg-white text-[#21164c] shadow-sm"
                    : "text-[#5f5f69] hover:text-[#21164c]"
                }`}
              >
                <span>Email</span>
                <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0.2 rounded-full">
                  0
                </span>
              </button>
            </div>

            {/* Campaign, Action & Status Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status select */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="appearance-none bg-[#f8f9fc] border border-[#e0e0db] hover:border-[#592eff]/40 text-[#21164c] text-xs font-bold px-3 py-1.5 pr-8 rounded-xl focus:outline-none cursor-pointer"
                >
                  <option value="QUEUED">Statut : En attente</option>
                  <option value="FAILED">Statut : Échouées</option>
                  <option value="SUCCESS">Statut : Terminées</option>
                  <option value="ALL">Statut : Tous</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#5f5f69] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Campaign select */}
              <div className="relative">
                <select
                  value={selectedCampaignId}
                  onChange={(e) => {
                    setSelectedCampaignId(e.target.value);
                    setPage(1);
                  }}
                  className="appearance-none bg-[#f8f9fc] border border-[#e0e0db] hover:border-[#592eff]/40 text-[#21164c] text-xs font-bold px-3 py-1.5 pr-8 rounded-xl focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Mes campagnes (Toutes)</option>
                  {campaignsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#5f5f69] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Action type select */}
              <div className="relative">
                <select
                  value={selectedActionType}
                  onChange={(e) => {
                    setSelectedActionType(e.target.value);
                    setPage(1);
                  }}
                  className="appearance-none bg-[#f8f9fc] border border-[#e0e0db] hover:border-[#592eff]/40 text-[#21164c] text-xs font-bold px-3 py-1.5 pr-8 rounded-xl focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Type d'action (Tous)</option>
                  <option value="INVITATION">Invitations</option>
                  <option value="MESSAGE">Messages</option>
                  <option value="VISIT_PROFILE">Visites de profil</option>
                  <option value="FOLLOW">Suivis de profil</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#5f5f69] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#5f5f69] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8 pr-3 py-1.5 bg-[#f8f9fc] border border-[#e0e0db] focus:border-[#592eff] rounded-xl text-xs text-[#21164c] placeholder-[#5f5f69]/60 focus:outline-none transition-colors w-36 sm:w-44"
                />
              </div>
            </div>
          </div>

          {/* Batch Actions Toolbar (Appears when items are selected) */}
          {selectedIds.length > 0 && (
            <div className="bg-[#592eff] text-white p-3 rounded-2xl shadow-lg shadow-[#592eff]/20 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="bg-white/20 px-2.5 py-1 rounded-lg">
                  {selectedIds.length} sélectionnée(s)
                </span>
                <span>Actions groupées :</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBatchReschedule("hours", 2)}
                  disabled={actionInProgress}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" /> Reporter de 2h
                </button>

                <button
                  onClick={() => handleBatchReschedule("tomorrow_morning")}
                  disabled={actionInProgress}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" /> Demain 09h
                </button>

                <button
                  onClick={handleBatchDelete}
                  disabled={actionInProgress}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>

                <button
                  onClick={() => setSelectedIds([])}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-all ml-1"
                  title="Désélectionner tout"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-white rounded-3xl border border-[#e0e0db] shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e0e0db]/60 text-[11px] font-bold text-[#5f5f69] uppercase tracking-wider bg-[#fafaff]">
                    <th className="py-3.5 px-4 w-10">
                      <button
                        onClick={handleToggleSelectAll}
                        className="text-[#5f5f69] hover:text-[#592eff] transition-colors"
                      >
                        {items.length > 0 && selectedIds.length === items.length ? (
                          <CheckSquare className="w-4 h-4 text-[#592eff]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Prospect</th>
                    <th className="py-3.5 px-4">Campagne</th>
                    <th className="py-3.5 px-4">Statut / Exécution</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0e0db]/60">
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-8 h-8 border-3 border-[#592eff] border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs text-[#5f5f69] font-semibold">
                            Chargement de la file d'attente...
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                          <div className="w-12 h-12 rounded-full bg-[#592eff]/10 flex items-center justify-center text-[#592eff] mb-3">
                            <Clock className="w-6 h-6" />
                          </div>
                          <h4 className="text-sm font-bold text-[#21164c]">
                            Aucune action dans cette vue
                          </h4>
                          <p className="text-xs text-[#5f5f69] mt-1">
                            {statusFilter === "FAILED"
                              ? "Aucune action échouée. Tout fonctionne parfaitement !"
                              : statusFilter === "SUCCESS"
                              ? "Aucune action terminée pour l'instant."
                              : "Toutes les actions ont été traitées ou aucune campagne n'est active actuellement."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const isSelected = selectedIds.includes(item.id);
                      const execInfo = formatExecutionTime(item.scheduledFor);

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-[#f8f9fc] transition-colors ${
                            isSelected ? "bg-[#592eff]/5" : ""
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleToggleSelectItem(item.id)}
                              className="text-[#5f5f69] hover:text-[#592eff] transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-[#592eff]" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          {/* Action Type */}
                          <td className="py-3.5 px-4">
                            {renderActionTypeBadge(item.actionType)}
                          </td>

                          {/* Prospect */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={
                                  item.prospect?.avatarUrl ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    `${item.prospect?.firstName || "P"} ${item.prospect?.lastName || ""}`
                                  )}&background=592eff&color=fff`
                                }
                                alt={item.prospect?.firstName}
                                className="w-8 h-8 rounded-full object-cover border border-[#e0e0db]"
                              />
                              <div className="min-w-0 max-w-[220px]">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-bold text-[#21164c] truncate">
                                    {item.prospect?.firstName} {item.prospect?.lastName}
                                  </p>
                                  {item.prospect?.linkedinUrl && (
                                    <a
                                      href={item.prospect.linkedinUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[#5f5f69] hover:text-[#592eff]"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#5f5f69] truncate">
                                  {item.prospect?.company || item.prospect?.headline || "—"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Campaign */}
                          <td className="py-3.5 px-4">
                            <span className="text-xs font-semibold text-[#21164c] bg-[#f8f9fc] border border-[#e0e0db] px-2.5 py-1 rounded-xl truncate max-w-[180px] inline-block">
                              {item.campaign?.name || "Campagne"}
                            </span>
                          </td>

                          {/* Execution Timing / Status */}
                          <td className="py-3.5 px-4">
                            {item.status === "FAILED" ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md w-fit">
                                  <AlertCircle className="w-3 h-3" /> Échouée
                                </span>
                                {item.errorMessage && (
                                  <span className="text-[10px] text-red-500 truncate max-w-[180px]" title={item.errorMessage}>
                                    {item.errorMessage.includes("invalid_recipient")
                                      ? "Destinataire invalide"
                                      : item.errorMessage}
                                  </span>
                                )}
                              </div>
                            ) : item.status === "SUCCESS" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md w-fit">
                                <Check className="w-3 h-3" /> Terminée
                              </span>
                            ) : item.status === "EXECUTING" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md w-fit animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> En cours...
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-xs font-bold ${
                                    execInfo.isImminent ? "text-[#592eff] animate-pulse" : "text-[#5f5f69]"
                                  }`}
                                >
                                  {execInfo.label}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Single Action Menu */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.status === "FAILED" && (
                                <button
                                  onClick={() => handleRetryItem(item.id)}
                                  className="px-2.5 py-1 text-xs font-bold text-[#592eff] bg-[#592eff]/10 hover:bg-[#592eff] hover:text-white rounded-lg transition-all flex items-center gap-1"
                                  title="Réessayer cette action"
                                >
                                  <RefreshCw className="w-3 h-3" /> Relancer
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 hover:bg-red-50 text-[#5f5f69] hover:text-red-600 rounded-lg transition-colors"
                                title="Retirer de la file"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-[#e0e0db]/60 flex items-center justify-between bg-[#fafaff]">
                <p className="text-xs text-[#5f5f69]">
                  Affichage de <span className="font-bold text-[#21164c]">{items.length}</span> sur{" "}
                  <span className="font-bold text-[#21164c]">{totalCount}</span> actions
                </p>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-[#e0e0db] bg-white text-[#21164c] disabled:opacity-40 hover:bg-[#f8f9fc] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-[#21164c] px-3">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-[#e0e0db] bg-white text-[#21164c] disabled:opacity-40 hover:bg-[#f8f9fc] transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column : Quotas Journaliers Sidebar (Style Waalaxy) */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-[#e0e0db] shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-black text-[#21164c] tracking-tight">
                Quotas journaliers
              </h2>
              <span className="text-[10px] bg-[#592eff]/10 text-[#592eff] font-bold px-2 py-0.5 rounded-full">
                24h
              </span>
            </div>
            <p className="text-[11px] text-[#5f5f69] mb-5">
              Ces quotas sont mis à jour quotidiennement.
            </p>

            {/* LinkedIn Header */}
            <h3 className="text-xs font-bold text-[#21164c] uppercase tracking-wider mb-3">
              LinkedIn
            </h3>

            {/* Quotas List */}
            <div className="space-y-3">
              {/* Invitations */}
              <div className="bg-[#f8f9fc] p-3.5 rounded-2xl border border-[#e0e0db]/80 transition-all hover:border-[#592eff]/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-[#592eff]/10 flex items-center justify-center text-[#592eff]">
                      <UserPlus className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[#21164c] uppercase">Invitations</p>
                      <p className="text-[11px] text-[#5f5f69]">
                        <span className="font-bold text-[#592eff]">
                          {stats?.quotas.invitations.remaining ?? 30}
                        </span>{" "}
                        restants aujourd'hui
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[#e0e0db]/60 h-1.5 rounded-full overflow-hidden mb-1">
                  <div
                    className="bg-[#592eff] h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((stats?.quotas.invitations.sent ?? 0) /
                            (stats?.quotas.invitations.max || 30)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-[#5f5f69]">
                  <span>{stats?.quotas.invitations.sent ?? 0}</span>
                  <span>{stats?.quotas.invitations.max ?? 30}</span>
                </div>
              </div>

              {/* Messages */}
              <div className="bg-[#f8f9fc] p-3.5 rounded-2xl border border-[#e0e0db]/80 transition-all hover:border-[#2ed6ff]/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-[#2ed6ff]/10 flex items-center justify-center text-[#0284c7]">
                      <Send className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[#21164c] uppercase">Messages</p>
                      <p className="text-[11px] text-[#5f5f69]">
                        <span className="font-bold text-[#0284c7]">
                          {stats?.quotas.messages.remaining ?? 70}
                        </span>{" "}
                        restants aujourd'hui
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[#e0e0db]/60 h-1.5 rounded-full overflow-hidden mb-1">
                  <div
                    className="bg-[#2ed6ff] h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((stats?.quotas.messages.sent ?? 0) /
                            (stats?.quotas.messages.max || 70)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-[#5f5f69]">
                  <span>{stats?.quotas.messages.sent ?? 0}</span>
                  <span>{stats?.quotas.messages.max ?? 70}</span>
                </div>
              </div>

              {/* Visites de profil */}
              <div className="bg-[#f8f9fc] p-3.5 rounded-2xl border border-[#e0e0db]/80 transition-all hover:border-amber-400/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                      <Eye className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[#21164c] uppercase">
                        Visites de profil
                      </p>
                      <p className="text-[11px] text-[#5f5f69]">
                        <span className="font-bold text-amber-600">
                          {stats?.quotas.profileVisits.remaining ?? 120}
                        </span>{" "}
                        restants aujourd'hui
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full bg-[#e0e0db]/60 h-1.5 rounded-full overflow-hidden mb-1">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((stats?.quotas.profileVisits.sent ?? 0) /
                            (stats?.quotas.profileVisits.max || 120)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-[#5f5f69]">
                  <span>{stats?.quotas.profileVisits.sent ?? 0}</span>
                  <span>{stats?.quotas.profileVisits.max ?? 120}</span>
                </div>
              </div>

              {/* Suivis de profil */}
              <div className="bg-[#f8f9fc] p-3.5 rounded-2xl border border-[#e0e0db]/80 transition-all hover:border-purple-400/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                      <UserCheck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[#21164c] uppercase">
                        Suivis de profil
                      </p>
                      <p className="text-[11px] text-[#5f5f69]">
                        <span className="font-bold text-purple-600">
                          {stats?.quotas.profileFollows.remaining ?? 80}
                        </span>{" "}
                        restants aujourd'hui
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full bg-[#e0e0db]/60 h-1.5 rounded-full overflow-hidden mb-1">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((stats?.quotas.profileFollows.sent ?? 0) /
                            (stats?.quotas.profileFollows.max || 80)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-[#5f5f69]">
                  <span>{stats?.quotas.profileFollows.sent ?? 0}</span>
                  <span>{stats?.quotas.profileFollows.max ?? 80}</span>
                </div>
              </div>
            </div>

            {/* Safety badge */}
            <div className="mt-5 p-3 bg-[#592eff]/5 rounded-2xl border border-[#592eff]/10 flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#592eff] shrink-0" />
              <p className="text-[11px] text-[#21164c] leading-tight">
                Protection anti-blocage active : 90s d'intervalle minimum entre chaque envoi.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Activity Modal */}
      <ScheduleActivityModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSaved={fetchQueue}
      />
    </div>
  );
};
