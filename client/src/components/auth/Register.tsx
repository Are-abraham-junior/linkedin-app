import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { User } from "../../types";
import {
  Building2,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Eye,
  EyeOff,
  Check,
  Clock,
} from "lucide-react";

interface RegisterProps {
  onSwitchToLogin: () => void;
}

const LinkedInIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.25c-.9 0-1.63.73-1.63 1.63s.73 1.63 1.63 1.63 1.63-.73 1.63-1.63-.73-1.63-1.63Z" />
  </svg>
);

export const Register: React.FC<RegisterProps> = ({ onSwitchToLogin }) => {
  const { login, refreshUser } = useAuth();

  // Étape courante (1: Espace Entreprise, 2: Connexion LinkedIn)
  const [step, setStep] = useState<1 | 2>(1);

  // Étape 1 : Informations du compte & de l'espace
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Étape 2 : Synchronisation LinkedIn
  const [linkedinEmail, setLinkedinEmail] = useState("");
  const [linkedinPassword, setLinkedinPassword] = useState("");
  const [checkpointMsg, setCheckpointMsg] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Soumission Étape 1 : Création de compte & de l'organisation
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Veuillez renseigner votre prénom et nom.");
      return;
    }
    if (!email.trim()) {
      setError("Une adresse email professionnelle est requise.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (!workspaceName.trim()) {
      setError("Veuillez nommer votre espace entreprise.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiRequest<{ token: string; user: User; message?: string }>("/auth/register", {
        method: "POST",
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          workspaceName: workspaceName.trim(),
        },
      });

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
        // Pré-remplir l'email LinkedIn pour fluidifier
        if (!linkedinEmail) setLinkedinEmail(email.trim());
        setStep(2);
      } else {
        setError((res as any).error || "Erreur lors de la création de l'espace.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur de connexion. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  // Soumission Étape 2 : Connexion LinkedIn
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCheckpointMsg(null);

    if (!linkedinEmail.trim() || !linkedinPassword) {
      setError("Veuillez renseigner vos identifiants LinkedIn.");
      return;
    }

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

      if (res.status === "CHECKPOINT" || res.status === "WAITING_2FA") {
        setCheckpointMsg(res.message || "Code de validation requis.");
        return;
      }

      if (res.success) {
        if (res.token && res.user) {
          login(res.token, res.user);
        } else {
          await refreshUser();
        }
      } else {
        setError((res as any).error || "Identifiants LinkedIn invalides.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de la connexion LinkedIn.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9fc] via-[#ffffff] to-[#f0edf9] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl">
        {/* Navigation retour à l'accueil */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={step === 2 ? () => setStep(1) : onSwitchToLogin}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5f5f69] hover:text-[#592eff] transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            {step === 2 ? "Retour à l'étape 1" : "Retour à l'accueil"}
          </button>
          {step === 2 && (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-xs font-semibold text-[#5f5f69] hover:text-red-600 transition-colors cursor-pointer"
            >
              Retour à l'accueil
            </button>
          )}
        </div>

        {/* En-tête Stepper épuré */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#592eff]/10 text-[#592eff] text-xs font-bold mb-3 tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            Inscription Entreprise
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#21164c] tracking-tight">
            {step === 1 ? "Créez votre espace" : "Connectez votre compte LinkedIn"}
          </h1>
          <p className="text-[#5f5f69] text-xs sm:text-sm mt-1">
            {step === 1
              ? "Configurez votre espace de prospection collaborative."
              : "Requis pour activer vos campagnes et vos listes."}
          </p>

          {/* Stepper Dots & Labels */}
          <div className="flex items-center justify-center gap-3 mt-4">
            {/* Step 1 Pill */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                step === 1
                  ? "bg-[#592eff] text-white shadow-md shadow-[#592eff]/20"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {step > 1 ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span>1</span>}
              <span>Espace Entreprise</span>
            </div>

            <div className="w-6 h-[2px] bg-[#e0e0db]"></div>

            {/* Step 2 Pill */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                step === 2
                  ? "bg-[#0077b5] text-white shadow-md shadow-[#0077b5]/20"
                  : "bg-[#f8f9fc] text-[#5f5f69] border border-[#e0e0db]"
              }`}
            >
              <span>2</span>
              <span>Compte LinkedIn</span>
            </div>
          </div>
        </div>

        {/* Card Form */}
        <div className="adora-card p-6 sm:p-8 relative overflow-hidden shadow-2xl shadow-[#592eff]/5 border border-[#e0e0db]/60 bg-white rounded-3xl">
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

          {/* FORMULAIRE ÉTAPE 1 */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-4">
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium"
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Email professionnel */}
              <div>
                <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                  Email professionnel
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jean.dupont@entreprise.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Nom de l'espace */}
              <div>
                <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                  Nom de votre espace ou entreprise
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Ex: Acme Growth, Agence Digitale..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium"
                  />
                </div>
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
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium"
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

              {/* Submit Step 1 */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-5 rounded-xl bg-[#592eff] hover:bg-[#4d25e6] text-white font-bold text-xs shadow-lg shadow-[#592eff]/25 hover:shadow-[#592eff]/35 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Création de l'espace...</span>
                    </>
                  ) : (
                    <>
                      <span>Continuer vers l'étape 2</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* FORMULAIRE ÉTAPE 2 */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-4">
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

              {/* Submit Step 2 */}
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
                      <span>Finaliser & Accéder à mon espace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Switch to Login (Uniquement étape 1) */}
          {step === 1 && (
            <div className="mt-5 pt-4 border-t border-[#e0e0db]/60 text-center">
              <p className="text-xs text-[#5f5f69]">
                Vous avez déjà un compte ?{" "}
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="font-bold text-[#592eff] hover:underline cursor-pointer"
                >
                  Connectez-vous ici
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
