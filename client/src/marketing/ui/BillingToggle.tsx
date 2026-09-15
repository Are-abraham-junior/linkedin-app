import React from "react";
import clsx from "clsx";

export type BillingCycle = "monthly" | "annual";

interface BillingToggleProps {
  value: BillingCycle;
  onChange: (v: BillingCycle) => void;
}

/** Segmented control réel (radiogroup), la remise est un texte à côté. */
export const BillingToggle: React.FC<BillingToggleProps> = ({ value, onChange }) => {
  const options: { id: BillingCycle; label: string }[] = [
    { id: "monthly", label: "Mensuel" },
    { id: "annual", label: "Annuel" },
  ];
  return (
    <div className="inline-flex items-center gap-4">
      <div
        role="radiogroup"
        aria-label="Période de facturation"
        className="inline-flex rounded-lg border border-[#d6d6d0] bg-white p-1"
      >
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={clsx(
              "h-9 rounded-md px-4 text-[14px] font-semibold transition-colors",
              value === o.id ? "bg-[#21164c] text-white" : "text-[#5f5f69] hover:text-[#21164c]"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <span className="text-[14px] text-[#5f5f69]">−20 % en annuel</span>
    </div>
  );
};
