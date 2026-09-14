import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import { apiRequest } from "../../services/api";

const inputClass =
  "w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium";

/** Étape 1 du « mot de passe oublié » : saisie de l'e-mail, envoi du lien. */
export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await apiRequest("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: email.trim() }),
    });
    if (res.success) setSent(true);
    else setError(res.error || "Impossible d'envoyer le lien. Veuillez réessayer.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9fc] via-[#ffffff] to-[#f0edf9] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white shadow-lg shadow-[#592eff]/25"
            style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
          >
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#21164c] tracking-tight">Mot de passe oublié ?</h1>
          <p className="text-[#5f5f69] text-xs sm:text-sm mt-1">
            Indiquez votre adresse e-mail : nous vous enverrons un lien pour choisir un nouveau mot de passe.
          </p>
        </div>

        <div className="adora-card p-6 sm:p-8 shadow-2xl shadow-[#592eff]/5 border border-[#e0e0db]/60 bg-white rounded-3xl">
          {sent ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h2 className="text-lg font-extrabold text-[#21164c]">Vérifiez votre boîte mail</h2>
              <p className="text-xs text-[#5f5f69] leading-relaxed">
                Si un compte existe pour <strong className="text-[#21164c]">{email.trim()}</strong>, un lien de
                réinitialisation vient d'être envoyé. Il est valable <strong>1 heure</strong>. Pensez à vérifier
                vos courriers indésirables.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-xs font-bold text-[#592eff] hover:underline cursor-pointer"
              >
                Renvoyer le lien
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                  Adresse e-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@entreprise.com"
                    required
                    autoFocus
                    className={inputClass}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 rounded-xl font-bold text-xs text-white shadow-md shadow-[#592eff]/25 hover:shadow-lg hover:shadow-[#592eff]/30 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Envoi en cours…
                  </>
                ) : (
                  "Envoyer le lien de réinitialisation"
                )}
              </button>
            </form>
          )}

          <div className="pt-5 mt-5 border-t border-gray-100 text-center">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5f5f69] hover:text-[#592eff]">
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
