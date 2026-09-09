import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  User,
  History,
  Blocks,
  CreditCard,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { AccountSettingsTab } from "./AccountSettingsTab";
import { LinkedInSettingsTab } from "./LinkedInSettingsTab";
import { ImportsHistoryTab } from "./ImportsHistoryTab";
import { IntegrationsSettingsTab } from "./IntegrationsSettingsTab";
import { BillingSettingsTab } from "./BillingSettingsTab";

const LinkedInIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.25c-.9 0-1.63.73-1.63 1.63s.73 1.63 1.63 1.63 1.63-.73 1.63-1.63-.73-1.63-1.63-1.63Z" />
  </svg>
);

type TabType = "account" | "linkedin" | "imports" | "integrations" | "billing";

const TABS: Array<{ id: TabType; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: "account", label: "Mon Compte", icon: User },
  { id: "linkedin", label: "LinkedIn & Connexions", icon: LinkedInIcon },
  { id: "imports", label: "Historique des Imports", icon: History },
  { id: "integrations", label: "Intégrations & Clé API", icon: Blocks },
  { id: "billing", label: "Facturation & Plan", icon: CreditCard },
];

export const SettingsView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabType) || "account";
  const [activeTab, setActiveTab] = useState<TabType>(
    TABS.some((t) => t.id === initialTab) ? initialTab : "account"
  );

  useEffect(() => {
    const tabParam = searchParams.get("tab") as TabType;
    if (tabParam && TABS.some((t) => t.id === tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* En-tête Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#592eff]/10 text-[#592eff] text-xs font-bold mb-2">
            <SettingsIcon className="w-3.5 h-3.5" />
            Configuration & Paramètres
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#21164c] tracking-tight">
            Paramètres Bleadin
          </h1>
          <p className="text-[#5f5f69] text-xs sm:text-sm mt-1">
            Gérez votre profil, votre connexion LinkedIn, l'historique d'importation, vos intégrations et votre facturation.
          </p>
        </div>
      </div>

      {/* Barre d'onglets fluide Adora */}
      <div className="border-b border-[#e0e0db]/80 flex gap-2 sm:gap-3 overflow-x-auto no-scrollbar pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 sm:px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? "bg-[#592eff] text-white shadow-md shadow-[#592eff]/25 scale-[1.02]"
                  : "text-[#5f5f69] hover:text-[#21164c] hover:bg-white/80"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-[#7c7c88]"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="pt-2">
        {activeTab === "account" && <AccountSettingsTab />}
        {activeTab === "linkedin" && <LinkedInSettingsTab />}
        {activeTab === "imports" && <ImportsHistoryTab />}
        {activeTab === "integrations" && <IntegrationsSettingsTab />}
        {activeTab === "billing" && <BillingSettingsTab />}
      </div>
    </div>
  );
};
export default SettingsView;
