import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { AuthShell, AuthField, AuthError, AuthSubmit, PasswordInput, authInputClass } from "./AuthShell";

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
          organizationName: organizationName || "Bleadin Technologies",
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
    <AuthShell
      title="Première installation"
      lead="Aucun administrateur n'existe encore. Créez le compte super-administrateur de la plateforme."
      width="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <AuthError>{error}</AuthError>}

        <AuthField label="Nom complet">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            autoFocus
            className={authInputClass}
          />
        </AuthField>

        <AuthField label="Organisation" hint="Facultatif.">
          <input
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            autoComplete="organization"
            className={authInputClass}
          />
        </AuthField>

        <AuthField label="E-mail">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={authInputClass}
          />
        </AuthField>

        <AuthField label="Mot de passe" hint="8 caractères minimum.">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
        </AuthField>

        <AuthSubmit loading={loading} loadingLabel="Création…">
          Créer l'administrateur et démarrer
        </AuthSubmit>
      </form>
    </AuthShell>
  );
};
