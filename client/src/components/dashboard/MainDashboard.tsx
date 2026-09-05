import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { TeamMetrics, DashboardStats, DailyEvolutionPoint } from "../../types";
import {
  Send,
  Users,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Mail,
  Zap,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Building2,
  Shield,
  ArrowRightLeft,
  UserCheck,
  Calendar,
  AlertCircle,
  Activity,
  Phone,
  BarChart3,
  Flame,
  Layers,
  PieChart as PieIcon,
  SlidersHorizontal,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface MainDashboardProps {
  onStartCampaign?: () => void;
}

// Custom Tooltip pour le graphique d'évolution Recharts
const CustomEvolutionTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#21164c] text-white p-3.5 rounded-2xl shadow-xl text-xs space-y-1.5 border border-white/20 animate-fade-in">
        <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1.5">
          <span className="font-extrabold text-[12px] text-[#a2ea13] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {data.dayLabel}
          </span>
          <span className="text-[10px] text-white/60">{data.date}</span>
        </div>

        <div className="space-y-1 pt-0.5 font-medium">
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-white/80">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name} :
              </span>
              <span className="font-bold text-white text-xs">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip pour le Donut Chart
const CustomDonutTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-[#21164c] text-white px-3 py-2 rounded-xl shadow-lg text-xs border border-white/20 flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
          style={{ backgroundColor: data.payload.color }}
        />
        <span className="font-bold">{data.name} :</span>
        <span className="text-[#a2ea13] font-extrabold">{data.value} leads</span>
      </div>
    );
  }
  return null;
};

