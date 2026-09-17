import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { WorkspaceAvatar } from "../common/WorkspaceAvatar";
import { apiRequest } from "../../services/api";
import { TeamMetrics, DashboardStats, DailyEvolutionPoint } from "../../types";
import {
  Send,
  Users,
  ArrowRight,
  ChevronRight,
  ArrowRightLeft,
  Activity,
  BarChart3,
  RotateCw,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge, StatusDot } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { IconButton } from "../ui/IconButton";
import { PageHeader } from "../ui/PageHeader";
import { Skeleton, SkeletonStatRow } from "../ui/Skeleton";
import { Stat, StatRow } from "../ui/Stat";
import { Table, TableWrap, Td, Th, Tr } from "../ui/Table";
import { Tabs } from "../ui/Tabs";

/** Palette des graphiques : une seule série en violet, le reste en encre et gris. */
export const CHART = {
  accent: "#592eff",
  ink: "#21164c",
  grey: "#a3a3ab",
  line: "#d6d6d0",
  grid: "#ececea",
  axis: "#8a8a94",
};
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
} from "recharts";

interface MainDashboardProps {
  onStartCampaign?: () => void;
}

// Info-bulle du graphique d'évolution
const CustomEvolutionTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs shadow-pop">
        <div className="mb-1.5 flex items-center justify-between gap-4 border-b border-line pb-1.5">
          <span className="font-medium text-ink">{data.dayLabel}</span>
          <span className="text-muted">{data.date}</span>
        </div>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="tabular-nums font-medium text-ink">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Info-bulle du donut
const CustomDonutTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: data.payload.color }} />
        <span className="text-muted">{data.name}</span>
        <span className="tabular-nums font-medium text-ink">{data.value}</span>
      </div>
    );
  }
  return null;
};

