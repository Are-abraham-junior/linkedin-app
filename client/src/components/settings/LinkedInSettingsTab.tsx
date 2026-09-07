import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  Mail,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Sparkles,
  ArrowRight,
  KeyRound,
  ExternalLink,
  Loader2,
} from "lucide-react";

const LinkedInIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.25c-.9 0-1.63.73-1.63 1.63s.73 1.63 1.63 1.63 1.63-.73 1.63-1.63-.73-1.63-1.63-1.63Z" />
  </svg>
);

export const LinkedInSettingsTab: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [accountData, setAccountData] = useState<any>(null);
  const [status, setStatus] = useState<string>("DISCONNECTED");

  // Reconnection form state
  const [email, setEmail] = useState(user?.linkedinEmail || "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Checkpoint 2FA verification state
  const [checkpointPending, setCheckpointPending] = useState(false);
  const [checkpointAccountId, setCheckpointAccountId] = useState<string>("");
  const [checkpointCode, setCheckpointCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);

  const fetchLinkedInStatus = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        connected: boolean;
        status: string;
        account: any;
      }>("/settings/linkedin");

      if (res.success) {
        setStatus(res.status || "DISCONNECTED");
        setAccountData(res.account);
        if (res.account?.accountName) {
          setEmail(user?.linkedinEmail || "");
        }
      }
    } catch (err: any) {
      console.warn("Notice checking LinkedIn health:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinkedInStatus();
  }, []);

