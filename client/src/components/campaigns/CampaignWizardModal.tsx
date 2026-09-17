import React, { useState, useEffect } from "react";
import { initialsDataUrl } from "../ui/avatarFallback";
import {
  X,
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
  Lock,
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

import { Button } from "../ui/Button";
import { Callout } from "../ui/Callout";
import { Modal } from "../ui/Modal";
import { StatusDot } from "../ui/Badge";
import { TemplateDetailModal, SequenceTemplate } from "./TemplateDetailModal";

// Modèles servis par l'API (source unique : server/src/config/campaignTemplates.ts)
let cachedTemplates: SequenceTemplate[] = [];

async function loadTemplates(): Promise<SequenceTemplate[]> {
  if (cachedTemplates.length > 0) return cachedTemplates;
  const res = await apiRequest<{ templates: SequenceTemplate[] }>("/campaigns/templates");
  if (res.success && Array.isArray(res.templates)) {
    cachedTemplates = res.templates;
  }
  return cachedTemplates;
}

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
  const [templates, setTemplates] = useState<SequenceTemplate[]>(cachedTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("INVITE_AND_3_MESSAGES");
  const [viewingTemplate, setViewingTemplate] = useState<SequenceTemplate | null>(null);
  const findTemplate = (id: string) => templates.find((t) => t.id === id) || templates[0];
  const [availableLists, setAvailableLists] = useState<ProspectListOption[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [configuredSteps, setConfiguredSteps] = useState<CampaignStep[]>([]);
  const [activeStepTab, setActiveStepTab] = useState<number>(0);
  const [validatedStepTabs, setValidatedStepTabs] = useState<number[]>([]);
  const [startImmediately, setStartImmediately] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sauvegarde temporaire du texte de note d'invitation (mémorise la note si l'utilisateur bascule entre avec/sans note)
  const [savedInviteNotes, setSavedInviteNotes] = useState<Record<number, string>>({});

  // Étape 2 : Chargement des prospects de la liste et mode de sélection (Style Waalaxy)
  const [listProspects, setListProspects] = useState<any[]>([]);
  const [loadingProspects, setLoadingProspects] = useState<boolean>(false);
  const [selectionMode, setSelectionMode] = useState<"ALL" | "CUSTOM">("ALL");
  const [customSelectedIds, setCustomSelectedIds] = useState<string[]>([]);
  const [prospectSearchTerm, setProspectSearchTerm] = useState<string>("");

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
      loadTemplates().then(setTemplates).catch((err) => console.error("Erreur chargement modèles:", err));
      setCurrentStep(1);
      setActiveStepTab(0);
      setValidatedStepTabs([]);
      setError(null);
    }
  }, [isOpen]);

  // Récupérer les prospects de la liste active sélectionnée à l'étape 2
  useEffect(() => {
    const fetchProspectsForList = async () => {
      if (isOpen && currentStep === 2 && selectedListIds.length > 0) {
        setLoadingProspects(true);
        try {
          const res = await apiRequest<{ prospects: any[] }>(`/prospects?listId=${selectedListIds[0]}&limit=500`);
          if (res.success && Array.isArray(res.prospects)) {
            setListProspects(res.prospects);
          } else {
            setListProspects([]);
          }
        } catch (e) {
          console.error("Erreur chargement prospects de la liste:", e);
          setListProspects([]);
        } finally {
          setLoadingProspects(false);
        }
      }
    };
    fetchProspectsForList();
  }, [isOpen, currentStep, selectedListIds]);

  // Initialiser les étapes à partir du template choisi
  useEffect(() => {
    const tmpl = findTemplate(selectedTemplateId);
    if (!tmpl) return;
    if (!draftCampaignId) {
      setCampaignName(`Campagne - ${tmpl.title}`);
    }
    // Mémoriser les notes d'invitation par défaut du modèle
    const defaultNotesMap: Record<number, string> = {};
    tmpl.steps.forEach((s, idx) => {
      if (s.actionType === "INVITATION" && s.defaultMessage) {
        defaultNotesMap[idx] = s.defaultMessage;
      }
    });
    setSavedInviteNotes(defaultNotesMap);

    setConfiguredSteps(
      tmpl.steps.map((s, idx) => ({
        stepOrder: idx + 1,
        actionType: s.actionType,
        delayDays: s.delayDays,
        messageText: s.defaultMessage,
      }))
    );
    setActiveStepTab(0);
    setValidatedStepTabs([]);
  }, [selectedTemplateId, templates]);

  // Validation séquentielle pas-à-pas (Étape 3)
  const handleValidateCurrentStepTab = () => {
    const currentStepObj = configuredSteps[activeStepTab];
    if (
      currentStepObj &&
      currentStepObj.actionType === "INVITATION" &&
      (currentStepObj.messageText || "").length > 300
    ) {
      setError("La note d'invitation ne peut pas dépasser 300 caractères (limite LinkedIn).");
      return;
    }
    setError(null);
    if (!validatedStepTabs.includes(activeStepTab)) {
      setValidatedStepTabs((prev) => [...prev, activeStepTab]);
    }
    if (activeStepTab < configuredSteps.length - 1) {
      setActiveStepTab((prev) => prev + 1);
    } else {
      // Toutes les étapes de la séquence sont validées -> passage à l'étape 4
      setCurrentStep(4);
    }
  };

  if (!isOpen) return null;

  // Analyse d'éligibilité en temps réel selon le modèle de séquence choisi
  const currentTemplate = findTemplate(selectedTemplateId);
  const firstActionType = configuredSteps[0]?.actionType || currentTemplate?.steps[0]?.actionType || "INVITATION";

  const analyzedProspects = listProspects.map((p) => {
    // 1. Déjà dans une campagne active ou en attente
    const busy = p.campaignStates && Array.isArray(p.campaignStates) && p.campaignStates.some((s: any) =>
      ["PENDING", "IN_PROGRESS", "WAITING_DELAY", "WAITING_CONDITION"].includes(s.status)
    );

    // 2. Statut LinkedIn conforme
    let connectionMismatch = false;
    if (firstActionType === "MESSAGE") {
      connectionMismatch = p.connectionStatus !== "CONNECTED";
    } else if (firstActionType === "INVITATION" || firstActionType === "VISIT" || firstActionType === "VISIT_PROFILE" || firstActionType === "FOLLOW") {
      connectionMismatch = p.connectionStatus === "CONNECTED";
    }

    const doNotContact = Boolean(p.doNotContact);
    const isEligible = !busy && !connectionMismatch && !doNotContact;

    let exclusionReason = "";
    if (busy) exclusionReason = "Déjà en campagne";
    else if (connectionMismatch) exclusionReason = firstActionType === "MESSAGE" ? "Non connecté" : "Déjà connecté";
    else if (doNotContact) exclusionReason = "Ne pas contacter";

    return {
      ...p,
      busy,
      connectionMismatch,
      doNotContact,
      isEligible,
      exclusionReason,
    };
  });

  const eligibleProspects = analyzedProspects.filter((p) => p.isEligible);
  const totalListCount = listProspects.length;
  const eligibleCount = eligibleProspects.length;
  const busyCount = analyzedProspects.filter((p) => p.busy).length;
  const mismatchCount = analyzedProspects.filter((p) => !p.busy && p.connectionMismatch).length;
  const dncCount = analyzedProspects.filter((p) => !p.busy && !p.connectionMismatch && p.doNotContact).length;

  const totalEligibleProspects =
    selectionMode === "ALL"
      ? eligibleCount
      : customSelectedIds.length;

  const filteredCustomProspects = analyzedProspects.filter((p) => {
    if (!prospectSearchTerm.trim()) return true;
    const q = prospectSearchTerm.toLowerCase();
    return (
      (p.firstName || "").toLowerCase().includes(q) ||
      (p.lastName || "").toLowerCase().includes(q) ||
      (p.company || "").toLowerCase().includes(q) ||
      (p.headline || "").toLowerCase().includes(q)
    );
  });

  const filteredLists = availableLists.filter((l) => {
    if (!listSearchFilter.trim()) return true;
    return l.name.toLowerCase().includes(listSearchFilter.toLowerCase());
  });

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

  // Bascule pour accepter ou refuser la note d'invitation
  const handleToggleInviteNote = (accept: boolean) => {
    const updated = [...configuredSteps];
    const currentStepObj = updated[activeStepTab];
    if (!currentStepObj || currentStepObj.actionType !== "INVITATION") return;

    if (!accept) {
      // Refuser la note : sauvegarder le texte actuel avant de vider
      const currentNote = (currentStepObj.messageText || "").trim();
      if (currentNote.length > 0) {
        setSavedInviteNotes((prev) => ({
          ...prev,
          [activeStepTab]: currentNote,
        }));
      }
      currentStepObj.messageText = "";
    } else {
      // Accepter la note : restaurer la note mémorisée ou celle par défaut du modèle
      const tmpl = findTemplate(selectedTemplateId);
      const tmplStep = tmpl?.steps[activeStepTab] || tmpl?.steps.find((s) => s.actionType === "INVITATION");
      const defaultNote = tmplStep?.defaultMessage || "";
      const restored =
        savedInviteNotes[activeStepTab]?.trim() ||
        defaultNote ||
       "Bonjour {{firstName}}, j'ai découvert votre profil chez {{company}} et vos réalisations ont retenu mon attention. Au plaisir d'échanger avec vous !";
      currentStepObj.messageText = restored;
    }
    setConfiguredSteps(updated);
  };

  // Rétablir la note par défaut suggérée par le modèle
  const handleResetInviteNoteToDefault = () => {
    const tmpl = findTemplate(selectedTemplateId);
    const tmplStep = tmpl?.steps[activeStepTab] || tmpl?.steps.find((s) => s.actionType === "INVITATION");
    const defaultNote = tmplStep?.defaultMessage || "";
    const updated = [...configuredSteps];
    if (updated[activeStepTab]) {
      updated[activeStepTab].messageText = defaultNote;
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
      const tmpl = findTemplate(selectedTemplateId);
      const res = await apiRequest<{ success: boolean; campaign?: any; error?: string }>("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          id: draftCampaignId || undefined,
          name: campaignName.trim() || `Brouillon - ${tmpl?.title || "Séquence"}`,
          type: selectedTemplateId,
          listIds: selectedListIds,
          selectedProspectIds: selectionMode === "CUSTOM" ? customSelectedIds : undefined,
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
          selectedProspectIds: selectionMode === "CUSTOM" ? customSelectedIds : undefined,
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

  const goBack = () => {
    if (currentStep === 3) {
      if (activeStepTab > 0) setActiveStepTab((prev) => prev - 1);
      else setCurrentStep(2);
    } else if (currentStep === 4) {
      setCurrentStep(3);
      setActiveStepTab(configuredSteps.length - 1);
    } else {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const goNext = () => {
    if (currentStep === 3) handleValidateCurrentStepTab();
    else setCurrentStep((prev) => prev + 1);
  };

  const nextLabel =
    currentStep === 3 ? (activeStepTab < configuredSteps.length - 1 ? "Valider, étape suivante" : "Valider la séquence") : "Suivant";

  const WIZARD_STEPS = [
    { num: 1, label: "Modèle" },
    { num: 2, label: "Audience" },
    { num: 3, label: "Contenu & délais" },
    { num: 4, label: "Validation" },
  ];

  const footer = (
    <div className="flex w-full flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="flex items-center gap-3">
        {currentStep > 1 && (
          <Button variant="ghost" icon={ChevronLeft} onClick={goBack}>
            Précédent
          </Button>
        )}
        {savedSuccessMsg && <StatusDot tone="ok">{savedSuccessMsg}</StatusDot>}
      </div>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <Button variant="secondary" icon={BookmarkCheck} onClick={handleSaveDraft} loading={savingDraft} disabled={loading} title="Sauvegarder dans les brouillons">
          Sauvegarder
        </Button>
        {currentStep < 4 ? (
          <Button iconRight={ChevronRight} onClick={goNext}>
            {nextLabel}
          </Button>
        ) : (
          <Button icon={Send} onClick={handleSubmitCampaign} loading={loading} disabled={savingDraft}>
            Lancer la campagne
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="xl"
      title="Nouvelle campagne"
      description="Une séquence automatisée d'invitations, de messages et de visites sur LinkedIn."
      bodyClassName="px-6 pb-6"
      footer={footer}
    >
      <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Étapes">
        {WIZARD_STEPS.map((step, i) => {
          const isDone = currentStep > step.num;
          const isCurrent = currentStep === step.num;
          return (
            <React.Fragment key={step.num}>
              {i > 0 && <span className="h-px w-5 bg-line" aria-hidden />}
              <li className={`flex items-center gap-2 ${isCurrent ? "text-ink" : "text-muted"}`} aria-current={isCurrent ? "step" : undefined}>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs tabular-nums ${
                    isCurrent ? "border-ink bg-ink text-white" : isDone ? "border-line bg-surface-2 text-muted" : "border-line text-muted"
                  }`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : step.num}
                </span>
                <span className={isCurrent ? "font-medium" : undefined}>{step.label}</span>
              </li>
            </React.Fragment>
          );
        })}
      </ol>

      {error && (
        <Callout tone="danger" className="mb-6">
          {error}
        </Callout>
      )}

          {/* STEP 1: Modèle de Séquence */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="block text-xs font-medium text-ink">
                      Choisissez une séquence pré-paramétrée
                    </label>
                    <p className="text-xs text-muted mt-0.5">
                      Sélectionnez un modèle adapté à votre stratégie. Vous pourrez nommer et personnaliser la campagne à l'étape suivante.
                    </p>
                  </div>
                  
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((tmpl) => {
                    const isSelected = selectedTemplateId === tmpl.id;
                    return (
                      <div
                        key={tmpl.id}
                        onClick={() => setViewingTemplate(tmpl)}
                        role="radio"
                        aria-checked={isSelected}
                        className={`group flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border bg-surface transition-colors ${
                          isSelected ? "border-ink" : "border-line hover:border-ink"
                        }`}
                      >
                        {/* Illustration 3D Waalaxy Header Compact */}
                        <div className="relative flex h-28 items-center justify-center overflow-hidden border-b border-line bg-surface-2 p-2 sm:h-32">
                          <img
                            src={tmpl.image}
                            alt={tmpl.title}
                            className="w-full h-full object-contain transition-transform duration-300"
                            loading="lazy"
                          />

                          {/* Quick selection checkmark (top-right) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTemplateId(tmpl.id);
                            }}
                            className={`absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
                              isSelected ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:border-ink hover:text-ink"
                            }`}
                            title={isSelected ? "Modèle sélectionné" : "Sélectionner ce modèle"}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>

                        {/* Card Content Compact - Titre uniquement */}
                        <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                          <div>
                            {/* Popularity & Optional Badge */}
                            {(tmpl.badge || tmpl.popularity) && (
                              <div className={`flex items-center gap-2 mb-1.5 ${tmpl.badge ? "justify-between" : "justify-end"}`}>
                                {tmpl.badge && (
                                  <span
                                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      tmpl.badgeColor || "bg-surface-2 text-ink"
                                    }`}
                                  >
                                    {tmpl.badge}
                                  </span>
                                )}

                                {tmpl.popularity && (
                                  <span className="text-xs font-semibold text-muted flex items-center gap-1">
                                    <Users className="w-3 h-3" strokeWidth={1.75} />
                                    <span>{tmpl.popularity}</span>
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Title - Sans description */}
                            <h3 className="line-clamp-2 text-sm font-medium leading-snug text-ink">
                              {tmpl.title}
                            </h3>
                          </div>

                          {/* Bottom Row */}
                          <div className="pt-2 border-t border-[#f0f0ed] flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-muted">
                              <Layers className="w-3.5 h-3.5" strokeWidth={1.75} />
                              <span>{tmpl.steps.length} étapes</span>
                            </div>

                            <div className="flex items-center gap-1 text-muted transition-colors group-hover:text-ink">
                              <span>Détails</span>
                              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Colonne Principale (Sélecteur & Choix de prospects) */}
              <div className="lg:col-span-2 space-y-6">
                {/* 1. Nom de la campagne (Défini après avoir choisi le modèle) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-line space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-ink">
                      Nom de votre campagne
                    </label>
                    <span className="text-xs text-muted">
                      Modèle choisi : <strong className="text-ink">{currentTemplate.title}</strong>
                    </span>
                  </div>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="ex: Directeurs Commerciaux Paris - Mars 2026"
                    className="w-full px-4 py-2.5 rounded-xl border border-line text-sm text-ink focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/10 font-medium"
                  />
                </div>

                {/* En-tête de sélection de liste avec CTA de création */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-ink mb-1">
                      Sélectionnez votre liste de prospects
                    </h3>
                    <p className="text-xs text-muted">
                      Choisissez une liste existante ou créez-en une nouvelle pour cette campagne.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCreateListForm(!showCreateListForm)}
                    className="px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-accent/20 text-ink text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 border border-ink cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{showCreateListForm ? "Masquer formulaire" : "Créer une nouvelle liste"}</span>
                  </button>
                </div>

                {/* Formulaire de création rapide de liste (Inline) */}
                {showCreateListForm && (
                  <div className="space-y-4 rounded-xl border border-line bg-surface-2 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderPlus className="w-4 h-4 text-ink" />
                        <span className="text-xs font-medium text-ink">
                          Nouvelle liste de prospects
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCreateListForm(false)}
                        className="text-xs text-muted hover:text-ink cursor-pointer"
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
                          className="w-full px-3.5 py-2.5 rounded-xl border border-line text-xs text-ink focus:outline-none focus:border-ink bg-white font-medium"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 p-1.5 bg-white border border-line rounded-xl flex-1 justify-around">
                          {PRESET_COLORS.map((col) => (
                            <button
                              key={col}
                              type="button"
                              onClick={() => setNewListColor(col)}
                              className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                                newListColor === col ? "scale-125 ring-2 ring-ink/20" : "opacity-80"
                              }`}
                              style={{ backgroundColor: col }}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={creatingList}
                          onClick={handleCreateListSubmit}
                          className="px-4 py-2.5 rounded-xl bg-accent hover:bg-ink/90 text-white text-xs font-medium transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                        >
                          {creatingList ? "Création..." : "Ajouter"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cas A : Aucune liste trouvée */}
                {availableLists.length === 0 && !showCreateListForm ? (
                  <div className="text-center py-10 px-6 border-2 border-dashed border-ink rounded-2xl bg-surface-2">
                    <div className="w-12 h-12 rounded-2xl bg-surface-2 text-ink flex items-center justify-center mx-auto mb-3">
                      <FolderPlus className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-medium text-ink mb-1">
                      Vous n'avez pas encore de liste de prospects
                    </h4>
                    <p className="text-xs text-muted max-w-md mx-auto mb-5 leading-relaxed">
                      Créez votre première liste directement ici pour cette campagne.
                    </p>

                    <div className="max-w-md mx-auto flex items-center gap-2 p-2 bg-white rounded-2xl border border-line">
                      <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        placeholder="Nom de votre liste (ex: Prospects LinkedIn 2026)"
                        className="flex-1 px-3 py-2 text-xs text-ink focus:outline-none font-medium"
                      />
                      <button
                        type="button"
                        disabled={creatingList}
                        onClick={handleCreateListSubmit}
                        className="px-4 py-2 rounded-xl bg-accent hover:bg-ink/90 text-white text-xs font-medium transition-all disabled:opacity-50 shrink-0 cursor-pointer"
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
                        <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={listSearchFilter}
                          onChange={(e) => setListSearchFilter(e.target.value)}
                          placeholder="Rechercher une liste..."
                          className="w-full pl-8 pr-3 py-2 rounded-xl border border-line text-xs text-ink focus:outline-none focus:border-ink"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[180px] overflow-y-auto custom-scrollbar p-1">
                      {filteredLists.map((list) => {
                        const isChecked = selectedListIds.includes(list.id);
                        return (
                          <div
                            key={list.id}
                            onClick={() => toggleListSelection(list.id)}
                            className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                              isChecked
                                ? "border-ink bg-accent/[0.03]"
                                : "border-line hover:border-ink bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: list.color || "#592eff" }}
                              />
                              <div>
                                <p className="text-xs font-medium text-ink">{list.name}</p>
                                <p className="text-xs text-muted">
                                  {list.prospectsCount || 0} prospect(s) au total
                                </p>
                              </div>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                                isChecked ? "bg-ink text-white" : "border border-line"
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

                {/* Section Question Waalaxy & Choix des Prospects */}
                {selectedListIds.length > 0 && (
                  <div className="p-6 rounded-2xl bg-white border border-line space-y-5 duration-200">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-muted flex items-center justify-center font-medium shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-ink">
                          Voulez-vous ajouter tous les prospects de cette liste ?
                        </h4>
                        <p className="text-xs text-muted mt-0.5 leading-relaxed">
                          Vous pouvez choisir de sélectionner tous les prospects de votre liste qui remplissent les conditions pour cette campagne ou certains d'entre eux.
                        </p>
                      </div>
                    </div>

                    {/* Cartes d'Option : Oui (Tous) vs Non (Je sélectionne) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectionMode("ALL")}
                        className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between cursor-pointer ${
                          selectionMode === "ALL"
                            ? "border-ink bg-accent/[0.04] "
                            : "border-line hover:border-ink bg-white"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-semibold text-ink">
                            Oui, ajouter tous les prospects ({eligibleCount})
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            Engage tous les contacts qualifiés
                          </p>
                        </div>
                        {selectionMode === "ALL" && (
                          <CheckCircle2 className="w-5 h-5 text-ink shrink-0" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectionMode("CUSTOM");
                          if (customSelectedIds.length === 0) {
                            setCustomSelectedIds(eligibleProspects.map((p) => p.id));
                          }
                        }}
                        className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between cursor-pointer ${
                          selectionMode === "CUSTOM"
                            ? "border-ink bg-accent/[0.04] "
                            : "border-line hover:border-ink bg-white"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-semibold text-ink">
                            Non, je sélectionne ({customSelectedIds.length})
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            Choisissez au cas par cas
                          </p>
                        </div>
                        {selectionMode === "CUSTOM" && (
                          <CheckCircle2 className="w-5 h-5 text-ink shrink-0" />
                        )}
                      </button>
                    </div>

                    {/* Mode Sélecteur Personnalisé ("Non, je sélectionne") */}
                    {selectionMode === "CUSTOM" && (
                      <div className="pt-4 border-t border-[#f0f0ed] space-y-3 duration-200">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                          <div className="relative flex-1 w-full">
                            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={prospectSearchTerm}
                              onChange={(e) => setProspectSearchTerm(e.target.value)}
                              placeholder="Rechercher un prospect par nom, poste..."
                              className="w-full pl-8 pr-3 py-2 rounded-xl border border-line text-xs text-ink focus:outline-none focus:border-ink"
                            />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setCustomSelectedIds(eligibleProspects.map((p) => p.id))}
                              className="px-3 py-1.5 rounded-xl border border-line hover:border-ink text-xs font-medium text-ink bg-white transition-colors cursor-pointer"
                            >
                              Tout cocher éligibles
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomSelectedIds([])}
                              className="px-3 py-1.5 rounded-xl border border-line hover:bg-slate-50 text-xs font-semibold text-muted bg-white transition-colors cursor-pointer"
                            >
                              Décocher tout
                            </button>
                          </div>
                        </div>

                        {/* Liste des prospects éligibles avec filtres et cases à cocher */}
                        <div className="max-h-[260px] overflow-y-auto custom-scrollbar border border-line rounded-2xl divide-y divide-line/60 bg-white">
                          {loadingProspects ? (
                            <div className="p-6 text-center text-xs text-muted">
                              Chargement des prospects de la liste...
                            </div>
                          ) : filteredCustomProspects.length === 0 ? (
                            <div className="p-6 text-center text-xs text-muted">
                              Aucun prospect trouvé.
                            </div>
                          ) : (
                            filteredCustomProspects.map((p) => {
                              const isChecked = customSelectedIds.includes(p.id);
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    if (!p.isEligible) return;
                                    if (isChecked) {
                                      setCustomSelectedIds(customSelectedIds.filter((id) => id !== p.id));
                                    } else {
                                      setCustomSelectedIds([...customSelectedIds, p.id]);
                                    }
                                  }}
                                  className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                                    !p.isEligible
                                      ? "bg-slate-50/70 opacity-60 cursor-not-allowed"
                                      : isChecked
                                      ? "bg-accent/[0.03] cursor-pointer"
                                      : "hover:bg-slate-50 cursor-pointer"
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={!p.isEligible}
                                      onChange={() => {}}
                                      className="w-4 h-4 rounded text-ink border-line focus:ring-accent"
                                    />
                                    <img
                                      src={
                                        p.avatarUrl ||
                                        initialsDataUrl(p.firstName + " " + p.lastName)
                                      }
                                      alt={p.firstName}
                                      className="w-7 h-7 rounded-full object-cover shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <p className="font-medium text-xs text-ink truncate">
                                        {p.firstName} {p.lastName}
                                      </p>
                                      <p className="text-xs text-muted truncate">
                                        {p.headline || p.company || "Prospect LinkedIn"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="shrink-0 flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        p.connectionStatus === "CONNECTED"
                                          ? "bg-emerald-100 text-muted"
                                          : p.connectionStatus === "PENDING"
                                          ? "bg-amber-100 text-muted"
                                          : "bg-slate-100 text-slate-600"
                                      }`}
                                    >
                                      {p.connectionStatus === "CONNECTED"
                                        ? "Connecté"
                                        : p.connectionStatus === "PENDING"
                                        ? "En attente"
                                        : "Non connecté"}
                                    </span>

                                    {p.isEligible ? (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-muted text-xs font-semibold">
                                        Éligible ✓
                                      </span>
                                    ) : (
                                      <span
                                        className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 text-xs font-semibold"
                                        title={p.exclusionReason}
                                      >
                                        {p.exclusionReason}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Résumé du total retenu */}
                <div className="p-4 rounded-2xl bg-surface-2 border border-line flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-ink font-medium">
                    <Users className="w-4 h-4 text-ink" />
                    <span>Total prospects engagés dans cette campagne :</span>
                  </div>
                  <span className="text-sm font-semibold text-ink px-3.5 py-1 bg-surface-2 rounded-full">
                    {totalEligibleProspects} prospect(s)
                  </span>
                </div>
              </div>

              {/* Colonne Latérale Droite (Carte "ASTUCE" - Style Waalaxy) */}
              <div className="lg:col-span-1 space-y-4 self-start">
                <div className="space-y-4 rounded-xl border border-line bg-surface-2 p-5">
                  <span className="text-xs font-medium text-muted">Bon à savoir</span>

                  <div>
                    <h4 className="text-sm font-semibold text-ink leading-snug">
                      Quels prospects peuvent entrer dans ma campagne ?
                    </h4>
                    <p className="text-xs text-muted mt-1.5 leading-relaxed">
                      Vous utilisez la séquence <strong className="text-ink">"{currentTemplate.title}"</strong>. Vous ne pourrez sélectionner que les prospects répondant aux conditions suivantes :
                    </p>
                  </div>

                  {/* Conditions de la séquence */}
                  <div className="space-y-2.5 pt-3 border-t border-amber-500/15 text-xs">
                    <div className="flex items-start gap-2 text-ink">
                      <span className="shrink-0 text-muted font-medium" aria-hidden>—</span>
                      <span className="leading-snug">Ne pas être déjà engagé dans une autre campagne active</span>
                    </div>

                    <div className="flex items-start gap-2 text-ink">
                      <span className="shrink-0 text-muted font-medium" aria-hidden>—</span>
                      <span className="leading-snug">
                        {firstActionType === "MESSAGE"
                          ? "Être déjà connecté avec vous sur LinkedIn"
                          : "Ne pas être déjà connecté avec vous sur LinkedIn"}
                      </span>
                    </div>

                    <div className="flex items-start gap-2 text-ink">
                      <span className="shrink-0 text-muted font-medium" aria-hidden>—</span>
                      <span className="leading-snug">Ne pas figurer dans la liste "Ne pas contacter"</span>
                    </div>
                  </div>

                  {/* Bilan Chiffré des Éligibilités */}
                  <div className="p-4 rounded-2xl bg-white border border-amber-500/20 space-y-2 text-xs">
                    <div className="flex justify-between items-center font-medium text-ink">
                      <span>Total prospects dans la liste :</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-semibold">{totalListCount}</span>
                    </div>

                    <div className="flex justify-between items-center text-muted font-semibold">
                      <span>Éligibles pour cette campagne :</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 font-semibold">{eligibleCount}</span>
                    </div>

                    {busyCount > 0 && (
                      <div className="flex justify-between items-center text-slate-500 text-xs">
                        <span>• Déjà engagé en campagne :</span>
                        <span className="font-medium">{busyCount}</span>
                      </div>
                    )}

                    {mismatchCount > 0 && (
                      <div className="flex justify-between items-center text-slate-500 text-xs">
                        <span>• Statut LinkedIn non conforme :</span>
                        <span className="font-medium">{mismatchCount}</span>
                      </div>
                    )}

                    {dncCount > 0 && (
                      <div className="flex justify-between items-center text-slate-500 text-xs">
                        <span>• En liste "Ne pas contacter" :</span>
                        <span className="font-medium">{dncCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Contenu des Messages & Délais */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Onglets des étapes avec validation séquentielle */}
              <div className="flex items-center gap-2 border-b border-[#f0f0ed] pb-3 overflow-x-auto custom-scrollbar">
                {configuredSteps.map((step, idx) => {
                  const isUnlocked = idx === 0 || validatedStepTabs.includes(idx - 1) || validatedStepTabs.includes(idx);
                  const isValidated = validatedStepTabs.includes(idx);
                  const isActive = activeStepTab === idx;

                  return (
                    <button
                      key={idx}
                      disabled={!isUnlocked}
                      onClick={() => isUnlocked && setActiveStepTab(idx)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 shrink-0 ${
                        isActive
                          ? "bg-ink text-white"
                          : isValidated
                          ? "bg-surface-2 text-muted border border-line hover:bg-emerald-100 cursor-pointer"
                          : isUnlocked
                          ? "bg-surface-2 text-muted hover:text-ink cursor-pointer"
                          : "bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed border border-slate-200/60"
                      }`}
                      title={!isUnlocked ? `Validez l'étape ${idx} pour débloquer celle-ci` : undefined}
                    >
                      {!isUnlocked ? (
                        <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ) : isValidated && !isActive ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-muted shrink-0" />
                      ) : (
                        getActionTypeIcon(step.actionType)
                      )}
                      <span>Étape {step.stepOrder}</span>
                      <span className="text-xs opacity-80">
                        ({getActionTypeLabel(step.actionType)}
                        {step.actionType === "INVITATION" && (
                          <span className="ml-1 font-semibold">
                            {step.messageText && step.messageText.trim().length > 0
                              ? "• avec note"
                              : "• sans note"}
                          </span>
                        )})
                      </span>
                      {isValidated && isActive && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white ml-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              {configuredSteps[activeStepTab] && (
                <div className="space-y-4">
                  {/* CAS 1 : VISITE DE PROFIL */}
                  {(configuredSteps[activeStepTab].actionType === "VISIT" ||
                    configuredSteps[activeStepTab].actionType === "VISIT_PROFILE") && (
                    <div className="space-y-4 rounded-xl border border-line bg-surface-2 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-surface-2 text-ink flex items-center justify-center shrink-0">
                          <Eye className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-ink mb-1">
                            Consultation automatique du profil LinkedIn
                          </h4>
                          <p className="text-xs text-muted leading-relaxed">
                            Bleadin consultera discrètement le profil LinkedIn du prospect. Celui-ci recevra une notification LinkedIn native : <span className="font-semibold text-ink">"X a consulté votre profil"</span>. Cela crée de la familiarité avant toute sollicitation directe.
                          </p>
                        </div>
                      </div>

                      {configuredSteps[activeStepTab].stepOrder > 1 && (
                        <div className="pt-3 border-t border-ink flex items-center justify-between">
                          <span className="text-xs font-medium text-ink flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-ink" />
                            Délai avant la visite :
                          </span>
                          <select
                            value={configuredSteps[activeStepTab].delayDays}
                            onChange={(e) => handleStepDelayChange(Number(e.target.value))}
                            className="px-3 py-1.5 rounded-xl border border-line text-xs font-medium text-ink bg-white focus:outline-none focus:border-ink"
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
                    <div className="space-y-4 rounded-xl border border-line bg-surface-2 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-muted flex items-center justify-center shrink-0">
                          <UserCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-ink mb-1">
                            Abonnement aux publications du prospect (Follow)
                          </h4>
                          <p className="text-xs text-muted leading-relaxed">
                            Bleadin s'abonne automatiquement aux publications du prospect sur LinkedIn. Cela témoigne d'un intérêt authentique pour son contenu et renforce significativement les chances d'acceptation de votre prochaine invitation.
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-amber-500/10 flex items-center justify-between">
                        <span className="text-xs font-medium text-ink flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-muted" />
                          Délai après l'étape précédente :
                        </span>
                        <select
                          value={configuredSteps[activeStepTab].delayDays}
                          onChange={(e) => handleStepDelayChange(Number(e.target.value))}
                          className="px-3 py-1.5 rounded-xl border border-line text-xs font-medium text-ink bg-white focus:outline-none focus:border-ink"
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
                      <div className="p-4 rounded-2xl bg-surface-2 border border-line flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-medium text-ink">
                          <Clock className="w-4 h-4 text-ink" />
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
                            className="px-3 py-1.5 rounded-xl border border-line text-xs font-medium text-ink bg-white focus:outline-none focus:border-ink"
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

                      {/* Choix et Édition de la Note d'Invitation ou du Message */}
                      {configuredSteps[activeStepTab].actionType === "INVITATION" ? (
                        <div className="space-y-4">
                          {/* En-tête & Statut du choix */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <label className="text-xs font-medium text-ink flex items-center gap-2">
                                <Send className="w-3.5 h-3.5 text-ink" />
                                <span>Note d'invitation LinkedIn (Optionnelle)</span>
                              </label>
                              <p className="text-xs text-muted mt-0.5">
                                Décidez si vous souhaitez accompagner votre invitation d'un mot personnalisé.
                              </p>
                            </div>
                            {Boolean(configuredSteps[activeStepTab].messageText?.trim()) ? (
                              <span className="text-xs font-medium text-ink bg-surface-2 px-2.5 py-1 rounded-full flex items-center gap-1 self-start sm:self-center">
                                <CheckCircle2 className="w-3.5 h-3.5 text-ink" /> Note acceptée
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-muted bg-surface-2 px-2.5 py-1 rounded-full border border-line flex items-center gap-1 self-start sm:self-center">
                                <ShieldCheck className="w-3.5 h-3.5 text-muted" /> Sans note (Recommandé)
                              </span>
                            )}
                          </div>

                          {/* 2 Cartes de Choix : Refuser vs Accepter la note */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Option 1 : Refuser la note */}
                            <div
                              onClick={() => handleToggleInviteNote(false)}
                              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                                !configuredSteps[activeStepTab].messageText?.trim()
                                  ? "border-emerald-600 bg-surface-2/40 ring-2 ring-emerald-500/20"
                                  : "border-line bg-white hover:border-emerald-500/50 hover:bg-surface-2"
                              }`}
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                                        !configuredSteps[activeStepTab].messageText?.trim()
                                          ? "bg-emerald-600 text-white"
                                          : "bg-gray-100 text-muted"
                                      }`}
                                    >
                                      <ShieldCheck className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-medium text-ink">
                                        Refuser la note
                                      </h4>
                                      <p className="text-xs text-muted">
                                        Invitation directe sans message
                                      </p>
                                    </div>
                                  </div>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-muted border border-line shrink-0">
                                    Recommandé
                                  </span>
                                </div>
                                <p className="text-xs text-muted leading-relaxed">
                                  Sur LinkedIn, les invitations sans note obtiennent en moyenne <strong>+10% à +20% d'acceptation</strong> car elles semblent plus spontanées.
                                </p>
                              </div>

                              <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between text-xs font-medium">
                                <span
                                  className={
                                    !configuredSteps[activeStepTab].messageText?.trim()
                                      ? "text-muted font-semibold flex items-center gap-1"
                                      : "text-muted"
                                  }
                                >
                                  {!configuredSteps[activeStepTab].messageText?.trim() ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Option active
                                    </>
                                  ) : (
                                   "Cliquer pour refuser la note"
                                  )}
                                </span>
                              </div>
                            </div>

                            {/* Option 2 : Accepter la note */}
                            <div
                              onClick={() => handleToggleInviteNote(true)}
                              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                                Boolean(configuredSteps[activeStepTab].messageText?.trim())
                                  ? "border-ink bg-accent/[0.03] "
                                  : "border-line bg-white hover:border-ink hover:bg-surface-2"
                              }`}
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                                        Boolean(configuredSteps[activeStepTab].messageText?.trim())
                                          ? "bg-ink text-white"
                                          : "bg-gray-100 text-muted"
                                      }`}
                                    >
                                      <MessageSquare className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-medium text-ink">
                                        Accepter la note
                                      </h4>
                                      <p className="text-xs text-muted">
                                        Message personnalisé d'accroche
                                      </p>
                                    </div>
                                  </div>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-ink shrink-0">
                                    Max 300 car.
                                  </span>
                                </div>
                                <p className="text-xs text-muted leading-relaxed">
                                  Idéal si vous avez une accroche spécifique, un contact partagé ou une proposition de valeur courte à contextualiser.
                                </p>
                              </div>

                              <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between text-xs font-medium">
                                <span
                                  className={
                                    Boolean(configuredSteps[activeStepTab].messageText?.trim())
                                      ? "text-ink font-semibold flex items-center gap-1"
                                      : "text-muted"
                                  }
                                >
                                  {Boolean(configuredSteps[activeStepTab].messageText?.trim()) ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Option active
                                    </>
                                  ) : (
                                   "Cliquer pour inclure la note"
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Affichage conditionnel selon le choix */}
                          {!configuredSteps[activeStepTab].messageText?.trim() ? (
                            <div className="space-y-2.5 rounded-xl border border-ok/30 bg-ok-soft p-4">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-muted flex items-center justify-center shrink-0 mt-0.5">
                                  <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div className="flex-1 text-xs">
                                  <h5 className="font-medium text-ink mb-1">
                                    Invitation directe sans note d'accompagnement sélectionnée
                                  </h5>
                                  <p className="text-muted leading-relaxed mb-2.5">
                                    Votre demande de connexion sera envoyée directement sur LinkedIn sans message. C'est le format recommandé pour maximiser le taux d'acceptation. Vos messages de relance configurés aux étapes suivantes seront envoyés automatiquement dès que le prospect acceptera la connexion.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleInviteNote(true)}
                                    className="text-xs font-medium text-ink hover:text-[#4520cc] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    Vous changez d'avis ? Cliquer ici pour rédiger une note d'invitation
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2 duration-200">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-muted">Variables disponibles :</span>
                                  {["firstName", "lastName", "company"].map((varName) => (
                                    <button
                                      key={varName}
                                      type="button"
                                      onClick={() => handleInsertVariable(varName)}
                                      className="px-2 py-0.5 text-xs font-medium bg-[#f0f0f5] text-ink hover:bg-accent hover:text-white rounded-md transition-colors cursor-pointer"
                                    >
                                      + {varName}
                                    </button>
                                  ))}
                                </div>

                                <button
                                  type="button"
                                  onClick={handleResetInviteNoteToDefault}
                                  className="text-xs font-medium text-muted hover:text-ink hover:bg-gray-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer border border-line"
                                  title="Rétablir le texte par défaut proposé par le modèle"
                                >
                                  Rétablir modèle
                                </button>
                              </div>

                              <textarea
                                rows={4}
                                value={configuredSteps[activeStepTab].messageText || ""}
                                onChange={(e) => handleStepMessageChange(e.target.value)}
                                placeholder="Bonjour {{firstName}}, je découvre votre profil et votre activité..."
                                className={`w-full p-4 rounded-2xl border text-xs leading-relaxed text-ink focus:outline-none focus:ring-2 font-normal ${
                                  (configuredSteps[activeStepTab].messageText || "").length > 300
                                    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                                    : "border-line focus:border-ink focus:ring-accent/10"
                                }`}
                              />

                              <div className="flex items-center justify-between text-xs mt-1">
                                <span
                                  className={`flex items-center gap-1 font-semibold ${
                                    (configuredSteps[activeStepTab].messageText || "").length > 300
                                      ? "text-red-600 font-medium"
                                      : (configuredSteps[activeStepTab].messageText || "").length > 270
                                      ? "text-muted"
                                      : "text-muted"
                                  }`}
                                >
                                  <Info className="w-3.5 h-3.5" />
                                  Caractères : {(configuredSteps[activeStepTab].messageText || "").length} / 300
                                  {(configuredSteps[activeStepTab].messageText || "").length > 300 && (
                                    <span className="text-red-600 ml-1">
                                      (Dépassement de {(configuredSteps[activeStepTab].messageText || "").length - 300} car.)
                                    </span>
                                  )}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handleToggleInviteNote(false)}
                                  className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                                >
                                  Refuser la note (envoyer sans note)
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* CAS DU MESSAGE CLASSIQUE (ÉTAPE SUIVANTE) */
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-ink">
                              Contenu du message
                            </label>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted mr-1">Variables :</span>
                              {["firstName", "lastName", "company"].map((varName) => (
                                <button
                                  key={varName}
                                  type="button"
                                  onClick={() => handleInsertVariable(varName)}
                                  className="px-2 py-0.5 text-xs font-medium bg-[#f0f0f5] text-ink hover:bg-surface-2 rounded-md transition-colors cursor-pointer"
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
                            placeholder="Écrivez votre message de prospection..."
                            className="w-full p-4 rounded-2xl border border-line text-xs leading-relaxed text-ink focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/10 font-normal"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Indicateur d'état de l'étape (le bouton d'action principal est dans le pied de page) */}
                  <div className="pt-4 border-t border-[#f0f0ed] flex items-center justify-between">
                    <div className="text-xs text-muted flex items-center gap-1.5">
                      {validatedStepTabs.includes(activeStepTab) ? (
                        <span className="text-muted font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-muted" />
                          Étape {activeStepTab + 1} validée
                        </span>
                      ) : (
                        <span className="text-muted flex items-center gap-1.5">
                          <Info className="w-4 h-4 text-ink" />
                          Cliquez sur « Valider & Étape suivante » ci-dessous pour continuer
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Validation & Lancement */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-line bg-surface-2 p-5">
                <h3 className="text-base font-medium text-ink mb-1">
                  Récapitulatif de la campagne
                </h3>
                <p className="text-xs text-muted">
                  Vérifiez la configuration avant d'activer votre séquence d'envois.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-ink">
                  <div>
                    <span className="text-xs text-muted block">Nom :</span>
                    <span className="text-xs font-medium text-ink truncate block">
                      {campaignName}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Audience :</span>
                    <span className="text-xs font-medium text-ink">
                      {totalEligibleProspects} prospects
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Étapes :</span>
                    <span className="text-xs font-medium text-ink">
                      {configuredSteps.length} étape(s)
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Sécurité :</span>
                    <span className="text-xs font-medium text-muted flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Quotas actifs
                    </span>
                  </div>
                </div>
              </div>

              {/* Étapes détaillées */}
              <div className="p-5 rounded-2xl border border-line space-y-3 bg-surface-2">
                <h4 className="text-xs font-medium text-ink mb-2">
                  Déroulement de la séquence
                </h4>
                <div className="space-y-2">
                  {configuredSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-line/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-surface-2 text-ink font-medium text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        {getActionTypeIcon(step.actionType)}
                        <span className="font-medium text-ink">
                          {getActionTypeLabel(step.actionType)}
                          {step.actionType === "INVITATION" && (
                            <span className="ml-1.5 text-xs font-semibold text-ink">
                              {step.messageText && step.messageText.trim().length > 0
                                ? "• avec note"
                                : "• sans note (recommandé)"}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-xs text-muted">
                        {step.delayDays === 0
                          ? "Immédiat"
                          : `Délai : +${step.delayDays}j`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Option d'activation */}
              <div className="p-4 rounded-2xl border border-line space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={startImmediately}
                    onChange={(e) => setStartImmediately(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-ink focus:ring-accent"
                  />
                  <div>
                    <span className="text-xs font-medium text-ink block">
                      Activer la campagne immédiatement
                    </span>
                    <span className="text-xs text-muted leading-relaxed block">
                      Le worker Bleadin commencera à exécuter les premières étapes selon vos créneaux et quotas de sécurité.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

      {/* Modale de détails du modèle de séquence (Style Waalaxy) */}
      <TemplateDetailModal
        template={viewingTemplate}
        isOpen={Boolean(viewingTemplate)}
        onClose={() => setViewingTemplate(null)}
        isSelected={selectedTemplateId === viewingTemplate?.id}
        onSelectAndProceed={(templateId) => {
          setSelectedTemplateId(templateId);
          setViewingTemplate(null);
          setCurrentStep(2);
        }}
      />
    </Modal>
  );
};
