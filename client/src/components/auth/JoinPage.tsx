import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { User } from "../../types";
import {
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  Sparkles,
  Eye,
  EyeOff,
  XCircle,
} from "lucide-react";

const LinkedInLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

interface InvitationInfo {
  email: string;
  organizationName: string;
  invitedBy: string;
  invitedByAvatar?: string;
  expiresAt: string;
}

interface JoinPageProps {
  token: string;
  onJoined?: () => void;
}

/**
 * Page /join?token=… : l'invité crée son compte Bleadin (identifiants
 * applicatifs) et rejoint l'espace. La connexion LinkedIn se fait ensuite
 * dans l'application, via le bandeau « Connecter LinkedIn » du tableau de bord.
 */
export const JoinPage: React.FC<JoinPageProps> = ({ token, onJoined }) => {
  const { login } = useAuth();
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Charger les informations de l'invitation
  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await apiRequest<{ invitation: InvitationInfo }>(
          `/team/invitation-info/${token}`
        );
        if (res.success && res.invitation) {
          setInvitationInfo(res.invitation);
        } else {
          setInvitationError((res as any).error || "Invitation introuvable.");
        }
      } catch (err: any) {
        setInvitationError("Impossible de charger l'invitation.");
      } finally {
        setLoadingInfo(false);
      }
    };
    fetchInfo();
  }, [token]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAccountExists(false);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Veuillez renseigner votre prénom et nom.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiRequest<{ token: string; user: User; message?: string }>("/auth/join", {
        method: "POST",
        body: { token, firstName: firstName.trim(), lastName: lastName.trim(), password },
      });

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
        onJoined?.();
      } else {
        const message: string = (res as any).error || "Erreur lors de la création du compte.";
        setError(message);
        if (/existe déjà/i.test(message)) setAccountExists(true);
      }
    } catch (err: any) {
      setError(err.message || "Erreur inattendue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    "w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9fc] via-[#ffffff] to-[#f0edf9] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl">
        {/* Loading */}
        {loadingInfo && (
          <div className="adora-card bg-white rounded-3xl border border-[#e0e0db]/60 p-10 flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-[#592eff] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#5f5f69] text-xs font-medium">Chargement de l'invitation...</p>
          </div>
        )}

        {/* Invitation error */}
        {!loadingInfo && invitationError && (
          <div className="adora-card bg-white rounded-3xl border border-[#e0e0db]/60 p-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-4 text-red-500">
              <XCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-extrabold text-[#21164c] mb-2">Invitation invalide</h2>
            <p className="text-[#5f5f69] text-xs">{invitationError}</p>
            <Link to="/login" className="mt-5 text-xs font-bold text-[#592eff] hover:underline">
              Aller à la page de connexion →
            </Link>
          </div>
        )}

        {/* Join form */}
        {!loadingInfo && !invitationError && invitationInfo && (
          <>
            {/* En-tête */}
            <div className="text-center mb-6">
              <div className="relative inline-block mb-3">
                {invitationInfo.invitedByAvatar ? (
                  <img
                    src={invitationInfo.invitedByAvatar}
                    alt={invitationInfo.invitedBy}
                    className="w-16 h-16 rounded-2xl object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-white font-bold text-xl"
                    style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
                  >
                    {invitationInfo.invitedBy?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#592eff]/10 text-[#592eff] text-xs font-bold mb-3 tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                Invitation de {invitationInfo.invitedBy}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#21164c] tracking-tight">
                Rejoindre {invitationInfo.organizationName}
              </h1>
              <p className="text-[#5f5f69] text-xs sm:text-sm mt-1">
                Créez votre compte pour rejoindre l'équipe. Vous pourrez connecter votre LinkedIn ensuite.
              </p>
            </div>

            {/* Card Form */}
            <div className="adora-card p-6 sm:p-8 relative overflow-hidden shadow-2xl shadow-[#592eff]/5 border border-[#e0e0db]/60 bg-white rounded-3xl">
              {error && (
                <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2.5">
                  <span className="text-sm font-bold">⚠️</span>
                  <div className="flex-1">
                    <p>{error}</p>
                    {accountExists && (
                      <Link to="/login" className="inline-block mt-1.5 font-bold text-[#592eff] hover:underline">
                        Se connecter →
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleJoin} className="space-y-4">
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
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Jean"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                      Nom
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Dupont"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Email (verrouillé : c'est l'adresse invitée) */}
                <div>
                  <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={invitationInfo.email}
                      readOnly
                      className={`${inputClass} opacity-70 cursor-not-allowed`}
                    />
                  </div>
                  <p className="text-[11px] text-[#5f5f69] mt-1">
                    Adresse définie par l'invitation, elle servira d'identifiant de connexion.
                  </p>
                </div>

                {/* Mot de passe */}
                <div>
                  <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                    Mot de passe (8 caractères min.)
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
                      className={`${inputClass} pr-10`}
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

                {/* Submit */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-5 rounded-xl bg-[#592eff] hover:bg-[#4d25e6] text-white font-bold text-xs shadow-lg shadow-[#592eff]/25 hover:shadow-[#592eff]/35 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Création du compte...</span>
                      </>
                    ) : (
                      <>
                        <span>Créer mon compte et rejoindre l'équipe</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Note LinkedIn */}
              <div className="mt-5 pt-4 border-t border-[#e0e0db]/60 flex items-start gap-2.5 text-[11px] text-[#5f5f69]">
                <LinkedInLogo className="w-4 h-4 text-[#0A66C2] shrink-0 mt-0.5" />
                <p>
                  Aucun identifiant LinkedIn n'est demandé ici. Une fois dans l'espace, vous pourrez
                  connecter votre compte LinkedIn quand vous le souhaitez.
                </p>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-center text-[#5f5f69]">
              Cette invitation expire le {new Date(invitationInfo.expiresAt).toLocaleDateString("fr-FR")}.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
