import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { User } from "../../types";
import { ShieldCheck, Sparkles, Lock, Mail, ArrowRight, LogOut, CheckCircle2, Clock, Users } from "lucide-react";

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
  const [linkedinEmail, setLinkedinEmail] = useState("");
  const [linkedinPassword, setLinkedinPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkpointMsg, setCheckpointMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCheckpointMsg(null);
    setIsLoading(true);

    try {
      const res = await apiRequest<{ token: string; user: User; status?: string; message?: string }>(
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
        setCheckpointMsg(
          res.message || "LinkedIn demande une vérification (2FA ou notification mobile). Validez sur votre application LinkedIn puis réessayez ici."
        );
        setIsLoading(false);
        return;
      }

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
        await refreshUser();
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
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9fc] via-[#ffffff] to-[#f0edf9] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0077b5]/10 text-[#0077b5] text-xs font-bold mb-3 tracking-wide">
            <LinkedInIcon className="w-4 h-4" />
            Connexion LinkedIn
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#21164c] tracking-tight">
            Connectez votre compte LinkedIn
          </h1>
          <p className="text-[#5f5f69] text-xs sm:text-sm mt-1">
            Espace actif : <span className="font-bold text-[#21164c]">{user?.organization?.name || "Bime Link"}</span>
          </p>
        </div>

        {/* Card Form */}
        <div className="adora-card p-6 sm:p-8 relative overflow-hidden shadow-2xl shadow-[#0077b5]/10 border border-[#e0e0db]/60 bg-white rounded-3xl">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer font-bold"
              title="Fermer"
            >
              ✕
            </button>
          )}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2.5">
              <span className="text-sm font-bold">⚠️</span>
              <p className="flex-1">{error}</p>
            </div>
          )}

          {checkpointMsg && (
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">Code de sécurité requis</p>
                <p className="text-[11px] text-amber-800 mt-0.5">{checkpointMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                Email LinkedIn
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={linkedinEmail}
                  onChange={(e) => setLinkedinEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#0077b5] focus:bg-white focus:ring-3 focus:ring-[#0077b5]/10 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                Mot de passe LinkedIn
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={linkedinPassword}
                  onChange={(e) => setLinkedinPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#0077b5] focus:bg-white focus:ring-3 focus:ring-[#0077b5]/10 transition-all font-medium"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-5 rounded-xl bg-[#0077b5] hover:bg-[#005f93] text-white font-bold text-xs shadow-lg shadow-[#0077b5]/25 hover:shadow-[#0077b5]/35 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

          {/* Footer Action: Logout / Switch account */}
          <div className="mt-6 pt-4 border-t border-[#e0e0db]/50 flex items-center justify-between text-xs text-[#5f5f69]">
            <span>Connecté en tant que <strong>{user?.email}</strong></span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Changer de compte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
