import React, { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../services/api";
import { AuthShell, AuthField, AuthError, AuthSubmit, AuthSecondary, PasswordInput } from "./AuthShell";

interface ResetPasswordPageProps {
  token: string;
}

/** Étape 2 du « mot de passe oublié » : nouveau mot de passe + confirmation, via le jeton reçu par e-mail. */
export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ token }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

  if (done) {
    return (
      <AuthShell title="Mot de passe enregistré" lead="Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.">
        <AuthSecondary to="/connexion">Se connecter</AuthSecondary>
      </AuthShell>
    );
  }

  if (linkInvalid) {
    return (
      <AuthShell
        title="Lien invalide ou expiré"
        lead="Ce lien de réinitialisation n'est plus valable : il expire au bout d'une heure et ne peut servir qu'une fois."
      >
        <AuthSecondary to="/forgot-password">Demander un nouveau lien</AuthSecondary>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Nouveau mot de passe"
      lead="Choisissez un mot de passe de 8 caractères minimum, puis confirmez-le."
      footer={
        <Link to="/connexion" className="font-semibold text-ink hover:text-accent">
          Retour à la connexion
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <AuthError>{error}</AuthError>}
        <AuthField label="Nouveau mot de passe">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" minLength={8} autoFocus />
        </AuthField>
        <AuthField
          label="Confirmer le mot de passe"
          hint={confirm && password !== confirm ? <span className="text-[#8a2a2a]">Les deux mots de passe ne correspondent pas.</span> : undefined}
        >
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={8} />
        </AuthField>
        <AuthSubmit loading={loading} disabled={!password || !confirm} loadingLabel="Enregistrement…">
          Enregistrer le mot de passe
        </AuthSubmit>
      </form>
    </AuthShell>
  );
};
