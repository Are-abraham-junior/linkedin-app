import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { User } from "../../types";
import { ShieldCheck, Sparkles, Lock, Mail, ArrowRight, LogOut, CheckCircle2, Users } from "lucide-react";
import { LinkedInCheckpointForm } from "../common/LinkedInCheckpointForm";

const LinkedInIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.25c-.9 0-1.63.73-1.63 1.63s.73 1.63 1.63 1.63 1.63-.73 1.63-1.63-.73-1.63-1.63-1.63Z" />
  </svg>
);

interface LinkedInOnboardingWallProps {
  onDismiss?: () => void;
}

export const LinkedInOnboardingWall: React.FC<LinkedInOnboardingWallProps> = ({ onDismiss }) => {
  const { user, login, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [linkedinEmail, setLinkedinEmail] = useState("");
  const [linkedinPassword, setLinkedinPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkpointMsg, setCheckpointMsg] = useState<string | null>(null);
  // account_id Unipile en attente de code : le même compte est réutilisé, aucun doublon facturé
  const [checkpointAccountId, setCheckpointAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  /** Connexion réussie (directe ou après code 2FA) : session + félicitations + redirection */
  const handleConnected = async (res: { token: string; user: User }) => {
    login(res.token, res.user);
    await refreshUser();
    setCheckpointAccountId(null);
    setSuccess(true);
    setIsLoading(false);
    setTimeout(() => {
      onDismiss?.();
      navigate("/dashboard");
    }, 2000);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCheckpointMsg(null);
    setIsLoading(true);

    try {
      const res = await apiRequest<{ token: string; user: User; status?: string; message?: string; checkpoint?: any }>(
        "/auth/linkedin",
        {
          method: "POST",
          body: {
            linkedinEmail: linkedinEmail.trim(),
            linkedinPassword,
          },
        }
      );

      if (res.status === "CHECKPOINT") {
        setCheckpointMsg(res.message || null);
        setCheckpointAccountId(res.checkpoint?.account_id || res.checkpoint?.id || null);
        setIsLoading(false);
        return;
      }

      if (res.success && res.token && res.user) {
        await handleConnected(res as any);
        return;
      } else {
        setError((res as any).error || "Identifiants LinkedIn incorrects ou compte introuvable.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur de communication avec LinkedIn. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = user?.firstName || user?.name || user?.email?.split("@")[0] || "Chère prospectrice, cher prospecteur";

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0077b5]/10 text-[#0077b5] text-xs font-medium mb-3">
            <LinkedInIcon className="w-4 h-4" />
            Connexion LinkedIn
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
            Connectez votre compte LinkedIn
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-1">
            Espace actif : <span className="font-medium text-ink">{user?.organization?.name || "Bleadin"}</span>
          </p>
        </div>

        {/* Card Form */}
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 relative overflow-hidden border border-line/60 bg-white rounded-2xl">
          {onDismiss && !success && (
            <button
              type="button"
              onClick={onDismiss}
              className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center text-muted hover:text-muted rounded-full hover:bg-surface-2 transition-colors cursor-pointer font-medium"
              title="Fermer"
            >
              ✕
            </button>
          )}

          {success ? (
            <div className="py-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4 animate-pulse">
                <CheckCircle2 className="w-9 h-9 text-ok" />
              </div>
              <h2 className="text-xl font-semibold text-ink mb-1.5">
                Votre compte LinkedIn est connecté.
              </h2>
              <p className="text-muted text-xs sm:text-sm">
                Redirection vers votre tableau de bord...
              </p>
            </div>
          ) : (
          <>
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-surface-2 border border-line text-danger text-xs font-semibold flex items-start gap-2.5">
              <p className="flex-1">{error}</p>
            </div>
          )}

          {checkpointAccountId ? (
            <LinkedInCheckpointForm
              accountId={checkpointAccountId}
              solveEndpoint="/auth/linkedin/checkpoint"
              resendEndpoint="/auth/linkedin/checkpoint/resend"
              extraBody={{ linkedinEmail: linkedinEmail.trim() }}
              message={checkpointMsg}
              onSolved={(res) => handleConnected(res)}
              onNewCheckpoint={(cp) => setCheckpointAccountId(cp?.account_id || checkpointAccountId)}
              onCancel={() => {
                setCheckpointAccountId(null);
                setCheckpointMsg(null);
              }}
            />
          ) : (
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">
                Email LinkedIn
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={linkedinEmail}
                  onChange={(e) => setLinkedinEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-2 border border-line text-ink text-xs focus:outline-none focus:border-[#0077b5] focus:bg-white focus:ring-3 focus:ring-[#0077b5]/10 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">
                Mot de passe LinkedIn
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={linkedinPassword}
                  onChange={(e) => setLinkedinPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-2 border border-line text-ink text-xs focus:outline-none focus:border-[#0077b5] focus:bg-white focus:ring-3 focus:ring-[#0077b5]/10 transition-all font-medium"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-5 rounded-xl bg-[#0077b5] hover:bg-[#005f93] text-white font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Connexion en cours...</span>
                  </>
                ) : (
                  <>
                    <LinkedInIcon className="w-4 h-4" />
                    <span>Connecter et débloquer mon espace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
          )}

          {/* Footer Action: Logout / Switch account */}
          <div className="mt-6 pt-4 border-t border-line/50 flex items-center justify-between text-xs text-muted">
            <span>Connecté en tant que <strong>{user?.email}</strong></span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-danger hover:text-danger font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Changer de compte
            </button>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
};
