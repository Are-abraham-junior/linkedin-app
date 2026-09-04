import React, { useState, useEffect } from "react";
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
    maxDailyInvites: 30,
    maxDailyMsg: 70,
  });

  const [editFormData, setEditFormData] = useState({
    name: "",
    role: "USER" as Role,
    status: "ACTIVE" as UserStatus,
    maxDailyInvites: 30,
    maxDailyMsg: 70,
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
          maxDailyInvites: 30,
          maxDailyMsg: 70,
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
        maxDailyInvites: editFormData.maxDailyInvites,
        maxDailyMsg: editFormData.maxDailyMsg,
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
      maxDailyInvites: user.maxDailyInvites,
      maxDailyMsg: user.maxDailyMsg,
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
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge-tag bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20">
              <Users className="w-3.5 h-3.5" /> Gestion des Accès & Quotas
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#21164c] tracking-tight">
            Utilisateurs & Profils
          </h1>
          <p className="text-sm text-[#5f5f69] mt-1">
            Contrôlez les accès (Super Admin / Utilisateur), statuts et quotas LinkedIn.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsCreateModalOpen(true);
          }}
          className="py-2.5 px-5 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 flex items-center gap-2 transition-all transform active:scale-95 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" /> Ajouter un Utilisateur
        </button>
      </div>

      {/* Filter Bar */}
      <div className="adora-card p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#e0e0db] bg-white text-xs text-[#353241] focus:outline-none focus:border-[#592eff]"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#e0e0db] bg-white text-xs text-[#353241] font-medium focus:outline-none focus:border-[#592eff]"
          >
            <option value="ALL">Tous les Rôles</option>
            <option value="SUPER_ADMIN">Super Admins</option>
            <option value="USER">Utilisateurs</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#e0e0db] bg-white text-xs text-[#353241] font-medium focus:outline-none focus:border-[#592eff]"
          >
            <option value="ALL">Tous les Statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="SUSPENDED">Suspendus</option>
          </select>

          <button
            onClick={fetchUsers}
            className="p-2 rounded-xl border border-[#e0e0db] bg-white hover:bg-[#f5f5f7] text-[#353241] text-xs transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="adora-card p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#e0e0db] text-[#5f5f69] uppercase font-bold tracking-wider">
                <th className="pb-3">Utilisateur</th>
                <th className="pb-3">Organisation</th>
                <th className="pb-3">Rôle</th>
                <th className="pb-3">Statut</th>
                <th className="pb-3">Quotas LinkedIn</th>
                <th className="pb-3">Campagnes</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0db]/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#5f5f69]">
                    Chargement des utilisateurs...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#5f5f69]">
                    Aucun utilisateur trouvé avec ces filtres.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#f8f9fc] transition-colors">
                    {/* User info */}
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            u.avatarUrl ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.email)}&background=592eff&color=fff`
                          }
                          alt={u.name || u.email}
                          className="w-9 h-9 rounded-full object-cover border border-[#e0e0db]"
                        />
                        <div>
                          <p className="font-bold text-[#21164c] text-sm">{u.name || "Sans nom"}</p>
                          <p className="text-[11px] text-[#5f5f69] flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {u.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Organization */}
                    <td className="py-3.5">
                      {u.organization ? (
                        <span className="font-semibold text-[#21164c] flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-[#592eff]" /> {u.organization.name}
                        </span>
                      ) : (
                        <span className="text-[#5f5f69] italic">Espace Individuel</span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="py-3.5">
                      <span
                        className={`badge-tag ${
                          u.role === "SUPER_ADMIN"
                            ? "bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/25 font-bold"
                            : "bg-[#f5f5f7] text-[#5f5f69] border border-[#e0e0db]"
                        }`}
                      >
                        {u.role === "SUPER_ADMIN" && <ShieldCheck className="w-3 h-3" />}
                        {u.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5">
                      {u.status === "ACTIVE" ? (
                        <span className="badge-tag bg-emerald-50 text-emerald-600 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Actif
                        </span>
                      ) : (
                        <span className="badge-tag bg-red-50 text-red-600 border border-red-200">
                          <Ban className="w-3 h-3" /> Suspendu
                        </span>
                      )}
                    </td>

                    {/* Quotas */}
                    <td className="py-3.5 font-medium text-[#353241]">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="bg-[#592eff]/10 text-[#592eff] px-1.5 py-0.5 rounded font-bold">
                          {u.maxDailyInvites} inv/j
                        </span>
                        <span>•</span>
                        <span className="bg-[#2ed6ff]/15 text-[#00819e] px-1.5 py-0.5 rounded font-bold">
                          {u.maxDailyMsg} msg/j
                        </span>
                      </div>
                    </td>

                    {/* Campaigns count */}
                    <td className="py-3.5">
                      <span className="font-bold text-[#21164c]">
                        {u.stats?.campaigns || 0} campagne(s)
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openDetailModal(u)}
                          className="p-1.5 rounded-lg border border-[#e0e0db] hover:bg-[#592eff]/10 hover:border-[#592eff]/30 text-[#353241] hover:text-[#592eff] transition-colors"
                          title="Voir Fiche Profil"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded-lg border border-[#e0e0db] hover:bg-[#592eff]/10 hover:border-[#592eff]/30 text-[#353241] hover:text-[#592eff] transition-colors"
                          title="Modifier Rôle & Quotas"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                        {u.role !== "SUPER_ADMIN" && (
                          <button
                            onClick={() => handleOpenDeleteUser(u.id, u.name)}
                            className="p-1.5 rounded-lg border border-[#e0e0db] hover:bg-red-50 hover:border-red-200 text-[#5f5f69] hover:text-red-600 transition-colors"
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
        <div className="fixed inset-0 bg-[#21164c]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="adora-card bg-white w-full max-w-lg p-6 sm:p-8 shadow-2xl relative">
            <h2 className="text-xl font-bold text-[#21164c] mb-1">Ajouter un utilisateur</h2>
            <p className="text-xs text-[#5f5f69] mb-5">Créez un compte utilisateur et attribuez-lui des quotas personnalisés.</p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Marc Koffi"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs focus:outline-none focus:border-[#592eff]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="marc@growth.ci"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs focus:outline-none focus:border-[#592eff]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs focus:outline-none focus:border-[#592eff]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                    Rôle
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
                  >
                    <option value="USER">USER (Utilisateur)</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Super Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                    Organisation
                  </label>
                  <select
                    value={formData.organizationId}
                    onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
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

              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]">
                <div>
                  <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                    Max Invits / Jour
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={formData.maxDailyInvites}
                    onChange={(e) =>
                      setFormData({ ...formData, maxDailyInvites: parseInt(e.target.value) || 30 })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                    Max Messages / Jour
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={200}
                    value={formData.maxDailyMsg}
                    onChange={(e) =>
                      setFormData({ ...formData, maxDailyMsg: parseInt(e.target.value) || 70 })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e0e0db]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#e0e0db] text-xs font-semibold text-[#5f5f69] hover:bg-[#f5f5f7]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 disabled:opacity-50"
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
        <div className="fixed inset-0 bg-[#21164c]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="adora-card bg-white w-full max-w-lg p-6 sm:p-8 shadow-2xl relative">
            <h2 className="text-xl font-bold text-[#21164c] mb-1">Modifier l'Utilisateur</h2>
            <p className="text-xs text-[#5f5f69] mb-5">
              Édition des privilèges et des limites pour <span className="font-bold">{selectedUser.email}</span>
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                  Nom
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs focus:outline-none focus:border-[#592eff]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                    Rôle
                  </label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as Role })}
                    className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
                  >
                    <option value="USER">USER</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                    Statut du compte
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, status: e.target.value as UserStatus })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
                  >
                    <option value="ACTIVE">ACTIF</option>
                    <option value="SUSPENDED">SUSPENDU</option>
                  </select>
                </div>
              </div>

              {/* Quotas */}
              <div className="p-3 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db] space-y-3">
                <p className="text-xs font-bold text-[#21164c] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#592eff]" /> Quotas Quotidiens LinkedIn
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-[#5f5f69] uppercase font-bold mb-1">
                      Invitations / jour
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={editFormData.maxDailyInvites}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          maxDailyInvites: parseInt(e.target.value) || 30,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#5f5f69] uppercase font-bold mb-1">
                      Messages / jour
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={200}
                      value={editFormData.maxDailyMsg}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          maxDailyMsg: parseInt(e.target.value) || 70,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                  Réinitialiser le mot de passe (Laisser vide pour ne pas changer)
                </label>
                <input
                  type="password"
                  placeholder="Nouveau mot de passe"
                  value={editFormData.newPassword}
                  onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs focus:outline-none focus:border-[#592eff]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e0e0db]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#e0e0db] text-xs font-semibold text-[#5f5f69] hover:bg-[#f5f5f7]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 disabled:opacity-50"
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
        <div className="fixed inset-0 bg-[#21164c]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="adora-card bg-white w-full max-w-lg p-6 sm:p-8 shadow-2xl relative">
            <div className="flex items-center gap-4 mb-6">
              <img
                src={
                  selectedUser.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name || selectedUser.email)}&background=592eff&color=fff`
                }
                alt={selectedUser.name || selectedUser.email}
                className="w-14 h-14 rounded-full object-cover border-2 border-[#592eff]"
              />
              <div>
                <h3 className="text-xl font-bold text-[#21164c]">{selectedUser.name || "Sans nom"}</h3>
                <p className="text-xs text-[#5f5f69]">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="badge-tag bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20 text-[10px]">
                    {selectedUser.role}
                  </span>
                  <span
                    className={`badge-tag text-[10px] ${
                      selectedUser.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : "bg-red-50 text-red-600 border border-red-200"
                    }`}
                  >
                    {selectedUser.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db] flex justify-between">
                <span className="text-[#5f5f69]">Organisation rattachée :</span>
                <span className="font-bold text-[#21164c]">
                  {selectedUser.organization?.name || "Espace Solo"}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db] flex justify-between">
                <span className="text-[#5f5f69]">Compte LinkedIn Unipile :</span>
                <span className="font-bold text-[#21164c]">
                  {selectedUser.linkedInAccount ? (
                    <span className="text-emerald-600 font-bold">
                      {selectedUser.linkedInAccount.accountName || "Connecté"}
                    </span>
                  ) : (
                    <span className="text-amber-600 font-medium">Non lié</span>
                  )}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db] flex justify-between">
                <span className="text-[#5f5f69]">Quotas autorisés :</span>
                <span className="font-bold text-[#592eff]">
                  {selectedUser.maxDailyInvites} inv/jour • {selectedUser.maxDailyMsg} msg/jour
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db] flex justify-between">
                <span className="text-[#5f5f69]">Campagnes actives :</span>
                <span className="font-bold text-[#21164c]">
                  {selectedUser.stats?.campaigns || 0}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#592eff] text-white text-xs font-bold shadow-md hover:bg-[#4d25e0]"
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
