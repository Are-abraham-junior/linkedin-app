import React, { useState, useEffect } from "react";
import {
  X,
  Play,
  Pause,
  Users,
  Send,
  UserCheck,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Search,
  Filter,
  Layers,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Campaign, ProspectStepStatus } from "../../types";
import { apiRequest } from "../../services/api";

interface CampaignDetailModalProps {
  campaignId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusToggled: () => void;
}

interface CampaignProspectDetail {
  id: string;
  stateId: string;
  firstName: string;
  lastName: string;
  headline?: string;
  company?: string;
  avatarUrl?: string;
  linkedinUrl: string;
  connectionStatus?: string;
  currentStepOrder: number;
  currentStepType: string;
  status: ProspectStepStatus;
  nextExecutionAt?: string;
  lastActionAt?: string;
  errorLog?: string;
}

export const CampaignDetailModal: React.FC<CampaignDetailModalProps> = ({
  campaignId,
  isOpen,
  onClose,
  onStatusToggled,
}) => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [prospects, setProspects] = useState<CampaignProspectDetail[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchDetails = async () => {
    if (!campaignId) return;
    setLoading(true);

    try {
      const data = await apiRequest<{ campaign: any }>(`/campaigns/${campaignId}`);
      if (data.success && data.campaign) {
        setCampaign(data.campaign);
        setProspects(data.campaign.prospects || []);
        setStats(data.campaign.stats);
      }
    } catch (err) {
      console.error("Erreur chargement détails campagne:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && campaignId) {
      fetchDetails();
    }
  }, [isOpen, campaignId]);

  if (!isOpen || !campaignId) return null;

  const handleToggleStatus = async () => {
    if (!campaign) return;
    setActionLoading(true);
    try {
      const data = await apiRequest<{ campaign: any }>(`/campaigns/${campaign.id}/toggle-status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
        }),
      });
      if (data.success && data.campaign) {
        setCampaign({ ...campaign, status: data.campaign.status });
        onStatusToggled();
      }
    } catch (err) {
      console.error("Erreur toggle status:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredProspects = prospects.filter((p) => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    const company = (p.company || "").toLowerCase();
    const matchesSearch =
      fullName.includes(searchTerm.toLowerCase()) || company.includes(searchTerm.toLowerCase());

    if (statusFilter === "ALL") return matchesSearch;
    return matchesSearch && p.status === statusFilter;
  });

  const getStatusBadge = (status: ProspectStepStatus) => {
    switch (status) {
      case "WAITING_CONDITION":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3" /> Attend acceptation
          </span>
        );
      case "WAITING_DELAY":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3" /> Délai en cours
          </span>
        );
      case "REPLIED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1 w-fit">
            <MessageSquare className="w-3 h-3" /> A répondu (Succès)
          </span>
        );
      case "COMPLETED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3" /> Séquence terminée
          </span>
        );
      case "FAILED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200/60 flex items-center gap-1 w-fit">
            <AlertCircle className="w-3 h-3" /> Échec
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3" /> En attente
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-[32px] shadow-2xl border border-[#e0e0db] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-8 pt-7 pb-5 border-b border-[#f0f0ed] bg-[#fafafd] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center border border-[#592eff]/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-[#21164c] tracking-tight">
                  {campaign?.name || "Détails de la campagne"}
                </h2>
                {campaign && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      campaign.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        : campaign.status === "PAUSED"
                        ? "bg-amber-100 text-amber-700 border border-amber-200"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {campaign.status === "ACTIVE"
                      ? "En cours"
                      : campaign.status === "PAUSED"
                      ? "En pause"
                      : "Brouillon"}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#5f5f69] mt-0.5">
                Suivi de l'entonnoir de conversion et état d'avancement des prospects
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {campaign && (
              <button
                disabled={actionLoading}
                onClick={handleToggleStatus}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                  campaign.status === "ACTIVE"
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : "bg-[#592eff] hover:bg-[#4d25e0] text-white shadow-[#592eff]/25"
                }`}
              >
                {campaign.status === "ACTIVE" ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Mettre en pause
                  </>
                ) : campaign.status === "DRAFT" ? (
                  <>
                    <Play className="w-3.5 h-3.5" /> Lancer la campagne
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Reprendre la campagne
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full text-[#5f5f69] hover:text-[#21164c] hover:bg-[#f0f0ed] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-7">
          {loading ? (
            <div className="text-center py-20 text-[#5f5f69] text-sm">
              Chargement des détails de la campagne...
            </div>
          ) : (
            <>
              {/* Funnel de conversion Waalaxy */}
              <div className="p-6 rounded-[24px] bg-gradient-to-r from-[#fafafd] to-[#f4f3fe] border border-[#e0e0db]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-[#21164c] uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#592eff]" />
                    Entonnoir de conversion de la séquence
                  </h3>
                  <span className="text-xs font-bold text-[#592eff]">
                    {stats?.total || 0} prospect(s) inscrits
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-white border border-[#e0e0db] shadow-sm">
                    <span className="text-[11px] text-[#5f5f69] block mb-1">Inscrits</span>
                    <span className="text-xl font-extrabold text-[#21164c]">
                      {stats?.total || 0}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">100% de l'audience</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-[#e0e0db] shadow-sm">
                    <span className="text-[11px] text-[#5f5f69] block mb-1">Acceptations</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-extrabold text-[#21164c]">
                        {stats?.accepted || 0}
                      </span>
                      <span className="text-xs font-bold text-emerald-600">
                        {stats?.acceptanceRate || 0}%
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">Taux d'acceptation</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-[#e0e0db] shadow-sm">
                    <span className="text-[11px] text-[#5f5f69] block mb-1">Réponses (Inbox)</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-extrabold text-[#21164c]">
                        {stats?.replied || 0}
                      </span>
                      <span className="text-xs font-bold text-[#592eff]">
                        {stats?.replyRate || 0}%
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">Sur acceptés</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-[#e0e0db] shadow-sm">
                    <span className="text-[11px] text-[#5f5f69] block mb-1">En attente</span>
                    <span className="text-xl font-extrabold text-amber-600">
                      {(stats?.waitingCondition || 0) + (stats?.waitingDelay || 0)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">Actions planifiées</span>
                  </div>
                </div>
              </div>

              {/* Tableau des prospects de la campagne */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Rechercher par nom ou entreprise..."
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#e0e0db] text-xs text-[#21164c] focus:outline-none focus:border-[#592eff]"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-[#5f5f69]" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-[#e0e0db] text-xs font-bold text-[#21164c] bg-white focus:outline-none focus:border-[#592eff]"
                    >
                      <option value="ALL">Tous les statuts</option>
                      <option value="WAITING_CONDITION">Attend acceptation</option>
                      <option value="WAITING_DELAY">Délai en cours</option>
                      <option value="REPLIED">A répondu</option>
                      <option value="COMPLETED">Séquence terminée</option>
                      <option value="FAILED">Échec</option>
                    </select>
                  </div>
                </div>

                <div className="border border-[#e0e0db] rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#fafafd] border-b border-[#e0e0db] text-[#5f5f69] font-bold">
                      <tr>
                        <th className="px-4 py-3">Prospect</th>
                        <th className="px-4 py-3">Entreprise</th>
                        <th className="px-4 py-3">Étape actuelle</th>
                        <th className="px-4 py-3">Statut</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0ed]">
                      {filteredProspects.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-[#5f5f69]">
                            Aucun prospect trouvé dans cette vue.
                          </td>
                        </tr>
                      ) : (
                        filteredProspects.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={
                                    p.avatarUrl ||
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                      p.firstName + " " + p.lastName
                                    )}&background=592eff&color=fff`
                                  }
                                  alt={p.firstName}
                                  className="w-7 h-7 rounded-full object-cover shrink-0 border border-[#e0e0db]"
                                />
                                <div>
                                  <span className="font-bold text-[#21164c] block">
                                    {p.firstName} {p.lastName}
                                  </span>
                                  <span className="text-[10px] text-[#5f5f69] line-clamp-1">
                                    {p.headline || "Professionnel"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-[#353241] font-medium">
                              {p.company || "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="font-bold text-[#21164c] text-[11px]">
                                Étape {p.currentStepOrder}
                              </span>
                              <span className="text-[10px] text-[#5f5f69] block">
                                {p.currentStepType === "INVITATION" ? "Demande connexion" : "Relance message"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">{getStatusBadge(p.status)}</td>
                            <td className="px-4 py-2.5 text-right">
                              {p.linkedinUrl && (
                                <a
                                  href={p.linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg text-[#5f5f69] hover:text-[#592eff] hover:bg-[#592eff]/10 inline-flex transition-colors"
                                  title="Ouvrir le profil LinkedIn"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
