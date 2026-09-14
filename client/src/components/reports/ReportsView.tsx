import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  FileBarChart,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  Users,
  Send,
  UserCheck,
  MessageSquare,
  Reply,
  Eye,
  Loader2,
  Check,
  AlertCircle,
  Contact,
  Mail,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type {
  CampaignReport,
  ReportCampaign,
  ReportSettings,
  ReportHistoryEntry,
  ReportEmailFrequency,
} from "../../types";
import {
  exportReportToExcel,
  exportReportToPdf,
  exportContactsToExcel,
  mergeTimelines,
  fillTimeline,
  CAMPAIGN_STATUS_LABELS,
  fmtDate,
} from "../../utils/reportExport";

type Preset = "7" | "30" | "90" | "custom";
type ExportKind = "pdf" | "xlsx" | "contacts";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PAUSED: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-sky-50 text-sky-700 border-sky-200",
  ARCHIVED: "bg-slate-100 text-slate-600 border-slate-200",
  DRAFT: "bg-slate-50 text-slate-500 border-slate-200",
};

const HISTORY_KIND_LABELS: Record<ReportHistoryEntry["kind"], string> = {
  PDF: "Rapport PDF",
  XLSX: "Rapport Excel",
  CONTACTS: "Contacts Excel",
};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  return isoDay(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#21164c] text-white p-3.5 rounded-2xl shadow-xl text-xs space-y-1.5 border border-white/20">
      <div className="font-extrabold text-[12px] text-[#a2ea13] border-b border-white/15 pb-1.5">{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-white/80">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
            {entry.name} :
          </span>
          <span className="font-bold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const DeltaBadge: React.FC<{ value: number | null | undefined; label: string }> = ({ value, label }) => {
  if (value === null || value === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#9a9aa5]" title={label}>
        <Minus className="w-3 h-3" /> —
      </span>
    );
  }
  const up = value > 0;
  const flat = value === 0;
  const cls = flat ? "text-[#5f5f69] bg-[#f5f5f7]" : up ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50";
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls}`} title={label}>
      <Icon className="w-3 h-3" />
      {up ? "+" : ""}
      {value} %
    </span>
  );
};

export const ReportsView: React.FC = () => {
  const { user, impersonatedOrg } = useAuth();

  const [preset, setPreset] = useState<Preset>("30");
  const [from, setFrom] = useState<string>(daysAgo(29));
  const [to, setTo] = useState<string>(isoDay(new Date()));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [includeProspects, setIncludeProspects] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("ALL");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const [report, setReport] = useState<CampaignReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState<string | null>(null);

  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [history, setHistory] = useState<ReportHistoryEntry[]>([]);

  const canPickMember = user?.role === "SUPER_ADMIN" || user?.orgRole === "OWNER";

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      setFrom(daysAgo(Number(p) - 1));
      setTo(isoDay(new Date()));
    }
  };

  const buildQuery = (details: boolean, ids: string[] = selectedIds) => {
    const params = new URLSearchParams({ from, to, compare: "1" });
    if (ids.length) params.set("campaignIds", ids.join(","));
    if (canPickMember && selectedMemberId !== "ALL") params.set("memberId", selectedMemberId);
    if (details) params.set("details", "1");
    return `/reports/campaigns?${params.toString()}`;
  };

  const fetchReport = async () => {
    if (from > to) {
      setError("La date de début doit précéder la date de fin.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await apiRequest<CampaignReport>(buildQuery(false));
    if (res.success) setReport(res as unknown as CampaignReport);
    else setError(res.error || "Impossible de charger le rapport.");
    setLoading(false);
  };

  const fetchSettings = async () => {
    const res = await apiRequest<{ settings: ReportSettings }>("/reports/settings");
    if (res.success && res.settings) setSettings(res.settings);
  };

  const fetchHistory = async () => {
    const res = await apiRequest<{ history: ReportHistoryEntry[] }>("/reports/history");
    if (res.success && Array.isArray(res.history)) setHistory(res.history);
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, selectedIds.join(","), selectedMemberId, impersonatedOrg]);

  useEffect(() => {
    fetchSettings();
    fetchHistory();
    if (canPickMember) {
      apiRequest<{ members: any[] }>("/team/members").then((res) => {
        if (res.success && Array.isArray(res.members)) setTeamMembers(res.members);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPickMember, impersonatedOrg]);

  // Liste complète des campagnes du périmètre (sans filtre d'ids) pour le sélecteur
  const [allCampaigns, setAllCampaigns] = useState<ReportCampaign[]>([]);
  useEffect(() => {
    if (report && selectedIds.length === 0) setAllCampaigns(report.campaigns);
  }, [report, selectedIds.length]);

  const selectableCampaigns = useMemo(
    () => allCampaigns.filter((c) => includeArchived || c.status !== "ARCHIVED"),
    [allCampaigns, includeArchived]
  );

  const toggleCampaign = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Le rapport affiché exclut les archivées sauf demande explicite
  const visibleReport = useMemo<CampaignReport | null>(() => {
    if (!report) return null;
    if (includeArchived || selectedIds.length > 0) return report;
    return { ...report, campaigns: report.campaigns.filter((c) => c.status !== "ARCHIVED") };
  }, [report, includeArchived, selectedIds.length]);

  const chartData = useMemo(() => {
    if (!visibleReport) return [];
    return fillTimeline(mergeTimelines(visibleReport.campaigns), from, to).map((p) => ({
      ...p,
      label: new Date(p.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    }));
  }, [visibleReport, from, to]);

  // Résumé + comparaison recalculés sur les campagnes visibles
  const vs = useMemo(() => {
    if (!visibleReport) return null;
    const cs = visibleReport.campaigns;
    const sum = (k: keyof ReportCampaign["stats"]) => cs.reduce((acc, c) => acc + (c.stats[k] as number), 0);
    const prevSum = (k: keyof NonNullable<ReportCampaign["previousStats"]>) =>
      cs.reduce((acc, c) => acc + (c.previousStats?.[k] ?? 0), 0);
    const hasCmp = !!visibleReport.comparison;
    const d = (cur: number, prev: number) => (!hasCmp || prev === 0 ? null : Math.round(((cur - prev) / prev) * 100));
    const totalProspects = sum("totalProspects");
    const accepted = sum("acceptedCount");
    const replied = sum("repliedCount");
    const invitesSent = sum("invitesSent");
    const messagesSent = sum("messagesSent");
    const repliesReceived = sum("repliesReceived");
    const visits = sum("visits");
    return {
      campaigns: cs.length,
      totalProspects,
      acceptedCount: accepted,
      invitesSent,
      messagesSent,
      repliesReceived,
      visits,
      follows: sum("follows"),
      acceptanceRate: totalProspects ? Math.round((accepted / totalProspects) * 100) : 0,
      replyRate: accepted ? Math.round((replied / accepted) * 100) : 0,
      deltas: {
        invitesSent: d(invitesSent, prevSum("invitesSent")),
        messagesSent: d(messagesSent, prevSum("messagesSent")),
        repliesReceived: d(repliesReceived, prevSum("repliesReceived")),
        visits: d(visits, prevSum("visits")),
      },
      prevPeriod: visibleReport.comparison?.period || null,
    };
  }, [visibleReport]);

  const prevLabel = vs?.prevPeriod ? `vs ${fmtDate(vs.prevPeriod.from)} → ${fmtDate(vs.prevPeriod.to)}` : "";
  const plural = (n: number, s: string) => `${n} ${s}${n > 1 ? "s" : ""}`;
  const cards = vs
    ? [
        { label: "Prospects enrôlés", value: vs.totalProspects, icon: Users, sub: plural(vs.campaigns, "campagne"), delta: undefined as number | null | undefined },
        { label: "Invitations envoyées", value: vs.invitesSent, icon: Send, sub: "sur la période", delta: vs.deltas.invitesSent },
        { label: "Taux d'acceptation", value: `${vs.acceptanceRate} %`, icon: UserCheck, sub: `${vs.acceptedCount} acceptées (cumul)`, delta: undefined },
        { label: "Messages envoyés", value: vs.messagesSent, icon: MessageSquare, sub: "sur la période", delta: vs.deltas.messagesSent },
        { label: "Taux de réponse", value: `${vs.replyRate} %`, icon: Reply, sub: `${plural(vs.repliesReceived, "réponse")} sur la période`, delta: vs.deltas.repliesReceived },
        { label: "Visites / Suivis", value: `${vs.visits} / ${vs.follows}`, icon: Eye, sub: "sur la période", delta: vs.deltas.visits },
      ]
    : [];

  const recordHistory = async (entry: Omit<ReportHistoryEntry, "id" | "createdAt" | "userId" | "userName">) => {
    const res = await apiRequest("/reports/history", { method: "POST", body: JSON.stringify(entry) });
    if (res.success) fetchHistory();
  };

  /** Récupère le rapport détaillé pour les campagnes visibles (ou un sous-ensemble). */
  const fetchDetailed = async (ids?: string[]): Promise<CampaignReport> => {
    const targetIds =
      ids ?? (selectedIds.length === 0 && !includeArchived && visibleReport ? visibleReport.campaigns.map((c) => c.id) : selectedIds);
    const res = await apiRequest<CampaignReport>(buildQuery(true, targetIds));
    if (!res.success) throw new Error(res.error || "Export impossible.");
    return res as unknown as CampaignReport;
  };

  const handleExport = async (kind: ExportKind, campaignId?: string) => {
    if (from > to) return;
    const key = campaignId ? `${kind}:${campaignId}` : kind;
    setExporting(key);
    setExportDone(null);
    setError(null);
    setNotice(null);
    try {
      const data = await fetchDetailed(campaignId ? [campaignId] : undefined);
      if (data.campaigns.length === 0) throw new Error("Aucune campagne à exporter sur ce périmètre.");
      const campaignIds = data.campaigns.map((c) => c.id);
      const stamp = new Date().toISOString().slice(0, 10);

      if (kind === "pdf") {
        exportReportToPdf(data, includeProspects);
        await recordHistory({ kind: "PDF", filename: `bleadin-rapport-${stamp}.pdf`, periodFrom: data.period.from, periodTo: data.period.to, campaignIds, campaignsCount: campaignIds.length });
      } else if (kind === "xlsx") {
        exportReportToExcel(data, includeProspects);
        await recordHistory({ kind: "XLSX", filename: `bleadin-rapport-${stamp}.xlsx`, periodFrom: data.period.from, periodTo: data.period.to, campaignIds, campaignsCount: campaignIds.length });
      } else {
        const { count, filename } = exportContactsToExcel(data.campaigns);
        if (count === 0) {
          setNotice("Aucun prospect avec e-mail ou téléphone dans cette sélection.");
          return;
        }
        setNotice(`${count} contact${count > 1 ? "s" : ""} exporté${count > 1 ? "s" : ""}.`);
        await recordHistory({ kind: "CONTACTS", filename, periodFrom: data.period.from, periodTo: data.period.to, campaignIds, campaignsCount: campaignIds.length, prospectsCount: count });
      }
      setExportDone(key);
      setTimeout(() => setExportDone(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Export impossible.");
    } finally {
      setExporting(null);
    }
  };

  const updateSettings = async (patch: { emailFrequency: ReportEmailFrequency }) => {
    setSavingSettings(true);
    setError(null);
    const res = await apiRequest<{ settings: ReportSettings }>("/reports/settings", { method: "PUT", body: JSON.stringify(patch) });
    if (res.success && res.settings) {
      setSettings(res.settings);
      setNotice(patch.emailFrequency === "NONE" ? "Rapport par e-mail désactivé." : "Rapport par e-mail activé.");
    } else {
      setError(res.error || "Enregistrement impossible.");
    }
    setSavingSettings(false);
  };

  const handleSendNow = async () => {
    setSendingNow(true);
    setError(null);
    setNotice(null);
    const frequency = settings?.emailFrequency && settings.emailFrequency !== "NONE" ? settings.emailFrequency : "WEEKLY";
    const res = await apiRequest("/reports/email/send-now", { method: "POST", body: JSON.stringify({ frequency }) });
    if (res.success) setNotice(`Rapport envoyé à ${user?.email}.`);
    else setError(res.error || "L'envoi a échoué.");
    setSendingNow(false);
  };

  const exportDisabled = loading || !!exporting || !visibleReport || visibleReport.campaigns.length === 0;
  const btnIcon = (key: string, Idle: React.FC<{ className?: string }>, idleCls = "") =>
    exporting === key ? <Loader2 className="w-4 h-4 animate-spin" /> : exportDone === key ? <Check className={`w-4 h-4 ${idleCls}`} /> : <Idle className={`w-4 h-4 ${idleCls}`} />;

  return (
    <div className="max-w-[1640px] mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in font-sans">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#21164c] tracking-tight flex items-center gap-2.5">
            <FileBarChart className="w-7 h-7 text-[#592eff]" />
            Rapports
          </h1>
          <p className="text-xs text-[#5f5f69] mt-1">
            Statistiques consolidées de vos campagnes, exportables en PDF et Excel.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#353241] px-3 py-2 rounded-xl bg-white border border-[#e0e0db] cursor-pointer select-none">
            <input type="checkbox" checked={includeProspects} onChange={(e) => setIncludeProspects(e.target.checked)} className="accent-[#592eff]" />
            Inclure le détail des prospects
          </label>
          <button
            type="button"
            onClick={() => fetchReport()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white hover:bg-[#f5f5f7] border border-[#e0e0db] text-[#5f5f69] hover:text-[#21164c] shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={exportDisabled}
            className="py-2.5 px-5 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 flex items-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {btnIcon("pdf", FileText)}
            Télécharger PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport("xlsx")}
            disabled={exportDisabled}
            className="py-2.5 px-5 rounded-xl bg-white hover:bg-[#f5f5f7] border border-[#e0e0db] text-[#21164c] text-xs font-bold shadow-xs flex items-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {btnIcon("xlsx", FileSpreadsheet, "text-emerald-600")}
            Télécharger Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport("contacts")}
            disabled={exportDisabled}
            title="Exporter les prospects ayant un e-mail ou un téléphone (toutes les campagnes affichées)"
            className="py-2.5 px-5 rounded-xl bg-white hover:bg-[#f5f5f7] border border-[#e0e0db] text-[#21164c] text-xs font-bold shadow-xs flex items-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {btnIcon("contacts", Contact, "text-[#592eff]")}
            Exporter les contacts
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="adora-card p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[#5f5f69] uppercase">Période</span>
            <div className="bg-[#f5f5f7] p-1 rounded-xl flex items-center border border-[#e0e0db] text-xs">
              {(["7", "30", "90", "custom"] as Preset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    preset === p ? "bg-white text-[#21164c] shadow-xs" : "text-[#5f5f69] hover:text-[#21164c]"
                  }`}
                >
                  {p === "custom" ? "Personnalisée" : `${p} jours`}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }}
              className="px-3 py-1.5 rounded-xl border border-[#e0e0db] bg-white text-xs font-semibold text-[#21164c] focus:outline-none focus:ring-2 focus:ring-[#592eff]/30"
            />
            <span className="text-xs text-[#5f5f69]">→</span>
            <input
              type="date"
              value={to}
              min={from}
              max={isoDay(new Date())}
              onChange={(e) => { setPreset("custom"); setTo(e.target.value); }}
              className="px-3 py-1.5 rounded-xl border border-[#e0e0db] bg-white text-xs font-semibold text-[#21164c] focus:outline-none focus:ring-2 focus:ring-[#592eff]/30"
            />
          </div>

          {canPickMember && teamMembers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#5f5f69] uppercase">Membre</span>
              <select
                value={selectedMemberId}
                onChange={(e) => { setSelectedMemberId(e.target.value); setSelectedIds([]); }}
                className="px-3 py-1.5 rounded-xl border border-[#e0e0db] bg-white text-xs font-semibold text-[#21164c] focus:outline-none focus:ring-2 focus:ring-[#592eff]/30"
              >
                <option value="ALL">Toute l'équipe</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.email}</option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs font-semibold text-[#353241] cursor-pointer select-none lg:ml-auto">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="accent-[#592eff]" />
            Inclure les campagnes archivées
          </label>
        </div>

        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-xs font-bold text-[#5f5f69] uppercase pt-1.5">Campagnes</span>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
              selectedIds.length === 0 ? "bg-[#592eff] text-white border-[#592eff]" : "bg-white text-[#353241] border-[#e0e0db] hover:border-[#592eff]"
            }`}
          >
            Toutes
          </button>
          {selectableCampaigns.map((c) => {
            const active = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCampaign(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer max-w-[260px] truncate ${
                  active ? "bg-[#592eff] text-white border-[#592eff]" : "bg-white text-[#353241] border-[#e0e0db] hover:border-[#592eff]"
                }`}
                title={c.name}
              >
                {c.name}
              </button>
            );
          })}
          {selectableCampaigns.length === 0 && !loading && (
            <span className="text-xs text-[#5f5f69] pt-1.5">Aucune campagne sur ce périmètre.</span>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
          <Check className="w-4 h-4 shrink-0" />
          {notice}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="adora-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#5f5f69] uppercase">{c.label}</span>
              <c.icon className="w-4 h-4 text-[#592eff]" />
            </div>
            <div className="flex items-end justify-between gap-2 mt-2">
              <div className="text-2xl font-extrabold text-[#21164c]">{loading && !report ? "…" : c.value}</div>
              {c.delta !== undefined && <DeltaBadge value={c.delta} label={prevLabel} />}
            </div>
            <div className="text-[11px] text-[#5f5f69] font-semibold mt-1">{c.sub}</div>
          </div>
        ))}
        {cards.length === 0 && loading && (
          <div className="col-span-full flex items-center justify-center py-10 text-xs text-[#5f5f69] gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement du rapport…
          </div>
        )}
      </div>
      {vs?.prevPeriod && (
        <p className="text-[11px] text-[#5f5f69] -mt-3 px-1">
          Variations calculées par rapport à la période précédente de même durée ({fmtDate(vs.prevPeriod.from)} → {fmtDate(vs.prevPeriod.to)}).
        </p>
      )}

      {/* Graphe */}
      <div className="adora-card p-6 sm:p-7 space-y-5">
        <div>
          <h3 className="text-lg font-extrabold text-[#21164c]">Activité sur la période</h3>
          <p className="text-xs text-[#5f5f69] mt-0.5">
            Invitations, messages envoyés et réponses reçues, du {fmtDate(from)} au {fmtDate(to)}
          </p>
        </div>
        <div className="w-full h-64 sm:h-72">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#5f5f69]">Aucune activité sur la période.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rInv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#592eff" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#592eff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rMsg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2ed6ff" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#2ed6ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rRep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff5982" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#ff5982" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" stroke="#8e8e93" fontSize={11} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} minTickGap={16} />
                <YAxis stroke="#8e8e93" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="invitesSent" name="Invitations" stroke="#592eff" strokeWidth={2.5} fill="url(#rInv)" dot={chartData.length <= 45 ? { r: 3, fill: "#592eff", stroke: "#fff", strokeWidth: 2 } : false} />
                <Area type="monotone" dataKey="messagesSent" name="Messages" stroke="#00a8cc" strokeWidth={2.5} fill="url(#rMsg)" dot={chartData.length <= 45 ? { r: 3, fill: "#2ed6ff", stroke: "#fff", strokeWidth: 2 } : false} />
                <Area type="monotone" dataKey="replies" name="Réponses" stroke="#ff5982" strokeWidth={2.5} fill="url(#rRep)" dot={chartData.length <= 45 ? { r: 3, fill: "#ff5982", stroke: "#fff", strokeWidth: 2 } : false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tableau des campagnes */}
      <div className="adora-card overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-lg font-extrabold text-[#21164c]">Détail par campagne</h3>
          <p className="text-xs text-[#5f5f69] mt-0.5">
            Les colonnes « période » sont filtrées sur les dates choisies ; les taux sont cumulés depuis le lancement.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#f8f9fc] text-[#5f5f69] uppercase text-[10px] font-bold tracking-wider">
                <th className="text-left px-6 py-3">Campagne</th>
                <th className="text-left px-3 py-3">Statut</th>
                <th className="text-right px-3 py-3">Prospects</th>
                <th className="text-right px-3 py-3">Invit. (période)</th>
                <th className="text-right px-3 py-3">Acceptées</th>
                <th className="text-right px-3 py-3">Tx acc.</th>
                <th className="text-right px-3 py-3">Msg (période)</th>
                <th className="text-right px-3 py-3">Réponses (période)</th>
                <th className="text-right px-3 py-3">Tx rép.</th>
                <th className="text-right px-3 py-3">Terminés</th>
                <th className="text-right px-3 py-3">Échecs</th>
                <th className="text-right px-6 py-3">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {visibleReport?.campaigns.map((c) => {
                const key = `contacts:${c.id}`;
                return (
                  <tr key={c.id} className="border-t border-[#f0f0ed] hover:bg-[#fbfbfe] transition-colors">
                    <td className="px-6 py-3">
                      <div className="font-bold text-[#21164c] truncate max-w-[280px]" title={c.name}>{c.name}</div>
                      <div className="text-[10px] text-[#5f5f69]">
                        {c.steps.length} étape{c.steps.length > 1 ? "s" : ""} · créée le {fmtDate(c.createdAt)}
                        {c.author?.name ? ` · ${c.author.name}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`badge-tag text-[10px] font-bold border ${STATUS_BADGE[c.status] || STATUS_BADGE.DRAFT}`}>
                        {CAMPAIGN_STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-[#21164c]">{c.stats.totalProspects}</td>
                    <td className="px-3 py-3 text-right">
                      {c.stats.invitesSent}
                      {c.previousStats && <span className="text-[10px] text-[#9a9aa5] ml-1">({c.previousStats.invitesSent})</span>}
                    </td>
                    <td className="px-3 py-3 text-right">{c.stats.acceptedCount}</td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-600">{c.stats.acceptanceRate} %</td>
                    <td className="px-3 py-3 text-right">
                      {c.stats.messagesSent}
                      {c.previousStats && <span className="text-[10px] text-[#9a9aa5] ml-1">({c.previousStats.messagesSent})</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {c.stats.repliesReceived}
                      {c.previousStats && <span className="text-[10px] text-[#9a9aa5] ml-1">({c.previousStats.repliesReceived})</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-[#592eff]">{c.stats.replyRate} %</td>
                    <td className="px-3 py-3 text-right">{c.stats.completedCount}</td>
                    <td className="px-3 py-3 text-right text-red-600">{c.stats.failed + c.stats.failedActions}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleExport("contacts", c.id)}
                        disabled={!!exporting || c.stats.totalProspects === 0}
                        title="Exporter les prospects de cette campagne ayant un e-mail ou un téléphone"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#e0e0db] bg-white hover:border-[#592eff] hover:text-[#592eff] text-[#353241] font-bold text-[11px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {exporting === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : exportDone === key ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Contact className="w-3.5 h-3.5" />}
                        Excel
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibleReport && visibleReport.campaigns.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-6 py-10 text-center text-[#5f5f69]">Aucune campagne à afficher.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {visibleReport?.comparison && (
          <p className="px-6 pb-5 text-[10px] text-[#9a9aa5]">Entre parenthèses : valeur de la période précédente.</p>
        )}
      </div>

      {/* Paramètres + Historique */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="adora-card p-6 space-y-5 xl:col-span-1">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#592eff]" />
            <h3 className="text-lg font-extrabold text-[#21164c]">Rapport automatique par e-mail</h3>
          </div>
          <p className="text-xs text-[#5f5f69]">
            Recevez un résumé de vos campagnes (KPIs, variation vs période précédente, tableau) à <strong>{user?.email}</strong>, chaque jour ou chaque lundi vers 8h (heure locale).
          </p>
          {settings && !settings.available ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Aucun espace de travail associé à ce compte : option indisponible.</p>
          ) : (
            <>
              <div className="bg-[#f5f5f7] p-1 rounded-xl flex items-center border border-[#e0e0db] text-xs">
                {(["NONE", "DAILY", "WEEKLY"] as ReportEmailFrequency[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    disabled={savingSettings || !settings}
                    onClick={() => updateSettings({ emailFrequency: f })}
                    className={`flex-1 px-3 py-2 rounded-lg font-bold transition-all cursor-pointer disabled:opacity-60 ${
                      settings?.emailFrequency === f ? "bg-[#592eff] text-white shadow-xs" : "text-[#5f5f69] hover:text-[#21164c]"
                    }`}
                  >
                    {f === "NONE" ? "Désactivé" : f === "DAILY" ? "Quotidien" : "Hebdomadaire"}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[11px] text-[#5f5f69]">
                  {settings?.lastSentAt ? `Dernier envoi : ${fmtDateTime(settings.lastSentAt)}` : "Aucun envoi pour le moment."}
                </span>
                <button
                  type="button"
                  onClick={handleSendNow}
                  disabled={sendingNow || !settings?.available}
                  className="py-2 px-4 rounded-xl bg-white hover:bg-[#f5f5f7] border border-[#e0e0db] text-[#21164c] text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {sendingNow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-[#592eff]" />}
                  Envoyer maintenant
                </button>
              </div>
            </>
          )}
        </div>

        <div className="adora-card p-6 space-y-4 xl:col-span-2">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#592eff]" />
            <h3 className="text-lg font-extrabold text-[#21164c]">Historique des rapports générés</h3>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-[#5f5f69] py-6 text-center">Aucun rapport généré pour le moment.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#5f5f69] uppercase text-[10px] font-bold tracking-wider">
                    <th className="text-left px-2 py-2">Date</th>
                    <th className="text-left px-2 py-2">Type</th>
                    <th className="text-left px-2 py-2">Fichier</th>
                    <th className="text-left px-2 py-2">Période</th>
                    <th className="text-right px-2 py-2">Campagnes</th>
                    <th className="text-left px-2 py-2">Par</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 30).map((h) => (
                    <tr key={h.id} className="border-t border-[#f0f0ed]">
                      <td className="px-2 py-2 whitespace-nowrap text-[#21164c] font-semibold">{fmtDateTime(h.createdAt)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className={`badge-tag text-[10px] font-bold border ${h.kind === "PDF" ? "bg-[#592eff]/10 text-[#592eff] border-[#592eff]/20" : h.kind === "XLSX" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-sky-50 text-sky-700 border-sky-200"}`}>
                          {HISTORY_KIND_LABELS[h.kind]}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-mono text-[11px] text-[#353241] truncate max-w-[240px]" title={h.filename}>{h.filename}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-[#5f5f69]">{fmtDate(h.periodFrom)} → {fmtDate(h.periodTo)}</td>
                      <td className="px-2 py-2 text-right text-[#353241]">
                        {h.campaignsCount}
                        {h.prospectsCount !== undefined && <span className="text-[#9a9aa5]"> · {h.prospectsCount} contacts</span>}
                      </td>
                      <td className="px-2 py-2 text-[#5f5f69] truncate max-w-[160px]">{h.userName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-[#9a9aa5]">Les fichiers sont générés dans votre navigateur et ne sont pas conservés sur le serveur ; l'historique garde la trace des exports (100 derniers).</p>
        </div>
      </div>
    </div>
  );
};
