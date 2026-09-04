import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { User } from "../../types";

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

export const JoinPage: React.FC<JoinPageProps> = ({ token, onJoined }) => {
  const { login } = useAuth();
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  const [linkedinEmail, setLinkedinEmail] = useState("");
  const [linkedinPassword, setLinkedinPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkpointMsg, setCheckpointMsg] = useState<string | null>(null);
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
          setLinkedinEmail(res.invitation.email);
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
    setCheckpointMsg(null);
    setIsLoading(true);

    try {
      const res = await apiRequest<{ token: string; user: User; status?: string; message?: string }>(
        "/auth/join",
        {
          method: "POST",
          body: { token, linkedinEmail: linkedinEmail.trim(), linkedinPassword },
        }
      );

      if ((res as any).status === "CHECKPOINT") {
        setCheckpointMsg((res as any).message || "LinkedIn demande une vérification. Validez sur LinkedIn puis réessayez.");
        setIsLoading(false);
        return;
      }

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
      } else {
        setError((res as any).error || "Erreur de connexion LinkedIn.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur inattendue.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #592eff 0%, #7c3aed 40%, #4f46e5 100%)" }}
    >
      {/* Background decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #a78bfa, transparent)" }} />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #818cf8, transparent)" }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Loading */}
          {loadingInfo && (
            <div className="p-10 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-3 border-[#592eff] border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 text-sm">Chargement de l'invitation...</p>
            </div>
          )}

          {/* Invitation error */}
          {!loadingInfo && invitationError && (
            <div className="p-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invitation invalide</h2>
              <p className="text-gray-500 text-sm">{invitationError}</p>
            </div>
          )}

          {/* Join form */}
          {!loadingInfo && !invitationError && invitationInfo && (
            <div className="p-10">
              {/* Header */}
              <div className="flex flex-col items-center mb-7 text-center">
                {/* Inviter avatar */}
                <div className="relative mb-4">
                  {invitationInfo.invitedByAvatar ? (
                    <img
                      src={invitationInfo.invitedByAvatar}
                      alt={invitationInfo.invitedBy}
                      className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white font-bold text-xl"
                      style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}>
                      {invitationInfo.invitedBy?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "#0A66C2" }}>
                    <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </div>
                </div>

                <div className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-3"
                  style={{ background: "#f3f0ff", color: "#592eff" }}>
                  Invitation de {invitationInfo.invitedBy}
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  Rejoindre {invitationInfo.organizationName}
                </h2>
                <p className="text-gray-500 text-sm">
                  Connectez votre LinkedIn pour rejoindre l'équipe.
                </p>
              </div>

              {/* Checkpoint */}
              {checkpointMsg && (
                <div className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm leading-relaxed">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{checkpointMsg}</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email LinkedIn
                  </label>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <input
                      type="email"
                      value={linkedinEmail}
                      onChange={(e) => setLinkedinEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mot de passe LinkedIn
                  </label>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={linkedinPassword}
                      onChange={(e) => setLinkedinPassword(e.target.value)}
                      placeholder="••••••••••"
                      required
                      className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {showPassword
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                        }
                      </svg>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
                >
                  {isLoading ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Connexion...</>
                  ) : (
                    <>Rejoindre l'équipe <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></>
                  )}
                </button>
              </form>

              <p className="mt-4 text-xs text-center text-gray-400">
                Cette invitation expire le {new Date(invitationInfo.expiresAt).toLocaleDateString("fr-FR")}.
              </p>
            </div>
          )}
        </div>

        
      </div>
    </div>
  );
};
