import React, { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../services/api";
import { AuthShell, AuthField, AuthError, AuthSubmit, authInputClass } from "./AuthShell";

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
    <AuthShell
      title="Mot de passe oublié"
      lead={sent ? undefined : "Indiquez votre adresse e-mail : nous vous enverrons un lien pour choisir un nouveau mot de passe."}
      footer={
        <Link to="/connexion" className="font-semibold text-ink hover:text-accent">
          Retour à la connexion
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-[18px] font-semibold text-ink">Vérifiez votre boîte mail</h2>
          <p className="text-[15px] leading-[1.6] text-muted">
            Si un compte existe pour <span className="font-medium text-ink">{email.trim()}</span>, un lien de
            réinitialisation vient d'être envoyé. Il est valable une heure. Pensez à vérifier vos courriers indésirables.
          </p>
          <button type="button" onClick={() => setSent(false)} className="self-start text-base font-semibold text-ink hover:text-accent">
            Renvoyer le lien
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && <AuthError>{error}</AuthError>}
          <AuthField label="E-mail">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@entreprise.com"
              required
              autoFocus
              autoComplete="email"
              className={authInputClass}
            />
          </AuthField>
          <AuthSubmit loading={loading} disabled={!email.trim()} loadingLabel="Envoi…">
            Envoyer le lien
          </AuthSubmit>
        </form>
      )}
    </AuthShell>
  );
};
