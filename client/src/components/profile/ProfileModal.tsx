import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { User, Lock, Building2, Shield, X, Check, ArrowRight } from "lucide-react";

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
    <div className="fixed inset-0 bg-[#21164c]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="adora-card bg-white w-full max-w-lg p-6 sm:p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full hover:bg-[#f5f5f7] text-[#5f5f69]"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-xl font-bold text-[#21164c] mb-1">Mon Profil & Sécurité</h2>
        <p className="text-xs text-[#5f5f69] mb-5">Gérez vos informations personnelles et identifiants.</p>

        {msg && (
          <div
            className={`mb-4 p-3 rounded-xl text-xs font-semibold ${
              msg.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
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
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email)}&background=592eff&color=fff`
              }
              alt="Avatar"
              className="w-14 h-14 rounded-full object-cover border-2 border-[#592eff]"
            />
            <div>
              <p className="text-xs font-bold text-[#21164c]">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="badge-tag bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20 text-[10px]">
                  {user.role}
                </span>
                {user.organization && (
                  <span className="text-xs text-[#5f5f69] flex items-center gap-1 font-medium">
                    <Building2 className="w-3 h-3 text-[#592eff]" /> {user.organization.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
              Nom complet
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs focus:outline-none focus:border-[#592eff]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
              URL de la photo de profil
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] text-xs focus:outline-none focus:border-[#592eff]"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db] space-y-2.5">
            <p className="text-xs font-bold text-[#21164c] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#592eff]" /> Changer de mot de passe
            </p>
            <input
              type="password"
              placeholder="Mot de passe actuel"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="password"
                placeholder="Nouveau mot de passe"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
              />
              <input
                type="password"
                placeholder="Confirmer nouveau"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-[#e0e0db] text-xs bg-white focus:outline-none focus:border-[#592eff]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#e0e0db] text-xs font-semibold text-[#5f5f69] hover:bg-[#f5f5f7]"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 disabled:opacity-50"
            >
              {loading ? "Enregistrement..." : "Mettre à jour"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