export const MainDashboard: React.FC<MainDashboardProps> = ({ onStartCampaign }) => {
  const { user, selectedMemberId, setSelectedMemberId, impersonatedOrg } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [teamMetrics, setTeamMetrics] = useState<TeamMetrics | null>(null);
  const [viewMode, setViewMode] = useState<"personal" | "team">("personal");
  const [timeRange, setTimeRange] = useState<"7d" | "30d">("7d");
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const [visibleSeries, setVisibleSeries] = useState<{
    actions: boolean;
    prospects: boolean;
    replies: boolean;
  }>({
    actions: true,
    prospects: true,
    replies: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const [resPersonal, resTeam] = await Promise.all([
          apiRequest<{ success: boolean; stats: DashboardStats }>("/user/dashboard-stats"),
          apiRequest<{ success: boolean; metrics: TeamMetrics }>("/team/metrics").catch(() => null),
        ]);

        if (resPersonal.success && resPersonal.stats) {
          setStats(resPersonal.stats);
        }
        if (resTeam && resTeam.success && resTeam.metrics) {
          setTeamMetrics(resTeam.metrics);
        }
      } catch (e) {
        console.error("Erreur chargement dashboard stats:", e);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [selectedMemberId, impersonatedOrg?.id]);

  // Données pour le graphique Recharts
  const evolutionChartData = useMemo(() => {
    if (!stats) return [];
    const source = timeRange === "30d" && stats.evolution30d && stats.evolution30d.length > 0
      ? stats.evolution30d
      : stats.evolution || [];

    return source.map((d) => ({
      ...d,
      actionsTotal: d.actionsExecuted || (d.invitesSent + d.messagesSent),
      prospectsCount: d.prospectsAdded,
      repliesCount: d.repliesReceived || 0,
    }));
  }, [stats, timeRange]);

  // Données réelles pour l'entonnoir (Donut Recharts)
  const totalProspectsCount = stats?.prospectsCount || 0;
  const notConnected = stats?.notConnectedProspects || 0;
  const pending = stats?.pendingProspects || 0;
  const connected = stats?.connectedProspects || 0;
  const replied = stats?.repliedProspects || 0;

  const donutData = useMemo(() => {
    if (totalProspectsCount === 0) {
      return [{ name: "Aucun lead", value: 1, color: "#e2e8f0" }];
    }
    const items = [
      { name: "Non Connectés", value: notConnected, color: "#94a3b8" },
      { name: "En Attente", value: pending, color: "#f59e0b" },
      { name: "En Relation", value: connected, color: "#10b981" },
      { name: "Ayant Répondu", value: replied, color: "#592eff" },
    ];
    return items.filter((item) => item.value > 0);
  }, [totalProspectsCount, notConnected, pending, connected, replied]);

  const connectedPct = totalProspectsCount > 0 ? Math.round((connected / totalProspectsCount) * 100) : 0;
  const pendingPct = totalProspectsCount > 0 ? Math.round((pending / totalProspectsCount) * 100) : 0;
  const notConnectedPct = totalProspectsCount > 0 ? Math.round((notConnected / totalProspectsCount) * 100) : 0;
  const repliedPct = totalProspectsCount > 0 ? Math.round((replied / totalProspectsCount) * 100) : 0;

  // Quotas du jour réels
  const dailyInvites = stats?.linkedInAccount?.dailyInvitesSent || 0;
  const maxInvites = user?.maxDailyInvites || 30;
  const invitesGaugePct = Math.min(Math.round((dailyInvites / Math.max(maxInvites, 1)) * 100), 100);

  const dailyMsg = stats?.linkedInAccount?.dailyMsgSent || 0;
  const maxMsg = user?.maxDailyMsg || 70;
  const msgGaugePct = Math.min(Math.round((dailyMsg / Math.max(maxMsg, 1)) * 100), 100);

  const responseRateNum = stats?.responseRate || 0;
  const acceptanceRateNum = stats?.acceptanceRate || 0;

  return (
    <div className="max-w-[1640px] mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in font-sans">
      {/* Header Profile + Action Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#21164c] tracking-tight">
            Bonjour, {user?.name || "Cher utilisateur"} 👋
          </h1>
          <p className="text-xs text-[#5f5f69] mt-1">
            {viewMode === "team"
              ? "Supervisez les quotas, prospects et campagnes de l'ensemble de vos collaborateurs en direct."
              : "Voici vos indicateurs et graphiques d'évolution calculés en direct sur vos données réelles."}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {teamMetrics && teamMetrics.totalMembers > 1 && (
            <div className="bg-[#f5f5f7] p-1 rounded-2xl flex items-center gap-1 border border-[#e0e0db]">
              <button
                onClick={() => setViewMode("personal")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "personal" ? "bg-white text-[#21164c] shadow-xs" : "text-[#5f5f69] hover:text-[#21164c]"
                }`}
              >
                Vue Personnelle
              </button>
              <button
                onClick={() => setViewMode("team")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "team" ? "bg-[#592eff] text-white shadow-xs" : "text-[#5f5f69] hover:text-[#21164c]"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Performance Équipe ({teamMetrics.totalMembers})
              </button>
            </div>
          )}

          <button
            onClick={onStartCampaign || (() => navigate("/campaigns"))}
            className="py-2.5 px-5 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" /> Démarrer une campagne
          </button>
        </div>
      </div>

      {viewMode === "team" && teamMetrics ? (
        <div className="space-y-6">
          {/* Top 4 Team KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="adora-card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#5f5f69] uppercase">Membres Équipe</span>
                <Users className="w-4 h-4 text-[#592eff]" />
              </div>
              <div className="text-2xl font-extrabold text-[#21164c]">
                {teamMetrics.totalMembers} collaborateurs
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                {teamMetrics.connectedAccounts} compte(s) LinkedIn connecté(s)
              </p>
            </div>

            <div className="adora-card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#5f5f69] uppercase">Prospects Unifiés</span>
                <Users className="w-4 h-4 text-[#2ed6ff]" />
              </div>
              <div className="text-2xl font-extrabold text-[#21164c]">
                {teamMetrics.totalProspects}
              </div>
              <p className="text-[11px] text-[#5f5f69] mt-1">
                Zéro doublon grâce à l'anti-collision
              </p>
            </div>

            <div className="adora-card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#5f5f69] uppercase">Campagnes Actives</span>
                <Send className="w-4 h-4 text-[#a2ea13]" />
              </div>
              <div className="text-2xl font-extrabold text-[#21164c]">
                {teamMetrics.activeCampaigns} / {teamMetrics.totalCampaigns}
              </div>
              <p className="text-[11px] text-[#592eff] font-semibold mt-1">
                Séquences en cours de diffusion
              </p>
            </div>

            <div className="adora-card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#5f5f69] uppercase">Actions du Jour</span>
                <TrendingUp className="w-4 h-4 text-[#ff5982]" />
              </div>
              <div className="text-2xl font-extrabold text-[#21164c]">
                {teamMetrics.totalInvitesSent + teamMetrics.totalMsgSent}
              </div>
              <p className="text-[11px] text-[#5f5f69] mt-1">
                {teamMetrics.totalInvitesSent} inv. • {teamMetrics.totalMsgSent} msg.
              </p>
            </div>
          </div>

          {/* Detailed Members Breakdown Table */}
          <div className="adora-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#21164c]">Activité & Quotas par Collaborateur</h3>
                <p className="text-xs text-[#5f5f69]">Suivez la cadence de prospection de chaque membre et basculez en 1 clic</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e0e0db] text-[#5f5f69] uppercase font-bold tracking-wider">
                    <th className="pb-3">Membre</th>
                    <th className="pb-3">Rôle Espace</th>
                    <th className="pb-3">Statut LinkedIn</th>
                    <th className="pb-3">Invitations (Auj.)</th>
                    <th className="pb-3">Messages (Auj.)</th>
                    <th className="pb-3">Campagnes</th>
                    <th className="pb-3">Prospects</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0e0db]/50">
                  {teamMetrics.membersBreakdown.map((m) => (
                    <tr key={m.id} className="hover:bg-[#f8f9fc] transition-colors">
                      <td className="py-3 flex items-center gap-3">
                        <img
                          src={
                            m.avatarUrl ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || m.email)}&background=592eff&color=fff`
                          }
                          alt={m.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-bold text-[#21164c]">{m.name || "Collaborateur"}</p>
                          <p className="text-[11px] text-[#5f5f69]">{m.email}</p>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          m.orgRole === "OWNER" ? "bg-[#592eff]/10 text-[#592eff]" : "bg-gray-100 text-gray-700"
                        }`}>
                          {m.orgRole === "OWNER" ? "Propriétaire" : "Membre"}
                        </span>
                      </td>
                      <td className="py-3">
                        {m.hasLinkedInAccount ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {m.linkedInAccountName || "Connecté"}
                          </span>
                        ) : (
                          <span className="text-amber-600 italic text-xs">En attente</span>
                        )}
                      </td>
                      <td className="py-3 font-semibold text-[#21164c]">
                        {m.dailyInvitesSent} / {m.maxDailyInvites}
                      </td>
                      <td className="py-3 font-semibold text-[#21164c]">
                        {m.dailyMsgSent} / {m.maxDailyMsg}
                      </td>
                      <td className="py-3 text-[#353241]">
                        <span className="font-bold text-[#592eff]">{m.activeCampaigns}</span> / {m.totalCampaigns}
                      </td>
                      <td className="py-3 font-semibold text-[#21164c]">
                        {m.totalProspects}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedMemberId(m.id === user?.id ? null : m.id);
                            if (onStartCampaign) onStartCampaign();
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#592eff] text-[#21164c] hover:text-white font-bold text-xs border border-[#e0e0db] hover:border-[#592eff] transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="Basculez sur ce compte pour gérer ses campagnes"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>Gérer campagnes</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top 2 Cards: LinkedIn Overview & Real Profile Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Blue-Purple LinkedIn Live Hero Card */}
            <div className="lg:col-span-2 rounded-[32px] bg-gradient-to-br from-[#3b66ff] via-[#4d40ee] to-[#592eff] text-white p-7 sm:p-8 relative overflow-hidden shadow-lg shadow-[#592eff]/20 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                {stats?.linkedInAccount ? (
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Photo de profil LinkedIn avec badge officiel */}
                    <div className="relative shrink-0">
                      {stats.linkedInAccount.profilePicture ? (
                        <img
                          src={stats.linkedInAccount.profilePicture}
                          alt={stats.linkedInAccount.accountName || "LinkedIn"}
                          className="w-12 h-12 rounded-2xl object-cover border-2 border-white/40 shadow-md"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-white font-extrabold text-base shadow-sm">
                          {stats.linkedInAccount.accountName?.charAt(0) || "L"}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-[#0077b5] text-white flex items-center justify-center shadow-xs border border-white">
                        <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.2a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28z" />
                        </svg>
                      </div>
                    </div>

                    {/* Nom complet du compte LinkedIn en grand titre */}
                    <div className="min-w-0">
                      <h2 className="font-black text-lg sm:text-xl text-white tracking-tight truncate leading-tight drop-shadow-xs">
                        {stats.linkedInAccount.accountName}
                      </h2>
                      <p className="text-xs text-white/85 font-medium flex items-center gap-1.5 mt-0.5 truncate">
                        <span className="font-bold text-[#bcf2ff]">Compte LinkedIn lié</span>
                        {stats.linkedInAccount.headline && (
                          <span className="text-white/60 truncate max-w-[280px] hidden sm:inline">
                            • {stats.linkedInAccount.headline}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.2a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="font-black text-base sm:text-lg text-white leading-tight">
                        Compte LinkedIn non lié
                      </h2>
                      <p className="text-xs text-white/75 font-medium mt-0.5">
                        Associez votre compte pour activer la prospection
                      </p>
                    </div>
                  </div>
                )}

                {stats?.linkedInAccount ? (
                  <span className="text-xs bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Connecté
                  </span>
                ) : (
                  <button
                    onClick={() => navigate("/team")}
                    className="text-xs bg-white text-[#592eff] px-3.5 py-1.5 rounded-full font-bold shadow hover:bg-white/90 transition-all cursor-pointer"
                  >
                    Connecter LinkedIn →
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <span className="text-3xl sm:text-4xl font-black">{replied}</span>
                      <p className="text-xs text-white/80 font-medium">Réponses reçues de prospects</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-white/70">
                    <Zap className="w-3.5 h-3.5 text-[#a2ea13]" />
                    <span>{stats?.executedActionsCount || 0} action(s) exécutée(s) au total</span>
                  </div>
                </div>

                <div className="flex items-center justify-start sm:justify-end gap-4">
                  {/* Real Circular Gauge */}
                  <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-white/20"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-white"
                        strokeDasharray={`${responseRateNum}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-xs font-black">{responseRateNum}%</span>
                  </div>
                  <div>
                    <span className="text-xs text-white font-bold block">Taux de Réponse</span>
                    <span className="text-[11px] text-white/70">
                      {totalProspectsCount > 0 ? `${replied} sur ${totalProspectsCount} contacts` : "0 prospect"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Real Quotas Usage Progress Bar */}
              <div className="pt-4 border-t border-white/15 space-y-2">
                <div className="flex items-center justify-between text-xs text-white/90">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5" /> Quotas du jour :
                  </span>
                  <span className="font-bold">
                    {dailyInvites} / {maxInvites} invitations • {dailyMsg} / {maxMsg} messages
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden flex">
                  <div
                    className="bg-[#a2ea13] h-full rounded-full transition-all duration-500"
                    style={{ width: `${invitesGaugePct}%` }}
                    title={`Invitations: ${dailyInvites}/${maxInvites}`}
                  />
                </div>
              </div>
            </div>

            {/* Right Card: Real User Identity & Contacts Counter */}
            <div className="adora-card p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="badge-tag bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20 text-[10px]">
                  {stats?.owner?.orgRole === "OWNER" || user?.orgRole === "OWNER" ? "Propriétaire Espace" : "Membre Collaborateur"}
                </span>
                <span className={`text-xs font-semibold flex items-center gap-1 ${
                  stats?.linkedInAccount ? "text-emerald-600" : "text-amber-600"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${stats?.linkedInAccount ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                  {stats?.linkedInAccount ? "Actif" : "LinkedIn déconnecté"}
                </span>
              </div>

              <div className="text-center my-3">
                <img
                  src={
                    stats?.owner?.avatarUrl ||
                    user?.avatarUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(stats?.owner?.name || user?.name || "User")}&background=592eff&color=fff`
                  }
                  alt="Avatar"
                  className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-[#592eff] shadow-sm"
                />
                <h3 className="font-extrabold text-[#21164c] text-base mt-2 truncate">
                  {stats?.owner?.name || user?.name || user?.email}
                </h3>
                <p className="text-xs text-[#5f5f69] truncate">
                  {stats?.owner?.organizationName || user?.organization?.name || "Espace de travail"}
                </p>
              </div>

              {/* Real Prospects Breakdown Matrix */}
              <div className="grid grid-cols-3 gap-2 py-3 border-t border-[#e0e0db] text-center">
                <div className="hover:bg-[#f5f5f7] p-1.5 rounded-xl transition-colors cursor-pointer" onClick={() => navigate("/prospects")}>
                  <p className="text-base font-extrabold text-emerald-600">{connected}</p>
                  <p className="text-[10px] text-[#5f5f69] uppercase font-bold tracking-tight">En relation</p>
                </div>
                <div className="hover:bg-[#f5f5f7] p-1.5 rounded-xl transition-colors cursor-pointer" onClick={() => navigate("/prospects")}>
                  <p className="text-base font-extrabold text-[#592eff]">{pending}</p>
                  <p className="text-[10px] text-[#5f5f69] uppercase font-bold tracking-tight">En attente</p>
                </div>
                <div className="hover:bg-[#f5f5f7] p-1.5 rounded-xl transition-colors cursor-pointer" onClick={() => navigate("/prospects")}>
                  <p className="text-base font-extrabold text-[#21164c]">{totalProspectsCount}</p>
                  <p className="text-[10px] text-[#5f5f69] uppercase font-bold tracking-tight">Total Leads</p>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 1 : RECHARTS HYBRID EVOLUTION CHART (/pick-ui-library) */}
          {/* ========================================================================= */}
          <div className="adora-card p-6 sm:p-7 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#592eff]" />
                  <h3 className="text-lg font-extrabold text-[#21164c]">Évolution & Activité Réelle</h3>
                </div>
                <p className="text-xs text-[#5f5f69] mt-0.5">
                  Analyse temporelle interactive de vos prospections et interactions
                </p>
              </div>

              {/* Chart Controls */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Series Toggles */}
                <div className="bg-[#f5f5f7] p-1 rounded-xl flex items-center border border-[#e0e0db] text-xs gap-1">
                  <button
                    onClick={() =>
                      setVisibleSeries((prev) => ({ ...prev, actions: !prev.actions }))
                    }
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      visibleSeries.actions
                        ? "bg-[#592eff] text-white shadow-xs"
                        : "text-[#5f5f69] opacity-50 hover:opacity-80"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                    Actions ({evolutionChartData.reduce((acc, c) => acc + c.actionsTotal, 0)})
                  </button>

                  <button
                    onClick={() =>
                      setVisibleSeries((prev) => ({ ...prev, prospects: !prev.prospects }))
                    }
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      visibleSeries.prospects
                        ? "bg-[#2ed6ff] text-[#004f63] shadow-xs"
                        : "text-[#5f5f69] opacity-50 hover:opacity-80"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#004f63]"></span>
                    Prospects ({evolutionChartData.reduce((acc, c) => acc + c.prospectsCount, 0)})
                  </button>

                  <button
                    onClick={() =>
                      setVisibleSeries((prev) => ({ ...prev, replies: !prev.replies }))
                    }
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      visibleSeries.replies
                        ? "bg-[#ff5982] text-white shadow-xs"
                        : "text-[#5f5f69] opacity-50 hover:opacity-80"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                    Réponses ({evolutionChartData.reduce((acc, c) => acc + c.repliesCount, 0)})
                  </button>
                </div>

                {/* Chart Style Switcher (Area vs Bar) */}
                <div className="bg-[#f5f5f7] p-1 rounded-xl flex items-center border border-[#e0e0db] text-xs">
                  <button
                    onClick={() => setChartType("area")}
                    className={`p-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      chartType === "area" ? "bg-white text-[#21164c] shadow-xs" : "text-[#5f5f69]"
                    }`}
                    title="Courbes lissées"
                  >
                    <Activity className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setChartType("bar")}
                    className={`p-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      chartType === "bar" ? "bg-white text-[#21164c] shadow-xs" : "text-[#5f5f69]"
                    }`}
                    title="Histogramme barres"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 7d / 30d Toggle */}
                <div className="bg-[#f5f5f7] p-1 rounded-xl flex items-center border border-[#e0e0db] text-xs">
                  <button
                    onClick={() => setTimeRange("7d")}
                    className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      timeRange === "7d"
                        ? "bg-white text-[#21164c] shadow-xs"
                        : "text-[#5f5f69] hover:text-[#21164c]"
                    }`}
                  >
                    7 jours
                  </button>
                  <button
                    onClick={() => setTimeRange("30d")}
                    className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      timeRange === "30d"
                        ? "bg-white text-[#21164c] shadow-xs"
                        : "text-[#5f5f69] hover:text-[#21164c]"
                    }`}
                  >
                    30 jours
                  </button>
                </div>
              </div>
            </div>

            {/* Recharts Area / Bar Container */}
            <div className="w-full h-72 sm:h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "area" ? (
                  <AreaChart
                    data={evolutionChartData}
                    margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorActions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#592eff" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#592eff" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorProspects" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2ed6ff" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#2ed6ff" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff5982" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#ff5982" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="dayLabel"
                      stroke="#8e8e93"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <YAxis
                      stroke="#8e8e93"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <RechartsTooltip content={<CustomEvolutionTooltip />} />
                    {visibleSeries.actions && (
                      <Area
                        type="monotone"
                        dataKey="actionsTotal"
                        name="Actions exécutées"
                        stroke="#592eff"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorActions)"
                        dot={{ r: 4, fill: "#592eff", stroke: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#592eff", stroke: "#fff", strokeWidth: 2 }}
                      />
                    )}
                    {visibleSeries.prospects && (
                      <Area
                        type="monotone"
                        dataKey="prospectsCount"
                        name="Prospects ajoutés"
                        stroke="#00a8cc"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorProspects)"
                        dot={{ r: 3.5, fill: "#2ed6ff", stroke: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#2ed6ff", stroke: "#fff", strokeWidth: 2 }}
                      />
                    )}
                    {visibleSeries.replies && (
                      <Area
                        type="monotone"
                        dataKey="repliesCount"
                        name="Réponses reçues"
                        stroke="#ff5982"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorReplies)"
                        dot={{ r: 3.5, fill: "#ff5982", stroke: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#ff5982", stroke: "#fff", strokeWidth: 2 }}
                      />
                    )}
                  </AreaChart>
                ) : (
                  <BarChart
                    data={evolutionChartData}
                    margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="dayLabel"
                      stroke="#8e8e93"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <YAxis
                      stroke="#8e8e93"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <RechartsTooltip content={<CustomEvolutionTooltip />} />
                    {visibleSeries.actions && (
                      <Bar
                        dataKey="actionsTotal"
                        name="Actions exécutées"
                        fill="#592eff"
                        radius={[6, 6, 0, 0]}
                      />
                    )}
                    {visibleSeries.prospects && (
                      <Bar
                        dataKey="prospectsCount"
                        name="Prospects ajoutés"
                        fill="#2ed6ff"
                        radius={[6, 6, 0, 0]}
                      />
                    )}
                    {visibleSeries.replies && (
                      <Bar
                        dataKey="repliesCount"
                        name="Réponses reçues"
                        fill="#ff5982"
                        radius={[6, 6, 0, 0]}
                      />
                    )}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2 : PROSPECTS CONVERSION DONUT + METRIC CARDS (BARRE VERTE SUPPRIMÉE) */}
          {/* ========================================================================= */}
          <div className="adora-card p-6 sm:p-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#21164c]">
                  Entonnoir de Conversion des Prospects ({totalProspectsCount})
                </h3>
                <p className="text-xs text-[#5f5f69]">
                  Répartition et taux de passage de vos contacts par statut
                </p>
              </div>
              <button
                onClick={() => navigate("/prospects")}
                className="text-xs text-[#592eff] font-bold hover:underline inline-flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              >
                Gérer tous les prospects <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Donut Chart & 4 Status Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left Side: Modern Recharts Donut Pie Chart */}
              <div className="lg:col-span-4 flex items-center justify-center relative">
                <div className="w-56 h-56 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <RechartsTooltip content={<CustomDonutTooltip />} />
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={88}
                        paddingAngle={3}
                        dataKey="value"
                        cornerRadius={6}
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>

                  {/* Centered Total Indicator */}
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-2xl font-black text-[#21164c]">{totalProspectsCount}</span>
                    <span className="text-[10px] text-[#5f5f69] uppercase font-bold tracking-wider">
                      Leads
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: 4 Premium Status Cards */}
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Non connectés */}
                <div
                  onClick={() => navigate("/prospects")}
                  className="bg-[#f8f9fc] hover:bg-[#f2f4fa] p-4 rounded-2xl border border-[#e0e0db] transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#5f5f69] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                      Non Connectés
                    </span>
                    <span className="text-xs font-extrabold text-slate-600">{notConnectedPct}%</span>
                  </div>
                  <div className="text-2xl font-extrabold text-[#21164c]">{notConnected}</div>
                  <p className="text-[11px] text-[#5f5f69] mt-0.5">Leads importés non encore invités</p>
                </div>

                {/* 2. En attente */}
                <div
                  onClick={() => navigate("/prospects")}
                  className="bg-[#fffbf0] hover:bg-[#fff7e0] p-4 rounded-2xl border border-amber-200/80 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                      Invitations En Attente
                    </span>
                    <span className="text-xs font-extrabold text-amber-800">{pendingPct}%</span>
                  </div>
                  <div className="text-2xl font-extrabold text-amber-900">{pending}</div>
                  <p className="text-[11px] text-amber-700 mt-0.5">Invitations envoyées sur LinkedIn</p>
                </div>

                {/* 3. En relation */}
                <div
                  onClick={() => navigate("/prospects")}
                  className="bg-[#f0fbf5] hover:bg-[#e4f7ee] p-4 rounded-2xl border border-emerald-200/80 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      En Relation (1er degré)
                    </span>
                    <span className="text-xs font-extrabold text-emerald-800">{connectedPct}%</span>
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-900">{connected}</div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">Taux d'acceptation : {acceptanceRateNum}%</p>
                </div>

                {/* 4. Ayant Répondu */}
                <div
                  onClick={() => navigate("/inbox")}
                  className="bg-[#f5f2ff] hover:bg-[#eee8ff] p-4 rounded-2xl border border-[#592eff]/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#592eff] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#592eff]"></span>
                      Ayant Répondu
                    </span>
                    <span className="text-xs font-extrabold text-[#592eff]">{repliedPct}%</span>
                  </div>
                  <div className="text-2xl font-extrabold text-[#21164c]">{replied}</div>
                  <p className="text-[11px] text-[#592eff] font-semibold mt-0.5">Taux de réponse : {responseRateNum}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3 : DETAILED 3 REAL KPIS CARDS */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Taux d'Acceptation Réel */}
            <div className="adora-card p-6 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#5f5f69] uppercase">Taux d'Acceptation</span>
                <div className="text-2xl font-extrabold text-[#21164c] mt-1">
                  {acceptanceRateNum}%
                </div>
                <p className="text-[11px] text-emerald-600 font-semibold mt-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {connected} acceptés sur {totalProspectsCount} contacts
                </p>
              </div>
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[#e0e0db]"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-[#592eff]"
                    strokeDasharray={`${acceptanceRateNum}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-xs font-extrabold text-[#21164c]">{acceptanceRateNum}%</span>
              </div>
            </div>

            {/* Campagnes & File d'attente Réelles */}
            <div className="adora-card p-6 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#5f5f69] uppercase">Campagnes Actives</span>
                <div className="text-2xl font-extrabold text-[#21164c] mt-1">
                  {stats?.activeCampaignsCount || 0} / {stats?.totalCampaignsCount || 0}
                </div>
                <p className="text-[11px] text-[#592eff] font-semibold mt-2">
                  {stats?.queuedActionsCount || 0} actions planifiées dans la file
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center">
                <Send className="w-6 h-6" />
              </div>
            </div>

            {/* Données de Contact Enrichies Réelles */}
            <div className="adora-card p-6 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#5f5f69] uppercase">Coordonnées Enrichies</span>
                <div className="text-2xl font-extrabold text-[#21164c] mt-1">
                  {stats?.emailsFoundCount || 0} emails
                </div>
                <p className="text-[11px] text-[#5f5f69] font-medium mt-2">
                  {stats?.phonesFoundCount || 0} téléphones trouvés
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#2ed6ff]/15 text-[#008ba8] flex items-center justify-center">
                <Mail className="w-6 h-6" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
