import React, { useState, useEffect } from "react";
import { Play, Pause, MessageSquare, ExternalLink, Search, Layers, Eye, UserCheck, UserPlus, Save, RotateCcw } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Callout } from "../ui/Callout";
import { Field, Input, Select, Textarea } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { SkeletonStatRow, SkeletonTable } from "../ui/Skeleton";
import { Stat, StatRow } from "../ui/Stat";
import { Table, TableWrap, Td, TdActions, Th, Tr } from "../ui/Table";
import { Tabs } from "../ui/Tabs";
import { useToast } from "../ui/Toast";
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
  const toast = useToast();
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
      toast.error("Impossible d'enregistrer la séquence", { description: err.message || "Erreur serveur" });
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
        return <Eye className="h-4 w-4 text-muted" strokeWidth={1.75} />;
      case "INVITATION":
        return <UserPlus className="h-4 w-4 text-muted" strokeWidth={1.75} />;
      case "MESSAGE":
        return <MessageSquare className="h-4 w-4 text-muted" strokeWidth={1.75} />;
      case "FOLLOW":
        return <UserCheck className="h-4 w-4 text-muted" strokeWidth={1.75} />;
      default:
        return <Layers className="h-4 w-4 text-muted" strokeWidth={1.75} />;
    }
  };

  const getStepLabel = (actionType: string) => {
    switch (actionType) {
      case "VISIT_PROFILE":
      case "VISIT":
        return "Visite de profil";
      case "INVITATION":
        return "Invitation";
      case "MESSAGE":
        return "Message";
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

  const statusBadge = (status: ProspectStepStatus) => {
    switch (status) {
      case "WAITING_CONDITION":
        return <Badge tone="warn" dot>Attend acceptation</Badge>;
      case "WAITING_DELAY":
        return <Badge tone="neutral" dot>Délai en cours</Badge>;
      case "REPLIED":
        return <Badge tone="ok" dot>A répondu</Badge>;
      case "COMPLETED":
        return <Badge tone="accent" dot>Séquence terminée</Badge>;
      case "FAILED":
        return <Badge tone="danger" dot>Échec</Badge>;
      default:
        return <Badge tone="neutral" dot>En attente</Badge>;
    }
  };

  const campaignTone = campaign?.status === "ACTIVE" ? "ok" : campaign?.status === "PAUSED" ? "warn" : "neutral";
  const campaignLabel = campaign?.status === "ACTIVE" ? "En cours" : campaign?.status === "PAUSED" ? "En pause" : "Brouillon";

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2.5">
          <span className="truncate">{campaign?.name || "Campagne"}</span>
          {campaign && (
            <Badge tone={campaignTone} dot>
              {campaignLabel}
            </Badge>
          )}
        </span>
      }
      description="Suivi de l'entonnoir et ajustement de la séquence."
      headerActions={
        campaign && (
          <Button
            size="sm"
            variant={campaign.status === "ACTIVE" ? "secondary" : "primary"}
            icon={campaign.status === "ACTIVE" ? Pause : Play}
            loading={actionLoading}
            onClick={handleToggleStatus}
          >
            {campaign.status === "ACTIVE" ? "Mettre en pause" : campaign.status === "DRAFT" ? "Lancer" : "Reprendre"}
          </Button>
        )
      }
      bodyClassName="px-6 pb-6"
    >
      <Tabs
        aria-label="Section"
        size="sm"
        value={activeTab}
        onChange={(v) => setActiveTab(v as "PROSPECTS" | "SEQUENCE")}
        items={[
          { id: "PROSPECTS", label: "Prospects", count: prospects.length },
          { id: "SEQUENCE", label: "Séquence", count: editableSteps.length },
        ]}
        className="mb-6"
      />

      {loading ? (
        <div className="space-y-6" aria-busy>
          <SkeletonStatRow columns={4} />
          <SkeletonTable rows={5} cols={4} />
        </div>
      ) : activeTab === "PROSPECTS" ? (
        <div className="space-y-6">
          <StatRow columns={4}>
            <Stat label="Inscrits" value={stats?.total || 0} />
            <Stat label="Acceptations" value={stats?.accepted || 0} hint={`${stats?.acceptanceRate || 0}% d'acceptation`} />
            <Stat label="Réponses" value={stats?.replied || 0} hint={`${stats?.replyRate || 0}% des acceptés`} />
            <Stat label="En attente" value={(stats?.waitingCondition || 0) + (stats?.waitingDelay || 0)} hint="actions planifiées" />
          </StatRow>

          <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <Input
              size="sm"
              leftIcon={Search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom ou entreprise…"
              className="sm:max-w-sm"
            />
            <Select inline size="sm" aria-label="Statut" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Tous les statuts</option>
              <option value="WAITING_CONDITION">Attend acceptation</option>
              <option value="WAITING_DELAY">Délai en cours</option>
              <option value="REPLIED">A répondu</option>
              <option value="COMPLETED">Séquence terminée</option>
              <option value="FAILED">Échec</option>
            </Select>
          </div>

          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Prospect</Th>
                  <Th>Entreprise</Th>
                  <Th>Étape</Th>
                  <Th>Statut</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {filteredProspects.length === 0 ? (
                  <tr>
                    <Td colSpan={5} className="border-b-0 py-10 text-center text-muted">
                      Aucun prospect dans cette vue.
                    </Td>
                  </tr>
                ) : (
                  filteredProspects.map((p) => (
                    <Tr key={p.id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={`${p.firstName} ${p.lastName}`} src={p.avatarUrl} size="md" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">
                              {p.firstName} {p.lastName}
                            </p>
                            <p className="max-w-[220px] truncate text-xs text-muted">{p.headline || "—"}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>{p.company || "—"}</Td>
                      <Td>
                        <span className="font-medium text-ink">Étape {p.currentStepOrder}</span>
                        <span className="block text-xs text-muted">
                          {p.currentStepType === "INVITATION" ? "Invitation" : p.currentStepType === "MESSAGE" ? "Message" : "Visite de profil"}
                        </span>
                      </Td>
                      <Td>{statusBadge(p.status)}</Td>
                      <TdActions>
                        {p.linkedinUrl && (
                          <a
                            href={p.linkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
                            title="Voir sur LinkedIn"
                          >
                            <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                          </a>
                        )}
                      </TdActions>
                    </Tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      ) : (
        <div className="space-y-6">
          {saveSuccessMessage && <Callout tone="ok">{saveSuccessMessage}</Callout>}
          <Callout tone="info" title="Modification d'une séquence en cours">
            Les messages et délais modifiés sont répercutés sur les actions encore en attente pour les prospects qui n'ont pas franchi ces étapes.
          </Callout>

          <Field label="Nom de la campagne">
            <Input value={editableName} onChange={(e) => setEditableName(e.target.value)} placeholder="Ex. : Prospection directeurs financiers" />
          </Field>

          <div className="space-y-3">
            <p className="text-sm font-medium text-ink">Étapes ({editableSteps.length})</p>
            {editableSteps.map((step, index) => {
              const isMessageStep = step.actionType === "MESSAGE" || step.actionType === "INVITATION";
              const isInvitation = step.actionType === "INVITATION";
              const charCount = (step.messageText || "").length;
              const maxChars = isInvitation ? 300 : 2000;
              const isPreviewOpen = previewStepIndex === index;

              return (
                <div key={step.id || index} className="space-y-4 rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-xs tabular-nums text-muted">{step.stepOrder}</span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                        {getStepIcon(step.actionType)}
                        {getStepLabel(step.actionType)}
                      </span>
                    </div>
                    {step.stepOrder > 1 && (
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span>Délai</span>
                        <Tabs
                          variant="segmented"
                          size="sm"
                          aria-label="Délai"
                          value={[0, 1, 2, 3, 5].includes(step.delayDays) ? String(step.delayDays) : "custom"}
                          onChange={(v) => v !== "custom" && handleStepChange(index, "delayDays", Number(v))}
                          items={[
                            { id: "0", label: "Immédiat" },
                            { id: "1", label: "1 j" },
                            { id: "2", label: "2 j" },
                            { id: "3", label: "3 j" },
                            { id: "5", label: "5 j" },
                          ]}
                        />
                        <Input
                          size="sm"
                          type="number"
                          min={0}
                          max={30}
                          value={step.delayDays}
                          onChange={(e) => handleStepChange(index, "delayDays", parseInt(e.target.value) || 0)}
                          className="w-16 text-center"
                          aria-label="Jours"
                        />
                        <span>jours</span>
                      </div>
                    )}
                  </div>

                  {isMessageStep && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink">{isInvitation ? "Note d'invitation (optionnelle)" : "Message"}</span>
                        <div className="flex items-center gap-1">
                          <span className="mr-1 hidden text-xs text-muted sm:inline">Insérer</span>
                          <Button variant="ghost" size="sm" onClick={() => handleInsertVariable(index, "{{firstName}}")}>
                            Prénom
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleInsertVariable(index, "{{lastName}}")}>
                            Nom
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleInsertVariable(index, "{{company}}")}>
                            Entreprise
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        rows={isInvitation ? 3 : 4}
                        value={step.messageText || ""}
                        onChange={(e) => handleStepChange(index, "messageText", e.target.value)}
                        placeholder={
                          isInvitation
                            ? "Bonjour {{firstName}}, je serais ravi de vous ajouter à mon réseau…"
                            : "Bonjour {{firstName}}, je vous contacte suite à vos actualités chez {{company}}…"
                        }
                      />
                      <div className="flex items-center justify-between text-xs text-muted">
                        <button type="button" onClick={() => setPreviewStepIndex(isPreviewOpen ? null : index)} className="inline-flex items-center gap-1 hover:text-ink">
                          <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                          {isPreviewOpen ? "Masquer l'aperçu" : "Voir l'aperçu"}
                        </button>
                        <span className={charCount > maxChars ? "text-danger" : undefined}>
                          {charCount} / {maxChars}
                        </span>
                      </div>
                      {isPreviewOpen && step.messageText && (
                        <div className="rounded-lg border border-line bg-surface-2 p-3 text-sm leading-relaxed text-ink-2 whitespace-pre-wrap">{renderPreview(step.messageText)}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <Button variant="ghost" icon={RotateCcw} onClick={fetchDetails} disabled={savingSequence}>
              Réinitialiser
            </Button>
            <Button icon={Save} onClick={handleSaveSequence} loading={savingSequence}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
