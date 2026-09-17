import React from "react";
import clsx from "clsx";

export interface TooltipProps {
  label: string;
  side?: "right" | "top" | "bottom";
  children: React.ReactNode;
  className?: string;
}

/** Info-bulle CSS (survol/focus) — sidebar repliée, icônes seules. */
export const Tooltip: React.FC<TooltipProps> = ({ label, side = "right", children, className }) => (
  <span className={clsx("group/tip relative inline-flex", className)}>
    {children}
    <span
      role="tooltip"
      className={clsx(
        "pointer-events-none absolute z-[60] whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white opacity-0 shadow-pop transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
        side === "right" && "left-full top-1/2 ml-2 -translate-y-1/2",
        side === "top" && "bottom-full left-1/2 mb-2 -translate-x-1/2",
        side === "bottom" && "left-1/2 top-full mt-2 -translate-x-1/2",
      )}
    >
      {label}
    </span>
  </span>
);
