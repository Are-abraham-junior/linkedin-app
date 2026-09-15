import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { User } from "../../types";
import { Register } from "./Register";
import { AuthShell, AuthField, AuthError, AuthSubmit, PasswordInput, authInputClass } from "./AuthShell";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (authMode === "register") {
    return <Register onSwitchToLogin={() => setAuthMode("login")} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await apiRequest<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
      });

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
      } else {
        setError((res as any).error || "Identifiants incorrects.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur inattendue.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Se connecter"
      footer={
        <p>
          Pas encore d'espace ?{" "}
          <button type="button" onClick={() => setAuthMode("register")} className="font-semibold text-[#21164c] hover:text-[#592eff]">
            Créer un espace
          </button>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <AuthError>{error}</AuthError>}

        <AuthField label="E-mail">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@entreprise.com"
            required
            autoComplete="email"
            autoFocus
            className={authInputClass}
          />
        </AuthField>

        <AuthField
          label="Mot de passe"
          action={
            <Link to="/forgot-password" className="text-[13px] text-[#5f5f69] hover:text-[#21164c]">
              Mot de passe oublié ?
            </Link>
          }
        >
          <PasswordInput value={password} onChange={setPassword} />
        </AuthField>

        <AuthSubmit loading={isLoading} loadingLabel="Connexion…">
          Se connecter
        </AuthSubmit>
      </form>
    </AuthShell>
  );
};
