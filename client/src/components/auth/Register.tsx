import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { User } from "../../types";
import { AuthShell, AuthField, AuthError, AuthSubmit, PasswordInput, authInputClass } from "./AuthShell";

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
    <AuthShell
      title="Créer un espace"
      lead="Votre compte et votre espace de travail. Le compte LinkedIn se connecte ensuite, depuis l'application."
      width="md"
      footer={
        <p>
          Vous avez déjà un compte ?{" "}
          <button type="button" onClick={onSwitchToLogin} className="font-semibold text-[#21164c] hover:text-[#592eff]">
            Se connecter
          </button>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <AuthError>{error}</AuthError>}

        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField label="Prénom">
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              autoFocus
              className={authInputClass}
            />
          </AuthField>
          <AuthField label="Nom">
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              className={authInputClass}
            />
          </AuthField>
        </div>

        <AuthField label="E-mail professionnel">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@entreprise.com"
            autoComplete="email"
            className={authInputClass}
          />
        </AuthField>

        <AuthField label="Nom de l'espace" hint="Le nom de votre entreprise ou de votre équipe.">
          <input
            type="text"
            required
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            autoComplete="organization"
            className={authInputClass}
          />
        </AuthField>

        <AuthField label="Mot de passe" hint="8 caractères minimum.">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
        </AuthField>

        <AuthSubmit loading={isLoading} loadingLabel="Création de l'espace…">
          Créer mon espace
        </AuthSubmit>
      </form>
    </AuthShell>
  );
};
