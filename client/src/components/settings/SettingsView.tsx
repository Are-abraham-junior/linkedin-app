import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AccountSettingsTab } from "./AccountSettingsTab";
import { LinkedInSettingsTab } from "./LinkedInSettingsTab";
import { ImportsHistoryTab } from "./ImportsHistoryTab";
import { IntegrationsSettingsTab } from "./IntegrationsSettingsTab";
import { BillingSettingsTab } from "./BillingSettingsTab";
import { PageHeader } from "../ui/PageHeader";
import { Tabs } from "../ui/Tabs";

type TabType = "account" | "linkedin" | "imports" | "integrations" | "billing";

const TABS: Array<{ id: TabType; label: string }> = [
  { id: "account", label: "Compte" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "imports", label: "Imports" },
  { id: "integrations", label: "Intégrations" },
  { id: "billing", label: "Facturation" },
];

export const SettingsView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabType) || "account";
  const [activeTab, setActiveTab] = useState<TabType>(TABS.some((t) => t.id === initialTab) ? initialTab : "account");

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
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Paramètres"
        description="Profil, espace de travail, connexion LinkedIn, imports, intégrations et facturation."
        tabs={<Tabs aria-label="Paramètres" value={activeTab} onChange={handleTabChange} items={TABS} />}
      />
      {activeTab === "account" && <AccountSettingsTab />}
      {activeTab === "linkedin" && <LinkedInSettingsTab />}
      {activeTab === "imports" && <ImportsHistoryTab />}
      {activeTab === "integrations" && <IntegrationsSettingsTab />}
      {activeTab === "billing" && <BillingSettingsTab />}
    </div>
  );
};
export default SettingsView;
