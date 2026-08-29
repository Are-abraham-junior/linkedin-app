import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Layers,
  Users,
  Send,
  Clock,
  MessageSquare,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Info,
  Check,
  ShieldCheck,
  AlertCircle,
  Plus,
  FolderPlus,
  Search,
  Eye,
  UserCheck,
  Zap,
  BookmarkCheck,
} from "lucide-react";
import { CampaignStep, ActionType } from "../../types";
import { apiRequest } from "../../services/api";

interface ProspectListOption {
  id: string;
  name: string;
  color?: string;
  prospectsCount: number;
}

interface CampaignWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCampaignCreated: () => void;
}

interface SequenceTemplate {
  id: string;
  title: string;
  badge: string;
  badgeColor?: string;
  description: string;
  recommendedFor: string;
  steps: {
    actionType: ActionType;
    delayDays: number;
    defaultMessage: string;
    label: string;
  }[];
}

const TEMPLATES: SequenceTemplate[] = [
  {
    id: "INVITE_AND_3_MESSAGES",
    title: "Invitation + 3 messages",
    badge: "Haute conversion",
    badgeColor: "bg-[#592eff]/10 text-[#592eff]",
    description: "Séquence de prospection complète avec 1 invitation et 3 relances de valeur. Arrêt automatique garanti dès que le prospect répond.",
    recommendedFor: "Prospection commerciale B2B & Nurturing intensif de décideurs",
    steps: [
      {
        actionType: "INVITATION",
        delayDays: 0,
        label: "Demande de connexion",
        defaultMessage: "Bonjour {{firstName}}, j'ai découvert votre profil chez {{company}} et vos réalisations ont retenu mon attention. Au plaisir d'échanger avec vous !",
      },
      {
        actionType: "MESSAGE",
        delayDays: 1,
        label: "Message 1 (Bienvenue)",
        defaultMessage: "Merci pour votre connexion {{firstName}} ! Quel est votre principal défi actuellement chez {{company}} ?",
      },
      {
        actionType: "MESSAGE",
        delayDays: 3,
        label: "Message 2 (Partage de valeur)",
        defaultMessage: "Bonjour {{firstName}}, j'ai pensé à vous suite à un retour d'expérience récent sur des problématiques similaires à {{company}}. Seriez-vous curieux d'en discuter brièvement ?",
      },
      {
        actionType: "MESSAGE",
        delayDays: 4,
        label: "Message 3 (Relance de rupture)",
        defaultMessage: "Bonjour {{firstName}}, je ne souhaite pas être insistant. Si le sujet n'est pas prioritaire en ce moment, aucun souci ! Au plaisir de suivre vos actualités sur LinkedIn.",
      },
    ],
  },
  {
    id: "VISIT_FOLLOW_INVITE",
    title: "Visite + Follow + Invitation",
    badge: "Préchauffage max",
    badgeColor: "bg-amber-500/10 text-amber-700",
    description: "Stratégie multi-touch : consulte le profil le Jour J, s'abonne à ses publications à J+1, puis envoie l'invitation à J+2 avec un taux d'acceptation record.",
    recommendedFor: "Grands comptes, Cadres dirigeants & Cibles très sollicitées",
    steps: [
      {
        actionType: "VISIT",
        delayDays: 0,
        label: "Visite de profil",
        defaultMessage: "",
      },
      {
        actionType: "FOLLOW",
        delayDays: 1,
        label: "Suivre le profil",
        defaultMessage: "",
      },
      {
        actionType: "INVITATION",
        delayDays: 1,
        label: "Demande de connexion",
        defaultMessage: "Bonjour {{firstName}}, je suis vos actualités et vos partages chez {{company}} avec grand intérêt. Au plaisir de vous compter parmi mon réseau !",
      },
    ],
  },
  {
    id: "VISIT_INVITE_1_MESSAGE",
    title: "Visite + Invitation + 1 message",
    badge: "Approche naturelle",
    badgeColor: "bg-emerald-500/10 text-emerald-700",
    description: "Préchauffez votre prospect par une consultation de son profil, puis envoyez l'invitation et un premier message d'introduction dès acceptation.",
    recommendedFor: "Prospection consultative, Consulting & Freelances",
    steps: [
      {
        actionType: "VISIT",
        delayDays: 0,
        label: "Visite de profil",
        defaultMessage: "",
      },
      {
        actionType: "INVITATION",
        delayDays: 1,
        label: "Demande de connexion",
        defaultMessage: "Bonjour {{firstName}}, j'ai visité votre profil et votre activité chez {{company}} m'a particulièrement interpellé. Connectons-nous !",
      },
      {
        actionType: "MESSAGE",
        delayDays: 1,
        label: "Message de présentation",
        defaultMessage: "Ravi d'être en relation {{firstName}} ! Seriez-vous ouvert à échanger sur vos priorités actuelles chez {{company}} ?",
      },
    ],
  },
  {
    id: "INVITE_AND_FOLLOWUPS",
    title: "Connexion & Double Relance",
    badge: "Le plus populaire",
    badgeColor: "bg-blue-500/10 text-blue-700",
    description: "Envoie une invitation ciblée, puis 2 messages espacés dès que le contact accepte la relation.",
    recommendedFor: "Prospection commerciale B2B & Génération de leads",
    steps: [
      {
        actionType: "INVITATION",
        delayDays: 0,
        label: "Demande de connexion",
        defaultMessage: "Bonjour {{firstName}}, j'ai découvert votre profil et votre activité chez {{company}}. Au plaisir d'échanger avec vous !",
      },
      {
        actionType: "MESSAGE",
        delayDays: 1,
        label: "Message 1 (Bienvenue)",
        defaultMessage: "Merci pour votre connexion {{firstName}} ! Je serais ravi de découvrir vos défis actuels chez {{company}}.",
      },
      {
        actionType: "MESSAGE",
        delayDays: 3,
        label: "Message 2 (Relance de valeur)",
        defaultMessage: "{{firstName}}, avez-vous eu l'opportunité de regarder mon précédent message ? Nous aidons les entreprises comme {{company}} à optimiser leur acquisition.",
      },
    ],
  },
  {
    id: "SOFT_INVITE",
    title: "Invitation Douce sans note",
    badge: "Taux d'acceptation max",
    badgeColor: "bg-violet-500/10 text-violet-700",
    description: "Invitation sans message d'accroche (recommandé pour un taux d'acceptation optimal), suivie d'un premier message.",
    recommendedFor: "Recrutement, Réseau & Prospection discrète",
    steps: [
      {
        actionType: "INVITATION",
        delayDays: 0,
        label: "Demande de connexion sans note",
        defaultMessage: "",
      },
      {
        actionType: "MESSAGE",
        delayDays: 1,
        label: "Message de présentation",
        defaultMessage: "Bonjour {{firstName}}, ravi de faire partie de votre réseau ! Quel est votre projet phare en ce moment chez {{company}} ?",
      },
    ],
  },
  {
    id: "DIRECT_MESSAGES",
    title: "Message Direct (Contacts 1er degré)",
    badge: "Relations existantes",
    badgeColor: "bg-slate-500/10 text-slate-700",
    description: "Contacte directement les prospects qui font déjà partie de votre réseau LinkedIn avec une relance automatique.",
    recommendedFor: "Réactivation de réseau, Invités webinar & Newsletters",
    steps: [
      {
        actionType: "MESSAGE",
        delayDays: 0,
        label: "Message initial",
        defaultMessage: "Bonjour {{firstName}}, je me permets de vous contacter car j'ai suivi vos actualités chez {{company}}...",
      },
      {
        actionType: "MESSAGE",
        delayDays: 4,
        label: "Relance douce",
        defaultMessage: "Bonjour {{firstName}}, je relance brièvement mon message précédent au cas où il serait passé inaperçu.",
      },
    ],
  },
];

