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
  X,
  Plus,
} from "lucide-react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type {
  CampaignReport,
  ReportCampaign,
  ReportSettings,
  ReportSettingsPatch,
  ReportHistoryEntry,
  ReportEmailFrequency,
  ReportDay,
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
  ACTIVE: "bg-surface-2 text-ok border-line",
  PAUSED: "bg-surface-2 text-warn border-line",
  COMPLETED: "bg-surface-2 text-muted border-line",
  ARCHIVED: "bg-surface-2 text-muted border-line",
  DRAFT: "bg-surface-2 text-muted border-line",
};

const REPORT_DAYS: { id: ReportDay; label: string; long: string }[] = [
  { id: "MON", label: "Lun", long: "lundi" },
  { id: "TUE", label: "Mar", long: "mardi" },
  { id: "WED", label: "Mer", long: "mercredi" },
  { id: "THU", label: "Jeu", long: "jeudi" },
  { id: "FRI", label: "Ven", long: "vendredi" },
  { id: "SAT", label: "Sam", long: "samedi" },
  { id: "SUN", label: "Dim", long: "dimanche" },
];
const MAX_REPORT_EMAILS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    <div className="bg-ink text-white p-3.5 rounded-2xl text-xs space-y-1.5 border border-white/20">
      <div className="font-semibold text-[12px] text-[#a2ea13] border-b border-white/15 pb-1.5">{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-white/80">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
            {entry.name} :
          </span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const DeltaBadge: React.FC<{ value: number | null | undefined; label: string }> = ({ value, label }) => {
  if (value === null || value === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#9a9aa5]" title={label}>
        <Minus className="w-3 h-3" /> —
      </span>
    );
  }
  const up = value > 0;
  const flat = value === 0;
  const cls = flat ? "text-muted bg-surface-2" : up ? "text-ok bg-surface-2" : "text-danger bg-surface-2";
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${cls}`} title={label}>
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
  // Brouillon local des réglages d'envoi (destinataires / heure / jour), enregistré explicitement
  const [draftEmails, setDraftEmails] = useState<string[]>([]);
  const [draftHour, setDraftHour] = useState(8);
  const [draftDay, setDraftDay] = useState<ReportDay>("MON");
  const [emailInput, setEmailInput] = useState("");
  const [emailInputError, setEmailInputError] = useState<string | null>(null);
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

  const applySettings = (s: ReportSettings) => {
    setSettings(s);
    setDraftEmails(s.emails || []);
    setDraftHour(s.hour ?? 8);
    setDraftDay(s.day || "MON");
  };

  const fetchSettings = async () => {
    const res = await apiRequest<{ settings: ReportSettings }>("/reports/settings");
    if (res.success && res.settings) applySettings(res.settings);
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

  const updateSettings = async (patch: ReportSettingsPatch, successNotice?: string) => {
    setSavingSettings(true);
    setError(null);
    const res = await apiRequest<{ settings: ReportSettings }>("/reports/settings", { method: "PUT", body: JSON.stringify(patch) });
    if (res.success && res.settings) {
      applySettings(res.settings);
      setNotice(
        successNotice ??
          (patch.emailFrequency === "NONE" ? "Rapport par e-mail désactivé." : "Rapport par e-mail activé.")
      );
    } else {
      setError(res.error || "Enregistrement impossible.");
    }
    setSavingSettings(false);
  };

  const addDraftEmail = (): boolean => {
    const value = emailInput.trim().toLowerCase();
    if (!value) return true;
    if (!EMAIL_RE.test(value)) {
      setEmailInputError("Adresse e-mail invalide.");
      return false;
    }
    if (draftEmails.includes(value)) {
      setEmailInput("");
      setEmailInputError(null);
      return true;
    }
    if (draftEmails.length >= MAX_REPORT_EMAILS) {
      setEmailInputError(`${MAX_REPORT_EMAILS} destinataires maximum.`);
      return false;
    }
    setDraftEmails([...draftEmails, value]);
    setEmailInput("");
    setEmailInputError(null);
    return true;
  };

  const handleSaveDelivery = async () => {
    // Une adresse encore dans le champ mais non validée est ajoutée avant l'enregistrement
    if (!addDraftEmail()) return;
    const pendingValue = emailInput.trim().toLowerCase();
    const emails = pendingValue && !draftEmails.includes(pendingValue) ? [...draftEmails, pendingValue] : draftEmails;
    await updateSettings({ emails, hour: draftHour, day: draftDay }, "Réglages d'envoi enregistrés.");
  };

  const deliveryDirty =
    !!settings &&
    (draftHour !== settings.hour ||
      draftDay !== settings.day ||
      draftEmails.length !== (settings.emails || []).length ||
      draftEmails.some((e, i) => e !== settings.emails?.[i]));

  const effectiveRecipients = settings ? (settings.emails?.length ? settings.emails : [settings.accountEmail]) : [];

  const scheduleSummary = (() => {
    if (!settings || settings.emailFrequency === "NONE") return null;
    const at = `${String(settings.hour).padStart(2, "0")}h`;
    const dayLabel = REPORT_DAYS.find((d) => d.id === settings.day)?.long || "lundi";
    return settings.emailFrequency === "DAILY" ? `chaque jour à ${at}` : `chaque ${dayLabel} à ${at}`;
  })();

  const handleSendNow = async () => {
    setSendingNow(true);
    setError(null);
    setNotice(null);
    const frequency = settings?.emailFrequency && settings.emailFrequency !== "NONE" ? settings.emailFrequency : "WEEKLY";
    const res = await apiRequest<{ recipients?: string[] }>("/reports/email/send-now", { method: "POST", body: JSON.stringify({ frequency }) });
    if (res.success) setNotice(`Rapport envoyé à ${(res.recipients?.length ? res.recipients : effectiveRecipients).join(", ")}.`);
    else setError(res.error || "L'envoi a échoué.");
    setSendingNow(false);
  };

  const exportDisabled = loading || !!exporting || !visibleReport || visibleReport.campaigns.length === 0;
  const btnIcon = (key: string, Idle: React.FC<{ className?: string }>, idleCls = "") =>
    exporting === key ? <Loader2 className="w-4 h-4 animate-spin" /> : exportDone === key ? <Check className={`w-4 h-4 ${idleCls}`} /> : <Idle className={`w-4 h-4 ${idleCls}`} />;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl leading-tight">Rapports</h1>
          <p className="mt-1 text-base text-muted">
            Statistiques consolidées de vos campagnes, exportables en PDF et Excel.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-2 px-3 py-2 rounded-xl bg-white border border-line cursor-pointer select-none">
            <input type="checkbox" checked={includeProspects} onChange={(e) => setIncludeProspects(e.target.checked)} className="accent-[#592eff]" />
            Inclure le détail des prospects
          </label>
          <button
            type="button"
            onClick={() => fetchReport()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white hover:bg-surface-2 border border-line text-muted hover:text-ink transition-all cursor-pointer disabled:opacity-50"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={exportDisabled}
            className="py-2.5 px-5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {btnIcon("pdf", FileText)}
            Télécharger PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport("xlsx")}
            disabled={exportDisabled}
            className="py-2.5 px-5 rounded-xl bg-white hover:bg-surface-2 border border-line text-ink text-xs font-medium flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {btnIcon("xlsx", FileSpreadsheet, "text-ok")}
            Télécharger Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport("contacts")}
            disabled={exportDisabled}
            title="Exporter les prospects ayant un e-mail ou un téléphone (toutes les campagnes affichées)"
            className="py-2.5 px-5 rounded-xl bg-white hover:bg-surface-2 border border-line text-ink text-xs font-medium flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {btnIcon("contacts", Contact, "text-ink")}
            Exporter les contacts
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted">Période</span>
            <div className="bg-surface-2 p-1 rounded-xl flex items-center border border-line text-xs">
              {(["7", "30", "90", "custom"] as Preset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    preset === p ? "bg-white text-ink" : "text-muted hover:text-ink"
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
              className="px-3 py-1.5 rounded-xl border border-line bg-white text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <span className="text-xs text-muted">→</span>
            <input
              type="date"
              value={to}
              min={from}
              max={isoDay(new Date())}
              onChange={(e) => { setPreset("custom"); setTo(e.target.value); }}
              className="px-3 py-1.5 rounded-xl border border-line bg-white text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {canPickMember && teamMembers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted">Membre</span>
              <select
                value={selectedMemberId}
                onChange={(e) => { setSelectedMemberId(e.target.value); setSelectedIds([]); }}
                className="px-3 py-1.5 rounded-xl border border-line bg-white text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="ALL">Toute l'équipe</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.email}</option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs font-semibold text-ink-2 cursor-pointer select-none lg:ml-auto">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="accent-[#592eff]" />
            Inclure les campagnes archivées
          </label>
        </div>

        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted pt-1.5">Campagnes</span>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
              selectedIds.length === 0 ? "bg-accent text-white border-ink" : "bg-white text-ink-2 border-line hover:border-ink"
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
                  active ? "bg-accent text-white border-ink" : "bg-white text-ink-2 border-line hover:border-ink"
                }`}
                title={c.name}
              >
                {c.name}
              </button>
            );
          })}
          {selectableCampaigns.length === 0 && !loading && (
            <span className="text-xs text-muted pt-1.5">Aucune campagne sur ce périmètre.</span>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-surface-2 border border-line text-danger text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-surface-2 border border-line text-ok text-xs font-semibold">
          <Check className="w-4 h-4 shrink-0" />
          {notice}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">{c.label}</span>
              <c.icon className="w-4 h-4 text-ink" />
            </div>
            <div className="flex items-end justify-between gap-2 mt-2">
              <div className="text-2xl font-semibold text-ink">{loading && !report ? "…" : c.value}</div>
              {c.delta !== undefined && <DeltaBadge value={c.delta} label={prevLabel} />}
            </div>
            <div className="text-xs text-muted font-semibold mt-1">{c.sub}</div>
          </div>
        ))}
        {cards.length === 0 && loading && (
          <div className="col-span-full flex items-center justify-center py-10 text-xs text-muted gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement du rapport…
          </div>
        )}
      </div>
      {vs?.prevPeriod && (
        <p className="text-xs text-muted -mt-3 px-1">
          Variations calculées par rapport à la période précédente de même durée ({fmtDate(vs.prevPeriod.from)} → {fmtDate(vs.prevPeriod.to)}).
        </p>
      )}

      {/* Graphe */}
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-7 space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-ink">Activité sur la période</h3>
          <p className="text-xs text-muted mt-0.5">
            Invitations, messages envoyés et réponses reçues, du {fmtDate(from)} au {fmtDate(to)}
          </p>
        </div>
        <div className="w-full h-64 sm:h-72">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted">Aucune activité sur la période.</div>
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
      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-lg font-semibold text-ink">Détail par campagne</h3>
          <p className="text-xs text-muted mt-0.5">
            Les colonnes « période » sont filtrées sur les dates choisies ; les taux sont cumulés depuis le lancement.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-2 text-muted text-xs font-medium">
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
                  <tr key={c.id} className="border-t border-[#f0f0ed] hover:bg-surface-2 transition-colors">
                    <td className="px-6 py-3">
                      <div className="font-medium text-ink truncate max-w-[280px]" title={c.name}>{c.name}</div>
                      <div className="text-xs text-muted">
                        {c.steps.length} étape{c.steps.length > 1 ? "s" : ""} · créée le {fmtDate(c.createdAt)}
                        {c.author?.name ? ` · ${c.author.name}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-xs font-medium border ${STATUS_BADGE[c.status] || STATUS_BADGE.DRAFT}`}>
                        {CAMPAIGN_STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-ink">{c.stats.totalProspects}</td>
                    <td className="px-3 py-3 text-right">
                      {c.stats.invitesSent}
                      {c.previousStats && <span className="text-xs text-[#9a9aa5] ml-1">({c.previousStats.invitesSent})</span>}
                    </td>
                    <td className="px-3 py-3 text-right">{c.stats.acceptedCount}</td>
                    <td className="px-3 py-3 text-right font-medium text-ok">{c.stats.acceptanceRate} %</td>
                    <td className="px-3 py-3 text-right">
                      {c.stats.messagesSent}
                      {c.previousStats && <span className="text-xs text-[#9a9aa5] ml-1">({c.previousStats.messagesSent})</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {c.stats.repliesReceived}
                      {c.previousStats && <span className="text-xs text-[#9a9aa5] ml-1">({c.previousStats.repliesReceived})</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-ink">{c.stats.replyRate} %</td>
                    <td className="px-3 py-3 text-right">{c.stats.completedCount}</td>
                    <td className="px-3 py-3 text-right text-danger">{c.stats.failed + c.stats.failedActions}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleExport("contacts", c.id)}
                        disabled={!!exporting || c.stats.totalProspects === 0}
                        title="Exporter les prospects de cette campagne ayant un e-mail ou un téléphone"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-white hover:border-ink hover:text-ink text-ink-2 font-medium text-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {exporting === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : exportDone === key ? <Check className="w-3.5 h-3.5 text-ok" /> : <Contact className="w-3.5 h-3.5" />}
                        Excel
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibleReport && visibleReport.campaigns.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-6 py-10 text-center text-muted">Aucune campagne à afficher.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {visibleReport?.comparison && (
          <p className="px-6 pb-5 text-xs text-[#9a9aa5]">Entre parenthèses : valeur de la période précédente.</p>
        )}
      </div>

      {/* Paramètres + Historique */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-line bg-surface p-6 space-y-5 xl:col-span-1">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-ink" />
            <h3 className="text-lg font-semibold text-ink">Rapport automatique par e-mail</h3>
          </div>
          <p className="text-xs text-muted">
            Recevez un résumé de vos campagnes (KPIs, variation vs période précédente, tableau) par e-mail.{" "}
            {scheduleSummary ? (
              <>
                Envoyé à <strong>{effectiveRecipients.join(", ")}</strong>, {scheduleSummary} (heure locale).
              </>
            ) : (
              "Choisissez la fréquence, puis les destinataires, l'heure et le jour d'envoi."
            )}
          </p>
          {settings && !settings.available ? (
            <p className="text-xs text-warn bg-surface-2 border border-line rounded-xl px-3 py-2">Aucun espace de travail associé à ce compte : option indisponible.</p>
          ) : (
            <>
              <div className="bg-surface-2 p-1 rounded-xl flex items-center border border-line text-xs">
                {(["NONE", "DAILY", "WEEKLY"] as ReportEmailFrequency[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    disabled={savingSettings || !settings}
                    onClick={() => updateSettings({ emailFrequency: f })}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all cursor-pointer disabled:opacity-60 ${
                      settings?.emailFrequency === f ? "bg-accent text-white" : "text-muted hover:text-ink"
                    }`}
                  >
                    {f === "NONE" ? "Désactivé" : f === "DAILY" ? "Quotidien" : "Hebdomadaire"}
                  </button>
                ))}
              </div>

              {settings && settings.emailFrequency !== "NONE" && (
                <div className="space-y-4 border-t border-[#ececf1] pt-4">
                  {/* Destinataires */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-muted-2">Destinataires</label>
                    {draftEmails.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {draftEmails.map((e) => (
                          <span
                            key={e}
                            className="inline-flex items-center gap-1 max-w-full pl-2.5 pr-1 py-1 rounded-full bg-[#f0f0f4] text-xs font-semibold text-ink"
                          >
                            <span className="truncate">{e}</span>
                            <button
                              type="button"
                              aria-label={`Retirer ${e}`}
                              onClick={() => setDraftEmails(draftEmails.filter((x) => x !== e))}
                              className="w-4 h-4 rounded-full flex items-center justify-center text-muted-2 hover:bg-line hover:text-ink cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted">
                        Aucune adresse : le rapport sera envoyé à <strong>{settings.accountEmail}</strong>.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => {
                          setEmailInput(e.target.value);
                          if (emailInputError) setEmailInputError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addDraftEmail();
                          }
                        }}
                        onBlur={() => emailInput.trim() && addDraftEmail()}
                        placeholder={draftEmails.length ? "Ajouter une adresse…" : settings.accountEmail}
                        className="flex-1 min-w-0 bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold text-ink placeholder:font-normal placeholder:text-[#9a9aa5] focus:outline-none focus:border-ink"
                      />
                      <button
                        type="button"
                        onClick={addDraftEmail}
                        disabled={!emailInput.trim()}
                        aria-label="Ajouter l'adresse"
                        className="px-3 rounded-xl bg-white hover:bg-surface-2 border border-line text-ink flex items-center cursor-pointer disabled:opacity-40"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {emailInputError && <p className="text-xs text-danger">{emailInputError}</p>}
                    {draftEmails.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setDraftEmails([settings.accountEmail])}
                        className="text-xs font-semibold text-ink hover:underline cursor-pointer"
                      >
                        Utiliser mon e-mail ({settings.accountEmail})
                      </button>
                    )}
                  </div>

                  {/* Heure + jour */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-muted-2">Heure d'envoi</label>
                      <select
                        value={draftHour}
                        onChange={(e) => setDraftHour(Number(e.target.value))}
                        className="w-full bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold text-ink focus:outline-none focus:border-ink cursor-pointer"
                      >
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, "0")}:00
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[#9a9aa5]">Heure locale · {settings.timezone}</p>
                    </div>
                    {settings.emailFrequency === "WEEKLY" && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-muted-2">Jour d'envoi</label>
                        <div className="flex flex-wrap gap-1">
                          {REPORT_DAYS.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => setDraftDay(d.id)}
                              className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                draftDay === d.id ? "bg-accent text-white" : "bg-[#f0f0f4] text-muted-2 hover:text-ink"
                              }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {deliveryDirty && (
                      <button
                        type="button"
                        onClick={() => applySettings(settings)}
                        disabled={savingSettings}
                        className="py-2 px-3 rounded-xl text-xs font-medium text-muted hover:text-ink cursor-pointer disabled:opacity-50"
                      >
                        Annuler
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveDelivery}
                      disabled={savingSettings || (!deliveryDirty && !emailInput.trim())}
                      className="py-2 px-4 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Enregistrer
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs text-muted">
                  {settings?.lastSentAt ? `Dernier envoi : ${fmtDateTime(settings.lastSentAt)}` : "Aucun envoi pour le moment."}
                </span>
                <button
                  type="button"
                  onClick={handleSendNow}
                  disabled={sendingNow || !settings?.available}
                  className="py-2 px-4 rounded-xl bg-white hover:bg-surface-2 border border-line text-ink text-xs font-medium flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {sendingNow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-ink" />}
                  Envoyer maintenant
                </button>
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 space-y-4 xl:col-span-2">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-ink" />
            <h3 className="text-lg font-semibold text-ink">Historique des rapports générés</h3>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-muted py-6 text-center">Aucun rapport généré pour le moment.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted text-xs font-medium">
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
                      <td className="px-2 py-2 whitespace-nowrap text-ink font-semibold">{fmtDateTime(h.createdAt)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-xs font-medium border ${h.kind === "PDF" ? "bg-surface-2 text-ink border-ink" : h.kind === "XLSX" ? "bg-surface-2 text-ok border-line" : "bg-surface-2 text-muted border-line"}`}>
                          {HISTORY_KIND_LABELS[h.kind]}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs text-ink-2 truncate max-w-[240px]" title={h.filename}>{h.filename}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-muted">{fmtDate(h.periodFrom)} → {fmtDate(h.periodTo)}</td>
                      <td className="px-2 py-2 text-right text-ink-2">
                        {h.campaignsCount}
                        {h.prospectsCount !== undefined && <span className="text-[#9a9aa5]"> · {h.prospectsCount} contacts</span>}
                      </td>
                      <td className="px-2 py-2 text-muted truncate max-w-[160px]">{h.userName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-[#9a9aa5]">Les fichiers sont générés dans votre navigateur et ne sont pas conservés sur le serveur ; l'historique garde la trace des exports (100 derniers).</p>
        </div>
      </div>
    </div>
  );
};
