import React, { useState, useEffect } from "react";
import {
  Rocket,
  Plus,
  Play,
  Pause,
  Trash2,
  TrendingUp,
  Users,
  MessageSquare,
  UserCheck,
  Clock,
  Layers,
  ChevronRight,
  Sparkles,
  AlertCircle,
  MoreVertical,
  CheckCircle2,
} from "lucide-react";
import { Campaign, CampaignStatus } from "../../types";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { CampaignWizardModal } from "./CampaignWizardModal";
import { CampaignDetailModal } from "./CampaignDetailModal";
import { QueueView } from "./QueueView";
import { ConfirmModal } from "../common/ConfirmModal";
import { LinkedInRequiredModal } from "../common/LinkedInRequiredModal";

export const CampaignsView: React.FC = () => {
  const { user, openLinkedInModal, selectedMemberId, setSelectedMemberId, impersonatedOrg } = useAuth();
  const [subTab, setSubTab] = useState<"CAMPAIGNS" | "QUEUE">("CAMPAIGNS");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Suppression Modal State
  const [campaignToDelete, setCampaignToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingCampaign, setIsDeletingCampaign] = useState(false);
  const [deleteCampaignError, setDeleteCampaignError] = useState<string | null>(null);
  const [showLinkedInRequiredModal, setShowLinkedInRequiredModal] = useState<boolean>(false);
  const [requiredFeatureName, setRequiredFeatureName] = useState<string>("");

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const query = selectedMemberId && selectedMemberId !== "ALL" ? `?memberId=${selectedMemberId}` : "";
      const res = await apiRequest<{ campaigns: Campaign[] }>(`/campaigns${query}`);
      if (res.success && Array.isArray(res.campaigns)) {
        setCampaigns(res.campaigns);
      }
    } catch (err) {
      console.error("Erreur récupération campagnes:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await apiRequest<{ members: any[] }>("/team/members");
      if (res.success && Array.isArray(res.members)) {
        setTeamMembers(res.members);
      }
    } catch (err) {
      console.error("Erreur récupération membres:", err);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [selectedMemberId]);

  useEffect(() => {
    if (user?.role === "SUPER_ADMIN" || user?.orgRole === "OWNER") {
      fetchMembers();
    }
  }, [user?.role, user?.orgRole, impersonatedOrg]);

  const handleOpenWizard = () => {
    if (!user?.hasLinkedInAccount) {
      setRequiredFeatureName("Création de campagne");
      setShowLinkedInRequiredModal(true);
      return;
    }
    setIsWizardOpen(true);
  };

  const handleToggleStatus = async (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user?.hasLinkedInAccount && campaign.status !== "ACTIVE") {
      setRequiredFeatureName("Lancement de campagne");
      setShowLinkedInRequiredModal(true);
      return;
    }

    setTogglingId(campaign.id);
    const newStatus = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";

    try {
      const res = await apiRequest<{ campaign: Campaign }>(`/campaigns/${campaign.id}/toggle-status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.success) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === campaign.id ? { ...c, status: newStatus } : c))
        );
      }
    } catch (err) {
      console.error("Erreur toggle status:", err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpenDeleteCampaign = (campaignId: string, campaignName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteCampaignError(null);
    setCampaignToDelete({ id: campaignId, name: campaignName });
  };

  const handleConfirmDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    setIsDeletingCampaign(true);
    setDeleteCampaignError(null);

    try {
      const res = await apiRequest(`/campaigns/${campaignToDelete.id}`, {
        method: "DELETE",
      });
      if (res.success) {
        setCampaigns((prev) => prev.filter((c) => c.id !== campaignToDelete.id));
        setCampaignToDelete(null);
      } else {
        setDeleteCampaignError(res.error || "Impossible de supprimer cette campagne.");
      }
    } catch (err: any) {
      console.error("Erreur suppression campagne:", err);
      setDeleteCampaignError(err?.message || "Erreur inattendue.");
    } finally {
      setIsDeletingCampaign(false);
    }
  };

  const handleOpenDetail = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setIsDetailOpen(true);
  };

  // Calcul des métriques globales
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const totalProspectsEnrolled = campaigns.reduce(
    (sum, c) => sum + (c.stats?.totalProspects || 0),
    0
  );
  const totalAccepted = campaigns.reduce(
    (sum, c) => sum + (c.stats?.acceptedCount || 0),
    0
  );
  const totalReplied = campaigns.reduce(
    (sum, c) => sum + (c.stats?.repliedCount || 0),
    0
  );
  const averageAcceptanceRate =
    totalProspectsEnrolled > 0
      ? Math.round((totalAccepted / totalProspectsEnrolled) * 100)
      : 0;

  const filteredCampaigns = campaigns.filter((c) => {
    if (filterStatus === "ALL") return true;
    return c.status === filterStatus;
  });

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#fbfbfe] overflow-y-auto custom-scrollbar">
      {/* Sub-navigation Header Tabs */}
      <div className="px-6 sm:px-8 pt-6 pb-2 border-b border-[#e0e0db]/60 bg-white sticky top-0 z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-[#f5f5f7] p-1 rounded-2xl">
          <button
            onClick={() => setSubTab("CAMPAIGNS")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === "CAMPAIGNS"
                ? "bg-white text-[#21164c] shadow-sm"
                : "text-[#5f5f69] hover:text-[#21164c]"
            }`}
          >
            <Rocket className="w-3.5 h-3.5 text-[#592eff]" />
            <span>Mes Campagnes</span>
            <span className="bg-[#592eff]/10 text-[#592eff] text-[10px] px-2 py-0.5 rounded-full font-bold">
              {totalCampaigns}
            </span>
          </button>

          <button
            onClick={() => setSubTab("QUEUE")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === "QUEUE"
                ? "bg-white text-[#21164c] shadow-sm"
                : "text-[#5f5f69] hover:text-[#21164c]"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[#2ed6ff]" />
            <span>File d'attente</span>
          </button>
        </div>

        {subTab === "CAMPAIGNS" && (
          <button
            onClick={handleOpenWizard}
            className="px-4 py-2 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle campagne</span>
          </button>
        )}
      </div>

      {/* Main Content View */}
      {subTab === "QUEUE" ? (
        <QueueView />
      ) : (
        <div className="p-6 sm:p-8 space-y-7">
          {/* Header View */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black text-[#21164c] tracking-tight">
                  Campagnes de prospection
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20">
                  {totalCampaigns}
                </span>
              </div>
              <p className="text-xs text-[#5f5f69] mt-1">
                Gérez vos séquences d'invitations et de relances automatisées sur LinkedIn
              </p>
            </div>
          </div>

      {/* Cartes de KPIs Globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="adora-card p-5 bg-white border border-[#e0e0db] rounded-[24px] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-[#5f5f69] font-medium block mb-1">
              Campagnes actives
            </span>
            <span className="text-2xl font-extrabold text-[#21164c]">
              {activeCampaigns}
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <Rocket className="w-5 h-5" />
          </div>
        </div>

        <div className="adora-card p-5 bg-white border border-[#e0e0db] rounded-[24px] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-[#5f5f69] font-medium block mb-1">
              Prospects engagés
            </span>
            <span className="text-2xl font-extrabold text-[#21164c]">
              {totalProspectsEnrolled}
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center border border-[#592eff]/20">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="adora-card p-5 bg-white border border-[#e0e0db] rounded-[24px] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-[#5f5f69] font-medium block mb-1">
              Taux moyen d'acceptation
            </span>
            <span className="text-2xl font-extrabold text-emerald-600">
              {averageAcceptanceRate}%
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="adora-card p-5 bg-white border border-[#e0e0db] rounded-[24px] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-[#5f5f69] font-medium block mb-1">
              Réponses obtenues
            </span>
            <span className="text-2xl font-extrabold text-[#592eff]">
              {totalReplied}
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center border border-[#592eff]/20">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filtres par statut & Collaborateur (Vue 360°) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0ed] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "ALL", label: "Toutes les campagnes" },
            { key: "ACTIVE", label: "En cours" },
            { key: "PAUSED", label: "En pause" },
            { key: "DRAFT", label: "Brouillons" },
            { key: "COMPLETED", label: "Terminées" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filterStatus === tab.key
                  ? "bg-[#592eff] text-white shadow-sm shadow-[#592eff]/25"
                  : "text-[#5f5f69] hover:text-[#21164c] hover:bg-slate-100/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sélecteur Collaborateur (Super Admin 360° ou Owner) */}
        {(user?.role === "SUPER_ADMIN" || user?.orgRole === "OWNER") && teamMembers.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#e0e0db] shadow-xs">
            <Users className="w-3.5 h-3.5 text-[#592eff]" />
            <span className="text-[11px] font-bold text-[#5f5f69]">Collaborateur :</span>
            <select
              value={selectedMemberId || "ALL"}
              onChange={(e) => setSelectedMemberId(e.target.value === "ALL" ? null : e.target.value)}
              className="text-xs font-bold text-[#21164c] bg-transparent border-none focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">🌟 Toute l'équipe (Vue 360°)</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  👤 {m.name || m.email} {m.orgRole === "OWNER" ? "(Propriétaire)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Grille des campagnes */}
      {loading ? (
        <div className="text-center py-20 text-[#5f5f69] text-xs">
          Chargement de vos campagnes...
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-[#e0e0db] rounded-[32px] bg-white">
          <Rocket className="w-12 h-12 text-[#592eff] mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-bold text-[#21164c] mb-1">
            Aucune campagne trouvée
          </h3>
          <p className="text-xs text-[#5f5f69] max-w-sm mx-auto mb-5 leading-relaxed">
            Créez votre première séquence automatisée d'invitations et de messages pour engager vos prospects LinkedIn.
          </p>
          <button
            onClick={handleOpenWizard}
            className="px-6 py-2.5 rounded-full bg-[#592eff] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 hover:bg-[#4d25e0] transition-all cursor-pointer"
          >
            Créer ma première campagne
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCampaigns.map((camp) => {
            const isActive = camp.status === "ACTIVE";
            const isPaused = camp.status === "PAUSED";
            const totalP = camp.stats?.totalProspects || 0;
            const acceptRate = camp.stats?.acceptanceRate || 0;
            const replyRate = camp.stats?.replyRate || 0;

            return (
              <div
                key={camp.id}
                onClick={() => handleOpenDetail(camp.id)}
                className="adora-card bg-white border border-[#e0e0db] hover:border-[#592eff]/40 rounded-[28px] p-6 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Top bar de la carte */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isPaused
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive
                              ? "bg-emerald-500 animate-pulse"
                              : isPaused
                              ? "bg-amber-500"
                              : "bg-slate-400"
                          }`}
                        />
                        {isActive ? "En cours" : isPaused ? "En pause" : "Brouillon"}
                      </span>

                      {(camp as any).author && (
                        <span className="badge-tag bg-[#592eff]/10 text-[#592eff] text-[10px] font-bold border border-[#592eff]/20 py-0.5 px-2">
                          <Users className="w-2.5 h-2.5" />
                          <span>{(camp as any).author.name}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleToggleStatus(camp, e)}
                        disabled={togglingId === camp.id}
                        className={`p-1.5 rounded-xl border transition-colors ${
                          isActive
                            ? "text-amber-600 hover:bg-amber-50 border-amber-200"
                            : "text-[#592eff] hover:bg-[#592eff]/10 border-[#592eff]/20"
                        }`}
                        title={isActive ? "Mettre en pause" : "Reprendre"}
                      >
                        {isActive ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => handleOpenDeleteCampaign(camp.id, camp.name, e)}
                        className="p-1.5 rounded-xl text-[#5f5f69] hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                        title="Supprimer la campagne"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Nom & Type */}
                  <h3 className="font-bold text-base text-[#21164c] group-hover:text-[#592eff] transition-colors mb-1 truncate">
                    {camp.name}
                  </h3>
                  <p className="text-[11px] text-[#5f5f69] mb-4">
                    {camp.steps?.length || 0} étape(s) automatisée(s)
                  </p>

                  {/* Indicateurs de conversion */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[#fafafd] border border-[#f0f0ed] mb-5">
                    <div>
                      <span className="text-[10px] text-[#5f5f69] block">Prospects</span>
                      <span className="text-xs font-extrabold text-[#21164c] block">
                        {totalP}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#5f5f69] block">Acceptés</span>
                      <span className="text-xs font-extrabold text-emerald-600 block">
                        {acceptRate}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#5f5f69] block">Réponses</span>
                      <span className="text-xs font-extrabold text-[#592eff] block">
                        {replyRate}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer de la carte */}
                <div className="pt-3 border-t border-[#f0f0ed] flex items-center justify-between">
                  <span className="text-[10px] text-[#5f5f69]">
                    Créée le {new Date(camp.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-[#592eff] group-hover:translate-x-0.5 transition-transform">
                    <span>Entonnoir</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </div>
      )}

      {/* Modale de Création (Wizard) */}
      <CampaignWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onCampaignCreated={fetchCampaigns}
      />

      {/* Modale de Détail (Funnel & Prospects) */}
      <CampaignDetailModal
        campaignId={selectedCampaignId}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedCampaignId(null);
        }}
        onStatusToggled={fetchCampaigns}
      />

      {/* Modale d'avertissement LinkedIn requis */}
      <LinkedInRequiredModal
        isOpen={showLinkedInRequiredModal}
        onClose={() => setShowLinkedInRequiredModal(false)}
        onConnectLinkedIn={() => openLinkedInModal()}
        featureName={requiredFeatureName}
      />

      {/* Modale de Confirmation de Suppression de Campagne */}
      <ConfirmModal
        isOpen={Boolean(campaignToDelete)}
        onClose={() => {
          if (!isDeletingCampaign) {
            setCampaignToDelete(null);
            setDeleteCampaignError(null);
          }
        }}
        onConfirm={handleConfirmDeleteCampaign}
        title="Supprimer la campagne"
        description="Cette action arrêtera tous les envois programmés et supprimera définitivement cette campagne."
        itemName={campaignToDelete?.name}
        itemType="Campagne"
        variant="danger"
        confirmText="Supprimer la campagne"
        cancelText="Conserver la campagne"
        isLoading={isDeletingCampaign}
        warningMessage={
          deleteCampaignError ||
          "Les prospects en cours d'exécution dans cette séquence ne recevront plus les messages prévus."
        }
      />
    </div>
  );
};