export const MainDashboard: React.FC<MainDashboardProps> = ({ onStartCampaign }) => {
  const { user, selectedMemberId, setSelectedMemberId, impersonatedOrg, openLinkedInModal } = useAuth();
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStats = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const query = selectedMemberId && selectedMemberId !== "ALL" ? `?memberId=${selectedMemberId}` : "";
      const [resPersonal, resTeam] = await Promise.all([
        apiRequest<{ success: boolean; stats: DashboardStats }>(`/user/dashboard-stats${query}`),
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
      if (!isBackground) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    // Chargement initial
    loadStats(false);

    // Intervalle d'actualisation automatique toutes les 25 secondes (uniquement si l'onglet est visible)
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadStats(true);
      }
    }, 25000);

    // Écoute de l'événement de reprise de focus et visibilité de l'onglet du navigateur
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        loadStats(true);
      }
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    // Écoute des événements de mise à jour déclenchés par d'autres composants
    const handleCustomRefresh = () => {
      loadStats(true);
    };
    window.addEventListener("bleadin:refresh-dashboard", handleCustomRefresh);
    window.addEventListener("bime:refresh-dashboard", handleCustomRefresh);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("bleadin:refresh-dashboard", handleCustomRefresh);
      window.removeEventListener("bime:refresh-dashboard", handleCustomRefresh);
    };
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
      return [{ name: "Aucun prospect", value: 1, color: CHART.line }];
    }
    const items = [
      { name: "Non connectés", value: notConnected, color: CHART.line },
      { name: "En attente", value: pending, color: CHART.grey },
      { name: "En relation", value: connected, color: CHART.ink },
      { name: "Ayant répondu", value: replied, color: CHART.accent },
    ];
    return items.filter((item) => item.value > 0);
  }, [totalProspectsCount, notConnected, pending, connected, replied]);

  const connectedPct = totalProspectsCount > 0 ? Math.round((connected / totalProspectsCount) * 100) : 0;
  const pendingPct = totalProspectsCount > 0 ? Math.round((pending / totalProspectsCount) * 100) : 0;
  const notConnectedPct = totalProspectsCount > 0 ? Math.round((notConnected / totalProspectsCount) * 100) : 0;
  const repliedPct = totalProspectsCount > 0 ? Math.round((replied / totalProspectsCount) * 100) : 0;

  // Quotas du jour réels (cible journalière aléatoire dérivée de l'offre, calculée côté serveur)
  const dailyInvites = stats?.linkedInAccount?.dailyInvitesSent || 0;
  const maxInvites = stats?.linkedInAccount?.dailyInvitesTarget ?? 0;
  const invitesGaugePct = Math.min(Math.round((dailyInvites / Math.max(maxInvites, 1)) * 100), 100);

  const dailyMsg = stats?.linkedInAccount?.dailyMsgSent || 0;
  const maxMsg = stats?.linkedInAccount?.dailyMsgTarget ?? 0;
  const msgGaugePct = Math.min(Math.round((dailyMsg / Math.max(maxMsg, 1)) * 100), 100);

  const responseRateNum = stats?.responseRate || 0;
  const acceptanceRateNum = stats?.acceptanceRate || 0;

  const seriesTotals = {
    actions: evolutionChartData.reduce((acc, c) => acc + c.actionsTotal, 0),
    prospects: evolutionChartData.reduce((acc, c) => acc + c.prospectsCount, 0),
    replies: evolutionChartData.reduce((acc, c) => acc + c.repliesCount, 0),
  };

  const toggleSeries = (key: keyof typeof visibleSeries) =>
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }));

  const seriesChip = (key: keyof typeof visibleSeries, label: string, color: string) => (
    <button
      type="button"
      onClick={() => toggleSeries(key)}
      aria-pressed={visibleSeries[key]}
      className={`inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors ${
        visibleSeries[key] ? "border-line-2 bg-surface text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: visibleSeries[key] ? color : CHART.line }} aria-hidden />
      {label}
      <span className="tabular-nums text-xs text-muted">{seriesTotals[key]}</span>
    </button>
  );

  const axisProps = { stroke: CHART.axis, fontSize: 11, tickLine: false } as const;
  const linkedIn = stats?.linkedInAccount;
  const ownerName = stats?.owner?.name || user?.name || user?.email || "";
  const orgName = stats?.owner?.organizationName || user?.organization?.name || "Espace de travail";
  const isOwner = stats?.owner?.orgRole === "OWNER" || user?.orgRole === "OWNER";

  const connectLinkedIn = () => (openLinkedInModal ? openLinkedInModal() : navigate("/team"));

  if (loading && !stats) {
    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6" aria-busy>
        <div className="space-y-2">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-3 w-96" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-56 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
        <Skeleton className="h-80 rounded-2xl" />
        <SkeletonStatRow columns={3} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title={`Bonjour, ${user?.name || "bienvenue"}`}
        description={
          viewMode === "team"
            ? "Quotas, prospects et campagnes de l'ensemble de vos collaborateurs."
            : "Vos indicateurs de prospection, calculés en direct sur vos données."
        }
        actions={
          <>
            {teamMetrics && teamMetrics.totalMembers > 1 && (
              <Tabs
                variant="segmented"
                size="sm"
                aria-label="Vue"
                value={viewMode}
                onChange={(v) => setViewMode(v as "personal" | "team")}
                items={[
                  { id: "personal", label: "Ma vue" },
                  { id: "team", label: "Équipe", count: teamMetrics.totalMembers, icon: Users },
                ]}
              />
            )}
            <IconButton
              label="Actualiser les données"
              icon={RotateCw}
              size="md"
              onClick={() => loadStats(true)}
              disabled={loading || isRefreshing}
              className={isRefreshing ? "[&>svg]:animate-spin" : undefined}
            />
            <Button icon={Send} onClick={onStartCampaign || (() => navigate("/campaigns"))}>
              Démarrer une campagne
            </Button>
          </>
        }
      />

      {viewMode === "team" && teamMetrics ? (
        <div className="space-y-6">
          <StatRow columns={4}>
            <Stat label="Membres" value={teamMetrics.totalMembers} hint={`${teamMetrics.connectedAccounts} compte(s) LinkedIn connecté(s)`} />
            <Stat label="Prospects" value={teamMetrics.totalProspects} hint="gérés par l'équipe" />
            <Stat label="Campagnes actives" value={teamMetrics.activeCampaigns} hint={`${teamMetrics.totalCampaigns} créée(s) au total`} />
            <Stat
              label="Actions du jour"
              value={teamMetrics.totalInvitesSent + teamMetrics.totalMsgSent}
              hint={`${teamMetrics.totalInvitesSent} invitations · ${teamMetrics.totalMsgSent} messages`}
            />
          </StatRow>

          <Card padding="none">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold text-ink">Activité par collaborateur</h2>
              <p className="mt-0.5 text-sm text-muted">Cadence de prospection de chaque membre — basculez sur un compte en un clic.</p>
            </div>
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Membre</Th>
                    <Th>Rôle</Th>
                    <Th>LinkedIn</Th>
                    <Th className="text-right">Invitations</Th>
                    <Th className="text-right">Messages</Th>
                    <Th className="text-right">Campagnes</Th>
                    <Th className="text-right">Prospects</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {teamMetrics.membersBreakdown.map((m) => (
                    <Tr key={m.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={m.name || m.email} src={m.avatarUrl} size="md" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{m.name || "Collaborateur"}</p>
                            <p className="truncate text-xs text-muted">{m.email}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={m.orgRole === "OWNER" ? "accent" : "neutral"}>{m.orgRole === "OWNER" ? "Propriétaire" : "Membre"}</Badge>
                      </Td>
                      <Td>
                        {m.hasLinkedInAccount ? (
                          <StatusDot tone="ok">{m.linkedInAccountName || "Connecté"}</StatusDot>
                        ) : (
                          <StatusDot tone="warn">Non connecté</StatusDot>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {m.dailyInvitesSent} <span className="text-muted">/ {m.dailyInvitesTarget ?? "–"}</span>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {m.dailyMsgSent} <span className="text-muted">/ {m.dailyMsgTarget ?? "–"}</span>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {m.activeCampaigns} <span className="text-muted">/ {m.totalCampaigns}</span>
                      </Td>
                      <Td className="text-right tabular-nums">{m.totalProspects}</Td>
                      <Td className="text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={ArrowRightLeft}
                          onClick={() => {
                            setSelectedMemberId(m.id === user?.id ? null : m.id);
                            if (onStartCampaign) onStartCampaign();
                          }}
                          title="Basculer sur ce compte pour gérer ses campagnes"
                        >
                          Gérer
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Compte LinkedIn */}
            <Card padding="lg" className="flex flex-col justify-between gap-6 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  <Avatar name={linkedIn?.accountName || "LinkedIn"} src={linkedIn?.profilePicture} size="lg" />
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-ink">
                      {linkedIn ? linkedIn.accountName : "Aucun compte LinkedIn connecté"}
                    </h2>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {linkedIn ? linkedIn.headline || "Compte LinkedIn lié" : "Connectez votre compte pour lancer vos campagnes."}
                    </p>
                  </div>
                </div>
                {linkedIn ? (
                  <StatusDot tone="ok">Connecté</StatusDot>
                ) : (
                  <Button size="sm" iconRight={ArrowRight} onClick={connectLinkedIn}>
                    Connecter LinkedIn
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6 border-t border-line pt-5">
                <Stat label="Réponses reçues" value={replied} hint={`${stats?.executedActionsCount || 0} action(s) exécutée(s) au total`} />
                <Stat
                  label="Taux de réponse"
                  value={`${responseRateNum}%`}
                  hint={totalProspectsCount > 0 ? `${replied} sur ${totalProspectsCount} contacts` : "Aucun prospect"}
                />
              </div>

              <div className="space-y-2 border-t border-line pt-5">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Quotas du jour</span>
                  <span className="tabular-nums text-ink">
                    {dailyInvites} / {maxInvites} invitations · {dailyMsg} / {maxMsg} messages
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-line" title={`Invitations : ${dailyInvites}/${maxInvites}`}>
                    <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${invitesGaugePct}%` }} />
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line" title={`Messages : ${dailyMsg}/${maxMsg}`}>
                    <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${msgGaugePct}%` }} />
                  </div>
                </div>
              </div>
            </Card>

            {/* Identité */}
            <Card padding="lg" className="flex flex-col justify-between gap-5">
              <div className="flex items-center justify-between gap-2">
                <Badge>{isOwner ? "Propriétaire" : "Collaborateur"}</Badge>
                {linkedIn ? (
                  <StatusDot tone="ok" className="text-xs">
                    LinkedIn connecté
                  </StatusDot>
                ) : (
                  <button
                    type="button"
                    onClick={connectLinkedIn}
                    className="rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <StatusDot tone="warn" className="text-xs hover:text-ink">
                      LinkedIn non connecté
                    </StatusDot>
                  </button>
                )}
              </div>

              <div className="flex flex-col items-center text-center">
                <Avatar name={ownerName} src={stats?.owner?.avatarUrl || user?.avatarUrl} size="xl" />
                <h3 className="mt-3 max-w-full truncate text-base font-semibold text-ink">{ownerName}</h3>
                <p className="mt-0.5 flex max-w-full items-center gap-1.5 text-sm text-muted">
                  <WorkspaceAvatar name={orgName} avatarUrl={user?.organization?.avatarUrl} className="h-4 w-4 rounded" textClassName="text-[9px]" />
                  <span className="truncate">{orgName}</span>
                </p>
              </div>

              <div className="grid grid-cols-3 divide-x divide-line border-t border-line pt-4 text-center">
                {[
                  { label: "En relation", value: connected, to: "/prospects" },
                  { label: "En attente", value: pending, to: "/prospects" },
                  { label: "Prospects", value: totalProspectsCount, to: "/prospects" },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className="rounded-md px-1 py-1 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <p className="display text-xl tabular-nums">{item.value}</p>
                    <p className="text-xs text-muted">{item.label}</p>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Évolution */}
          <Card padding="lg" className="space-y-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div>
                <h2 className="text-base font-semibold text-ink">Évolution de l'activité</h2>
                <p className="mt-0.5 text-sm text-muted">Actions exécutées, prospects ajoutés et réponses reçues, jour par jour.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  {seriesChip("actions", "Actions", CHART.accent)}
                  {seriesChip("prospects", "Prospects", CHART.ink)}
                  {seriesChip("replies", "Réponses", CHART.grey)}
                </div>
                <Tabs
                  variant="segmented"
                  size="sm"
                  aria-label="Type de graphique"
                  value={chartType}
                  onChange={(v) => setChartType(v as "area" | "bar")}
                  items={[
                    { id: "area", label: <span className="sr-only">Courbes</span>, icon: Activity },
                    { id: "bar", label: <span className="sr-only">Barres</span>, icon: BarChart3 },
                  ]}
                />
                <Tabs
                  variant="segmented"
                  size="sm"
                  aria-label="Période"
                  value={timeRange}
                  onChange={(v) => setTimeRange(v as "7d" | "30d")}
                  items={[
                    { id: "7d", label: "7 jours" },
                    { id: "30d", label: "30 jours" },
                  ]}
                />
              </div>
            </div>

            <div className="h-72 w-full sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "area" ? (
                  <AreaChart data={evolutionChartData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="dayLabel" {...axisProps} axisLine={{ stroke: CHART.grid }} />
                    <YAxis {...axisProps} axisLine={false} allowDecimals={false} />
                    <RechartsTooltip content={<CustomEvolutionTooltip />} cursor={{ stroke: CHART.line }} />
                    {visibleSeries.actions && (
                      <Area
                        type="monotone"
                        dataKey="actionsTotal"
                        name="Actions exécutées"
                        stroke={CHART.accent}
                        strokeWidth={2}
                        fill={CHART.accent}
                        fillOpacity={0.06}
                        dot={false}
                        activeDot={{ r: 4, fill: CHART.accent, stroke: "#fff", strokeWidth: 2 }}
                      />
                    )}
                    {visibleSeries.prospects && (
                      <Area
                        type="monotone"
                        dataKey="prospectsCount"
                        name="Prospects ajoutés"
                        stroke={CHART.ink}
                        strokeWidth={2}
                        fill={CHART.ink}
                        fillOpacity={0.04}
                        dot={false}
                        activeDot={{ r: 4, fill: CHART.ink, stroke: "#fff", strokeWidth: 2 }}
                      />
                    )}
                    {visibleSeries.replies && (
                      <Area
                        type="monotone"
                        dataKey="repliesCount"
                        name="Réponses reçues"
                        stroke={CHART.grey}
                        strokeWidth={2}
                        fill={CHART.grey}
                        fillOpacity={0.04}
                        dot={false}
                        activeDot={{ r: 4, fill: CHART.grey, stroke: "#fff", strokeWidth: 2 }}
                      />
                    )}
                  </AreaChart>
                ) : (
                  <BarChart data={evolutionChartData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="dayLabel" {...axisProps} axisLine={{ stroke: CHART.grid }} />
                    <YAxis {...axisProps} axisLine={false} allowDecimals={false} />
                    <RechartsTooltip content={<CustomEvolutionTooltip />} cursor={{ fill: "rgba(33,22,76,0.04)" }} />
                    {visibleSeries.actions && <Bar dataKey="actionsTotal" name="Actions exécutées" fill={CHART.accent} radius={[3, 3, 0, 0]} />}
                    {visibleSeries.prospects && <Bar dataKey="prospectsCount" name="Prospects ajoutés" fill={CHART.ink} radius={[3, 3, 0, 0]} />}
                    {visibleSeries.replies && <Bar dataKey="repliesCount" name="Réponses reçues" fill={CHART.grey} radius={[3, 3, 0, 0]} />}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Entonnoir */}
          <Card padding="lg" className="space-y-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-base font-semibold text-ink">Entonnoir de conversion</h2>
                <p className="mt-0.5 text-sm text-muted">Répartition de vos {totalProspectsCount} prospects par statut.</p>
              </div>
              <Button variant="ghost" size="sm" iconRight={ChevronRight} onClick={() => navigate("/prospects")}>
                Tous les prospects
              </Button>
            </div>

            <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
              <div className="relative flex items-center justify-center lg:col-span-4">
                <div className="relative flex h-52 w-52 items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <RechartsTooltip content={<CustomDonutTooltip />} />
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={68}
                        outerRadius={84}
                        paddingAngle={2}
                        dataKey="value"
                        cornerRadius={3}
                        stroke="none"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute flex flex-col items-center text-center">
                    <span className="display text-2xl tabular-nums">{totalProspectsCount}</span>
                    <span className="text-xs text-muted">prospects</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-8">
                {[
                  { label: "Non connectés", value: notConnected, pct: notConnectedPct, hint: "Importés, pas encore invités", color: CHART.line, to: "/prospects" },
                  { label: "Invitations en attente", value: pending, pct: pendingPct, hint: "Envoyées sur LinkedIn", color: CHART.grey, to: "/prospects" },
                  { label: "En relation", value: connected, pct: connectedPct, hint: `Taux d'acceptation : ${acceptanceRateNum}%`, color: CHART.ink, to: "/prospects" },
                  { label: "Ayant répondu", value: replied, pct: repliedPct, hint: `Taux de réponse : ${responseRateNum}%`, color: CHART.accent, to: "/inbox" },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className="rounded-xl border border-line p-4 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm text-muted">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
                        {item.label}
                      </span>
                      <span className="tabular-nums text-xs text-muted">{item.pct}%</span>
                    </div>
                    <div className="display text-2xl tabular-nums">{item.value}</div>
                    <p className="mt-0.5 text-xs text-muted">{item.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Indicateurs */}
          <StatRow columns={3}>
            <Stat label="Taux d'acceptation" value={`${acceptanceRateNum}%`} hint={`${connected} acceptés sur ${totalProspectsCount} contacts`} />
            <Stat
              label="Campagnes actives"
              value={stats?.activeCampaignsCount || 0}
              hint={`${stats?.queuedActionsCount || 0} action(s) planifiée(s) dans la file`}
            />
            <Stat label="Coordonnées enrichies" value={`${stats?.emailsFoundCount || 0} e-mails`} hint={`${stats?.phonesFoundCount || 0} téléphones trouvés`} />
          </StatRow>
        </>
      )}
    </div>
  );
};
