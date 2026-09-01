import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { User } from "../../types";

type LoginStep = "welcome" | "linkedin-login" | "admin-login";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [step, setStep] = useState<LoginStep>("welcome");
  const [linkedinEmail, setLinkedinEmail] = useState("");
  const [linkedinPassword, setLinkedinPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkpointMsg, setCheckpointMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLinkedInAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCheckpointMsg(null);
    setIsLoading(true);

    try {
      const res = await apiRequest<{ token: string; user: User; status?: string; message?: string }>(
        "/auth/linkedin",
        {
          method: "POST",
          body: { linkedinEmail: linkedinEmail.trim(), linkedinPassword },
        }
      );

      if (res.status === "CHECKPOINT") {
        setCheckpointMsg(res.message || "LinkedIn demande une vérification. Validez sur LinkedIn puis réessayez.");
        setIsLoading(false);
        return;
      }

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
      } else {
        setError((res as any).error || "Erreur de connexion LinkedIn.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur inattendue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await apiRequest<{ token: string; user: User }>(
        "/auth/login",
        {
          method: "POST",
          body: { email: adminEmail.trim(), password: adminPassword },
        }
      );

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
      } else {
        setError((res as any).error || "Identifiants incorrects.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur inattendue.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #592eff 0%, #7c3aed 40%, #4f46e5 100%)" }}>

      {/* Background decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #a78bfa, transparent)" }} />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #818cf8, transparent)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, white, transparent)" }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* ── WELCOME STEP ─────────────────────────── */}
          {step === "welcome" && (
            <div className="p-10 flex flex-col items-center text-center">
              {/* Logo */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}>
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-xl font-bold text-gray-900">Bime Link</span>
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Bienvenue sur Bime Link 👋
              </h1>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                Automatisez votre prospection LinkedIn et atteignez jusqu'à 800 prospects qualifiés par mois.
              </p>

              {/* LinkedIn CTA */}
              <button
                onClick={() => setStep("linkedin-login")}
                className="w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 mb-3"
                style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
              >
                Créer mon compte
              </button>

              <button
                onClick={() => setStep("linkedin-login")}
                className="w-full py-3.5 rounded-xl font-semibold border-2 border-gray-200 text-gray-700 transition-all duration-200 hover:border-[#592eff] hover:text-[#592eff] hover:bg-purple-50"
              >
                Se connecter
              </button>

              {/* Admin discreet link */}
              <button
                onClick={() => setStep("admin-login")}
                className="mt-6 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Accès administrateur
              </button>
            </div>
          )}

          {/* ── LINKEDIN LOGIN STEP ───────────────────── */}
          {step === "linkedin-login" && (
            <div className="p-10">
              <button
                onClick={() => { setStep("welcome"); setError(null); setCheckpointMsg(null); }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Retour
              </button>

              {/* LinkedIn Logo */}
              <div className="flex flex-col items-center mb-7">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "#0A66C2" }}>
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Se connecter avec LinkedIn</h2>
                <p className="text-gray-500 text-sm mt-1 text-center">
                  Entrez vos identifiants de votre compte LinkedIn.
                </p>
              </div>

              {/* Checkpoint message */}
              {checkpointMsg && (
                <div className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm leading-relaxed">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{checkpointMsg}</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleLinkedInAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email LinkedIn
                  </label>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <input
                      type="email"
                      value={linkedinEmail}
                      onChange={(e) => setLinkedinEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                      style={{ "--tw-ring-color": "#592eff" } as React.CSSProperties}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mot de passe LinkedIn
                  </label>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={linkedinPassword}
                      onChange={(e) => setLinkedinPassword(e.target.value)}
                      placeholder="••••••••••"
                      required
                      className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Connexion en cours...
                    </>
                  ) : (
                    <>
                      Se connecter
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-4 text-xs text-center text-gray-400">
                Vos identifiants sont transmis de façon sécurisée via Unipile.
              </p>
            </div>
          )}

          {/* ── ADMIN LOGIN STEP ──────────────────────── */}
          {step === "admin-login" && (
            <div className="p-10">
              <button
                onClick={() => { setStep("welcome"); setError(null); }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Retour
              </button>

              <div className="flex flex-col items-center mb-7">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, #1e293b, #334155)" }}>
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Accès Administrateur</h2>
                <p className="text-gray-500 text-sm mt-1">Réservé au Super Admin.</p>
              </div>

              {error && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@company.com"
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e293b, #334155)" }}
                >
                  {isLoading ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Connexion...</>
                  ) : "Se connecter"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-white/60 text-xs mt-6">
          © 2026 Bime Link · Powered by Unipile
        </p>
      </div>
    </div>
  );
};
