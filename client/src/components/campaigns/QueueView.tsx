import React, { useState, useEffect, useCallback } from "react";
import { Clock, Send, UserPlus, Eye, UserCheck, Calendar, Trash2, RefreshCw, Search, ExternalLink, ShieldCheck, X } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge, StatusDot } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { useConfirm } from "../ui/ConfirmProvider";
import { EmptyState } from "../ui/EmptyState";
import { Checkbox, Input, Select } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Skeleton } from "../ui/Skeleton";
import { Pagination, Table, Td, TdActions, Th, Tr } from "../ui/Table";
import { Tabs } from "../ui/Tabs";
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
  const confirm = useConfirm();
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
  const [pageSize, setPageSize] = useState<number>(15);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [scheduleInfo, setScheduleInfo] = useState<{
    workingDays: string[];
    workingHoursStart: string;
    workingHoursEnd: string;
    timezone: string;
  } | null>(null);

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
        limit: pageSize.toString(),
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
  }, [page, pageSize, statusFilter, selectedCampaignId, selectedActionType, searchQuery]);

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

  const fetchScheduleInfo = async () => {
    try {
      const res = await apiRequest<{ schedule: any }>("/queue/schedule");
      if (res.success && res.schedule) {
        setScheduleInfo(res.schedule);
      }
    } catch (err) {
      console.error("Erreur récupération planning:", err);
    }
  };

  useEffect(() => {
    fetchScheduleInfo();
  }, []);

  const getWorkingSlotStatus = () => {
    if (!scheduleInfo) return { inHours: true, message: "" };
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: scheduleInfo.timezone || "Africa/Abidjan",
        weekday: "short",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      let day = "";
      let hour = 0;
      let min = 0;
      for (const p of parts) {
        if (p.type === "weekday") {
          const map: Record<string, string> = {
            Sun: "SUN",
            Mon: "MON",
            Tue: "TUE",
            Wed: "WED",
            Thu: "THU",
            Fri: "FRI",
            Sat: "SAT",
          };
          day = map[p.value] || p.value.toUpperCase().slice(0, 3);
        } else if (p.type === "hour") {
          hour = parseInt(p.value, 10);
        } else if (p.type === "minute") {
          min = parseInt(p.value, 10);
        }
      }
      const days = scheduleInfo.workingDays || ["MON", "TUE", "WED", "THU", "FRI"];
      if (!days.includes(day)) {
        return { inHours: false, message: `En veille (Jour non actif : ${day})` };
      }
      const curM = hour * 60 + min;
      const [sh, sm] = (scheduleInfo.workingHoursStart || "08:00").split(":").map(Number);
      const [eh, em] = (scheduleInfo.workingHoursEnd || "19:00").split(":").map(Number);
      const startM = (sh || 8) * 60 + (sm || 0);
      const endM = (eh || 19) * 60 + (em || 0);
      if (curM < startM || curM > endM) {
        return {
          inHours: false,
          message: `En veille nocturne (Plage : ${scheduleInfo.workingHoursStart || "08:00"} - ${scheduleInfo.workingHoursEnd || "19:00"})`,
        };
      }
      return {
        inHours: true,
        message: `Plage active (${scheduleInfo.workingHoursStart} - ${scheduleInfo.workingHoursEnd})`,
      };
    } catch {
      return { inHours: true, message: "" };
    }
  };

  useEffect(() => {
    fetchQueue();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Handle single item deletion
  const handleDeleteItem = async (id: string) => {
    if (!(await confirm({ title: "Retirer cette action ?", description: "Elle ne sera pas exécutée et disparaîtra de la file d'attente.", confirmText: "Retirer" }))) return;

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
    if (!(await confirm({ title: `Retirer ${selectedIds.length} action(s) ?`, description: "Elles ne seront pas exécutées et disparaîtront de la file d'attente.", confirmText: "Retirer" }))) return;

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

  // Type d'action : icône nue + libellé
  const actionTypeMeta: Record<string, { icon: React.ElementType; label: string }> = {
    INVITATION: { icon: UserPlus, label: "Invitation" },
    MESSAGE: { icon: Send, label: "Message" },
    VISIT_PROFILE: { icon: Eye, label: "Visite de profil" },
    FOLLOW: { icon: UserCheck, label: "Suivi de profil" },
  };
  const renderActionTypeBadge = (type: string) => {
    const meta = actionTypeMeta[type] ?? { icon: Clock, label: type };
    const Icon = meta.icon;
    return (
      <span className="inline-flex items-center gap-2 text-ink">
        <Icon className="h-4 w-4 text-muted" strokeWidth={1.75} aria-hidden />
        {meta.label}
      </span>
    );
  };

  const slotStatus = getWorkingSlotStatus();
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  const quotaRows = [
    { key: "invitations", label: "Invitations", icon: UserPlus, data: stats?.quotas.invitations, fallback: 30 },
    { key: "messages", label: "Messages", icon: Send, data: stats?.quotas.messages, fallback: 70 },
    { key: "profileVisits", label: "Visites de profil", icon: Eye, data: stats?.quotas.profileVisits, fallback: 120 },
    { key: "profileFollows", label: "Suivis de profil", icon: UserCheck, data: stats?.quotas.profileFollows, fallback: 80 },
  ];

  return (
    <div className="space-y-4">
      {/* Ligne de statut + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <StatusDot tone={stats?.isQueueActive ? "ok" : "warn"}>{stats?.isQueueActive ? "File active" : "File en pause"}</StatusDot>
          {!slotStatus.inHours && (
            <Badge tone="neutral" title="Les actions sont différées pour respecter vos horaires d'activité.">
              {slotStatus.message}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <IconButton label="Rafraîchir la file" icon={RefreshCw} size="md" onClick={() => fetchQueue()} disabled={loading} className={loading ? "[&>svg]:animate-spin" : undefined} />
          <Button variant="secondary" icon={Calendar} onClick={() => setIsScheduleModalOpen(true)}>
            Planifier l'activité
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Colonne principale */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8 xl:col-span-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              variant="segmented"
              size="sm"
              aria-label="Canal"
              value={platformTab}
              onChange={(v) => setPlatformTab(v as "LINKEDIN" | "EMAIL")}
              items={[
                { id: "LINKEDIN", label: "LinkedIn", count: stats?.totalQueuedLinkedIn || 0 },
                { id: "EMAIL", label: "E-mail", count: 0 },
              ]}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Select
                inline
                size="sm"
                aria-label="Statut"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="QUEUED">En attente</option>
                <option value="FAILED">Échouées</option>
                <option value="SUCCESS">Terminées</option>
                <option value="ALL">Tous les statuts</option>
              </Select>
              <Select
                inline
                size="sm"
                aria-label="Campagne"
                value={selectedCampaignId}
                onChange={(e) => {
                  setSelectedCampaignId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Toutes les campagnes</option>
                {campaignsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select
                inline
                size="sm"
                aria-label="Type d'action"
                value={selectedActionType}
                onChange={(e) => {
                  setSelectedActionType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Tous les types</option>
                <option value="INVITATION">Invitations</option>
                <option value="MESSAGE">Messages</option>
                <option value="VISIT_PROFILE">Visites de profil</option>
                <option value="FOLLOW">Suivis de profil</option>
              </Select>
              <Input
                size="sm"
                leftIcon={Search}
                placeholder="Rechercher…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-40 sm:w-48"
              />
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2 shadow-pop">
              <span className="text-sm text-ink">
                <span className="font-medium">{selectedIds.length}</span> sélectionnée(s)
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="secondary" size="sm" icon={Clock} onClick={() => handleBatchReschedule("hours", 2)} disabled={actionInProgress}>
                  Reporter de 2 h
                </Button>
                <Button variant="secondary" size="sm" icon={Calendar} onClick={() => handleBatchReschedule("tomorrow_morning")} disabled={actionInProgress}>
                  Demain 9 h
                </Button>
                <Button variant="danger" size="sm" icon={Trash2} onClick={handleBatchDelete} disabled={actionInProgress}>
                  Retirer
                </Button>
                <IconButton label="Tout désélectionner" icon={X} onClick={() => setSelectedIds([])} />
              </div>
            </div>
          )}

          <Card padding="none" className="flex flex-col overflow-hidden">
            <div className="custom-scrollbar max-h-[620px] overflow-auto">
              <Table>
                <thead>
                  <tr>
                    <Th className="w-10">
                      <Checkbox checked={allSelected} onChange={handleToggleSelectAll} aria-label="Tout sélectionner" />
                    </Th>
                    <Th>Type</Th>
                    <Th>Prospect</Th>
                    <Th>Campagne</Th>
                    <Th>Exécution</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <Td colSpan={6}>
                          <Skeleton className="h-4 w-full" />
                        </Td>
                      </tr>
                    ))
                  ) : items.length === 0 ? (
                    <tr>
                      <Td colSpan={6} className="border-b-0">
                        <EmptyState
                          bare
                          icon={Clock}
                          title="Aucune action dans cette vue"
                          description={
                            statusFilter === "FAILED"
                              ? "Aucune action échouée."
                              : statusFilter === "SUCCESS"
                                ? "Aucune action terminée pour l'instant."
                                : "Toutes les actions ont été traitées ou aucune campagne n'est active."
                          }
                        />
                      </Td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const isSelected = selectedIds.includes(item.id);
                      const execInfo = formatExecutionTime(item.scheduledFor);
                      const prospectName = `${item.prospect?.firstName || ""} ${item.prospect?.lastName || ""}`.trim() || "Prospect";
                      return (
                        <Tr key={item.id} selected={isSelected}>
                          <Td>
                            <Checkbox checked={isSelected} onChange={() => handleToggleSelectItem(item.id)} aria-label={`Sélectionner ${prospectName}`} />
                          </Td>
                          <Td>{renderActionTypeBadge(item.actionType)}</Td>
                          <Td>
                            <div className="flex items-center gap-2.5">
                              <Avatar name={prospectName} src={item.prospect?.avatarUrl} size="md" />
                              <div className="min-w-0 max-w-[220px]">
                                <div className="flex items-center gap-1.5">
                                  <p className="truncate font-medium text-ink">{prospectName}</p>
                                  {item.prospect?.linkedinUrl && (
                                    <a href={item.prospect.linkedinUrl} target="_blank" rel="noreferrer" className="text-muted hover:text-ink" aria-label="Profil LinkedIn">
                                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                                    </a>
                                  )}
                                </div>
                                <p className="truncate text-xs text-muted">{item.prospect?.company || item.prospect?.headline || "—"}</p>
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <span className="inline-block max-w-[180px] truncate text-muted">{item.campaign?.name || "Campagne"}</span>
                          </Td>
                          <Td>
                            {item.status === "FAILED" ? (
                              <div className="flex flex-col gap-0.5">
                                <Badge tone="danger" dot>
                                  Échouée
                                </Badge>
                                {item.errorMessage && (
                                  <span className="max-w-[200px] truncate text-xs text-muted" title={item.errorMessage}>
                                    {item.errorMessage.includes("invalid_recipient") ? "Destinataire invalide" : item.errorMessage}
                                  </span>
                                )}
                              </div>
                            ) : item.status === "SUCCESS" ? (
                              <Badge tone="ok" dot>
                                Terminée
                              </Badge>
                            ) : item.status === "EXECUTING" ? (
                              <Badge tone="accent" dot>
                                En cours
                              </Badge>
                            ) : (
                              <span className={execInfo.isImminent ? "font-medium text-ink" : "text-muted"}>{execInfo.label}</span>
                            )}
                          </Td>
                          <TdActions>
                            {item.status === "FAILED" && <IconButton label="Relancer cette action" icon={RefreshCw} onClick={() => handleRetryItem(item.id)} />}
                            <IconButton label="Retirer de la file" icon={Trash2} tone="danger" onClick={() => handleDeleteItem(item.id)} />
                          </TdActions>
                        </Tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </div>

            {totalCount > 0 && (
              <Pagination
                page={page}
                pageCount={totalPages}
                onPage={(p) => setPage(p)}
                summary={
                  <span>
                    {items.length} sur {totalCount} action(s)
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
                      setPage(1);
                    }}
                  >
                    {[15, 30, 50].map((size) => (
                      <option key={size} value={size}>
                        {size} par page
                      </option>
                    ))}
                  </Select>
                }
              />
            )}
          </Card>
        </div>

        {/* Quotas journaliers */}
        <Card padding="md" className="space-y-4 lg:col-span-4 xl:col-span-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Quotas journaliers</h2>
            <p className="mt-0.5 text-sm text-muted">Remis à zéro chaque jour, cible dérivée de votre offre.</p>
          </div>
          <div className="divide-y divide-line">
            {quotaRows.map((q) => {
              const Icon = q.icon;
              const sent = q.data?.sent ?? 0;
              const max = q.data?.max ?? q.fallback;
              const pct = Math.min(100, Math.round((sent / (max || 1)) * 100));
              return (
                <div key={q.key} className="py-3 first:pt-0 last:pb-0">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm text-ink">
                      <Icon className="h-4 w-4 text-muted" strokeWidth={1.75} aria-hidden />
                      {q.label}
                    </span>
                    <span className="tabular-nums text-xs text-muted">
                      <span className="text-ink">{sent}</span> / {max}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="flex items-start gap-2 border-t border-line pt-4 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            Protection anti-blocage : 90 s d'intervalle minimum entre chaque envoi.
          </p>
        </Card>
      </div>

      <ScheduleActivityModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSaved={() => {
          fetchScheduleInfo();
          fetchQueue();
        }}
      />
    </div>
  );
};
