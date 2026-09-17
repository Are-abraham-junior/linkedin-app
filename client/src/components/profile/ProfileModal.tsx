import React, { useState } from "react";
import { initialsDataUrl } from "../ui/avatarFallback";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { User, Lock, Shield, X, Check, ArrowRight } from "lucide-react";
import { WorkspaceAvatar } from "../common/WorkspaceAvatar";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (newPassword && newPassword !== confirmPassword) {
      setMsg({ type: "error", text: "Les nouveaux mots de passe ne correspondent pas." });
      return;
    }

    setLoading(true);

    try {
      const payload: any = { name };
      if (avatarUrl) payload.avatarUrl = avatarUrl;
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await apiRequest("/user/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res.success && res.profile) {
        updateUser(res.profile);
        setMsg({ type: "success", text: "Profil mis à jour avec succès !" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMsg({ type: "error", text: res.error || "Erreur lors de la mise à jour." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Erreur réseau." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
      <div className="rounded-2xl border border-line bg-surface bg-white w-full max-w-lg p-6 sm:p-8 relative">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full hover:bg-surface-2 text-muted"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-xl font-medium text-ink mb-1">Mon Profil & Sécurité</h2>
        <p className="text-xs text-muted mb-5">Gérez vos informations personnelles et identifiants.</p>

        {msg && (
          <div
            className={`mb-4 p-3 rounded-xl text-xs font-semibold ${
              msg.type === "success"
                ? "bg-surface-2 text-ok border border-line"
                : "bg-surface-2 text-danger border border-line"
            }`}
          >
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4 mb-2">
            <img
              src={
                avatarUrl ||
                user.avatarUrl ||
                initialsDataUrl(user.name || user.email)
              }
              alt="Avatar"
              className="w-14 h-14 rounded-full object-cover border border-ink"
            />
            <div>
              <p className="text-xs font-medium text-ink">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium bg-surface-2 text-ink border border-ink text-xs">
                  {user.role}
                </span>
                {user.organization && (
                  <span className="text-xs text-muted flex items-center gap-1 font-medium">
                    <WorkspaceAvatar name={user.organization.name} avatarUrl={user.organization.avatarUrl} className="w-4 h-4 rounded-md" textClassName="text-xs" /> {user.organization.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink mb-1">
              Nom complet
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-line text-xs focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink mb-1">
              URL de la photo de profil
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-line text-xs focus:outline-none focus:border-ink"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-2 border border-line space-y-2.5">
            <p className="text-xs font-medium text-ink flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-ink" /> Changer de mot de passe
            </p>
            <input
              type="password"
              placeholder="Mot de passe actuel"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-line text-xs bg-white focus:outline-none focus:border-ink"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="password"
                placeholder="Nouveau mot de passe"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-line text-xs bg-white focus:outline-none focus:border-ink"
              />
              <input
                type="password"
                placeholder="Confirmer nouveau"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-line text-xs bg-white focus:outline-none focus:border-ink"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-muted hover:bg-surface-2"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium disabled:opacity-50"
            >
              {loading ? "Enregistrement..." : "Mettre à jour"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
