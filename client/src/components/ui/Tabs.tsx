import React, { useRef } from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  count?: number;
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: "underline" | "segmented";
  size?: "sm" | "md";
  "aria-label"?: string;
  className?: string;
}

/**
 * Onglets uniques de l'app : `underline` pour les sections de page,
 * `segmented` pour un basculement compact (vue perso / équipe, 7 j / 30 j).
 */
export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  variant = "underline",
  size = "md",
  className,
  ...rest
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const enabled = items.filter((i) => !i.disabled);
    const idx = enabled.findIndex((i) => i.id === value);
    if (idx < 0) return;
    e.preventDefault();
    const next = enabled[(idx + (e.key === "ArrowRight" ? 1 : enabled.length - 1)) % enabled.length];
    onChange(next.id);
    const btn = listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`);
    btn?.focus();
  };

  const isSeg = variant === "segmented";

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={rest["aria-label"]}
      onKeyDown={onKeyDown}
      className={clsx(
        isSeg
          ? "inline-flex shrink-0 rounded-lg border border-line bg-surface-2 p-0.5"
          : "flex flex-wrap gap-x-6 border-b border-line",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === value;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-tab={item.id}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={clsx(
              "inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
              size === "sm" ? "text-sm" : "text-base",
              isSeg
                ? clsx(
                    "rounded-md px-3 text-muted",
                    size === "sm" ? "h-7" : "h-8",
                    selected ? "bg-surface text-ink shadow-[0_1px_2px_rgba(33,22,76,0.08)]" : "hover:text-ink",
                  )
                : clsx(
                    "relative -mb-px border-b-2 hover:text-ink",
                    size === "sm" ? "h-9" : "h-10",
                    selected ? "border-accent text-ink" : "border-transparent text-muted",
                  ),
            )}
          >
            {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
            {item.label}
            {typeof item.count === "number" && (
              <span className={clsx("tabular-nums text-xs", selected ? "text-muted" : "text-muted-2")}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