function formatCleanError(err?: string): string {
  if (!err) return "Identifiants LinkedIn incorrects ou session expirée.";
  if (err.includes("502") || err.includes("Bad Gateway") || err.includes("Unexpected token '<'") || err.includes("<html")) {
    return "Le serveur de synchronisation LinkedIn est temporairement en cours d'initialisation ou indisponible (Code 502). Veuillez patienter quelques instants puis réessayer.";
  }
  if (err.includes("503") || err.includes("Service Unavailable")) {
    return "Le service LinkedIn est momentanément indisponible (503). Veuillez réessayer dans quelques instants.";
  }
  if (err.includes("504") || err.includes("Gateway Timeout")) {
    return "Le délai d'attente de la passerelle LinkedIn a expiré (504). Veuillez réessayer.";
  }
  return err;
}

  const handleReconnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setCheckpointPending(false);

    if (!email || !password) {
      setMessage({ type: "error", text: "Veuillez renseigner votre email et mot de passe LinkedIn." });
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiRequest<{
        success: boolean;
        status?: string;
        checkpoint?: any;
        account?: any;
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
        setCheckpointPending(true);
        setCheckpointAccountId(res.checkpoint?.account_id || res.checkpoint?.id || "");
        setMessage({
          type: "success",
          text: "Vérification de sécurité requise : veuillez entrer le code à 6 chiffres envoyé par LinkedIn.",
        });
        return;
      }

      if (res.success) {
        setMessage({ type: "success", text: res.message || "Compte LinkedIn reconnecté avec succès !" });
        setPassword("");
        await fetchLinkedInStatus();
        await refreshUser();
      } else {
        setMessage({ type: "error", text: formatCleanError(res.error) });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: formatCleanError(err.message) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkpointCode.trim()) {
      setMessage({ type: "error", text: "Veuillez entrer le code de sécurité reçu." });
      return;
    }

    setVerifyingCode(true);
    setMessage(null);

    try {
      const res = await apiRequest<{ success: boolean; message?: string; error?: string }>(
        "/settings/linkedin/checkpoint",
        {
          method: "POST",
          body: {
            accountId: checkpointAccountId,
            code: checkpointCode.trim(),
          },
        }
      );

      if (res.success) {
        setMessage({ type: "success", text: res.message || "Compte vérifié et activé avec succès !" });
        setCheckpointPending(false);
        setCheckpointCode("");
        setPassword("");
        await fetchLinkedInStatus();
        await refreshUser();
      } else {
        setMessage({ type: "error", text: formatCleanError(res.error) });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: formatCleanError(err.message) });
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir déconnecter ce compte LinkedIn ? Vos campagnes seront mises en pause.")) {
      return;
    }

    try {
      const res = await apiRequest<{ success: boolean; message?: string; error?: string }>(
        "/settings/linkedin/disconnect",
        { method: "POST" }
      );

      if (res.success) {
        setMessage({ type: "success", text: "Compte LinkedIn déconnecté." });
        await fetchLinkedInStatus();
        await refreshUser();
      } else {
        setMessage({ type: "error", text: formatCleanError(res.error) });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: formatCleanError(err.message) });
    }
  };

  const isConnected = status === "CONNECTED";
  const isCheckpoint = status === "CHECKPOINT";
  const isGatewayUnavailable = status === "GATEWAY_UNAVAILABLE";

  return (
    <div className="space-y-8 max-w-4xl">
      {message && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold animate-in fade-in ${
            message.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Carte Statut & Santé du compte */}
      <div className="adora-card p-6 sm:p-7 bg-white rounded-3xl border border-[#e0e0db]/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#f0f0f4] pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0077b5]/10 flex items-center justify-center text-[#0077b5]">
              <LinkedInIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#21164c]">Compte LinkedIn Lié</h3>
              <p className="text-xs text-[#5f5f69]">Surveillance et synchronisation en continu</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLinkedInStatus}
              disabled={loading}
              className="p-2 rounded-xl text-[#5f5f69] hover:text-[#592eff] hover:bg-[#f0edf9] transition-colors cursor-pointer"
              title="Rafraîchir l'état de connexion"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#592eff]" : ""}`} />
            </button>

            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Session Active & Connectée
              </span>
            ) : isCheckpoint ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                Vérification 2FA Requise
              </span>
            ) : isGatewayUnavailable ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Passerelle en synchronisation (502)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Déconnecté / Session Expirée
              </span>
            )}
          </div>
        </div>

        {/* Détails du compte actif */}
        {accountData && isConnected ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-4 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]/60">
            <div className="flex items-center gap-4">
              <img
                src={
                  accountData.profilePicture ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    accountData.accountName || "LinkedIn User"
                  )}&background=0077b5&color=fff`
                }
                alt="LinkedIn"
                className="w-14 h-14 rounded-full object-cover border-2 border-[#0077b5]/30 shadow-sm"
              />
              <div>
                <h4 className="text-sm font-extrabold text-[#21164c]">
                  {accountData.accountName || "Compte LinkedIn"}
                </h4>
                <p className="text-xs text-[#5f5f69] line-clamp-1 max-w-md">
                  {accountData.headline || "Profil synchronisé avec succès"}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#7c7c88]">
                  <span>Invitations aujourd'hui : <strong>{accountData.dailyInvitesSent || 0}</strong></span>
                  <span>•</span>
                  <span>Messages aujourd'hui : <strong>{accountData.dailyMsgSent || 0}</strong></span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDisconnect}
              className="px-4 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnecter ce compte</span>
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Attention : Prospection interrompue</p>
              <p className="text-[#665324] mt-0.5 leading-relaxed">
                Votre session LinkedIn n'est pas active. Utilisez le formulaire ci-dessous pour reconnecter votre compte directement sans changer d'application.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Formulaire de Reconnexion Directe (Intégré dans Bime Link) */}
      <div className="adora-card p-6 sm:p-7 bg-white rounded-3xl border border-[#e0e0db]/80 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-[#f0f0f4] pb-4">
          <div className="w-9 h-9 rounded-2xl bg-[#592eff]/10 flex items-center justify-center text-[#592eff]">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#21164c]">
              {isConnected ? "Mettre à jour ou Reconnecter la session" : "Reconnexion Directe LinkedIn"}
            </h3>
            <p className="text-xs text-[#5f5f69]">
              Connexion sécurisée en direct — Vos identifiants servent exclusivement à renouveler votre jeton LinkedIn
            </p>
          </div>
        </div>

        {checkpointPending ? (
          /* Étape 2FA / Code de validation */
          <form onSubmit={handleVerifyCheckpoint} className="space-y-4 p-5 rounded-2xl bg-[#f0edf9] border border-[#592eff]/20">
            <div className="flex items-center gap-2 text-xs font-bold text-[#592eff]">
              <Sparkles className="w-4 h-4" />
              <span>LinkedIn exige une confirmation de sécurité</span>
            </div>
            <p className="text-xs text-[#353241]">
              Un code de validation temporaire (SMS ou notification d'application mobile) a été envoyé par LinkedIn. Entrez-le ci-dessous :
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={checkpointCode}
                onChange={(e) => setCheckpointCode(e.target.value)}
                placeholder="Ex: 849201"
                className="w-48 px-3.5 py-2.5 bg-white border border-[#e0e0db] rounded-xl text-center text-base font-mono font-bold tracking-widest text-[#21164c] focus:outline-none focus:border-[#592eff]"
                autoFocus
              />
              <button
                type="submit"
                disabled={verifyingCode}
                className="px-5 py-2.5 bg-[#592eff] hover:bg-[#4922db] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {verifyingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>Valider le code</span>
              </button>
            </div>
          </form>
        ) : (
          /* Formulaire Email + Mot de passe */
          <form onSubmit={handleReconnect} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#21164c] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#592eff]" />
                  Adresse email LinkedIn
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-xs text-[#21164c] focus:outline-none focus:border-[#592eff] focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#21164c] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#592eff]" />
                  Mot de passe du compte LinkedIn
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-xs text-[#21164c] focus:outline-none focus:border-[#592eff] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-[11px] text-[#7c7c88]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Chiffrement SSL 256 bits • Détection automatique des doublons de session</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#0077b5] hover:bg-[#005f93] text-white font-bold text-xs rounded-xl shadow-md shadow-[#0077b5]/20 hover:shadow-[#0077b5]/35 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Reconnexion en cours...</span>
                  </>
                ) : (
                  <>
                    <LinkedInIcon className="w-4 h-4" />
                    <span>{isConnected ? "Renouveler la connexion LinkedIn" : "Connecter mon compte LinkedIn"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
