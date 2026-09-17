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

  const [resending, setResending] = useState(false);
  /** Renvoie un nouveau code sur le MÊME account_id (pas de nouvelle authentification = pas de doublon Unipile) */
  const handleResendCode = async () => {
    setResending(true);
    setError(null);
    const res = await apiRequest("/settings/linkedin/checkpoint/resend", {
      method: "POST",
      body: { accountId: activeAccountId },
    });
    if (res.success) setSuccess("Un nouveau code vient d'être envoyé.");
    else setError(res.error || "Impossible de renvoyer le code.");
    setResending(false);
  };

  const handleGoToSettings = () => {
    onClose();
    navigate("/settings?tab=linkedin");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-[32px] border border-ink overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Adora */}
        <div className="relative px-6 sm:px-8 pt-7 pb-5 border-b border-line bg-ink">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 w-9 h-9 rounded-full bg-surface-2 hover:bg-line text-muted hover:text-muted flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fermer la boîte de dialogue"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-ink text-white flex items-center justify-center">
              {isCheckpoint ? (
                <KeyRound className="w-6 h-6" />
              ) : (
                <Lock className="w-6 h-6" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink tracking-tight">
                {isCheckpoint
                  ? "Vérification de sécurité LinkedIn"
                  : "Renouveler votre session LinkedIn"}
              </h2>
              <p className="text-xs text-muted font-medium">
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
            <div className="p-4 rounded-2xl bg-surface-2 border border-line text-danger text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-2xl bg-surface-2 border border-line text-ok text-xs flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-ok" />
              <p className="font-medium leading-relaxed">{success}</p>
            </div>
          )}

          {!isCheckpoint ? (
            /* Étape 1 : Saisie des identifiants */
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1.5">
                  Adresse email du compte LinkedIn
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line text-xs text-ink placeholder:text-muted focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1.5">
                  Mot de passe du compte LinkedIn
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line text-xs text-ink placeholder:text-muted focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/10 transition-all font-medium"
                  />
                </div>
                <p className="mt-1 text-xs text-muted">
                  Vos identifiants ne sont jamais stockés en clair et servent uniquement à régénérer votre session LinkedIn.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleGoToSettings}
                  className="text-xs text-muted hover:text-ink font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Options avancées</span>
                  <ExternalLink className="w-3 h-3" />
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-ink hover:from-[#4a22e0] hover:to-[#6d28d9] disabled:opacity-50 text-white font-medium text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer ml-auto"
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
              <div className="p-3.5 rounded-2xl bg-surface-2 border border-ink text-xs text-ink flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-ink shrink-0" />
                <p className="leading-tight">
                  LinkedIn vous a transmis un code de vérification à 6 chiffres par SMS, email ou sur votre application mobile.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1.5">
                  Code de sécurité à 6 chiffres
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={8}
                    value={code}
                    onChange={(e) => setCode(e.target.value.trim())}
                    placeholder="Ex: 123456"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line text-sm font-medium text-center text-ink placeholder:text-gray-300 focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/10 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setIsCheckpoint(false)}
                    className="text-xs text-muted hover:text-muted font-medium transition-colors cursor-pointer"
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resending || verifyingCode}
                    className="text-xs text-ink hover:underline font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {resending ? "Envoi…" : "Renvoyer le code"}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={verifyingCode || !code.trim()}
                  className="px-6 py-2.5 bg-ink hover:from-[#4a22e0] hover:to-[#6d28d9] disabled:opacity-50 text-white font-medium text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer ml-auto"
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
