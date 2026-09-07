import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import {
  X,
  Lock,
  Mail,
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LinkedInReconnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCheckpoint?: boolean;
  checkpointAccountId?: string;
}

export const LinkedInReconnectModal: React.FC<LinkedInReconnectModalProps> = ({
  isOpen,
  onClose,
  initialCheckpoint = false,
  checkpointAccountId = "",
}) => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState((user as any)?.linkedinEmail || user?.email || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Checkpoint 2FA
  const [isCheckpoint, setIsCheckpoint] = useState(initialCheckpoint);
  const [activeAccountId, setActiveAccountId] = useState(checkpointAccountId);
  const [code, setCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);

  if (!isOpen) return null;

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password) {
      setError("Veuillez renseigner votre email et mot de passe LinkedIn.");
      return;
    }

    setLoading(true);

    try {
      const res = await apiRequest<{
        success: boolean;
        status?: string;
        checkpoint?: any;
        message?: string;
        error?: string;
      }>("/settings/linkedin/reconnect", {
        method: "POST",
        body: {
          linkedinEmail: email.trim(),
          linkedinPassword: password,
        },
      });

      if (res.status === "CHECKPOINT") {
        setIsCheckpoint(true);
        setActiveAccountId(res.checkpoint?.account_id || res.checkpoint?.id || "");
        setSuccess("Code de sécurité requis : veuillez saisir le code envoyé par LinkedIn.");
        return;
      }

      if (res.success) {
        setSuccess(res.message || "Session LinkedIn reconnectée avec succès !");
        setPassword("");
        await refreshUser();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(res.error || "Identifiants LinkedIn invalides. Veuillez vérifier votre mot de passe.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur de connexion avec le service LinkedIn.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckpointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Veuillez entrer le code de sécurité reçu.");
      return;
    }

    setVerifyingCode(true);
    setError(null);

    try {
      const res = await apiRequest<{
        success: boolean;
        message?: string;
        error?: string;
      }>("/settings/linkedin/checkpoint", {
        method: "POST",
        body: {
          accountId: activeAccountId,
          code: code.trim(),
        },
      });

      if (res.success) {
        setSuccess(res.message || "Compte vérifié et activé avec succès !");
        setCode("");
        setPassword("");
        await refreshUser();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(res.error || "Code de vérification invalide ou expiré.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de la validation du code.");
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleGoToSettings = () => {
    onClose();
    navigate("/settings?tab=linkedin");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl sm:rounded-[32px] shadow-2xl border border-[#592eff]/15 overflow-hidden transform transition-all animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Adora */}
        <div className="relative px-6 sm:px-8 pt-7 pb-5 border-b border-gray-100 bg-gradient-to-b from-[#592eff]/5 to-transparent">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 w-9 h-9 rounded-full bg-gray-100/80 hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fermer la boîte de dialogue"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#592eff] to-[#7c3aed] text-white flex items-center justify-center shadow-md shadow-[#592eff]/30">
              {isCheckpoint ? (
                <KeyRound className="w-6 h-6" />
              ) : (
                <Lock className="w-6 h-6" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-black text-[#21164c] tracking-tight">
                {isCheckpoint
                  ? "Vérification de sécurité LinkedIn"
                  : "Renouveler votre session LinkedIn"}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {isCheckpoint
                  ? "Saisissez le code de validation 2FA envoyé par LinkedIn"
                  : "Connexion sécurisée en direct pour réactiver vos campagnes"}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-5">
          {/* Notifications Alert */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-3 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-3 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <p className="font-medium leading-relaxed">{success}</p>
            </div>
          )}

          {!isCheckpoint ? (
            /* Étape 1 : Saisie des identifiants */
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#21164c] mb-1.5">
                  Adresse email du compte LinkedIn
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-[#21164c] placeholder:text-gray-400 focus:outline-none focus:border-[#592eff] focus:ring-2 focus:ring-[#592eff]/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#21164c] mb-1.5">
                  Mot de passe du compte LinkedIn
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-[#21164c] placeholder:text-gray-400 focus:outline-none focus:border-[#592eff] focus:ring-2 focus:ring-[#592eff]/10 transition-all font-medium"
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  Vos identifiants ne sont jamais stockés en clair et servent uniquement à régénérer votre session LinkedIn.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleGoToSettings}
                  className="text-xs text-gray-500 hover:text-[#592eff] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Options avancées</span>
                  <ExternalLink className="w-3 h-3" />
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#592eff] to-[#7c3aed] hover:from-[#4a22e0] hover:to-[#6d28d9] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-[#592eff]/25 hover:shadow-[#592eff]/40 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer ml-auto"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connexion en cours...</span>
                    </>
                  ) : (
                    <>
                      <span>Reconnecter mon compte</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Étape 2 : Saisie du code 2FA / Checkpoint */
            <form onSubmit={handleCheckpointSubmit} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#592eff]/5 border border-[#592eff]/15 text-xs text-[#21164c] flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-[#592eff] shrink-0" />
                <p className="leading-tight">
                  LinkedIn vous a transmis un code de vérification à 6 chiffres par SMS, email ou sur votre application mobile.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#21164c] mb-1.5">
                  Code de sécurité à 6 chiffres
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={8}
                    value={code}
                    onChange={(e) => setCode(e.target.value.trim())}
                    placeholder="Ex: 123456"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-center tracking-widest text-[#21164c] placeholder:text-gray-300 focus:outline-none focus:border-[#592eff] focus:ring-2 focus:ring-[#592eff]/10 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsCheckpoint(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 font-bold transition-colors cursor-pointer"
                >
                  Retour
                </button>

                <button
                  type="submit"
                  disabled={verifyingCode || !code.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#592eff] to-[#7c3aed] hover:from-[#4a22e0] hover:to-[#6d28d9] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-[#592eff]/25 hover:shadow-[#592eff]/40 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer ml-auto"
                >
                  {verifyingCode ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validation...</span>
                    </>
                  ) : (
                    <>
                      <span>Valider le code</span>
                      <ShieldCheck className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
