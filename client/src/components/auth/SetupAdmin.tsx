import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { ShieldCheck, Sparkles, Lock, Mail, User, Building2, ArrowRight } from "lucide-react";

export const SetupAdmin: React.FC = () => {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest("/auth/setup-superadmin", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          organizationName: organizationName || "Bime Link Technologies",
        }),
      });

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
      } else {
        setError(res.error || "Une erreur est survenue.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9fc] via-[#ffffff] to-[#f0edf9] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-[#592eff] text-white mx-auto flex items-center justify-center shadow-xl shadow-[#592eff]/30 mb-4 transform hover:rotate-6 transition-transform">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#21164c] tracking-tight">
            Bienvenue sur Bime Link
          </h1>
          <p className="text-[#5f5f69] text-sm sm:text-base mt-2 max-w-md mx-auto">
            Initialisation de la plateforme. Configurez le compte <span className="font-bold text-[#592eff]">Super Administrateur</span> principal.
          </p>
        </div>

        {/* Card Form */}
        <div className="adora-card p-8 sm:p-10 relative overflow-hidden">
          {/* Subtle Decorative pastel wash */}
          <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-[#bcf2ff]/30 blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-[#ffaae6]/30 blur-3xl pointer-events-none"></div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-2">
                Nom complet
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Jean-Regis N'GUESSAN"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#e0e0db] bg-white text-sm text-[#353241] placeholder:text-[#5f5f69]/60 focus:outline-none focus:border-[#592eff] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-2">
                Nom de l'Organisation / Entreprise
              </label>
              <div className="relative">
                <Building2 className="w-5 h-5 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Bime Link HQ (Optionnel)"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#e0e0db] bg-white text-sm text-[#353241] placeholder:text-[#5f5f69]/60 focus:outline-none focus:border-[#592eff] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-2">
                Adresse Email (Super Admin)
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="admin@bimelink.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#e0e0db] bg-white text-sm text-[#353241] placeholder:text-[#5f5f69]/60 focus:outline-none focus:border-[#592eff] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-2">
                Mot de passe fort
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Au moins 8 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#e0e0db] bg-white text-sm text-[#353241] placeholder:text-[#5f5f69]/60 focus:outline-none focus:border-[#592eff] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-3.5 px-6 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white font-bold text-sm tracking-wide shadow-lg shadow-[#592eff]/25 flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                "Création en cours..."
              ) : (
                <>
                  Créer le Super Administrateur & Démarrer <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
