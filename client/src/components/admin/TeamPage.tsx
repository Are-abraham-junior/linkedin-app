import React, { useState, useEffect, useCallback } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { UserPlus, Shield, User as UserIcon, Mail, X, LogOut, Send } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge, StatusDot } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Callout } from "../ui/Callout";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Field, Input, Select, labelClass } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Modal } from "../ui/Modal";
import { PageHeader } from "../ui/PageHeader";
import { SkeletonTable } from "../ui/Skeleton";
import { Table, TableWrap, Td, TdActions, Th, Tr } from "../ui/Table";
import { useToast } from "../ui/Toast";
import { ConfirmModal } from "../common/ConfirmModal";

interface TeamMember {
  id: string;
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  avatarUrl: string | null;
  orgRole: "OWNER" | "ADMIN" | "MEMBER";
  status: string;
  createdAt: string;
  linkedInAccount: {
    accountName: string | null;
    profilePicture: string | null;
    headline: string | null;
    status: string;
    dailyInvitesSent: number;
    dailyMsgSent: number;
  } | null;
}

interface PendingInvitation {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { name: string | null };
}

export const TeamPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const canManageTeam =
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.orgRole === "OWNER" ||
    currentUser?.orgRole === "ADMIN";

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modale Inviter un membre
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [email, setEmail] = useState("");
  const [orgRole, setOrgRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const toast = useToast();

  // États d'action sur la liste
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  // Modal de confirmation de retrait de membre
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);

  const loadTeam = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ members: TeamMember[]; invitations: PendingInvitation[] }>("/team/members");
      if (res.success) {
        setMembers(res.members || []);
        setInvitations(res.invitations || []);
      }
    } catch (err) {
      console.error("Erreur chargement équipe:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  // Envoi d'une invitation par email
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!email.trim()) {
      setAddError("L'adresse email est requise.");
      return;
    }

    setAddLoading(true);

    try {
      const res = await apiRequest<{ success: boolean; message: string }>("/team/invite", {
        method: "POST",
        body: {
          email: email.trim(),
          orgRole,
        },
      });

      if (res.success) {
        setShowAddMemberModal(false);
        toast.success(res.message || `Invitation envoyée à ${email}.`);
        // Réinitialiser le formulaire
        setEmail("");
        setOrgRole("MEMBER");
        loadTeam();
      } else {
        setAddError((res as any).error || "Erreur lors de l'envoi de l'invitation.");
      }
    } catch (err: any) {
      setAddError(err.message || "Erreur inattendue. Veuillez vérifier vos informations.");
    } finally {
      setAddLoading(false);
    }
  };

  // Modification du rôle d'un membre
  const handleUpdateRole = async (userId: string, newRole: "ADMIN" | "MEMBER") => {
    setUpdatingRoleId(userId);
    try {
      const res = await apiRequest(`/team/members/${userId}/role`, {
        method: "PUT",
        body: { orgRole: newRole },
      });
      if (res.success) {
        toast.success("Rôle mis à jour avec succès.");
        loadTeam();
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la modification du rôle.");
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // Suppression d'un membre avec Modal
  const handleOpenRemoveMember = (userId: string, memberName: string) => {
    setMemberToRemove({ id: userId, name: memberName || "ce membre" });
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setRemovingId(memberToRemove.id);
    try {
      await apiRequest(`/team/members/${memberToRemove.id}`, { method: "DELETE" });
      toast.success("Membre retiré de l'espace.");
      setMemberToRemove(null);
      loadTeam();
    } catch (err) {
      toast.error("Erreur lors du retrait du membre.");
    } finally {
      setRemovingId(null);
    }
  };

  // Annulation d'invitation
  const handleCancelInvitation = async (invitationId: string) => {
    setCancellingId(invitationId);
    try {
      await apiRequest(`/team/invitations/${invitationId}`, { method: "DELETE" });
      loadTeam();
    } catch {
      toast.error("Erreur lors de l'annulation de l'invitation.");
    } finally {
      setCancellingId(null);
    }
  };

  const memberAvatar = (member: TeamMember) => {
    const isConnected = member.linkedInAccount?.status === "CONNECTED";
    const src = (isConnected ? member.linkedInAccount?.profilePicture : null) || member.avatarUrl;
    const name =
      (isConnected ? member.linkedInAccount?.accountName : null) ||
      member.name ||
      `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
      member.email;
    return <Avatar name={name} src={src} size="md" />;
  };

  const roleBadge = (role: TeamMember["orgRole"]) =>
    role === "OWNER" ? <Badge tone="accent">Propriétaire</Badge> : role === "ADMIN" ? <Badge>Admin d'équipe</Badge> : <Badge>Membre</Badge>;

  const openAdd = () => {
    setShowAddMemberModal(true);
    setAddError(null);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Équipe"
        description={`${members.length} collaborateur${members.length !== 1 ? "s" : ""} dans cet espace${
          invitations.length > 0 ? ` · ${invitations.length} invitation${invitations.length !== 1 ? "s" : ""} en attente` : ""
        }.`}
        actions={
          canManageTeam ? (
            <Button icon={UserPlus} onClick={openAdd}>
              Inviter un membre
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : (
        <div className="space-y-6">
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold text-ink">Membres</h2>
              <span className="text-xs tabular-nums text-muted">{members.length}</span>
            </div>
            {members.length === 0 ? (
              <EmptyState
                bare
                icon={UserPlus}
                title="Aucun membre pour l'instant"
                description="Invitez vos collègues pour collaborer sur vos campagnes."
                action={
                  canManageTeam && (
                    <Button variant="secondary" size="sm" onClick={openAdd}>
                      Inviter un membre
                    </Button>
                  )
                }
              />
            ) : (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Membre</Th>
                      <Th>Rôle</Th>
                      <Th>LinkedIn</Th>
                      <Th className="text-right">Aujourd'hui</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const displayName = member.name || `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email;
                      const headline = member.linkedInAccount?.headline;
                      const liStatus = member.linkedInAccount?.status || "DISCONNECTED";
                      const isConnected = liStatus === "CONNECTED";
                      const editable = canManageTeam && member.orgRole !== "OWNER" && member.id !== currentUser?.id;
                      return (
                        <Tr key={member.id}>
                          <Td>
                            <div className="flex items-center gap-3">
                              {memberAvatar(member)}
                              <div className="min-w-0">
                                <p className="truncate font-medium text-ink">{displayName}</p>
                                <p className="truncate text-xs text-muted">{isConnected && headline ? headline : member.email}</p>
                              </div>
                            </div>
                          </Td>
                          <Td>
                            {editable ? (
                              <Select
                                inline
                                size="sm"
                                value={member.orgRole}
                                disabled={updatingRoleId === member.id}
                                onChange={(e) => handleUpdateRole(member.id, e.target.value as "ADMIN" | "MEMBER")}
                                aria-label="Rôle"
                              >
                                <option value="MEMBER">Membre</option>
                                <option value="ADMIN">Admin d'équipe</option>
                              </Select>
                            ) : (
                              roleBadge(member.orgRole)
                            )}
                          </Td>
                          <Td>
                            <StatusDot tone={isConnected ? "ok" : liStatus === "SUSPENDED" ? "danger" : "warn"}>
                              {isConnected ? "Connecté" : liStatus === "SUSPENDED" ? "Suspendu" : "Non lié"}
                            </StatusDot>
                          </Td>
                          <Td className="whitespace-nowrap text-right tabular-nums text-muted">
                            {isConnected && member.linkedInAccount
                              ? `${member.linkedInAccount.dailyInvitesSent} inv. · ${member.linkedInAccount.dailyMsgSent} msg.`
                              : "—"}
                          </Td>
                          <TdActions>
                            {editable && (
                              <IconButton
                                label="Retirer de l'équipe"
                                icon={LogOut}
                                tone="danger"
                                disabled={removingId === member.id}
                                onClick={() => handleOpenRemoveMember(member.id, displayName)}
                              />
                            )}
                          </TdActions>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>

          {invitations.length > 0 && (
            <Card padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="text-base font-semibold text-ink">Invitations en attente</h2>
                <span className="text-xs tabular-nums text-muted">{invitations.length}</span>
              </div>
              <ul className="divide-y divide-line">
                {invitations.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-4 px-5 py-3">
                    <Mail className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{inv.email}</p>
                      <p className="text-xs text-muted">Expire le {new Date(inv.expiresAt).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <Badge tone="warn" dot>
                      En attente
                    </Badge>
                    <IconButton label="Annuler l'invitation" icon={X} tone="danger" disabled={cancellingId === inv.id} onClick={() => handleCancelInvitation(inv.id)} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <Modal
        open={showAddMemberModal}
        onClose={() => {
          setShowAddMemberModal(false);
          setAddError(null);
        }}
        title="Inviter un membre"
        description="Une invitation lui sera envoyée par e-mail."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddMemberModal(false)}>
              Annuler
            </Button>
            <Button type="submit" form="invite-member-form" icon={Send} loading={addLoading}>
              Envoyer l'invitation
            </Button>
          </>
        }
      >
        <form id="invite-member-form" onSubmit={handleAddMember} className="space-y-4 pb-2">
          {addError && <Callout tone="danger">{addError}</Callout>}
          <Field label="E-mail professionnel" required>
            <Input type="email" required autoFocus leftIcon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@entreprise.com" />
          </Field>
          <div>
            <p className={labelClass}>Rôle</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Rôle">
              {[
                { id: "MEMBER" as const, icon: UserIcon, label: "Membre", desc: "Gère ses prospects, ses campagnes et sa messagerie." },
                { id: "ADMIN" as const, icon: Shield, label: "Admin d'équipe", desc: "Peut aussi inviter des membres et voir les métriques d'équipe." },
              ].map((opt) => {
                const Icon = opt.icon;
                const selected = orgRole === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setOrgRole(opt.id)}
                    className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      selected ? "border-ink bg-surface-2" : "border-line hover:border-ink"
                    }`}
                  >
                    <span className="mb-1 flex items-center gap-2 text-sm font-medium text-ink">
                      <Icon className="h-4 w-4 text-muted" strokeWidth={1.75} aria-hidden />
                      {opt.label}
                    </span>
                    <span className="block text-xs leading-snug text-muted">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal de Confirmation de Retrait de Membre */}
      <ConfirmModal
        isOpen={Boolean(memberToRemove)}
        onClose={() => {
          if (!removingId) setMemberToRemove(null);
        }}
        onConfirm={handleConfirmRemoveMember}
        title="Retirer le membre de l'espace"
        description="Cette action révoquera immédiatement l'accès de ce collaborateur à votre espace de travail."
        itemName={memberToRemove?.name}
        itemType="Membre d'équipe"
        variant="warning"
        confirmText="Retirer de l'équipe"
        cancelText="Conserver le membre"
        isLoading={Boolean(removingId)}
        warningMessage="Le membre ne pourra plus consulter les campagnes, prospects ni envoyer de messages pour cette organisation."
      />
    </div>
  );
};

