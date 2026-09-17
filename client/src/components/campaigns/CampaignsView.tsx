import React, { useState, useEffect } from "react";
import { Plus, Play, Pause, Trash2, RotateCcw, Archive, Send } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Select } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { PageHeader } from "../ui/PageHeader";
import { SkeletonTable } from "../ui/Skeleton";
import { Stat, StatRow } from "../ui/Stat";
import { Table, TableWrap, Td, TdActions, Th, Tr } from "../ui/Table";
import { Tabs } from "../ui/Tabs";
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
        window.dispatchEvent(new CustomEvent("bleadin:refresh-dashboard"));
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
      const isAlreadyArchived = campaigns.find((c) => c.id === campaignToDelete.id)?.status === "ARCHIVED";
      const query = isAlreadyArchived ? "?permanent=true" : "";
      const res = await apiRequest<{ success: boolean; action?: string; error?: string }>(
        `/campaigns/${campaignToDelete.id}${query}`,
        { method: "DELETE" }
      );
      if (res.success) {
        if (res.action === "ARCHIVED") {
          setCampaigns((prev) =>
            prev.map((c) => (c.id === campaignToDelete.id ? { ...c, status: "ARCHIVED" } : c))
          );
        } else {
          setCampaigns((prev) => prev.filter((c) => c.id !== campaignToDelete.id));
        }
        setCampaignToDelete(null);
        window.dispatchEvent(new CustomEvent("bleadin:refresh-dashboard"));
      } else {
        setDeleteCampaignError(res.error || "Impossible d'archiver ou supprimer cette campagne.");
      }
    } catch (err: any) {
      console.error("Erreur suppression campagne:", err);
      setDeleteCampaignError(err?.message || "Erreur inattendue.");
    } finally {
      setIsDeletingCampaign(false);
    }
  };

  const handleRestoreCampaign = async (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiRequest<{ campaign: Campaign }>(`/campaigns/${campaign.id}/toggle-status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "PAUSED" }),
      });
      if (res.success) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === campaign.id ? { ...c, status: "PAUSED" } : c))
        );
        window.dispatchEvent(new CustomEvent("bleadin:refresh-dashboard"));
      }
    } catch (err) {
      console.error("Erreur restauration campagne:", err);
    }
  };

  const handleOpenDetail = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setIsDetailOpen(true);
  };

  // Décomptes par statut pour afficher les nombres sur chaque bouton
  const countAll = campaigns.filter((c) => c.status !== "ARCHIVED").length;
  const countActive = campaigns.filter((c) => c.status === "ACTIVE").length;
  const countPaused = campaigns.filter((c) => c.status === "PAUSED").length;
  const countDraft = campaigns.filter((c) => c.status === "DRAFT").length;
  const countArchived = campaigns.filter((c) => c.status === "ARCHIVED" || c.status === "COMPLETED").length;

  // Calcul des métriques globales (sur campagnes non archivées)
  const totalCampaigns = countAll;
  const activeCampaigns = countActive;
  const totalProspectsEnrolled = campaigns
    .filter((c) => c.status !== "ARCHIVED")
    .reduce((sum, c) => sum + (c.stats?.totalProspects || 0), 0);
  const totalAccepted = campaigns
    .filter((c) => c.status !== "ARCHIVED")
    .reduce((sum, c) => sum + (c.stats?.acceptedCount || 0), 0);
  const totalReplied = campaigns
    .filter((c) => c.status !== "ARCHIVED")
    .reduce((sum, c) => sum + (c.stats?.repliedCount || 0), 0);
  const averageAcceptanceRate =
    totalProspectsEnrolled > 0
      ? Math.round((totalAccepted / totalProspectsEnrolled) * 100)
      : 0;

  const filterTabs = [
    { key: "ALL", label: "Toutes les campagnes", count: countAll },
    { key: "ACTIVE", label: "En cours", count: countActive },
    { key: "PAUSED", label: "En pause", count: countPaused },
    { key: "DRAFT", label: "Brouillons", count: countDraft },
    { key: "ARCHIVED", label: "Archivées", count: countArchived },
  ];

  const filteredCampaigns = campaigns.filter((c) => {
    if (filterStatus === "ALL") return c.status !== "ARCHIVED";
    if (filterStatus === "ARCHIVED") return c.status === "ARCHIVED" || c.status === "COMPLETED";
    return c.status === filterStatus;
  });

  const statusMeta = (camp: Campaign) => {
    if (camp.status === "ACTIVE") return { tone: "ok" as const, label: "En cours" };
    if (camp.status === "PAUSED") return { tone: "warn" as const, label: "En pause" };
    if (camp.status === "ARCHIVED" || camp.status === "COMPLETED") return { tone: "neutral" as const, label: "Archivée" };
    return { tone: "accent" as const, label: "Brouillon" };
  };

  const canFilterMembers = (user?.role === "SUPER_ADMIN" || user?.orgRole === "OWNER") && teamMembers.length > 0;

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">
        <PageHeader
          title="Campagnes"
          description="Vos séquences d'invitations et de relances automatisées sur LinkedIn."
          actions={
            subTab === "CAMPAIGNS" ? (
              <Button icon={Plus} onClick={handleOpenWizard}>
                Nouvelle campagne
              </Button>
            ) : undefined
          }
          tabs={
            <Tabs
              aria-label="Section"
              value={subTab}
              onChange={(v) => setSubTab(v as "CAMPAIGNS" | "QUEUE")}
              items={[
                { id: "CAMPAIGNS", label: "Mes campagnes", count: totalCampaigns },
                { id: "QUEUE", label: "File d'attente" },
              ]}
            />
          }
        />

        {subTab === "QUEUE" ? (
          <QueueView />
        ) : (
          <div className="space-y-6">
            <StatRow columns={4}>
              <Stat label="Campagnes actives" value={activeCampaigns} />
              <Stat label="Prospects engagés" value={totalProspectsEnrolled} />
              <Stat label="Taux moyen d'acceptation" value={`${averageAcceptanceRate}%`} />
              <Stat label="Réponses obtenues" value={totalReplied} />
            </StatRow>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Tabs
                variant="segmented"
                aria-label="Statut"
                size="sm"
                value={filterStatus}
                onChange={setFilterStatus}
                items={filterTabs.map((t) => ({ id: t.key, label: t.label, count: t.count }))}
                className="max-w-full"
              />
              {canFilterMembers && (
                <Select
                  inline
                  size="sm"
                  aria-label="Collaborateur"
                  value={selectedMemberId || "ALL"}
                  onChange={(e) => setSelectedMemberId(e.target.value === "ALL" ? null : e.target.value)}
                >
                  <option value="ALL">Toute l'équipe</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.email} {m.orgRole === "OWNER" ? "(Propriétaire)" : ""}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {loading ? (
              <SkeletonTable rows={5} cols={6} />
            ) : filteredCampaigns.length === 0 ? (
              filterStatus === "ARCHIVED" ? (
                <EmptyState
                  icon={Archive}
                  title="Aucune campagne archivée"
                  description="Les campagnes supprimées ou archivées apparaîtront ici pour conserver vos historiques."
                />
              ) : (
                <EmptyState
                  icon={Send}
                  title="Aucune campagne"
                  description="Créez votre première séquence d'invitations et de messages pour engager vos prospects LinkedIn."
                  action={
                    <Button icon={Plus} onClick={handleOpenWizard}>
                      Créer ma première campagne
                    </Button>
                  }
                />
              )
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Campagne</Th>
                      <Th>Statut</Th>
                      <Th className="text-right">Prospects</Th>
                      <Th className="text-right">Acceptés</Th>
                      <Th className="text-right">Réponses</Th>
                      <Th>Créée le</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((camp) => {
                      const isActive = camp.status === "ACTIVE";
                      const isArchived = camp.status === "ARCHIVED" || camp.status === "COMPLETED";
                      const meta = statusMeta(camp);
                      const author = (camp as any).author;
                      return (
                        <Tr key={camp.id} clickable onClick={() => handleOpenDetail(camp.id)} className={isArchived ? "text-muted" : undefined}>
                          <Td>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">{camp.name}</p>
                              <p className="truncate text-xs text-muted">
                                {camp.steps?.length || 0} étape(s)
                                {author ? ` · ${author.name}` : ""}
                              </p>
                            </div>
                          </Td>
                          <Td>
                            <Badge tone={meta.tone} dot>
                              {meta.label}
                            </Badge>
                          </Td>
                          <Td className="text-right tabular-nums">{camp.stats?.totalProspects || 0}</Td>
                          <Td className="text-right tabular-nums">{camp.stats?.acceptanceRate || 0}%</Td>
                          <Td className="text-right tabular-nums">{camp.stats?.replyRate || 0}%</Td>
                          <Td className="whitespace-nowrap text-muted">{new Date(camp.createdAt).toLocaleDateString()}</Td>
                          <TdActions>
                            {isArchived ? (
                              <IconButton label="Restaurer la campagne" icon={RotateCcw} onClick={(e) => handleRestoreCampaign(camp, e)} />
                            ) : (
                              <IconButton
                                label={isActive ? "Mettre en pause" : "Reprendre"}
                                icon={isActive ? Pause : Play}
                                disabled={togglingId === camp.id}
                                onClick={(e) => handleToggleStatus(camp, e)}
                              />
                            )}
                            <IconButton
                              label={isArchived ? "Supprimer définitivement" : "Archiver la campagne"}
                              icon={Trash2}
                              tone="danger"
                              onClick={(e) => handleOpenDeleteCampaign(camp.id, camp.name, e)}
                            />
                          </TdActions>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </div>
        )}
      </div>

      {/* Modale de Création (Wizard) */}
      <CampaignWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onCampaignCreated={() => {
          fetchCampaigns();
          window.dispatchEvent(new CustomEvent("bleadin:refresh-dashboard"));
        }}
      />

      {/* Modale de Détail (Funnel & Prospects) */}
      <CampaignDetailModal
        campaignId={selectedCampaignId}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedCampaignId(null);
        }}
        onStatusToggled={() => {
          fetchCampaigns();
          window.dispatchEvent(new CustomEvent("bleadin:refresh-dashboard"));
        }}
      />

      {/* Modale d'avertissement LinkedIn requis */}
      <LinkedInRequiredModal
        isOpen={showLinkedInRequiredModal}
        onClose={() => setShowLinkedInRequiredModal(false)}
        onConnectLinkedIn={() => openLinkedInModal()}
        featureName={requiredFeatureName}
      />

      {/* Modale de Confirmation d'Archivage ou de Suppression Définitive */}
      <ConfirmModal
        isOpen={Boolean(campaignToDelete)}
        onClose={() => {
          if (!isDeletingCampaign) {
            setCampaignToDelete(null);
            setDeleteCampaignError(null);
          }
        }}
        onConfirm={handleConfirmDeleteCampaign}
        title={
          campaigns.find((c) => c.id === campaignToDelete?.id)?.status === "ARCHIVED"
            ? "Supprimer définitivement la campagne"
            : "Archiver la campagne"
        }
        description={
          campaigns.find((c) => c.id === campaignToDelete?.id)?.status === "ARCHIVED"
            ? "Cette action supprimera définitivement cette campagne ainsi que toutes ses données associées de l'application."
            : "Cette action mettra la campagne en pause, annulera les actions programmées restantes et la déplacera dans l'onglet « Archivées »."
        }
        itemName={campaignToDelete?.name}
        itemType="Campagne"
        variant="danger"
        confirmText={
          campaigns.find((c) => c.id === campaignToDelete?.id)?.status === "ARCHIVED"
            ? "Supprimer définitivement"
            : "Archiver la campagne"
        }
        cancelText="Conserver la campagne"
        isLoading={isDeletingCampaign}
        warningMessage={
          deleteCampaignError ||
          (campaigns.find((c) => c.id === campaignToDelete?.id)?.status === "ARCHIVED"
            ? "Attention : Cette suppression est irréversible."
            : "Les prospects en cours d'exécution dans cette séquence ne recevront plus les messages prévus.")
        }
      />
    </div>
  );
};
