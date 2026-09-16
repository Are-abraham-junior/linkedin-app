import React from "react";
import { useSearchParams } from "react-router-dom";
import { Cpu, BookOpen } from "lucide-react";
import { AiProvidersTab } from "./AiProvidersTab";
import { AiKnowledgeTab } from "./AiKnowledgeTab";

type TabId = "ai-providers" | "ai-knowledge";

const TABS: Array<{ id: TabId; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: "ai-providers", label: "Providers IA", icon: Cpu },
  { id: "ai-knowledge", label: "Base de connaissances", icon: BookOpen },
];

export const AdminSettingsView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab") as TabId | null;
  const activeTab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : "ai-providers";

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-[#21164c]">Paramètres plateforme</h1>
        <p className="text-[13px] text-[#5f5f69] mt-1">Configuration globale de Bleadin, réservée au super administrateur.</p>
      </div>

      <div className="flex gap-1 rounded-2xl bg-white border border-[#e0e0db] p-1 w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSearchParams({ tab: t.id })}
              className={`inline-flex items-center gap-2 h-9 px-4 rounded-xl text-[12px] font-semibold transition-colors ${active ? "bg-[#592eff] text-white shadow-md shadow-[#592eff]/25" : "text-[#353241] hover:bg-[#f5f5f7]"}`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-[32px] bg-[#fafafd] border border-[#e0e0db] p-5 sm:p-6">
        {activeTab === "ai-providers" ? <AiProvidersTab /> : <AiKnowledgeTab />}
      </div>
    </div>
  );
};
