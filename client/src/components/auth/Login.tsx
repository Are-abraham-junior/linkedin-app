import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { User } from "../../types";
import { Register } from "./Register";

type LoginStep = "welcome" | "linkedin-login" | "admin-login";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState<LoginStep>("welcome");
  const [linkedinEmail, setLinkedinEmail] = useState("");
  const [linkedinPassword, setLinkedinPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkpointMsg, setCheckpointMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (authMode === "register") {
    return <Register onSwitchToLogin={() => setAuthMode("login")} />;
  }

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
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
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

              {/* Bouton S'inscrire */}
              <button
                onClick={() => setAuthMode("register")}
                className="w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 mb-3 cursor-pointer shadow-md shadow-[#592eff]/25"
                style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
              >
                S'inscrire
              </button>

              {/* Bouton Se connecter */}
              <button
                onClick={() => {
                  setStep("admin-login");
                  setError(null);
                }}
                className="w-full py-3.5 rounded-xl font-semibold border-2 border-gray-200 text-gray-700 transition-all duration-200 hover:border-[#592eff] hover:text-[#592eff] hover:bg-purple-50 cursor-pointer"
              >
                Se connecter
              </button>
            </div>
          )}

          {/* ── EMAIL LOGIN STEP ──────────────────────── */}
          {step === "admin-login" && (
            <div className="p-8 sm:p-10">
              <button
                type="button"
                onClick={() => {
                  setStep("welcome");
                  setError(null);
                }}
                className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-[#592eff] mb-6 transition-colors cursor-pointer group"
              >
                <svg
                  className="w-4 h-4 transition-transform group-hover:-translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Retour à l'accueil
              </button>

              <div className="flex flex-col items-center mb-6">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-white shadow-md shadow-[#592eff]/25"
                  style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Se connecter</h2>
                <p className="text-gray-500 text-xs mt-1">Accédez à votre espace Bime Link</p>
              </div>

              {error && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                  {error}
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="nom@entreprise.com"
                    required
                    className="w-full px-4 py-2.5 bg-[#f8f9fc] border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full px-4 py-2.5 bg-[#f8f9fc] border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl font-bold text-xs text-white transition-all duration-200 hover:opacity-90 shadow-md shadow-[#592eff]/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Connexion en cours...
                      </>
                    ) : (
                      "Se connecter"
                    )}
                  </button>
                </div>

                <div className="pt-4 border-t border-gray-100 text-center">
                  <p className="text-xs text-gray-500">
                    Pas encore d'espace ?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthMode("register")}
                      className="font-bold text-[#592eff] hover:underline cursor-pointer"
                    >
                      S'inscrire
                    </button>
                  </p>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        
      </div>
    </div>
  );
};
