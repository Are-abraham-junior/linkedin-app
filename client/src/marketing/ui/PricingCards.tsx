import React from "react";
import { Check } from "lucide-react";
import clsx from "clsx";
import { PLANS, CURRENCY_SYMBOL } from "../content/plans";
import type { BillingCycle } from "./BillingToggle";
import { Button } from "./Button";

interface PricingCardsProps {
  cycle: BillingCycle;
  compact?: boolean;
}

export const PricingCards: React.FC<PricingCardsProps> = ({ cycle, compact }) => (
  <div className="grid gap-4 md:grid-cols-3 md:gap-5">
    {PLANS.map((plan) => {
      const price = cycle === "annual" ? plan.annual : plan.monthly;
      return (
        <div
          key={plan.id}
          className={clsx(
            "flex flex-col rounded-card border bg-white",
            compact ? "p-6" : "p-7 lg:p-8",
            plan.highlighted ? "border-[#592eff]" : "border-[#e0e0db]"
          )}
        >
          <div className="flex items-baseline justify-between">
            <h3 className="display text-[22px]">{plan.name}</h3>
            {plan.highlighted && <span className="text-[13px] font-medium text-[#592eff]">Le plus choisi</span>}
          </div>
          <p className="mt-1.5 text-[15px] text-[#5f5f69]">{plan.audience}</p>

          <div className="mt-7 flex items-baseline gap-1.5">
            <span className="display text-[44px] leading-none tabular-nums">
              {price}
              <span className="text-[26px]"> {CURRENCY_SYMBOL}</span>
            </span>
            <span className="text-[15px] text-[#5f5f69]">/ mois</span>
          </div>
          <p className="mt-2 h-5 text-[13px] text-[#5f5f69]">
            {cycle === "annual" ? `Facturé ${price * 12} ${CURRENCY_SYMBOL} par an` : "Sans engagement"}
          </p>

          <Button
            to="/connexion"
            variant={plan.highlighted ? "primary" : "secondary"}
            className="mt-6 w-full"
          >
            Choisir {plan.name}
          </Button>

          {!compact && (
            <ul className="mt-7 flex flex-col gap-3 border-t border-[#e0e0db] pt-6">
              {plan.pitch.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-[15px] text-[#353241]">
                  <Check className="mt-[3px] h-4 w-4 shrink-0 text-[#21164c]" strokeWidth={2} aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    })}
  </div>
);
