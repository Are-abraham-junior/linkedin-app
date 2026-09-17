import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { User } from "../../types";
import { AuthShell, AuthField, AuthError, AuthSubmit, AuthSecondary, PasswordInput, authInputClass } from "./AuthShell";

interface InvitationInfo {
  email: string;
  organizationName: string;
  invitedBy: string;
  invitedByAvatar?: string;
  expiresAt: string;
}

interface JoinPageProps {
  token: string;
  onJoined?: () => void;
}

/**
 * Page /join?token=… : l'invité crée son compte Bleadin (identifiants
 * applicatifs) et rejoint l'espace. La connexion LinkedIn se fait ensuite
 * dans l'application, via le bandeau « Connecter LinkedIn » du tableau de bord.
 */
export const JoinPage: React.FC<JoinPageProps> = ({ token, onJoined }) => {
  const { login } = useAuth();
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Charger les informations de l'invitation
  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await apiRequest<{ invitation: InvitationInfo }>(
          `/team/invitation-info/${token}`
        );
        if (res.success && res.invitation) {
          setInvitationInfo(res.invitation);
        } else {
          setInvitationError((res as any).error || "Invitation introuvable.");
        }
      } catch (err: any) {
        setInvitationError("Impossible de charger l'invitation.");
      } finally {
        setLoadingInfo(false);
      }
    };
    fetchInfo();
  }, [token]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAccountExists(false);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Veuillez renseigner votre prénom et nom.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiRequest<{ token: string; user: User; message?: string }>("/auth/join", {
        method: "POST",
        body: { token, firstName: firstName.trim(), lastName: lastName.trim(), password },
      });

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
        onJoined?.();
      } else {
        const message: string = (res as any).error || "Erreur lors de la création du compte.";
        setError(message);
        if (/existe déjà/i.test(message)) setAccountExists(true);
      }
    } catch (err: any) {
      setError(err.message || "Erreur inattendue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingInfo) {
    return (
      <AuthShell title="Invitation">
        <p className="text-[15px] text-muted">Chargement de l'invitation…</p>
      </AuthShell>
    );
  }

  if (invitationError || !invitationInfo) {
    return (
      <AuthShell title="Invitation invalide" lead={invitationError || "Invitation introuvable."}>
        <AuthSecondary to="/connexion">Aller à la connexion</AuthSecondary>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Rejoindre ${invitationInfo.organizationName}`}
      lead={
        <>
          {invitationInfo.invitedBy} vous invite à rejoindre son espace. Créez votre compte ; le compte LinkedIn se
          connecte ensuite, depuis l'application.
        </>
      }
      width="md"
      footer={<p>Cette invitation expire le {new Date(invitationInfo.expiresAt).toLocaleDateString("fr-FR")}.</p>}
    >
      <form onSubmit={handleJoin} className="flex flex-col gap-5">
        {error && (
          <AuthError>
            {error}
            {accountExists && (
              <>
                {" "}
                <Link to="/connexion" className="font-semibold underline underline-offset-2">
                  Se connecter
                </Link>
              </>
            )}
          </AuthError>
        )}

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

        <AuthField label="E-mail" hint="Adresse définie par l'invitation ; elle servira d'identifiant de connexion.">
          <input type="email" value={invitationInfo.email} readOnly className={authInputClass} />
        </AuthField>

        <AuthField label="Mot de passe" hint="8 caractères minimum.">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
        </AuthField>

        <AuthSubmit loading={isLoading} loadingLabel="Création du compte…">
          Créer mon compte et rejoindre l'équipe
        </AuthSubmit>
      </form>
    </AuthShell>
  );
};
