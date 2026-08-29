import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
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
} from "lucide-react";

export const MainDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await apiRequest("/user/dashboard-stats");
        if (res.success && res.stats) {
          setStats(res.stats);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#21164c] tracking-tight">
            Bonjour {user?.name?.split(" ")[0] || "Jean-Regis"},
          </h1>
          <p className="text-sm text-[#5f5f69] mt-1">
            Voici les performances de vos campagnes de prospection LinkedIn en cours.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select className="px-3.5 py-2 rounded-xl border border-[#e0e0db] bg-white text-xs text-[#353241] font-semibold focus:outline-none focus:border-[#592eff]">
            <option>30 derniers jours</option>
            <option>7 derniers jours</option>
            <option>Ce mois-ci</option>
          </select>
          <button className="py-2.5 px-5 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 flex items-center gap-2 transition-all transform active:scale-95">
            <Send className="w-3.5 h-3.5" /> Démarrer une campagne
          </button>
        </div>
      </div>

      {/* Waalaxy Top Hero Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Blue LinkedIn Hero Card */}
        <div className="lg:col-span-2 rounded-[32px] bg-gradient-to-br from-[#3b66ff] to-[#592eff] text-white p-7 sm:p-8 relative overflow-hidden shadow-lg shadow-[#592eff]/15 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.2a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28z" />
              </svg>
              <span className="font-bold text-sm">LinkedIn Prospection</span>
            </div>
            <span className="text-xs bg-white/15 px-3 py-1 rounded-full font-semibold">Synchronisé</span>
          </div>

          <div className="grid grid-cols-2 gap-6 my-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <span className="text-3xl sm:text-4xl font-extrabold">199</span>
              </div>
              <p className="text-xs text-white/80 mt-1 font-medium">Réponses à un message</p>
            </div>

            <div className="flex items-center justify-end gap-3">
              {/* Circular Progress Gauge */}
              <div className="relative w-16 h-16 flex items-center justify-center">
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
                    strokeDasharray="57, 100"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-sm font-extrabold">57%</span>
              </div>
              <span className="text-xs text-white/80 font-medium">Taux de réponse</span>
            </div>
          </div>

          <div className="text-xs text-white/80 flex items-center justify-between pt-4 border-t border-white/15">
            <span>Quota journalier : {user?.maxDailyInvites || 30} inv / {user?.maxDailyMsg || 70} msg</span>
            <span className="font-bold underline cursor-pointer">Voir la file d'attente →</span>
          </div>
        </div>

        {/* Right LinkedIn Profile Card */}
        <div className="adora-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="badge-tag bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20 text-[10px]">
              Plan Avancé
            </span>
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> En ligne
            </span>
          </div>

          <div className="text-center my-4">
            <img
              src={
                user?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=592eff&color=fff`
              }
              alt="Avatar"
              className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-[#592eff]"
            />
            <h3 className="font-extrabold text-[#21164c] text-base mt-2">{user?.name || "Jean-Regis N'GUESSAN"}</h3>
            <p className="text-xs text-[#5f5f69]">{user?.organization?.name || "Bime Link Technologies"}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 py-3 border-t border-[#e0e0db] text-center">
            <div>
              <p className="text-base font-extrabold text-[#21164c]">2 966</p>
              <p className="text-[10px] text-[#5f5f69] uppercase font-bold">Relations</p>
            </div>
            <div>
              <p className="text-base font-extrabold text-[#592eff]">489</p>
              <p className="text-[10px] text-[#5f5f69] uppercase font-bold">En attente</p>
            </div>
            <div>
              <p className="text-base font-extrabold text-[#21164c]">547</p>
              <p className="text-[10px] text-[#5f5f69] uppercase font-bold">Vues profil</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2nd Row: Detailed KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Invitations Acceptées */}
        <div className="adora-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#5f5f69] uppercase">Invitations Acceptées</span>
            <div className="text-2xl font-extrabold text-[#21164c] mt-1">342</div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +14.2% cette semaine
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
                strokeDasharray="57.8, 100"
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xs font-extrabold text-[#21164c]">57.8%</span>
          </div>
        </div>

        {/* Campagnes & File d'attente */}
        <div className="adora-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#5f5f69] uppercase">Campagnes Actives</span>
            <div className="text-2xl font-extrabold text-[#21164c] mt-1">
              {stats?.activeCampaignsCount || 3}
            </div>
            <p className="text-[11px] text-[#592eff] font-semibold mt-2">
              355 actions planifiées
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center">
            <Send className="w-6 h-6" />
          </div>
        </div>

        {/* Emails Pro Trouvés */}
        <div className="adora-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#5f5f69] uppercase">Emails Pro Trouvés</span>
            <div className="text-2xl font-extrabold text-[#21164c] mt-1">19</div>
            <p className="text-[11px] text-[#5f5f69] font-medium mt-2">
              Taux d'enrichissement : 28.4%
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#2ed6ff]/15 text-[#008ba8] flex items-center justify-center">
            <Mail className="w-6 h-6" />
          </div>
        </div>
      </div>
    </div>
  );
};
