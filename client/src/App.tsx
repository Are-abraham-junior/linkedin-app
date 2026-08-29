import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { SetupAdmin } from "./components/auth/SetupAdmin";
import { Login } from "./components/auth/Login";
import { FloatingNavPill } from "./components/layout/FloatingNavPill";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { UserManagement } from "./components/admin/UserManagement";
import { MainDashboard } from "./components/dashboard/MainDashboard";
import { ProspectsView } from "./components/prospects/ProspectsView";
import { CampaignsView } from "./components/campaigns/CampaignsView";
import { ProfileModal } from "./components/profile/ProfileModal";

export const App: React.FC = () => {
  const { user, isLoading, setupNeeded } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>("admin-dashboard");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

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
        activeTab === "prospects" || activeTab === "campaigns"
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
          activeTab === "prospects" || activeTab === "campaigns"
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
      </main>

      {/* User Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};
