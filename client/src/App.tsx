import React, { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { SetupAdmin } from "./components/auth/SetupAdmin";
import { Login } from "./components/auth/Login";
import { JoinPage } from "./components/auth/JoinPage";
import { FloatingNavPill } from "./components/layout/FloatingNavPill";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { UserManagement } from "./components/admin/UserManagement";
import { TeamPage } from "./components/admin/TeamPage";
import { MainDashboard } from "./components/dashboard/MainDashboard";
import { ProspectsView } from "./components/prospects/ProspectsView";
import { CampaignsView } from "./components/campaigns/CampaignsView";
import { InboxView } from "./components/inbox/InboxView";
import { ProfileModal } from "./components/profile/ProfileModal";

export const App: React.FC = () => {
  const { user, isLoading, setupNeeded } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>("admin-dashboard");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Detect /join?token=... URL and show JoinPage before auth
  const [joinToken, setJoinToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const isJoinPath = window.location.pathname === "/join" || window.location.hash === "#/join";
    if (token && (isJoinPath || window.location.search.includes("token="))) {
      setJoinToken(token);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#592eff] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-[#21164c]">Chargement de Bime Link...</p>
        </div>
      </div>
    );
  }

  // Show join page if invitation token in URL (even if not logged in)
  if (joinToken && !user) {
    return <JoinPage token={joinToken} />;
  }

  // Si aucun Super Admin n'est présent dans la base, afficher l'assistant d'initialisation
  if (setupNeeded) {
    return <SetupAdmin />;
  }

  // Si l'utilisateur n'est pas connecté, afficher l'écran de connexion
  if (!user) {
    return <Login />;
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const activeTab = !isSuperAdmin && (currentTab === "admin-dashboard" || currentTab === "admin-users")
    ? "dashboard"
    : currentTab;

  return (
    <div
      className={`text-[#353241] flex flex-col ${
        activeTab === "prospects" || activeTab === "campaigns" || activeTab === "inbox"
          ? "h-screen overflow-hidden bg-[#f8f9fc]"
          : "min-h-screen bg-[#f8f9fc]"
      }`}
    >
      {/* Floating Adora Navigation Bar */}
      <FloatingNavPill
        currentTab={activeTab}
        onSelectTab={setCurrentTab}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Main View Area */}
      <main
        className={`flex-1 ${
          activeTab === "prospects" || activeTab === "campaigns" || activeTab === "inbox"
            ? "min-h-0 overflow-hidden flex flex-col"
            : "pb-16"
        }`}
      >
        {activeTab === "admin-dashboard" && isSuperAdmin && (
          <AdminDashboard onNavigateToUsers={() => setCurrentTab("admin-users")} />
        )}

        {activeTab === "admin-users" && isSuperAdmin && (
          <UserManagement />
        )}

        {activeTab === "dashboard" && (
          <MainDashboard onStartCampaign={() => setCurrentTab("campaigns")} />
        )}

        {activeTab === "campaigns" && (
          <CampaignsView />
        )}

        {activeTab === "prospects" && (
          <ProspectsView onStartCampaign={() => setCurrentTab("campaigns")} />
        )}

        {activeTab === "inbox" && (
          <InboxView />
        )}

        {activeTab === "team" && (
          <TeamPage />
        )}
      </main>

      {/* User Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};
