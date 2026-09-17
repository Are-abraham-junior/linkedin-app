import React, { useState, useEffect } from "react";
import { initialsDataUrl } from "../ui/avatarFallback";
import { apiRequest } from "../../services/api";
import { User, Role, UserStatus, Organization } from "../../types";
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Shield,
  ShieldCheck,
  Building2,
  Lock,
  Edit2,
  Trash2,
  CheckCircle2,
  Ban,
  Mail,
  RefreshCw,
  Eye,
  Sliders,
  Send,
  Sparkles,
} from "lucide-react";
import { ConfirmModal } from "../common/ConfirmModal";

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Deletion Modal
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER" as Role,
    organizationId: "",
    maxWeeklyInvites: null as number | null,
    maxWeeklyMessages: null as number | null,
  });

  const [editFormData, setEditFormData] = useState({
    name: "",
    role: "USER" as Role,
    status: "ACTIVE" as UserStatus,
    maxWeeklyInvites: null as number | null,
    maxWeeklyMessages: null as number | null,
    newPassword: "",
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let query = `?search=${encodeURIComponent(searchTerm)}`;
      if (roleFilter !== "ALL") query += `&role=${roleFilter}`;
      if (statusFilter !== "ALL") query += `&status=${statusFilter}`;

      const res = await apiRequest<{ users: User[] }>(`/admin/users${query}`);
      if (res.success && res.users) {
        setUsers(res.users);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgs = async () => {
    try {
      const res = await apiRequest<{ organizations: Organization[] }>("/admin/organizations");
      if (res.success && res.organizations) {
        setOrganizations(res.organizations);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchOrgs();
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setActionLoading(true);

    try {
      const res = await apiRequest("/admin/users", {
        method: "POST",
        body: JSON.stringify(formData),
      });

      if (res.success) {
        setIsCreateModalOpen(false);
        setFormData({
          name: "",
          email: "",
          password: "",
          role: "USER",
          organizationId: "",
          maxWeeklyInvites: null as number | null,
          maxWeeklyMessages: null as number | null,
        });
        fetchUsers();
      } else {
        setFormError(res.error || "Erreur lors de la création.");
      }
    } catch (err: any) {
      setFormError(err.message || "Erreur réseau.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError(null);
    setActionLoading(true);

    try {
      const payload: any = {
        name: editFormData.name,
        role: editFormData.role,
        status: editFormData.status,
        maxWeeklyInvites: editFormData.maxWeeklyInvites,
        maxWeeklyMessages: editFormData.maxWeeklyMessages,
      };

      if (editFormData.newPassword) {
        payload.password = editFormData.newPassword;
      }

      const res = await apiRequest(`/admin/users/${selectedUser.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setIsEditModalOpen(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        setFormError(res.error || "Erreur lors de la mise à jour.");
      }
    } catch (err: any) {
      setFormError(err.message || "Erreur réseau.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDeleteUser = (id: string, name: string | null) => {
    setDeleteUserError(null);
    setUserToDelete({ id, name: name || "cet utilisateur" });
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    setDeleteUserError(null);

    try {
      const res = await apiRequest(`/admin/users/${userToDelete.id}`, { method: "DELETE" });
      if (res.success) {
        setUserToDelete(null);
        fetchUsers();
      } else {
        setDeleteUserError(res.error || "Impossible de supprimer cet utilisateur.");
      }
    } catch (err: any) {
      setDeleteUserError(err.message || "Une erreur inattendue s'est produite.");
    } finally {
      setIsDeletingUser(false);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      name: user.name || "",
      role: user.role,
      status: user.status,
      maxWeeklyInvites: user.maxWeeklyInvites ?? null,
      maxWeeklyMessages: user.maxWeeklyMessages ?? null,
      newPassword: "",
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const openDetailModal = (user: User) => {
    setSelectedUser(user);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl leading-tight">Utilisateurs</h1>
          <p className="mt-1 text-base text-muted">
            Contrôlez les accès (Super Admin / Utilisateur), statuts et quotas LinkedIn.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex h-9 items-center gap-2 self-start rounded-lg bg-accent px-3.5 text-base font-semibold text-white transition-colors hover:bg-accent-hover sm:self-auto"
        >
          <UserPlus className="h-4 w-4" strokeWidth={1.75} /> Ajouter un utilisateur
        </button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-line bg-white text-xs text-ink-2 focus:outline-none focus:border-ink"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-line bg-white text-xs text-ink-2 font-medium focus:outline-none focus:border-ink"
          >
            <option value="ALL">Tous les Rôles</option>
            <option value="SUPER_ADMIN">Super Admins</option>
            <option value="USER">Utilisateurs</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-line bg-white text-xs text-ink-2 font-medium focus:outline-none focus:border-ink"
          >
            <option value="ALL">Tous les Statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="SUSPENDED">Suspendus</option>
          </select>

          <button
            onClick={fetchUsers}
            className="p-2 rounded-xl border border-line bg-white hover:bg-surface-2 text-ink-2 text-xs transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-line bg-surface p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-muted font-medium">
                <th className="pb-3">Utilisateur</th>
                <th className="pb-3">Organisation</th>
                <th className="pb-3">Rôle</th>
                <th className="pb-3">Statut</th>
                <th className="pb-3">Quotas LinkedIn</th>
                <th className="pb-3">Campagnes</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    Chargement des utilisateurs...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    Aucun utilisateur trouvé avec ces filtres.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-2 transition-colors">
                    {/* User info */}
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            u.avatarUrl ||
                            initialsDataUrl(u.name || u.email)
                          }
                          alt={u.name || u.email}
                          className="w-9 h-9 rounded-full object-cover border border-line"
                        />
                        <div>
                          <p className="font-medium text-ink text-sm">{u.name || "Sans nom"}</p>
                          <p className="text-xs text-muted flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {u.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Organization */}
                    <td className="py-3.5">
                      {u.organization ? (
                        <span className="font-semibold text-ink flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-ink" /> {u.organization.name}
                        </span>
                      ) : (
                        <span className="text-muted italic">Espace Individuel</span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${
                          u.role === "SUPER_ADMIN"
                            ? "bg-surface-2 text-ink border border-ink font-medium"
                            : "bg-surface-2 text-muted border border-line"
                        }`}
                      >
                        {u.role === "SUPER_ADMIN" && <ShieldCheck className="w-3 h-3" />}
                        {u.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5">
                      {u.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium bg-surface-2 text-ok border border-line">
                          <CheckCircle2 className="w-3 h-3" /> Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium bg-surface-2 text-danger border border-line">
                          <Ban className="w-3 h-3" /> Suspendu
                        </span>
                      )}
                    </td>

                    {/* Quotas */}
                    <td className="py-3.5 font-medium text-ink-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="bg-surface-2 text-ink px-1.5 py-0.5 rounded font-medium">
                          {u.maxWeeklyInvites ?? "offre"} inv/sem
                        </span>
                        <span>•</span>
                        <span className="bg-[#2ed6ff]/15 text-[#00819e] px-1.5 py-0.5 rounded font-medium">
                          {u.maxWeeklyMessages ?? "offre"} msg/sem
                        </span>
                      </div>
                    </td>

                    {/* Campaigns count */}
                    <td className="py-3.5">
                      <span className="font-medium text-ink">
                        {u.stats?.campaigns || 0} campagne(s)
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openDetailModal(u)}
                          className="p-1.5 rounded-lg border border-line hover:bg-surface-2 hover:border-ink text-ink-2 hover:text-ink transition-colors"
                          title="Voir Fiche Profil"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded-lg border border-line hover:bg-surface-2 hover:border-ink text-ink-2 hover:text-ink transition-colors"
                          title="Modifier Rôle & Quotas"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                        {u.role !== "SUPER_ADMIN" && (
                          <button
                            onClick={() => handleOpenDeleteUser(u.id, u.name)}
                            className="p-1.5 rounded-lg border border-line hover:bg-surface-2 hover:border-line text-muted hover:text-danger transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl border border-line bg-surface bg-white w-full max-w-lg p-6 sm:p-8 relative">
            <h2 className="text-xl font-medium text-ink mb-1">Ajouter un utilisateur</h2>
            <p className="text-xs text-muted mb-5">Créez un compte utilisateur et attribuez-lui des quotas personnalisés.</p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-surface-2 border border-line text-danger text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Marc Koffi"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-line text-xs focus:outline-none focus:border-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="marc@growth.ci"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-line text-xs focus:outline-none focus:border-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-line text-xs focus:outline-none focus:border-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Rôle
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full px-3 py-2 rounded-xl border border-line text-xs bg-white focus:outline-none focus:border-ink"
                  >
                    <option value="USER">USER (Utilisateur)</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Super Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Organisation
                  </label>
                  <select
                    value={formData.organizationId}
                    onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-line text-xs bg-white focus:outline-none focus:border-ink"
                  >
                    <option value="">Aucune (Indépendant)</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-surface-2 border border-line">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Max invitations / semaine (vide = offre)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.maxWeeklyInvites ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, maxWeeklyInvites: e.target.value === "" ? null : parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-line text-xs bg-white focus:outline-none focus:border-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Max messages / semaine (vide = offre)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.maxWeeklyMessages ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, maxWeeklyMessages: e.target.value === "" ? null : parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-line text-xs bg-white focus:outline-none focus:border-ink"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-muted hover:bg-surface-2"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium disabled:opacity-50"
                >
                  {actionLoading ? "Création..." : "Créer l'utilisateur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER & QUOTAS MODAL */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl border border-line bg-surface bg-white w-full max-w-lg p-6 sm:p-8 relative">
            <h2 className="text-xl font-medium text-ink mb-1">Modifier l'Utilisateur</h2>
            <p className="text-xs text-muted mb-5">
              Édition des privilèges et des limites pour <span className="font-medium">{selectedUser.email}</span>
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-surface-2 border border-line text-danger text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Nom
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-line text-xs focus:outline-none focus:border-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Rôle
                  </label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as Role })}
                    className="w-full px-3 py-2 rounded-xl border border-line text-xs bg-white focus:outline-none focus:border-ink"
                  >
                    <option value="USER">USER</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Statut du compte
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, status: e.target.value as UserStatus })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-line text-xs bg-white focus:outline-none focus:border-ink"
                  >
                    <option value="ACTIVE">ACTIF</option>
                    <option value="SUSPENDED">SUSPENDU</option>
                  </select>
                </div>
              </div>

              {/* Quotas */}
              <div className="p-3 rounded-2xl bg-surface-2 border border-line space-y-3">
                <p className="text-xs font-medium text-ink flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-ink" /> Plafonds hebdomadaires LinkedIn
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted font-medium mb-1">
                      Invitations / semaine (vide = offre)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editFormData.maxWeeklyInvites ?? ""}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, maxWeeklyInvites: e.target.value === "" ? null : parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-line text-xs bg-white focus:outline-none focus:border-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted font-medium mb-1">
                      Messages / semaine (vide = offre)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editFormData.maxWeeklyMessages ?? ""}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, maxWeeklyMessages: e.target.value === "" ? null : parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-line text-xs bg-white focus:outline-none focus:border-ink"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Réinitialiser le mot de passe (Laisser vide pour ne pas changer)
                </label>
                <input
                  type="password"
                  placeholder="Nouveau mot de passe"
                  value={editFormData.newPassword}
                  onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-line text-xs focus:outline-none focus:border-ink"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-muted hover:bg-surface-2"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium disabled:opacity-50"
                >
                  {actionLoading ? "Enregistrement..." : "Enregistrer les modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER DETAIL MODAL */}
      {isDetailModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl border border-line bg-surface bg-white w-full max-w-lg p-6 sm:p-8 relative">
            <div className="flex items-center gap-4 mb-6">
              <img
                src={
                  selectedUser.avatarUrl ||
                  initialsDataUrl(selectedUser.name || selectedUser.email)
                }
                alt={selectedUser.name || selectedUser.email}
                className="w-14 h-14 rounded-full object-cover border border-ink"
              />
              <div>
                <h3 className="text-xl font-medium text-ink">{selectedUser.name || "Sans nom"}</h3>
                <p className="text-xs text-muted">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium bg-surface-2 text-ink border border-ink text-xs">
                    {selectedUser.role}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-xs ${
                      selectedUser.status === "ACTIVE"
                        ? "bg-surface-2 text-ok border border-line"
                        : "bg-surface-2 text-danger border border-line"
                    }`}
                  >
                    {selectedUser.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-surface-2 border border-line flex justify-between">
                <span className="text-muted">Organisation rattachée :</span>
                <span className="font-medium text-ink">
                  {selectedUser.organization?.name || "Espace Solo"}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-2 border border-line flex justify-between">
                <span className="text-muted">Compte LinkedIn Associé :</span>
                <span className="font-medium text-ink">
                  {selectedUser.linkedInAccount ? (
                    <span className="text-ok font-medium">
                      {selectedUser.linkedInAccount.accountName || "Connecté"}
                    </span>
                  ) : (
                    <span className="text-warn font-medium">Non lié</span>
                  )}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-2 border border-line flex justify-between">
                <span className="text-muted">Quotas autorisés :</span>
                <span className="font-medium text-ink">
                  {selectedUser.maxWeeklyInvites ?? "offre"} inv/sem • {selectedUser.maxWeeklyMessages ?? "offre"} msg/sem
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-2 border border-line flex justify-between">
                <span className="text-muted">Campagnes actives :</span>
                <span className="font-medium text-ink">
                  {selectedUser.stats?.campaigns || 0}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-medium hover:bg-accent-hover"
              >
                Fermer la fiche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for User Deletion */}
      <ConfirmModal
        isOpen={Boolean(userToDelete)}
        onClose={() => {
          if (!isDeletingUser) {
            setUserToDelete(null);
            setDeleteUserError(null);
          }
        }}
        onConfirm={handleConfirmDeleteUser}
        title="Supprimer l'utilisateur"
        description="Cette action révoquera immédiatement les accès de cet utilisateur à la plateforme."
        itemName={userToDelete?.name}
        itemType="Utilisateur"
        variant="danger"
        confirmText="Supprimer définitivement"
        cancelText="Conserver le compte"
        isLoading={isDeletingUser}
        warningMessage={
          deleteUserError ||
          "Cette action est irréversible. Les campagnes et configurations associées à ce compte seront affectées."
        }
      />
    </div>
  );
};
