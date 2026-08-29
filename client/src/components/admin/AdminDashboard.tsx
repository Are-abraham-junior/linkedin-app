import React, { useState, useEffect } from "react";
import { apiRequest } from "../../services/api";
import { PlatformMetrics } from "../../types";
import {
  Users,
  Building2,
  Send,
  MessageSquare,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  UserPlus,
  RefreshCw,
  Sparkles,
} from "lucide-react";

interface AdminDashboardProps {
  onNavigateToUsers: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateToUsers }) => {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/admin/metrics");
      if (res.success && res.metrics) {
        setMetrics(res.metrics);
        setRecentUsers(res.recentUsers || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge-tag bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20">
              <ShieldCheck className="w-3.5 h-3.5" /> Centre de Contrôle SaaS
            </span>
            <span className="badge-tag bg-[#a2ea13]/20 text-[#3c6b00] border border-[#a2ea13]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#528f03] animate-pulse"></span> Unipile API Active
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#21164c] tracking-tight">
            Tableau de Bord Super Admin
          </h1>
          <p className="text-sm text-[#5f5f69] mt-1">
            Supervision globale des utilisateurs, organisations et infrastructure LinkedIn.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchMetrics}
            className="p-2.5 rounded-xl border border-[#e0e0db] bg-white hover:bg-[#f5f5f7] text-[#353241] text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
          <button
            onClick={onNavigateToUsers}
            className="py-2.5 px-4 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 flex items-center gap-2 transition-all transform active:scale-95"
          >
            <Users className="w-4 h-4" /> Gérer les Utilisateurs
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Users */}
        <div className="adora-card p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5f5f69]">Utilisateurs SaaS</span>
            <div className="w-10 h-10 rounded-2xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#21164c]">
            {loading ? "..." : metrics?.totalUsers || 0}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-[#5f5f69]">
            <span className="text-[#592eff] font-bold">
              {metrics?.usersByRole?.["SUPER_ADMIN"] || 1} Super Admin
            </span>
            <span>•</span>
            <span>{metrics?.usersByRole?.["USER"] || 0} Membres</span>
          </div>
        </div>

        {/* Organizations */}
        <div className="adora-card p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5f5f69]">Organisations</span>
            <div className="w-10 h-10 rounded-2xl bg-[#2ed6ff]/10 text-[#0089a8] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#21164c]">
            {loading ? "..." : metrics?.totalOrganizations || 0}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Espaces actifs
          </div>
        </div>

        {/* Active Campaigns */}
        <div className="adora-card p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5f5f69]">Campagnes Actives</span>
            <div className="w-10 h-10 rounded-2xl bg-[#a2ea13]/20 text-[#477300] flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#21164c]">
            {loading ? "..." : metrics?.activeCampaigns || 0}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-[#5f5f69]">
            <span>Sur un total de</span>
            <span className="font-bold text-[#21164c]">{metrics?.totalCampaigns || 0} campagnes</span>
          </div>
        </div>

        {/* LinkedIn Synchronized Accounts */}
        <div className="adora-card p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5f5f69]">Comptes Unipile</span>
            <div className="w-10 h-10 rounded-2xl bg-[#0a66c2]/10 text-[#0a66c2] flex items-center justify-center">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.2a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#21164c]">
            {loading ? "..." : metrics?.connectedAccounts || 0}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Synchronisation active
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Users List */}
        <div className="lg:col-span-2 adora-card p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#21164c]">Derniers Utilisateurs Inscrits</h2>
              <p className="text-xs text-[#5f5f69]">Membres et administrateurs récemment ajoutés</p>
            </div>
            <button
              onClick={onNavigateToUsers}
              className="text-xs font-bold text-[#592eff] hover:underline flex items-center gap-1"
            >
              Voir tout ({metrics?.totalUsers || 0}) <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#e0e0db] text-[#5f5f69] uppercase font-bold">
                  <th className="pb-3">Utilisateur</th>
                  <th className="pb-3">Organisation</th>
                  <th className="pb-3">Rôle</th>
                  <th className="pb-3">Statut LinkedIn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0e0db]/50">
                {recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#f8f9fc] transition-colors">
                    <td className="py-3.5 flex items-center gap-3">
                      <img
                        src={
                          u.avatarUrl ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.email)}&background=592eff&color=fff`
                        }
                        alt={u.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-bold text-[#21164c]">{u.name || "Sans nom"}</p>
                        <p className="text-[11px] text-[#5f5f69]">{u.email}</p>
                      </div>
                    </td>
                    <td className="py-3.5 text-[#353241] font-medium">
                      {u.organization?.name || "Espace Solo"}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`badge-tag ${
                          u.role === "SUPER_ADMIN"
                            ? "bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20"
                            : u.role === "ADMIN"
                            ? "bg-[#2ed6ff]/10 text-[#0089a8] border border-[#2ed6ff]/30"
                            : "bg-[#f5f5f7] text-[#5f5f69] border border-[#e0e0db]"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5">
                      {u.accounts?.length > 0 && u.accounts[0].status === "CONNECTED" ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Connecté
                        </span>
                      ) : (
                        <span className="text-[#5f5f69] italic">En attente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Platform Health & Quotas Monitor */}
        <div className="space-y-6">
          <div className="adora-card p-6">
            <h3 className="text-sm font-bold text-[#21164c] mb-1 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#592eff]" /> Santé de la Plateforme
            </h3>
            <p className="text-xs text-[#5f5f69] mb-4">Statuts des services critiques</p>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db] flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#21164c]">Base de Données PostgreSQL</p>
                  <p className="text-[11px] text-[#5f5f69]">Prisma Postgres (Pooled 5432)</p>
                </div>
                <span className="badge-tag bg-emerald-50 text-emerald-600 border border-emerald-200">
                  En ligne
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db] flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#21164c]">Passerelle API Unipile</p>
                  <p className="text-[11px] text-[#5f5f69]">Connecteurs LinkedIn & Webhooks</p>
                </div>
                <span className="badge-tag bg-emerald-50 text-emerald-600 border border-emerald-200">
                  Opérationnel
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db] flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#21164c]">Queue & Délai Anti-Ban</p>
                  <p className="text-[11px] text-[#5f5f69]">Jitter aléatoire (80s - 240s)</p>
                </div>
                <span className="badge-tag bg-emerald-50 text-emerald-600 border border-emerald-200">
                  Actif
                </span>
              </div>
            </div>
          </div>

          <div className="adora-card p-6 bg-gradient-to-br from-[#592eff] to-[#3a18b8] text-white">
            <h3 className="text-sm font-bold mb-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#dfff9d]" /> Quotas Globaux LinkedIn
            </h3>
            <p className="text-xs text-white/80 mb-4">
              Limites de sécurité imposées pour protéger l'ensemble des comptes connectés.
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/80">Invitations quotidiennes max :</span>
                <span className="font-bold">30 à 50 / compte</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/80">Messages de relance max :</span>
                <span className="font-bold">70 à 100 / compte</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
