import React, { useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useSearchParams,
  Outlet,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { SetupAdmin } from "./components/auth/SetupAdmin";
import { Login } from "./components/auth/Login";
import { JoinPage } from "./components/auth/JoinPage";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { UserManagement } from "./components/admin/UserManagement";
import { TeamPage } from "./components/admin/TeamPage";
import { MainDashboard } from "./components/dashboard/MainDashboard";
import { ProspectsView } from "./components/prospects/ProspectsView";
import { CampaignsView } from "./components/campaigns/CampaignsView";
import { InboxView } from "./components/inbox/InboxView";
import { ProfileModal } from "./components/profile/ProfileModal";
import { LinkedInOnboardingWall } from "./components/auth/LinkedInOnboardingWall";
import { SettingsView } from "./components/settings/SettingsView";
import { LinkedInSessionExpiredBanner } from "./components/common/LinkedInSessionExpiredBanner";
import { LinkedInReconnectModal } from "./components/modals/LinkedInReconnectModal";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * Wrapper pour la page /join?token=...
 */
const JoinPageWrapper: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <JoinPage token={token} onJoined={() => navigate("/dashboard")} />;
};

/**
 * Layout principal pour les routes authentifiées
 */
const AppLayout: React.FC = () => {
  const {
    user,
    impersonatedOrg,
    showLinkedInModal,
    setShowLinkedInModal,
    showReconnectModal,
    setShowReconnectModal,
    openReconnectModal,
    isLinkedInDisconnected,
    linkedInStatus,
  } = useAuth();
  const location = useLocation();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isNoScrollPage =
    location.pathname.startsWith("/prospects") ||
    location.pathname.startsWith("/campaigns") ||
    location.pathname.startsWith("/inbox");

  // Déterminer si le compte a une session expirée ou checkpoint (y compris pour Super Admin)
  const hasExpiredSession = Boolean(
    user.linkedInAccount &&
    (linkedInStatus === "DISCONNECTED" ||
      linkedInStatus === "CREDENTIALS" ||
      linkedInStatus === "CHECKPOINT" ||
      linkedInStatus === "GATEWAY_UNAVAILABLE")
  );

  return (
    <div className="text-[#353241] flex h-screen overflow-hidden bg-[#f8f9fc]">
      {/* Barre latérale de navigation verticale Adora à gauche */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Contenu principal : Header supérieur + Page active */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* En-tête supérieur avec Titre, Recherche, Collaborateur, et WorkspaceSwitcher */}
        <Header
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

        {/* 1. Alerte prioritaire : Session LinkedIn expirée ou requérant vérification */}
        {hasExpiredSession ? (
          <LinkedInSessionExpiredBanner
            onReconnectClick={openReconnectModal}
            status={linkedInStatus}
          />
        ) : (
          /* 2. Invitation initiale pour les collaborateurs sans compte LinkedIn lié */
          !user.hasLinkedInAccount && !isSuperAdmin && (
            <div className="bg-gradient-to-r from-[#592eff]/15 via-[#7c3aed]/10 to-[#0a66c2]/15 border-b border-[#592eff]/25 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs z-20 shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5 text-[#21164c] flex-1 min-w-0">
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#592eff] text-white font-extrabold text-[10px] uppercase tracking-wider shadow-xs shrink-0">
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  Action Requise
                </span>
                <p className="text-xs text-[#21164c] truncate">
                  <strong className="font-extrabold">Activez votre prospection :</strong>{" "}
                  <span className="text-[#3b2b73] font-medium">
                    Connectez votre compte LinkedIn pour lancer vos campagnes et générer des leads qualifiés en continu.
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLinkedInModal(true)}
                className="px-3.5 py-1.5 bg-[#592eff] hover:bg-[#4a22e0] text-white font-bold text-xs rounded-xl shadow-md shadow-[#592eff]/25 hover:shadow-[#592eff]/40 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <span>Connecter LinkedIn</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        )}

        {/* Zone de contenu principale */}
        <main
          className={`flex-1 ${
            isNoScrollPage
              ? "min-h-0 overflow-hidden flex flex-col"
              : "overflow-y-auto"
          }`}
        >
          <Outlet />
        </main>
      </div>

      {/* User Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* LinkedIn Onboarding Modal */}
      {showLinkedInModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <LinkedInOnboardingWall onDismiss={() => setShowLinkedInModal(false)} />
        </div>
      )}

      {/* LinkedIn Direct Reconnect Modal */}
      <LinkedInReconnectModal
        isOpen={showReconnectModal}
        onClose={() => setShowReconnectModal(false)}
        initialCheckpoint={linkedInStatus === "CHECKPOINT"}
        checkpointAccountId={(user as any)?.linkedInAccount?.unipileAccountId || ""}
      />
    </div>
  );
};

export const App: React.FC = () => {
  const { user, isLoading, setupNeeded, impersonatedOrg } = useAuth();
  const navigate = useNavigate();

  // Pendant le chargement initial du profil
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-3 border-[#592eff] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-[#5f5f69]">Chargement de votre session...</span>
        </div>
      </div>
    );
  }

  // Si aucun Super Admin n'est présent dans la base, rediriger vers l'assistant d'initialisation
  if (setupNeeded) {
    return <SetupAdmin />;
  }

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  return (
    <Routes>
      {/* Routes Publiques */}
      <Route
        path="/login"
        element={
          user ? (
            <Navigate
              to={isSuperAdmin && !impersonatedOrg ? "/admin" : "/dashboard"}
              replace
            />
          ) : (
            <Login />
          )
        }
      />
      {/* Un utilisateur déjà connecté ne doit pas voir le formulaire de création de compte */}
      <Route path="/join" element={user ? <Navigate to="/dashboard" replace /> : <JoinPageWrapper />} />
      <Route path="/setup" element={<SetupAdmin />} />

      {/* Routes Authentifiées (avec AppLayout & FloatingNavPill) */}
      <Route element={<AppLayout />}>
        <Route
          path="/dashboard"
          element={<MainDashboard onStartCampaign={() => navigate("/campaigns")} />}
        />
        <Route path="/campaigns" element={<CampaignsView />} />
        <Route
          path="/prospects"
          element={<ProspectsView onStartCampaign={() => navigate("/campaigns")} />}
        />
        <Route path="/inbox" element={<InboxView />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/settings" element={<SettingsView />} />

        {/* Routes Super Admin */}
        <Route
          path="/admin"
          element={
            isSuperAdmin ? (
              <AdminDashboard onNavigateToUsers={() => navigate("/admin/users")} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/admin/users"
          element={
            isSuperAdmin ? (
              <UserManagement />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
      </Route>

      {/* Route Racine */}
      <Route
        path="/"
        element={
          <Navigate
            to={
              setupNeeded
                ? "/setup"
                : user
                ? isSuperAdmin && !impersonatedOrg
                  ? "/admin"
                  : "/dashboard"
                : "/login"
            }
            replace
          />
        }
      />

      {/* 404 / Route inconnue */}
      <Route
        path="*"
        element={
          <Navigate
            to={user ? (isSuperAdmin && !impersonatedOrg ? "/admin" : "/dashboard") : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
};
