import React, { useState, useEffect, useCallback } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import {
  UserPlus,
  Shield,
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  X,
  Sparkles,
  AlertCircle,
  LogOut,
  Send,
  MessageSquare,
} from "lucide-react";
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

  // Modale Ajouter un membre
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgRole, setOrgRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [showPassword, setShowPassword] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Notification Toast de succès
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // Disparition automatique du toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Création directe d'un membre avec ses identifiants
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!lastName.trim()) {
      setAddError("Le nom du collaborateur est requis.");
      return;
    }
    if (!email.trim()) {
      setAddError("L'adresse email est requise.");
      return;
    }
    if (password.length < 8) {
      setAddError("Le mot de passe initial doit contenir au moins 8 caractères.");
      return;
    }

    setAddLoading(true);

    try {
      const res = await apiRequest<{ success: boolean; message: string; member: TeamMember }>("/team/members", {
        method: "POST",
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          orgRole,
        },
      });

      if (res.success) {
        setShowAddMemberModal(false);
        setToastMessage(res.message || `Le membre ${firstName} ${lastName} a été ajouté avec succès !`);
        // Réinitialiser le formulaire
        setFirstName("");
        setLastName("");
        setEmail("");
        setPassword("");
        setOrgRole("MEMBER");
        loadTeam();
      } else {
        setAddError((res as any).error || "Erreur lors de l'ajout du membre.");
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
        setToastMessage("Rôle mis à jour avec succès.");
        loadTeam();
      }
    } catch (err: any) {
      alert(err.message || "Erreur lors de la modification du rôle.");
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
      setToastMessage("Membre retiré de l'espace.");
      setMemberToRemove(null);
      loadTeam();
    } catch (err) {
      alert("Erreur lors du retrait du membre.");
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
      alert("Erreur lors de l'annulation de l'invitation.");
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONNECTED":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "SUSPENDED":
        return "bg-red-50 text-red-700 border border-red-200";
      default:
        return "bg-amber-50 text-amber-700 border border-amber-200";
    }
  };

  const MemberAvatar: React.FC<{ member: TeamMember; size?: "sm" | "md" }> = ({ member, size = "md" }) => {
    const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
    const isConnected = member.linkedInAccount?.status === "CONNECTED";
    const src = (isConnected ? member.linkedInAccount?.profilePicture : null) || member.avatarUrl;
    const name = (isConnected ? member.linkedInAccount?.accountName : null) || member.name || `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email;

    const getInitials = (n: string) => {
      const parts = n.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return n.slice(0, 2).toUpperCase() || "?";
    };

    if (src) {
      return (
        <img
          src={src}
          alt={name}
          className={`${sizeClass} rounded-2xl object-cover border border-[#e0e0db]/60 shadow-sm`}
        />
      );
    }
    return (
      <div
        className={`${sizeClass} rounded-2xl flex items-center justify-center font-bold text-white shadow-sm shrink-0`}
        style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
      >
        {getInitials(name)}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#592eff]/10 text-[#592eff] text-xs font-bold mb-2 tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            Espace Collaboratif
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#21164c] tracking-tight">Mon équipe</h1>
          <p className="text-[#5f5f69] text-xs sm:text-sm mt-1">
            {members.length} collaborateur{members.length !== 1 ? "s" : ""} dans cet espace
            {invitations.length > 0 && ` · ${invitations.length} invitation${invitations.length !== 1 ? "s" : ""} en attente`}
          </p>
        </div>

        {/* Bouton Ajouter un membre (Réservé au Propriétaire et Admins) */}
        {canManageTeam && (
          <button
            onClick={() => {
              setShowAddMemberModal(true);
              setAddError(null);
            }}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-white text-xs shadow-lg shadow-[#592eff]/25 hover:shadow-[#592eff]/35 active:scale-[0.99] transition-all cursor-pointer"
            style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Ajouter un membre</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
          <div className="w-6 h-6 border-2 border-[#592eff] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Chargement de votre équipe...</span>
        </div>
      ) : (
        <>
          {/* Members list Card */}
          <div className="adora-card bg-white rounded-3xl shadow-xl shadow-[#592eff]/5 border border-[#e0e0db]/60 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-[#e0e0db]/50 flex items-center justify-between bg-[#f8f9fc]/50">
              <h2 className="font-bold text-[#21164c] text-xs uppercase tracking-wider">Membres actifs</h2>
              <span className="text-xs font-bold text-[#592eff] bg-[#592eff]/10 px-2.5 py-0.5 rounded-full">
                {members.length} actif{members.length !== 1 ? "s" : ""}
              </span>
            </div>

            {members.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-3 text-[#592eff]">
                  <UserPlus className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-[#21164c]">Aucun membre pour l'instant.</p>
                <p className="text-xs text-[#5f5f69] mt-1">Ajoutez vos collègues pour collaborer sur vos campagnes.</p>
                {canManageTeam && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#592eff] hover:underline cursor-pointer"
                  >
                    Ajouter votre premier membre →
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#e0e0db]/40">
                {members.map((member) => {
                  const displayName = member.name || `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email;
                  const headline = member.linkedInAccount?.headline;
                  const liStatus = member.linkedInAccount?.status || "DISCONNECTED";
                  const isConnected = liStatus === "CONNECTED";

                  return (
                    <div key={member.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[#f8f9fc]/60 transition-colors">
                      <MemberAvatar member={member} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-[#21164c] text-sm truncate">{displayName}</span>

                          {/* Rôle Badge */}
                          {member.orgRole === "OWNER" && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20 shrink-0">
                              Propriétaire
                            </span>
                          )}
                          {member.orgRole === "ADMIN" && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                              Admin d'équipe
                            </span>
                          )}
                          {member.orgRole === "MEMBER" && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200 shrink-0">
                              Membre
                            </span>
                          )}
                        </div>

                        {isConnected && headline && (
                          <p className="text-xs text-[#5f5f69] truncate">{headline}</p>
                        )}
                        <p className="text-[11px] text-[#5f5f69]">{member.email}</p>
                      </div>

                      {/* Statut LinkedIn & Actions */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${getStatusColor(liStatus)}`}>
                          {isConnected ? "LinkedIn ✓" : "LinkedIn non lié"}
                        </span>

                        {/* Quotas / Activité si connecté */}
                        {isConnected && member.linkedInAccount && (
                          <div className="hidden sm:flex items-center gap-3 text-xs text-[#5f5f69]">
                            <span title="Invitations envoyées aujourd'hui" className="flex items-center gap-1">
                              <Send className="w-3.5 h-3.5 text-[#592eff]" />
                              {member.linkedInAccount.dailyInvitesSent}
                            </span>
                            <span title="Messages envoyés aujourd'hui" className="flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-[#592eff]" />
                              {member.linkedInAccount.dailyMsgSent}
                            </span>
                          </div>
                        )}

                        {/* Sélecteur de rôle rapide (Réservé aux admins/owner et interdit sur l'owner ou soi-même) */}
                        {canManageTeam && member.orgRole !== "OWNER" && member.id !== currentUser?.id && (
                          <div className="hidden md:block">
                            <select
                              value={member.orgRole}
                              disabled={updatingRoleId === member.id}
                              onChange={(e) => handleUpdateRole(member.id, e.target.value as "ADMIN" | "MEMBER")}
                              className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] focus:outline-none focus:border-[#592eff] cursor-pointer"
                            >
                              <option value="MEMBER">Membre</option>
                              <option value="ADMIN">Admin d'équipe</option>
                            </select>
                          </div>
                        )}

                        {/* Retirer le membre (Réservé aux admins/owner et interdit sur l'owner ou soi-même) */}
                        {canManageTeam && member.orgRole !== "OWNER" && member.id !== currentUser?.id && (
                          <button
                            onClick={() => handleOpenRemoveMember(member.id, displayName)}
                            disabled={removingId === member.id}
                            className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                            title="Retirer de l'équipe"
                          >
                            <LogOut className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Invitations list (si existantes) */}
          {invitations.length > 0 && (
            <div className="adora-card bg-white rounded-3xl shadow-sm border border-[#e0e0db]/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-[#e0e0db]/50 bg-[#f8f9fc]/50">
                <h2 className="font-bold text-[#21164c] text-xs uppercase tracking-wider">Invitations en attente</h2>
              </div>
              <div className="divide-y divide-[#e0e0db]/40">
                {invitations.map((inv) => (
                  <div key={inv.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-600">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#21164c] text-xs">{inv.email}</p>
                      <p className="text-[11px] text-[#5f5f69]">
                        Expire le {new Date(inv.expiresAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                      En attente
                    </span>
                    <button
                      onClick={() => handleCancelInvitation(inv.id)}
                      disabled={cancellingId === inv.id}
                      className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                      title="Annuler l'invitation"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MODALE AJOUTER UN MEMBRE ───────────────────────── */}
      {showAddMemberModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(33, 22, 76, 0.45)", backdropFilter: "blur(6px)" }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#e0e0db]/60 animate-fade-in">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-[#e0e0db]/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#21164c] text-base">Ajouter un membre</h3>
                  <p className="text-[#5f5f69] text-[11px]">Créez ses identifiants pour l'intégrer à votre espace.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setAddError(null);
                }}
                className="p-2 rounded-xl text-[#5f5f69] hover:text-[#21164c] hover:bg-[#f8f9fc] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              {addError && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="flex-1">{addError}</span>
                </div>
              )}

              {/* Prénom & Nom */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                    Prénom
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jean"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Dupont"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Email professionnel */}
              <div>
                <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                  Email professionnel <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jean.dupont@entreprise.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Mot de passe initial */}
              <div>
                <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                  Mot de passe initial (8 car. min) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5f5f69] hover:text-[#21164c] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Sélecteur de Rôle / Permissions (2 cartes radio) */}
              <div>
                <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                  Permissions & Rôle
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option Membre */}
                  <div
                    onClick={() => setOrgRole("MEMBER")}
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                      orgRole === "MEMBER"
                        ? "border-[#592eff] bg-[#592eff]/5 shadow-sm"
                        : "border-[#e0e0db] bg-[#f8f9fc] hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <UserIcon className={`w-4 h-4 ${orgRole === "MEMBER" ? "text-[#592eff]" : "text-[#5f5f69]"}`} />
                      <span className="text-xs font-bold text-[#21164c]">Membre</span>
                    </div>
                    <p className="text-[11px] text-[#5f5f69] leading-snug">
                      Gère ses prospects, ses campagnes et sa messagerie.
                    </p>
                  </div>

                  {/* Option Admin */}
                  <div
                    onClick={() => setOrgRole("ADMIN")}
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                      orgRole === "ADMIN"
                        ? "border-[#592eff] bg-[#592eff]/5 shadow-sm"
                        : "border-[#e0e0db] bg-[#f8f9fc] hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className={`w-4 h-4 ${orgRole === "ADMIN" ? "text-[#592eff]" : "text-[#5f5f69]"}`} />
                      <span className="text-xs font-bold text-[#21164c]">Admin d'équipe</span>
                    </div>
                    <p className="text-[11px] text-[#5f5f69] leading-snug">
                      Peut également ajouter des membres et voir les métriques d'équipe.
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="w-full py-3 px-5 rounded-xl font-bold text-xs text-white shadow-lg shadow-[#592eff]/25 hover:shadow-[#592eff]/35 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
                >
                  {addLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Création en cours...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Ajouter le membre à l'espace</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

