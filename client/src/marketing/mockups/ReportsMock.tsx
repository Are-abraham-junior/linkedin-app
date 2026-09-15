import React from "react";

const CAMPAIGNS = [
  { name: "Directeurs financiers — IDF", sent: 96, accepted: 41, replied: 12 },
  { name: "DRH — Scale-ups", sent: 120, accepted: 38, replied: 9 },
  { name: "Fondateurs — SaaS B2B", sent: 64, accepted: 31, replied: 11 },
];

const pct = (a: number, b: number) => `${Math.round((a / b) * 100)} %`;

/** Rapport par campagne : envoyées, acceptées, réponses, avec barres proportionnelles. */
export const ReportsMock: React.FC = () => {
  const max = Math.max(...CAMPAIGNS.map((c) => c.sent));
  return (
    <div className="font-sans text-[#353241]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0e0db] px-5 py-4 sm:px-6">
        <p className="text-[14px] font-medium text-[#21164c]">30 derniers jours</p>
        <span className="text-[13px] text-[#5f5f69]">Exporter en PDF</span>
      </div>
      <ul className="p-5 sm:p-6">
        {CAMPAIGNS.map((c) => (
          <li key={c.name} className="border-b border-[#f0f0ec] py-4 first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-4">
              <p className="truncate text-[14px] font-medium text-[#21164c]">{c.name}</p>
              <p className="shrink-0 text-[13px] tabular-nums text-[#5f5f69]">
                {c.sent} envoyées · {pct(c.accepted, c.sent)} acceptées · {pct(c.replied, c.accepted)} de réponses
              </p>
            </div>
            <div className="mt-2.5 flex h-2 w-full gap-px overflow-hidden rounded-full bg-[#eeeeee]">
              <div className="h-full bg-[#21164c]" style={{ width: `${(c.replied / max) * 100}%` }} />
              <div className="h-full bg-[#8f7de0]" style={{ width: `${((c.accepted - c.replied) / max) * 100}%` }} />
              <div className="h-full bg-[#d6d0f5]" style={{ width: `${((c.sent - c.accepted) / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex gap-5 border-t border-[#e0e0db] px-5 py-3 text-[12px] text-[#5f5f69] sm:px-6">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#21164c]" /> Réponses</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#8f7de0]" /> Acceptées</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#d6d0f5]" /> Envoyées</span>
      </div>
    </div>
  );
};
