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

        {/* LinkedIn Connect Reminder Banner pour les membres non connectés */}
        {!user.hasLinkedInAccount && !isSuperAdmin && (
          <div className="bg-gradient-to-r from-[#592eff]/10 via-[#7c3aed]/5 to-[#0077b5]/10 border-b border-[#592eff]/20 px-4 py-2 flex items-center justify-between text-xs z-10 shrink-0">
            <div className="flex items-center gap-2.5 text-[#21164c] font-medium">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0077b5] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0077b5]"></span>
              </span>
              <span>
                Votre compte LinkedIn n'est pas encore lié. Associez-le pour activer la prospection et vos campagnes personnelles.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowLinkedInModal(true)}
              className="px-3 py-1 bg-[#0077b5] hover:bg-[#005f93] text-white font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ml-3"
            >
              <span>Connecter LinkedIn</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
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
      <Route path="/join" element={<JoinPageWrapper />} />
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
