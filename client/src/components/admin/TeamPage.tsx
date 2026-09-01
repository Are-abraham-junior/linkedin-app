import React, { useState, useEffect, useCallback } from "react";
import { apiRequest } from "../../services/api";

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  orgRole: "OWNER" | "MEMBER";
  status: string;
  createdAt: string;
  linkedInAccount: {
    accountName: string | null;
    profilePicture: string | null;
    headline: string | null;
    status: string;
    dailyInvitesSent: number;
    dailyMsgSent: number;
  } | null;
}

interface PendingInvitation {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { name: string | null };
}

export const TeamPage: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ success: boolean; message: string; inviteUrl?: string } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ members: TeamMember[]; invitations: PendingInvitation[] }>("/team/members");
      if (res.success) {
        setMembers(res.members || []);
        setInvitations(res.invitations || []);
      }
    } catch (err) {
      console.error("Erreur chargement équipe:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteResult(null);
    try {
      const res = await apiRequest<{ invitation: { inviteUrl: string } }>("/team/invite", {
        method: "POST",
        body: { email: inviteEmail.trim() },
      });
      if (res.success) {
        setInviteResult({
          success: true,
          message: `Invitation envoyée à ${inviteEmail}`,
          inviteUrl: (res as any).invitation?.inviteUrl,
        });
        setInviteEmail("");
        loadTeam();
      } else {
        setInviteResult({ success: false, message: (res as any).error || "Erreur lors de l'invitation." });
      }
    } catch (err: any) {
      setInviteResult({ success: false, message: err.message });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!window.confirm(`Retirer ${memberName || "ce membre"} de l'équipe ?`)) return;
    setRemovingId(userId);
    try {
      await apiRequest(`/team/members/${userId}`, { method: "DELETE" });
      loadTeam();
    } catch (err) {
      alert("Erreur lors de la suppression.");
    } finally {
      setRemovingId(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setCancellingId(invitationId);
    try {
      await apiRequest(`/team/invitations/${invitationId}`, { method: "DELETE" });
      loadTeam();
    } catch {
      alert("Erreur lors de l'annulation.");
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONNECTED": return "bg-emerald-100 text-emerald-700";
      case "SUSPENDED": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const MemberAvatar: React.FC<{ member: TeamMember; size?: "sm" | "md" }> = ({ member, size = "md" }) => {
    const sizeClass = size === "sm" ? "w-8 h-8 text-sm" : "w-10 h-10 text-base";
    const src = member.linkedInAccount?.profilePicture || member.avatarUrl;
    const name = member.linkedInAccount?.accountName || member.name || member.email;
    if (src) {
      return <img src={src} alt={name} className={`${sizeClass} rounded-full object-cover border-2 border-white shadow`} />;
    }
    return (
      <div className={`${sizeClass} rounded-full flex items-center justify-center font-semibold text-white border-2 border-white shadow`}
        style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}>
        {name?.[0]?.toUpperCase() || "?"}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon équipe</h1>
          <p className="text-gray-500 text-sm mt-1">
            {members.length} membre{members.length !== 1 ? "s" : ""}
            {invitations.length > 0 && ` · ${invitations.length} invitation${invitations.length !== 1 ? "s" : ""} en attente`}
          </p>
        </div>
        <button
          onClick={() => { setShowInviteModal(true); setInviteResult(null); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Inviter un membre
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
          <div className="w-6 h-6 border-2 border-[#592eff] border-t-transparent rounded-full animate-spin" />
          Chargement...
        </div>
      ) : (
        <>
          {/* Members list */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900 text-sm">Membres actifs</h2>
            </div>

            {members.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">Aucun membre pour l'instant.</p>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="mt-3 text-sm font-medium text-[#592eff] hover:underline"
                >
                  Inviter votre premier membre →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {members.map((member) => {
                  const displayName = member.linkedInAccount?.accountName || member.name || member.email;
                  const headline = member.linkedInAccount?.headline;
                  const liStatus = member.linkedInAccount?.status || "DISCONNECTED";

                  return (
                    <div key={member.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                      <MemberAvatar member={member} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-gray-900 text-sm truncate">{displayName}</span>
                          {member.orgRole === "OWNER" && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 shrink-0">
                              Propriétaire
                            </span>
                          )}
                        </div>
                        {headline && (
                          <p className="text-xs text-gray-500 truncate">{headline}</p>
                        )}
                        <p className="text-xs text-gray-400">{member.email}</p>
                      </div>

                      {/* LinkedIn status */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(liStatus)}`}>
                          {liStatus === "CONNECTED" ? "LinkedIn ✓" : "Déconnecté"}
                        </span>

                        {/* Daily stats */}
                        {member.linkedInAccount && (
                          <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
                            <span title="Invitations aujourd'hui">
                              📨 {member.linkedInAccount.dailyInvitesSent}
                            </span>
                            <span title="Messages aujourd'hui">
                              💬 {member.linkedInAccount.dailyMsgSent}
                            </span>
                          </div>
                        )}

                        {/* Remove button (not for owner) */}
                        {member.orgRole !== "OWNER" && (
                          <button
                            onClick={() => handleRemoveMember(member.id, displayName)}
                            disabled={removingId === member.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Retirer de l'équipe"
                          >
                            {removingId === member.id ? (
                              <div className="w-4 h-4 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="font-semibold text-gray-900 text-sm">Invitations en attente</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {invitations.map((inv) => (
                  <div key={inv.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{inv.email}</p>
                      <p className="text-xs text-gray-400">
                        Expire le {new Date(inv.expiresAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 shrink-0">
                      En attente
                    </span>
                    <button
                      onClick={() => handleCancelInvitation(inv.id)}
                      disabled={cancellingId === inv.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Annuler l'invitation"
                    >
                      {cancellingId === inv.id ? (
                        <div className="w-4 h-4 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Invite Modal ─────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Inviter un membre</h3>
              <button onClick={() => { setShowInviteModal(false); setInviteResult(null); setInviteEmail(""); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {inviteResult ? (
                <div className={`rounded-xl p-4 ${inviteResult.success ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                  <div className="flex items-start gap-3">
                    {inviteResult.success ? (
                      <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <div>
                      <p className={`text-sm font-medium ${inviteResult.success ? "text-emerald-800" : "text-red-800"}`}>
                        {inviteResult.message}
                      </p>
                      {inviteResult.inviteUrl && (
                        <div className="mt-3">
                          <p className="text-xs text-emerald-600 mb-2">Lien d'invitation (à copier en dev) :</p>
                          <div className="bg-white rounded-lg p-2.5 border border-emerald-200 break-all">
                            <code className="text-xs text-gray-700">{inviteResult.inviteUrl}</code>
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(inviteResult.inviteUrl!)}
                            className="mt-2 text-xs font-medium text-emerald-600 hover:underline"
                          >
                            📋 Copier le lien
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleInvite} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email du membre à inviter
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      required
                      autoFocus
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                    />
                    <p className="mt-1.5 text-xs text-gray-400">
                      Un lien d'invitation sera généré. Le membre devra connecter son LinkedIn pour rejoindre l'équipe.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
                  >
                    {inviteLoading ? (
                      <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Envoi...</>
                    ) : "Envoyer l'invitation"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
