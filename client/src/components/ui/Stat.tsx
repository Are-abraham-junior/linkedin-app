import React from "react";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cardClass } from "./Card";

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  trend?: { value: number; label?: string };
  className?: string;
}

/** Indicateur chiffré : libellé discret, valeur en titre, pas d'icône ni de teinte. */
export const Stat: React.FC<StatProps> = ({ label, value, hint, trend, className }) => (
  <div className={clsx("flex min-w-0 flex-col gap-1", className)}>
    <span className="truncate text-sm text-muted">{label}</span>
    <span className="display text-2xl tabular-nums">{value}</span>
    {(hint || trend) && (
      <span className="flex items-center gap-2 text-xs text-muted">
        {trend && (
          <span
            className={clsx(
              "inline-flex items-center gap-0.5 font-medium",
              trend.value >= 0 ? "text-ok" : "text-danger",
            )}
          >
            {trend.value >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            {Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ""}
          </span>
        )}
        {hint}
      </span>
    )}
  </div>
);

/** Rangée d'indicateurs séparés par des hairlines. */
export const StatRow: React.FC<{ children: React.ReactNode; columns?: 2 | 3 | 4; className?: string }> = ({
  children,
  columns = 4,
  className,
}) => (
  <div
    className={clsx(
      cardClass,
      "grid divide-y divide-line sm:divide-y-0 sm:divide-x",
      columns === 2 && "grid-cols-1 sm:grid-cols-2",
      columns === 3 && "grid-cols-1 sm:grid-cols-3",
      columns === 4 && "grid-cols-2 sm:grid-cols-4",
      "[&>*]:p-5",
      className,
    )}
  >
    {children}
  </div>
);