const PRESET_COLORS = [
  "#592eff",
  "#2ed6ff",
  "#a2ea13",
  "#ffaae6",
  "#f843c2",
  "#ff9f43",
];

export const CampaignWizardModal: React.FC<CampaignWizardModalProps> = ({
  isOpen,
  onClose,
  onCampaignCreated,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [campaignName, setCampaignName] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("INVITE_AND_3_MESSAGES");
  const [availableLists, setAvailableLists] = useState<ProspectListOption[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [configuredSteps, setConfiguredSteps] = useState<CampaignStep[]>([]);
  const [activeStepTab, setActiveStepTab] = useState<number>(0);
  const [startImmediately, setStartImmediately] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sauvegarde brouillon
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Création rapide de liste dans l'étape 2
  const [showCreateListForm, setShowCreateListForm] = useState<boolean>(false);
  const [newListName, setNewListName] = useState<string>("");
  const [newListColor, setNewListColor] = useState<string>("#592eff");
  const [creatingList, setCreatingList] = useState<boolean>(false);
  const [listSearchFilter, setListSearchFilter] = useState<string>("");

  // Charger les listes de prospects
  const loadLists = async () => {
    try {
      const res = await apiRequest<{ lists: ProspectListOption[] }>("/lists");
      if (res.success && Array.isArray(res.lists)) {
        setAvailableLists(res.lists);
        if (res.lists.length > 0 && selectedListIds.length === 0) {
          setSelectedListIds([res.lists[0].id]);
        }
      }
    } catch (err) {
      console.error("Erreur chargement listes:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLists();
    }
  }, [isOpen]);

  // Initialiser les étapes à partir du template choisi
  useEffect(() => {
    const tmpl = TEMPLATES.find((t) => t.id === selectedTemplateId) || TEMPLATES[0];
    if (!draftCampaignId) {
      setCampaignName(`Campagne - ${tmpl.title}`);
    }
    setConfiguredSteps(
      tmpl.steps.map((s, idx) => ({
        stepOrder: idx + 1,
        actionType: s.actionType,
        delayDays: s.delayDays,
        messageText: s.defaultMessage,
      }))
    );
    setActiveStepTab(0);
  }, [selectedTemplateId]);

  if (!isOpen) return null;

  const totalEligibleProspects = availableLists
    .filter((l) => selectedListIds.includes(l.id))
    .reduce((sum, l) => sum + (l.prospectsCount || 0), 0);

  const handleInsertVariable = (variable: string) => {
    const updated = [...configuredSteps];
    const currentMsg = updated[activeStepTab]?.messageText || "";
    updated[activeStepTab].messageText = `${currentMsg} {{${variable}}}`.trim();
    setConfiguredSteps(updated);
  };

  const handleStepMessageChange = (text: string) => {
    const updated = [...configuredSteps];
    if (updated[activeStepTab]) {
      updated[activeStepTab].messageText = text;
      setConfiguredSteps(updated);
    }
  };

  const handleStepDelayChange = (days: number) => {
    const updated = [...configuredSteps];
    if (updated[activeStepTab]) {
      updated[activeStepTab].delayDays = days;
      setConfiguredSteps(updated);
    }
  };

  const toggleListSelection = (listId: string) => {
    if (selectedListIds.includes(listId)) {
      if (selectedListIds.length > 1) {
        setSelectedListIds(selectedListIds.filter((id) => id !== listId));
      }
    } else {
      setSelectedListIds([...selectedListIds, listId]);
    }
  };

  // Création rapide d'une liste
  const handleCreateListSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newListName.trim()) {
      setError("Veuillez saisir un nom pour votre liste.");
      return;
    }

    setCreatingList(true);
    setError(null);

    try {
      const res = await apiRequest<{ list: any }>("/lists", {
        method: "POST",
        body: JSON.stringify({
          name: newListName.trim(),
          color: newListColor,
        }),
      });

      if (res.success && res.list) {
        const created: ProspectListOption = {
          id: res.list.id,
          name: res.list.name,
          color: res.list.color || newListColor,
          prospectsCount: 0,
        };

        setAvailableLists((prev) => [created, ...prev]);
        setSelectedListIds([created.id]);
        setNewListName("");
        setShowCreateListForm(false);
      } else {
        throw new Error(res.error || "Impossible de créer la liste");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingList(false);
    }
  };

  // Sauvegarder la progression comme BROUILLON (disponible à chaque étape)
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setError(null);
    try {
      const tmpl = TEMPLATES.find((t) => t.id === selectedTemplateId) || TEMPLATES[0];
      const res = await apiRequest<{ success: boolean; campaign?: any; error?: string }>("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          id: draftCampaignId || undefined,
          name: campaignName.trim() || `Brouillon - ${tmpl.title}`,
          type: selectedTemplateId,
          listIds: selectedListIds,
          steps: configuredSteps,
          startImmediately: false,
        }),
      });

      if (!res.success) {
        throw new Error(res.error || "Erreur lors de la sauvegarde du brouillon");
      }

      if (res.campaign?.id) {
        setDraftCampaignId(res.campaign.id);
      }

      setSavedSuccessMsg("Brouillon sauvegardé ! Retrouvez-le dans l'onglet 'Brouillons'.");
      setTimeout(() => setSavedSuccessMsg(null), 4000);
      onCampaignCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingDraft(false);
    }
  };

  // Lancement final de la campagne (Étape 4)
  const handleSubmitCampaign = async () => {
    if (!campaignName.trim()) {
      setError("Veuillez donner un nom à votre campagne.");
      return;
    }
    if (selectedListIds.length === 0) {
      setError("Veuillez sélectionner au moins une liste de prospects avant de lancer la campagne.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          id: draftCampaignId || undefined,
          name: campaignName.trim(),
          type: selectedTemplateId,
          listIds: selectedListIds,
          steps: configuredSteps,
          startImmediately,
        }),
      });

      if (!res.success) {
        throw new Error(res.error || "Erreur lors de la création de la campagne");
      }

      onCampaignCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredLists = availableLists.filter((l) =>
    l.name.toLowerCase().includes(listSearchFilter.toLowerCase())
  );

  const getActionTypeLabel = (actionType: ActionType) => {
    switch (actionType) {
      case "VISIT":
      case "VISIT_PROFILE":
        return "Visite";
      case "FOLLOW":
        return "Follow";
      case "INVITATION":
        return "Invitation";
      case "MESSAGE":
        return "Message";
      default:
        return actionType;
    }
  };

  const getActionTypeIcon = (actionType: ActionType) => {
    switch (actionType) {
      case "VISIT":
      case "VISIT_PROFILE":
        return <Eye className="w-3.5 h-3.5" />;
      case "FOLLOW":
        return <UserCheck className="w-3.5 h-3.5" />;
      case "INVITATION":
        return <Users className="w-3.5 h-3.5" />;
      case "MESSAGE":
        return <MessageSquare className="w-3.5 h-3.5" />;
      default:
        return <Layers className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-[32px] shadow-2xl border border-[#e0e0db] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header & Stepper */}
        <div className="px-8 pt-7 pb-5 border-b border-[#f0f0ed] bg-gradient-to-b from-[#fafafd] to-white shrink-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center border border-[#592eff]/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#21164c] tracking-tight">
                  Créer une nouvelle campagne
                </h2>
                <p className="text-xs text-[#5f5f69]">
                  Configurez votre séquence automatisée de prospection LinkedIn
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-[#5f5f69] hover:text-[#21164c] hover:bg-[#f0f0ed] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper horizontal */}
          <div className="grid grid-cols-4 gap-2 sm:gap-4 relative">
            {[
              { num: 1, label: "Modèle de séquence" },
              { num: 2, label: "Audience cible" },
              { num: 3, label: "Contenu & Délais" },
              { num: 4, label: "Validation & Lancement" },
            ].map((step) => {
              const isDone = currentStep > step.num;
              const isCurrent = currentStep === step.num;
              return (
                <div
                  key={step.num}
                  className={`flex items-center gap-2.5 p-2 rounded-xl transition-all ${
                    isCurrent
                      ? "bg-white shadow-sm border border-[#592eff]/30"
                      : isDone
                      ? "opacity-90"
                      : "opacity-40"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isDone
                        ? "bg-[#592eff] text-white"
                        : isCurrent
                        ? "bg-[#592eff] text-white"
                        : "bg-[#e0e0db] text-[#5f5f69]"
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : step.num}
                  </div>
                  <span className="text-xs font-semibold text-[#21164c] truncate">
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Modèle de Séquence */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-2">
                  Nom de la campagne
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="ex: Directeurs Commerciaux Paris - Mars 2026"
                  className="w-full px-4 py-3 rounded-2xl border border-[#e0e0db] text-sm text-[#21164c] focus:outline-none focus:border-[#592eff] focus:ring-2 focus:ring-[#592eff]/10 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider">
                    Choisissez une séquence pré-paramétrée (6 modèles disponibles)
                  </label>
                  <span className="text-[11px] text-[#592eff] font-bold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> Prêts à l'emploi
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {TEMPLATES.map((tmpl) => {
                    const isSelected = selectedTemplateId === tmpl.id;
                    return (
                      <div
                        key={tmpl.id}
                        onClick={() => setSelectedTemplateId(tmpl.id)}
                        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? "border-[#592eff] bg-[#592eff]/[0.03] shadow-md shadow-[#592eff]/10 ring-2 ring-[#592eff]/20"
                            : "border-[#e0e0db] hover:border-[#592eff]/40 hover:bg-slate-50/50"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                tmpl.badgeColor || "bg-[#592eff]/10 text-[#592eff]"
                              }`}
                            >
                              {tmpl.badge}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="w-5 h-5 text-[#592eff]" />
                            )}
                          </div>
                          <h3 className="font-bold text-[#21164c] text-sm mb-1.5">
                            {tmpl.title}
                          </h3>
                          <p className="text-xs text-[#5f5f69] leading-relaxed mb-3">
                            {tmpl.description}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-[#f0f0ed] flex items-center justify-between text-[11px] text-[#592eff] font-bold">
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" />
                            <span>{tmpl.steps.length} étape(s) automatisée(s)</span>
                          </div>
                          <span className="text-[10px] text-[#5f5f69] font-normal">
                            Arrêt si réponse
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Audience Cible & Sélection/Création de Liste */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* En-tête de l'étape avec CTA de création */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#21164c] mb-1">
                    Sélectionnez votre liste de prospects
                  </h3>
                  <p className="text-xs text-[#5f5f69]">
                    Choisissez une liste existante ou créez-en une nouvelle pour cette campagne.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreateListForm(!showCreateListForm)}
                  className="px-3.5 py-2 rounded-xl bg-[#592eff]/10 hover:bg-[#592eff]/20 text-[#592eff] text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border border-[#592eff]/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showCreateListForm ? "Masquer formulaire" : "Créer une nouvelle liste"}</span>
                </button>
              </div>

              {/* Formulaire de création rapide de liste (Inline) */}
              {showCreateListForm && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#fafafd] to-[#f4f3fe] border-2 border-[#592eff]/30 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderPlus className="w-4 h-4 text-[#592eff]" />
                      <span className="text-xs font-bold text-[#21164c] uppercase tracking-wider">
                        Nouvelle liste de prospects
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreateListForm(false)}
                      className="text-xs text-[#5f5f69] hover:text-[#21164c] cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        placeholder="Nom de la liste (ex: Directeurs Commerciaux Paris)"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#e0e0db] text-xs text-[#21164c] focus:outline-none focus:border-[#592eff] bg-white font-medium"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 p-1.5 bg-white border border-[#e0e0db] rounded-xl flex-1 justify-around">
                        {PRESET_COLORS.map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setNewListColor(col)}
                            className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                              newListColor === col ? "scale-125 ring-2 ring-[#21164c]/20" : "opacity-80"
                            }`}
                            style={{ backgroundColor: col }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={creatingList}
                        onClick={handleCreateListSubmit}
                        className="px-4 py-2.5 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 shrink-0 cursor-pointer"
                      >
                        {creatingList ? "Création..." : "Ajouter"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Cas A : Aucune liste trouvée -> État d'accueil pour création immédiate */}
              {availableLists.length === 0 && !showCreateListForm ? (
                <div className="text-center py-10 px-6 border-2 border-dashed border-[#592eff]/30 rounded-3xl bg-[#fafafd]">
                  <div className="w-12 h-12 rounded-2xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center mx-auto mb-3">
                    <FolderPlus className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-[#21164c] mb-1">
                    Vous n'avez pas encore de liste de prospects
                  </h4>
                  <p className="text-xs text-[#5f5f69] max-w-md mx-auto mb-5 leading-relaxed">
                    Créez votre première liste directement ici. Vous pourrez y ajouter des prospects depuis l'onglet Prospects ou importer un fichier Excel/CSV par la suite.
                  </p>

                  <div className="max-w-md mx-auto flex items-center gap-2 p-2 bg-white rounded-2xl border border-[#e0e0db] shadow-sm">
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="Nom de votre liste (ex: Prospects LinkedIn 2026)"
                      className="flex-1 px-3 py-2 text-xs text-[#21164c] focus:outline-none font-medium"
                    />
                    <button
                      type="button"
                      disabled={creatingList}
                      onClick={handleCreateListSubmit}
                      className="px-4 py-2 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                      {creatingList ? "Création..." : "Créer la liste"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Cas B : Listes existantes */
                <div className="space-y-4">
                  {availableLists.length > 4 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#5f5f69] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={listSearchFilter}
                        onChange={(e) => setListSearchFilter(e.target.value)}
                        placeholder="Rechercher une liste..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#e0e0db] text-xs text-[#21164c] focus:outline-none focus:border-[#592eff]"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                    {filteredLists.map((list) => {
                      const isChecked = selectedListIds.includes(list.id);
                      return (
                        <div
                          key={list.id}
                          onClick={() => toggleListSelection(list.id)}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                            isChecked
                              ? "border-[#592eff] bg-[#592eff]/[0.03] shadow-sm"
                              : "border-[#e0e0db] hover:border-[#592eff]/30 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: list.color || "#592eff" }}
                            />
                            <div>
                              <p className="text-xs font-bold text-[#21164c]">{list.name}</p>
                              <p className="text-[11px] text-[#5f5f69]">
                                {list.prospectsCount || 0} prospect(s) qualifié(s)
                              </p>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                              isChecked ? "bg-[#592eff] text-white" : "border border-[#e0e0db]"
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Résumé de l'audience */}
              <div className="space-y-2">
                <div className="p-4 rounded-2xl bg-[#fafafd] border border-[#e0e0db] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#21164c] font-bold">
                    <Users className="w-4 h-4 text-[#592eff]" />
                    <span>Total prospects éligibles dans cette campagne :</span>
                  </div>
                  <span className="text-sm font-extrabold text-[#592eff] px-3 py-1 bg-[#592eff]/10 rounded-full">
                    {totalEligibleProspects} prospect(s)
                  </span>
                </div>

                {selectedListIds.length > 0 && totalEligibleProspects === 0 && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 p-3 rounded-xl flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      La liste sélectionnée ne contient aucun prospect pour l'instant. Vous pourrez finaliser la configuration de la campagne maintenant et y importer vos prospects ultérieurement.
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Contenu des Messages & Délais */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Onglets des étapes */}
              <div className="flex items-center gap-2 border-b border-[#f0f0ed] pb-3 overflow-x-auto custom-scrollbar">
                {configuredSteps.map((step, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveStepTab(idx)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                      activeStepTab === idx
                        ? "bg-[#592eff] text-white shadow-sm shadow-[#592eff]/25"
                        : "bg-[#f5f5f7] text-[#5f5f69] hover:text-[#21164c]"
                    }`}
                  >
                    {getActionTypeIcon(step.actionType)}
                    <span>Étape {step.stepOrder}</span>
                    <span className="text-[10px] opacity-80">
                      ({getActionTypeLabel(step.actionType)})
                    </span>
                  </button>
                ))}
              </div>

              {configuredSteps[activeStepTab] && (
                <div className="space-y-4">
                  {/* CAS 1 : VISITE DE PROFIL */}
                  {(configuredSteps[activeStepTab].actionType === "VISIT" ||
                    configuredSteps[activeStepTab].actionType === "VISIT_PROFILE") && (
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-[#fafafd] to-[#f4f3fe] border border-[#592eff]/20 space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center shrink-0">
                          <Eye className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1">
                            Consultation automatique du profil LinkedIn
                          </h4>
                          <p className="text-xs text-[#5f5f69] leading-relaxed">
                            Bime Link consultera discrètement le profil LinkedIn du prospect. Celui-ci recevra une notification LinkedIn native : <span className="font-semibold text-[#21164c]">"X a consulté votre profil"</span>. Cela crée de la familiarité avant toute sollicitation directe.
                          </p>
                        </div>
                      </div>

                      {configuredSteps[activeStepTab].stepOrder > 1 && (
                        <div className="pt-3 border-t border-[#592eff]/10 flex items-center justify-between">
                          <span className="text-xs font-bold text-[#21164c] flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-[#592eff]" />
                            Délai avant la visite :
                          </span>
                          <select
                            value={configuredSteps[activeStepTab].delayDays}
                            onChange={(e) => handleStepDelayChange(Number(e.target.value))}
                            className="px-3 py-1.5 rounded-xl border border-[#e0e0db] text-xs font-bold text-[#21164c] bg-white focus:outline-none focus:border-[#592eff]"
                          >
                            <option value={0}>Immédiatement</option>
                            <option value={1}>1 jour ouvré après</option>
                            <option value={2}>2 jours ouvrés après</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CAS 2 : SUIVRE LE PROFIL (FOLLOW) */}
                  {configuredSteps[activeStepTab].actionType === "FOLLOW" && (
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-[#fafafd] to-[#f4f3fe] border border-amber-500/20 space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                          <UserCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1">
                            Abonnement aux publications du prospect (Follow)
                          </h4>
                          <p className="text-xs text-[#5f5f69] leading-relaxed">
                            Bime Link s'abonne automatiquement aux publications du prospect sur LinkedIn. Cela témoigne d'un intérêt authentique pour son contenu et renforce significativement les chances d'acceptation de votre prochaine invitation.
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-amber-500/10 flex items-center justify-between">
                        <span className="text-xs font-bold text-[#21164c] flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-amber-600" />
                          Délai après l'étape précédente :
                        </span>
                        <select
                          value={configuredSteps[activeStepTab].delayDays}
                          onChange={(e) => handleStepDelayChange(Number(e.target.value))}
                          className="px-3 py-1.5 rounded-xl border border-[#e0e0db] text-xs font-bold text-[#21164c] bg-white focus:outline-none focus:border-[#592eff]"
                        >
                          <option value={0}>Immédiatement après</option>
                          <option value={1}>1 jour ouvré après</option>
                          <option value={2}>2 jours ouvrés après</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* CAS 3 : DEMANDE D'INVITATION OU MESSAGE */}
                  {(configuredSteps[activeStepTab].actionType === "INVITATION" ||
                    configuredSteps[activeStepTab].actionType === "MESSAGE") && (
                    <>
                      {/* Temporisation / Délai */}
                      <div className="p-4 rounded-2xl bg-[#fafafd] border border-[#e0e0db] flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#21164c]">
                          <Clock className="w-4 h-4 text-[#592eff]" />
                          <span>
                            {configuredSteps[activeStepTab].actionType === "INVITATION"
                              ? "Délai avant l'envoi de l'invitation :"
                              : "Délai après l'étape précédente :"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={configuredSteps[activeStepTab].delayDays}
                            onChange={(e) => handleStepDelayChange(Number(e.target.value))}
                            className="px-3 py-1.5 rounded-xl border border-[#e0e0db] text-xs font-bold text-[#21164c] bg-white focus:outline-none focus:border-[#592eff]"
                          >
                            <option value={0}>
                              {configuredSteps[activeStepTab].actionType === "INVITATION"
                                ? "Immédiatement"
                                : "Dès acceptation confirmée"}
                            </option>
                            <option value={1}>1 jour ouvré après</option>
                            <option value={2}>2 jours ouvrés après</option>
                            <option value={3}>3 jours ouvrés après</option>
                            <option value={4}>4 jours ouvrés après</option>
                            <option value={5}>5 jours ouvrés après</option>
                            <option value={7}>7 jours ouvrés après</option>
                          </select>
                        </div>
                      </div>

                      {/* Variables d'insertion */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-[#21164c] uppercase tracking-wider">
                            {configuredSteps[activeStepTab].actionType === "INVITATION"
                              ? "Note d'invitation (Optionnelle - Max 300 car.)"
                              : "Contenu du message"}
                          </label>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[#5f5f69] mr-1">Variables :</span>
                            {["firstName", "lastName", "company"].map((varName) => (
                              <button
                                key={varName}
                                type="button"
                                onClick={() => handleInsertVariable(varName)}
                                className="px-2 py-0.5 text-[10px] font-bold bg-[#f0f0f5] text-[#592eff] hover:bg-[#592eff]/10 rounded-md transition-colors cursor-pointer"
                              >
                                + {varName}
                              </button>
                            ))}
                          </div>
                        </div>

                        <textarea
                          rows={5}
                          value={configuredSteps[activeStepTab].messageText || ""}
                          onChange={(e) => handleStepMessageChange(e.target.value)}
                          placeholder={
                            configuredSteps[activeStepTab].actionType === "INVITATION"
                              ? "Laissez vide pour envoyer une invitation sans note..."
                              : "Écrivez votre message de prospection..."
                          }
                          className="w-full p-4 rounded-2xl border border-[#e0e0db] text-xs leading-relaxed text-[#21164c] focus:outline-none focus:border-[#592eff] focus:ring-2 focus:ring-[#592eff]/10 font-normal"
                        />

                        {configuredSteps[activeStepTab].actionType === "INVITATION" && (
                          <p className="text-[11px] text-[#5f5f69] flex items-center gap-1.5 mt-1.5">
                            <Info className="w-3.5 h-3.5 text-[#592eff]" />
                            Caractères : {(configuredSteps[activeStepTab].messageText || "").length} / 300
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Validation & Lancement */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-gradient-to-r from-[#592eff]/10 to-transparent border border-[#592eff]/20">
                <h3 className="text-base font-bold text-[#21164c] mb-1">
                  Récapitulatif de la campagne
                </h3>
                <p className="text-xs text-[#5f5f69]">
                  Vérifiez la configuration avant d'activer votre séquence d'envois.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-[#592eff]/15">
                  <div>
                    <span className="text-[11px] text-[#5f5f69] block">Nom :</span>
                    <span className="text-xs font-bold text-[#21164c] truncate block">
                      {campaignName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#5f5f69] block">Audience :</span>
                    <span className="text-xs font-bold text-[#21164c]">
                      {totalEligibleProspects} prospects
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#5f5f69] block">Étapes :</span>
                    <span className="text-xs font-bold text-[#21164c]">
                      {configuredSteps.length} étape(s)
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#5f5f69] block">Sécurité :</span>
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Quotas actifs
                    </span>
                  </div>
                </div>
              </div>

              {/* Étapes détaillées */}
              <div className="p-5 rounded-2xl border border-[#e0e0db] space-y-3 bg-[#fafafd]">
                <h4 className="text-xs font-bold text-[#21164c] uppercase tracking-wider mb-2">
                  Déroulement de la séquence
                </h4>
                <div className="space-y-2">
                  {configuredSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-[#e0e0db]/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-[#592eff]/10 text-[#592eff] font-bold text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        {getActionTypeIcon(step.actionType)}
                        <span className="font-bold text-[#21164c]">
                          {getActionTypeLabel(step.actionType)}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#5f5f69]">
                        {step.delayDays === 0
                          ? "Immédiat"
                          : `Délai : +${step.delayDays}j`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Option d'activation */}
              <div className="p-4 rounded-2xl border border-[#e0e0db] space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={startImmediately}
                    onChange={(e) => setStartImmediately(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-[#592eff] focus:ring-[#592eff]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#21164c] block">
                      Activer la campagne immédiatement
                    </span>
                    <span className="text-xs text-[#5f5f69] leading-relaxed block">
                      Le worker Bime Link commencera à exécuter les premières étapes selon vos créneaux et quotas de sécurité.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer avec bouton Sauvegarder à chaque étape */}
        <div className="px-8 py-5 border-t border-[#f0f0ed] bg-[#fafafd] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-4 py-2.5 rounded-full border border-[#e0e0db] text-xs font-bold text-[#5f5f69] hover:text-[#21164c] hover:bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Précédent
              </button>
            )}

            {/* Message de succès de sauvegarde */}
            {savedSuccessMsg && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200 animate-in fade-in duration-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{savedSuccessMsg}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {/* Bouton Sauvegarder (brouillon) présent à chaque étape */}
            <button
              type="button"
              disabled={savingDraft || loading}
              onClick={handleSaveDraft}
              className="px-4 py-2.5 rounded-full border border-[#e0e0db] bg-white hover:border-[#592eff]/40 hover:bg-[#592eff]/5 text-xs font-bold text-[#21164c] transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
              title="Sauvegarder l'état actuel de la campagne dans les brouillons"
            >
              <BookmarkCheck className="w-4 h-4 text-[#592eff]" />
              <span>{savingDraft ? "Sauvegarde..." : "Sauvegarder"}</span>
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="px-6 py-2.5 rounded-full bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                Suivant <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading || savingDraft}
                onClick={handleSubmitCampaign}
                className="px-7 py-2.5 rounded-full bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {loading ? (
                  <span>Lancement...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Lancer la campagne</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
