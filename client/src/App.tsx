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
import { ForgotPasswordPage } from "./components/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./components/auth/ResetPasswordPage";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { UserManagement } from "./components/admin/UserManagement";
import { TeamPage } from "./components/admin/TeamPage";
import { MainDashboard } from "./components/dashboard/MainDashboard";
import { ProspectsView } from "./components/prospects/ProspectsView";
import { CampaignsView } from "./components/campaigns/CampaignsView";
import { InboxView } from "./components/inbox/InboxView";
import { ReportsView } from "./components/reports/ReportsView";
import { ProfileModal } from "./components/profile/ProfileModal";
import { LinkedInOnboardingWall } from "./components/auth/LinkedInOnboardingWall";
import { SettingsView } from "./components/settings/SettingsView";
import { LinkedInSessionExpiredBanner } from "./components/common/LinkedInSessionExpiredBanner";
import { LinkedInReconnectModal } from "./components/modals/LinkedInReconnectModal";
import { ArrowRight } from "lucide-react";
import { MarketingLayout } from "./marketing/MarketingLayout";
import { HomePage } from "./marketing/pages/HomePage";
import { FeaturesPage } from "./marketing/pages/FeaturesPage";
import { AudiencesPage } from "./marketing/pages/AudiencesPage";
import { PricingPage } from "./marketing/pages/PricingPage";

/**
 * Wrapper pour la page /join?token=...
 */
const JoinPageWrapper: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  if (!token) {
    return <Navigate to="/connexion" replace />;
  }

  return <JoinPage token={token} onJoined={() => navigate("/dashboard")} />;
};

/**
 * Wrapper pour la page /reset-password?token=...
 */
const ResetPasswordPageWrapper: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  if (!token) {
    return <Navigate to="/connexion" replace />;
  }

  return <ResetPasswordPage token={token} />;
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
    return <Navigate to="/connexion" replace />;
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
            <div className="z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e0e0db] bg-white px-4 py-2.5 sm:px-6">
              <p className="min-w-0 truncate text-[13px] text-[#21164c]">
                <span className="font-semibold">Compte LinkedIn non connecté.</span>{" "}
                <span className="text-[#5f5f69]">Connectez-le pour lancer vos campagnes.</span>
              </p>
              <button
                type="button"
                onClick={() => setShowLinkedInModal(true)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#592eff] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#4a22e0]"
              >
                Connecter LinkedIn
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
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
      {/* La page de connexion vit sur /connexion : l'edge LWS (« Portail »/Varnish)
          coupe la connexion (ERR_CONNECTION_RESET) sur le chemin exact /login,
          avant meme qu'Apache ne reponde. /login reste un alias interne. */}
      <Route path="/login" element={<Navigate to="/connexion" replace />} />
      <Route
        path="/connexion"
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
      {/* Mot de passe oublié : demande de lien, puis réinitialisation via le jeton reçu par e-mail */}
      <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />
      <Route path="/reset-password" element={user ? <Navigate to="/dashboard" replace /> : <ResetPasswordPageWrapper />} />

      {/* Routes Authentifiées (AppLayout : Sidebar + Header) */}
      <Route element={<AppLayout />}>
        <Route
          path="/dashboard"
          element={<MainDashboard onStartCampaign={() => navigate("/campaigns")} />}
        />
        <Route path="/campaigns" element={<CampaignsView />} />
        <Route path="/reports" element={<ReportsView />} />
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

      {/* Site vitrine (public, visible aussi connecté) */}
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/fonctionnalites" element={<FeaturesPage />} />
        <Route path="/fait-pour" element={<AudiencesPage />} />
        <Route path="/tarifs" element={<PricingPage />} />
      </Route>

      {/* 404 / Route inconnue */}
      <Route
        path="*"
        element={
          <Navigate
            to={user ? (isSuperAdmin && !impersonatedOrg ? "/admin" : "/dashboard") : "/connexion"}
            replace
          />
        }
      />
    </Routes>
  );
};
