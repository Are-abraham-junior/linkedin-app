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
} from "lucide-react";

interface RegisterProps {
  onSwitchToLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onSwitchToLogin }) => {
  const { login } = useAuth();

  // Informations du compte & de l'espace (LinkedIn se connecte plus tard, dans l'app)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
        // Le compte LinkedIn se connecte plus tard, directement dans l'application
        // (bannière + modale sur le tableau de bord) — pas d'étape 2 ici.
        login(res.token, res.user);
      } else {
        setError((res as any).error || "Erreur lors de la création de l'espace.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur de connexion. Veuillez réessayer.");
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
            onClick={onSwitchToLogin}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5f5f69] hover:text-[#592eff] transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Retour à l'accueil
          </button>
        </div>

        {/* En-tête */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#592eff]/10 text-[#592eff] text-xs font-bold mb-3 tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            Inscription Entreprise
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#21164c] tracking-tight">
            Créez votre espace
          </h1>
          <p className="text-[#5f5f69] text-xs sm:text-sm mt-1">
            Configurez votre espace de prospection collaborative.
          </p>
        </div>

        {/* Card Form */}
        <div className="adora-card p-6 sm:p-8 relative overflow-hidden shadow-2xl shadow-[#592eff]/5 border border-[#e0e0db]/60 bg-white rounded-3xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2.5">
              <span className="text-sm font-bold">⚠️</span>
              <p className="flex-1">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                    <span>Création de l'espace...</span>
                  </>
                ) : (
                  <>
                    <span>Créer mon espace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Switch to Login */}
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
        </div>
      </div>
    </div>
  );
};
