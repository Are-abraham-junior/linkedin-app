import React from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Version compacte (panneaux latéraux, cellules). */
  compact?: boolean;
  /** Sans cadre pointillé (à l'intérieur d'une carte). */
  bare?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, compact, bare, className }) => (
  <div
    className={clsx(
      "flex flex-col items-center justify-center text-center",
      !bare && "rounded-2xl border border-dashed border-line",
      compact ? "px-4 py-8" : "px-6 py-12",
      className,
    )}
  >
    {Icon && <Icon className={clsx("mb-3 text-muted", compact ? "h-4 w-4" : "h-5 w-5")} strokeWidth={1.75} aria-hidden />}
    <p className={clsx("font-semibold text-ink", compact ? "text-sm" : "text-base")}>{title}</p>
    {description && <p className={clsx("mt-1 max-w-[40ch] text-muted", compact ? "text-xs" : "text-sm")}>{description}</p>}
    {action && <div className="mt-4 flex items-center gap-2">{action}</div>}
  </div>
);
