import React from "react";
import clsx from "clsx";
import { cardClass } from "./Card";

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx("animate-pulse rounded-md bg-line/70", className)} aria-hidden />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 3, className }) => {
  const widths = ["w-full", "w-11/12", "w-3/5", "w-4/5", "w-2/3"];
  return (
    <div className={clsx("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={clsx("h-3", widths[i % widths.length])} />
      ))}
    </div>
  );
};

export const SkeletonStatRow: React.FC<{ columns?: number; className?: string }> = ({ columns = 4, className }) => (
  <div className={clsx(cardClass, "grid divide-x divide-line", className)} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-hidden>
    {Array.from({ length: columns }).map((_, i) => (
      <div key={i} className="space-y-2 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-16" />
      </div>
    ))}
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number; className?: string }> = ({ rows = 6, cols = 4, className }) => (
  <div className={clsx(cardClass, "overflow-hidden", className)} aria-hidden>
    <div className="flex gap-6 border-b border-line px-4 py-3">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-20" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex items-center gap-6 border-b border-line px-4 py-3 last:border-b-0">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className={clsx("h-3", c === 0 ? "w-40" : "w-24")} />
        ))}
      </div>
    ))}
  </div>
);

/** Écran de chargement plein cadre (remplace spinner + texte). */
export const SkeletonPage: React.FC = () => (
  <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-6" aria-busy>
    <div className="space-y-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-3 w-80" />
    </div>
    <SkeletonStatRow />
    <SkeletonTable />
  </div>
);
