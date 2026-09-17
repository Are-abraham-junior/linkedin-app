import React from "react";
import { useSearchParams } from "react-router-dom";
import { AiProvidersTab } from "./AiProvidersTab";
import { AiKnowledgeTab } from "./AiKnowledgeTab";
import { PageHeader } from "../ui/PageHeader";
import { Tabs } from "../ui/Tabs";

type TabId = "ai-providers" | "ai-knowledge";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "ai-providers", label: "Providers IA" },
  { id: "ai-knowledge", label: "Base de connaissances" },
];

export const AdminSettingsView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab") as TabId | null;
  const activeTab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : "ai-providers";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Paramètres plateforme"
        description="Configuration globale de Bleadin, réservée au super administrateur."
        tabs={<Tabs aria-label="Sections" value={activeTab} onChange={(id) => setSearchParams({ tab: id })} items={TABS} />}
      />
      {activeTab === "ai-providers" ? <AiProvidersTab /> : <AiKnowledgeTab />}
    </div>
  );
};
