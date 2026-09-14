import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiRequest } from "../../services/api";

interface ResetPasswordPageProps {
  token: string;
}

const inputClass =
  "w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-xs focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all font-medium";


interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
}

// Défini hors du composant page : un composant imbriqué serait recréé à chaque rendu et perdrait le focus
const PasswordField: React.FC<PasswordFieldProps> = ({ label, value, onChange, placeholder, show, onToggle }) => (
  <div>
    <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">{label}</label>
    <div className="relative">
      <Lock className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        minLength={8}
        className={inputClass}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5f5f69] hover:text-[#592eff] cursor-pointer"
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  </div>
);

/** Étape 2 du « mot de passe oublié » : nouveau mot de passe + confirmation, via le jeton reçu par e-mail. */
export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ token }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const res = await apiRequest("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    if (res.success) {
      setDone(true);
    } else {
      const message: string = res.error || "Réinitialisation impossible. Veuillez réessayer.";
      setError(message);
      if (/invalide|expiré/i.test(message)) setLinkInvalid(true);
    }
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
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#21164c] tracking-tight">Nouveau mot de passe</h1>
          <p className="text-[#5f5f69] text-xs sm:text-sm mt-1">
            Choisissez un nouveau mot de passe (8 caractères minimum), puis confirmez-le.
          </p>
        </div>

        <div className="adora-card p-6 sm:p-8 shadow-2xl shadow-[#592eff]/5 border border-[#e0e0db]/60 bg-white rounded-3xl">
          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h2 className="text-lg font-extrabold text-[#21164c]">Mot de passe réinitialisé</h2>
              <p className="text-xs text-[#5f5f69] leading-relaxed">
                Votre nouveau mot de passe est enregistré. Vous pouvez maintenant vous connecter.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full py-3 rounded-xl font-bold text-xs text-white shadow-md shadow-[#592eff]/25 hover:shadow-lg transition-all"
                style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
              >
                Se connecter
              </Link>
            </div>
          ) : linkInvalid ? (
            <div className="text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
              <h2 className="text-lg font-extrabold text-[#21164c]">Lien invalide ou expiré</h2>
              <p className="text-xs text-[#5f5f69] leading-relaxed">
                Ce lien de réinitialisation n'est plus valable (il expire au bout d'une heure et ne peut servir qu'une
                fois). Demandez-en un nouveau.
              </p>
              <Link
                to="/forgot-password"
                className="inline-flex items-center justify-center w-full py-3 rounded-xl font-bold text-xs text-white shadow-md shadow-[#592eff]/25 hover:shadow-lg transition-all"
                style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
              >
                Demander un nouveau lien
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                  {error}
                </div>
              )}
              <PasswordField label="Nouveau mot de passe" value={password} onChange={setPassword} placeholder="8 caractères minimum" show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
              <PasswordField label="Confirmer le mot de passe" value={confirm} onChange={setConfirm} placeholder="Retapez le mot de passe" show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
              {confirm && password !== confirm && (
                <p className="text-[11px] text-red-600 font-semibold -mt-2">Les deux mots de passe ne correspondent pas.</p>
              )}
              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full py-3 rounded-xl font-bold text-xs text-white shadow-md shadow-[#592eff]/25 hover:shadow-lg hover:shadow-[#592eff]/30 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  "Enregistrer le nouveau mot de passe"
                )}
              </button>
            </form>
          )}

          {!done && (
            <div className="pt-5 mt-5 border-t border-gray-100 text-center">
              <Link to="/login" className="text-xs font-bold text-[#5f5f69] hover:text-[#592eff]">
                Retour à la connexion
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
