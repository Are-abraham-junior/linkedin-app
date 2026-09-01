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
  Edit3,
  Sliders,
  Check,
  Sparkles,
  Eye,
  UserPlus,
  Info,
  Calendar,
  Save,
  RotateCcw,
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

interface EditableStep {
  id: string;
  stepOrder: number;
  actionType: "INVITATION" | "MESSAGE" | "VISIT_PROFILE" | "FOLLOW";
  delayDays: number;
  messageText: string;
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
  const [activeTab, setActiveTab] = useState<"PROSPECTS" | "SEQUENCE">("PROSPECTS");

  // Filter state for prospects tab
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Editable sequence state
  const [editableName, setEditableName] = useState<string>("");
  const [editableSteps, setEditableSteps] = useState<EditableStep[]>([]);
  const [savingSequence, setSavingSequence] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [previewStepIndex, setPreviewStepIndex] = useState<number | null>(null);

  const fetchDetails = async () => {
    if (!campaignId) return;
    setLoading(true);

    try {
      const data = await apiRequest<{ campaign: any }>(`/campaigns/${campaignId}`);
      if (data.success && data.campaign) {
        setCampaign(data.campaign);
        setProspects(data.campaign.prospects || []);
        setStats(data.campaign.stats);
        setEditableName(data.campaign.name || "");

        const steps = (data.campaign.steps || []).map((s: any) => ({
          id: s.id,
          stepOrder: s.stepOrder,
          actionType: s.actionType,
          delayDays: s.delayDays || 0,
          messageText: s.messageText || "",
        }));
        setEditableSteps(steps);
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
      setSaveSuccessMessage(null);
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

  const handleStepChange = (index: number, field: keyof EditableStep, value: any) => {
    setEditableSteps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleInsertVariable = (index: number, variableTag: string) => {
    setEditableSteps((prev) => {
      const updated = [...prev];
      const currentText = updated[index].messageText || "";
      updated[index] = {
        ...updated[index],
        messageText: currentText + (currentText.endsWith(" ") || currentText === "" ? "" : " ") + variableTag + " ",
      };
      return updated;
    });
  };

  const handleSaveSequence = async () => {
    if (!campaign) return;
    setSavingSequence(true);
    setSaveSuccessMessage(null);

    try {
      const res = await apiRequest<{ campaign: any; message?: string }>(`/campaigns/${campaign.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editableName.trim() || campaign.name,
          steps: editableSteps.map((s) => ({
            id: s.id,
            stepOrder: s.stepOrder,
            actionType: s.actionType,
            delayDays: Number(s.delayDays) || 0,
            messageText: s.messageText,
          })),
        }),
      });

      if (res.success && res.campaign) {
        setCampaign((prev) => ({
          ...prev!,
          name: res.campaign.name,
          steps: res.campaign.steps,
        }));
        setSaveSuccessMessage("Modifications enregistrées et répercutées dans la file d'attente !");
        onStatusToggled();
        setTimeout(() => setSaveSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      console.error("Erreur sauvegarde séquence:", err);
      alert("Erreur lors de la mise à jour de la séquence : " + (err.message || "Erreur serveur"));
    } finally {
      setSavingSequence(false);
    }
  };

  const renderPreview = (text: string) => {
    return text
      .replace(/{{firstName}}/g, "Jean")
      .replace(/{{lastName}}/g, "Dupont")
      .replace(/{{company}}/g, "Tech Solutions")
      .replace(/{{headline}}/g, "Directeur Commercial");
  };

  const getStepIcon = (actionType: string) => {
    switch (actionType) {
      case "VISIT_PROFILE":
      case "VISIT":
        return <Eye className="w-4 h-4 text-[#2ed6ff]" />;
      case "INVITATION":
        return <UserPlus className="w-4 h-4 text-[#592eff]" />;
      case "MESSAGE":
        return <MessageSquare className="w-4 h-4 text-[#2ed6ff]" />;
      case "FOLLOW":
        return <UserCheck className="w-4 h-4 text-emerald-500" />;
      default:
        return <Layers className="w-4 h-4 text-[#592eff]" />;
    }
  };

  const getStepLabel = (actionType: string) => {
    switch (actionType) {
      case "VISIT_PROFILE":
      case "VISIT":
        return "Visite de profil";
      case "INVITATION":
        return "Demande de connexion (Invitation)";
      case "MESSAGE":
        return "Message LinkedIn direct";
      case "FOLLOW":
        return "Suivre le profil";
      default:
        return actionType;
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
        <div className="px-8 pt-7 pb-4 border-b border-[#f0f0ed] bg-[#fafafd] flex flex-col gap-4 shrink-0">
          <div className="flex items-center justify-between">
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
                  Suivi de l'entonnoir de conversion et ajustement en temps réel de la séquence
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
                className="p-2 rounded-full text-[#5f5f69] hover:text-[#21164c] hover:bg-[#f0f0ed] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 pt-1 border-t border-[#e0e0db]/60">
            <button
              onClick={() => setActiveTab("PROSPECTS")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "PROSPECTS"
                  ? "bg-[#592eff] text-white shadow-md shadow-[#592eff]/20"
                  : "bg-white border border-[#e0e0db] text-[#5f5f69] hover:text-[#21164c] hover:border-[#592eff]/30"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Prospects & Suivi</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === "PROSPECTS" ? "bg-white/20 text-white" : "bg-[#592eff]/10 text-[#592eff]"
                }`}
              >
                {prospects.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("SEQUENCE")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "SEQUENCE"
                  ? "bg-[#592eff] text-white shadow-md shadow-[#592eff]/20"
                  : "bg-white border border-[#e0e0db] text-[#5f5f69] hover:text-[#21164c] hover:border-[#592eff]/30"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Éditer la séquence</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === "SEQUENCE" ? "bg-white/20 text-white" : "bg-[#2ed6ff]/20 text-[#21164c]"
                }`}
              >
                {editableSteps.length} étapes
              </span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-7">
          {loading ? (
            <div className="text-center py-20 text-[#5f5f69] text-sm flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-3 border-[#592eff] border-t-transparent rounded-full animate-spin" />
              <span>Chargement des détails de la campagne...</span>
            </div>
          ) : activeTab === "PROSPECTS" ? (
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
                                      `${p.firstName} ${p.lastName}`
                                    )}&background=592eff&color=fff`
                                  }
                                  alt={p.firstName}
                                  className="w-7 h-7 rounded-full object-cover border border-[#e0e0db]"
                                />
                                <div>
                                  <span className="font-bold text-[#21164c] block">
                                    {p.firstName} {p.lastName}
                                  </span>
                                  <span className="text-[10px] text-[#5f5f69] truncate max-w-[200px] block">
                                    {p.headline || "—"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-medium text-[#21164c]">
                              {p.company || "—"}
                            </td>
                            <td className="px-4 py-2.5 font-medium">
                              <span className="text-[#592eff] font-bold">Étape {p.currentStepOrder}</span>
                              <span className="text-[#5f5f69] block text-[11px]">
                                {p.currentStepType === "INVITATION"
                                  ? "Demande connexion"
                                  : p.currentStepType === "MESSAGE"
                                  ? "Relance message"
                                  : "Visite profil"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">{getStatusBadge(p.status)}</td>
                            <td className="px-4 py-2.5 text-right">
                              {p.linkedinUrl && (
                                <a
                                  href={p.linkedinUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 hover:bg-[#592eff]/10 rounded-lg text-[#5f5f69] hover:text-[#592eff] transition-colors inline-block"
                                  title="Voir sur LinkedIn"
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
          ) : (
            /* Tab 2 : Éditeur de Séquence Waalaxy */
            <div className="space-y-6">
              {/* Notification de succès */}
              {saveSuccessMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveSuccessMessage}</span>
                </div>
              )}

              {/* Info banner */}
              <div className="p-4 bg-[#f8f9fc] border border-[#e0e0db] rounded-2xl flex items-start gap-3 text-xs text-[#5f5f69]">
                <Info className="w-4 h-4 text-[#592eff] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#21164c] mb-0.5">
                    Modification d'une séquence en cours
                  </p>
                  <p>
                    Toute modification de message ou de délai sera automatiquement répercutée sur les actions en attente dans la file d'attente pour les prospects n'ayant pas encore franchi ces étapes.
                  </p>
                </div>
              </div>

              {/* Nom de la campagne */}
              <div className="bg-white p-5 rounded-2xl border border-[#e0e0db] shadow-sm space-y-2">
                <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider">
                  Nom de la campagne
                </label>
                <input
                  type="text"
                  value={editableName}
                  onChange={(e) => setEditableName(e.target.value)}
                  placeholder="Ex: Campagne - Prospection Directe..."
                  className="w-full px-4 py-2.5 bg-[#f8f9fc] border border-[#e0e0db] focus:border-[#592eff] rounded-xl text-sm font-bold text-[#21164c] focus:outline-none transition-colors"
                />
              </div>

              {/* Étapes de la séquence */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#21164c] uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#592eff]" />
                    Étapes de la séquence ({editableSteps.length})
                  </h3>
                  <span className="text-[11px] text-[#5f5f69]">
                    Personnalisation des délais et modèles de messages
                  </span>
                </div>

                <div className="space-y-4">
                  {editableSteps.map((step, index) => {
                    const isMessageStep = step.actionType === "MESSAGE" || step.actionType === "INVITATION";
                    const isInvitation = step.actionType === "INVITATION";
                    const charCount = (step.messageText || "").length;
                    const maxChars = isInvitation ? 300 : 2000;
                    const isPreviewOpen = previewStepIndex === index;

                    return (
                      <div
                        key={step.id || index}
                        className="bg-white rounded-2xl border border-[#e0e0db] p-5 shadow-sm space-y-4 relative group hover:border-[#592eff]/40 transition-colors"
                      >
                        {/* Step Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0f0ed] pb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#592eff]/10 text-[#592eff] font-extrabold text-xs flex items-center justify-center border border-[#592eff]/20">
                              #{step.stepOrder}
                            </div>
                            <div className="flex items-center gap-2">
                              {getStepIcon(step.actionType)}
                              <span className="text-sm font-bold text-[#21164c]">
                                {getStepLabel(step.actionType)}
                              </span>
                            </div>
                          </div>

                          {/* Delay Selector (if not first step or if delay is applicable) */}
                          {step.stepOrder > 1 && (
                            <div className="flex items-center gap-2 bg-[#f8f9fc] px-3 py-1.5 rounded-xl border border-[#e0e0db]">
                              <Clock className="w-3.5 h-3.5 text-[#592eff]" />
                              <span className="text-xs font-semibold text-[#5f5f69]">Délai :</span>
                              <div className="flex items-center gap-1">
                                {[0, 1, 2, 3, 5].map((d) => (
                                  <button
                                    key={d}
                                    type="button"
                                    onClick={() => handleStepChange(index, "delayDays", d)}
                                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                                      step.delayDays === d
                                        ? "bg-[#592eff] text-white shadow-sm"
                                        : "bg-white text-[#5f5f69] hover:text-[#21164c] border border-[#e0e0db]"
                                    }`}
                                  >
                                    {d === 0 ? "Immédiat" : `${d}j`}
                                  </button>
                                ))}
                                <input
                                  type="number"
                                  min="0"
                                  max="30"
                                  value={step.delayDays}
                                  onChange={(e) =>
                                    handleStepChange(index, "delayDays", parseInt(e.target.value) || 0)
                                  }
                                  className="w-12 px-1.5 py-0.5 bg-white border border-[#e0e0db] rounded-lg text-xs font-bold text-center text-[#21164c] focus:outline-none focus:border-[#592eff]"
                                  title="Nombre de jours personnalisé"
                                />
                                <span className="text-[11px] text-[#5f5f69]">jours</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Message Template Editor (for Invitations & Messages) */}
                        {isMessageStep && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-[#21164c] flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-[#592eff]" />
                                {isInvitation
                                  ? "Note d'invitation (Optionnelle)"
                                  : "Modèle de message personnalisé"}
                              </label>

                              {/* Variable Buttons */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-[#5f5f69] hidden sm:inline">
                                  Insérer :
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleInsertVariable(index, "{{firstName}}")}
                                  className="px-2 py-1 bg-[#592eff]/10 hover:bg-[#592eff] text-[#592eff] hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  + Prénom
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleInsertVariable(index, "{{lastName}}")}
                                  className="px-2 py-1 bg-[#592eff]/10 hover:bg-[#592eff] text-[#592eff] hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  + Nom
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleInsertVariable(index, "{{company}}")}
                                  className="px-2 py-1 bg-[#592eff]/10 hover:bg-[#592eff] text-[#592eff] hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  + Entreprise
                                </button>
                              </div>
                            </div>

                            <textarea
                              rows={isInvitation ? 3 : 4}
                              value={step.messageText || ""}
                              onChange={(e) => handleStepChange(index, "messageText", e.target.value)}
                              placeholder={
                                isInvitation
                                  ? "Bonjour {{firstName}}, je serais ravi de vous ajouter à mon réseau..."
                                  : "Bonjour {{firstName}}, je vous contacte suite à vos actualités chez {{company}}..."
                              }
                              className="w-full p-3 bg-[#f8f9fc] border border-[#e0e0db] focus:border-[#592eff] rounded-xl text-xs text-[#21164c] placeholder-[#5f5f69]/60 focus:outline-none transition-colors custom-scrollbar resize-none font-medium leading-relaxed"
                            />

                            <div className="flex items-center justify-between text-[11px] text-[#5f5f69]">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewStepIndex(isPreviewOpen ? null : index)
                                  }
                                  className="text-[#592eff] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  {isPreviewOpen ? "Masquer l'aperçu" : "Voir l'aperçu personnalisé"}
                                </button>
                              </div>

                              <span
                                className={`font-semibold ${
                                  charCount > maxChars ? "text-red-500" : "text-[#5f5f69]"
                                }`}
                              >
                                {charCount} / {maxChars} caractères
                              </span>
                            </div>

                            {/* Live Preview Box */}
                            {isPreviewOpen && step.messageText && (
                              <div className="p-3.5 bg-gradient-to-br from-[#fafaff] to-[#f4f3fe] border border-[#592eff]/20 rounded-xl space-y-1.5 animate-in fade-in duration-200">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#592eff] uppercase tracking-wider">
                                  <Sparkles className="w-3 h-3" /> Exemple d'aperçu prospect
                                </div>
                                <p className="text-xs text-[#21164c] bg-white p-3 rounded-lg border border-[#e0e0db]/60 leading-relaxed whitespace-pre-wrap">
                                  {renderPreview(step.messageText)}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-4 border-t border-[#f0f0ed] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={fetchDetails}
                  disabled={savingSequence}
                  className="px-4 py-2.5 bg-white border border-[#e0e0db] hover:bg-[#f8f9fc] rounded-xl text-xs font-bold text-[#5f5f69] hover:text-[#21164c] transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
                </button>

                <button
                  type="button"
                  onClick={handleSaveSequence}
                  disabled={savingSequence}
                  className="px-6 py-2.5 bg-[#592eff] hover:bg-[#4d25e0] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#592eff]/25 hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
                >
                  {savingSequence ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Enregistrer les modifications</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
