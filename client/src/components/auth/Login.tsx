import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { Lock, Mail, ArrowRight, Sparkles, Shield, User, Users, CheckCircle2 } from "lucide-react";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("jeanregis@bimelink.io");
  const [password, setPassword] = useState("Admin123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
      } else {
        setError(res.error || "Email ou mot de passe incorrect.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9fc] via-[#ffffff] to-[#f4f1fb] flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Logo Lockup */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#592eff] text-white mx-auto flex items-center justify-center shadow-lg shadow-[#592eff]/30 mb-3">
            <svg
              className="w-7 h-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a10 10 0 1 0 10 10" />
              <path d="M12 6a6 6 0 1 0 6 6" />
              <path d="M12 10a2 2 0 1 0 2 2" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-[#21164c] tracking-tight">Bime Link</h1>
          <p className="text-[#5f5f69] text-sm mt-1">Automatisation de prospection & messagerie LinkedIn</p>
        </div>

        {/* Login Card */}
        <div className="adora-card p-8 sm:p-9">
          <h2 className="text-xl font-bold text-[#21164c] mb-1">Connexion à votre espace</h2>
          <p className="text-xs text-[#5f5f69] mb-6">Accédez à votre tableau de bord et vos campagnes</p>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="jeanregis@bimelink.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#e0e0db] bg-white text-sm text-[#353241] focus:outline-none focus:border-[#592eff] transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider">
                  Mot de passe
                </label>
                <a href="#forgot" className="text-xs text-[#592eff] hover:underline font-medium">
                  Oublié ?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#e0e0db] bg-white text-sm text-[#353241] focus:outline-none focus:border-[#592eff] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-6 rounded-xl bg-[#592eff] hover:bg-[#4b25dd] text-white font-bold text-sm tracking-wide shadow-md shadow-[#592eff]/25 flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {loading ? "Connexion..." : "Se connecter"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Social login divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e0e0db]"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-[#5f5f69] font-medium">Ou</span>
            </div>
          </div>

          {/* LinkedIn Direct OAuth Button */}
          <button
            onClick={() => {
              // Simulation de connexion LinkedIn via Unipile
              handleQuickDemo("sarah.growth@acme.com", "User123!");
            }}
            className="w-full py-2.5 px-4 rounded-xl border border-[#0a66c2]/30 hover:border-[#0a66c2] bg-[#0a66c2]/5 hover:bg-[#0a66c2]/10 text-[#0a66c2] font-semibold text-xs flex items-center justify-center gap-2 transition-all"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.2a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28z" />
            </svg>
            Continuer avec LinkedIn (Unipile SSO)
          </button>
        </div>

        {/* Quick Demo Selector */}
        <div className="mt-6 p-4 rounded-2xl bg-white border border-[#e0e0db] text-xs">
          <p className="font-bold text-[#21164c] mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#592eff]" /> Comptes de Démonstration Rapides :
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickDemo("jeanregis@bimelink.io", "Admin123!")}
              className="p-2 rounded-xl bg-[#592eff]/10 hover:bg-[#592eff]/20 text-[#592eff] font-bold text-center border border-[#592eff]/20 transition-colors"
            >
              Super Admin
            </button>
            <button
              onClick={() => handleQuickDemo("sarah.growth@acme.com", "User123!")}
              className="p-2 rounded-xl bg-[#a2ea13]/15 hover:bg-[#a2ea13]/25 text-[#477300] font-bold text-center border border-[#a2ea13]/30 transition-colors"
            >
              Utilisateur
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
