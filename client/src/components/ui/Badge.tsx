import React from "react";
import clsx from "clsx";

export type BadgeTone = "neutral" | "accent" | "ok" | "warn" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

const dotTones: Record<BadgeTone, string> = {
  neutral: "bg-muted-2",
  accent: "bg-accent",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({ tone = "neutral", dot, size = "md", className, children, ...rest }) => (
  <span
    className={clsx(
      "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-medium",
      size === "sm" ? "px-1.5 py-px text-[11px] leading-4" : "px-2 py-0.5 text-xs",
      tones[tone],
      className,
    )}
    {...rest}
  >
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
    {children}
  </span>
);

/** Point de statut statique + texte, sans fond (cellules, lignes d'en-tête). */
export const StatusDot: React.FC<{ tone?: BadgeTone; children?: React.ReactNode; className?: string }> = ({
  tone = "neutral",
  children,
  className,
}) => (
  <span className={clsx("inline-flex items-center gap-1.5 text-sm text-ink-2", className)}>
    <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", dotTones[tone])} aria-hidden />
    {children}
  </span>
);
