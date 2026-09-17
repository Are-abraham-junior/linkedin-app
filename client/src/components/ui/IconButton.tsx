import React from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Libellé accessible (aria-label + title) — obligatoire. */
  label: string;
  icon: LucideIcon;
  size?: "sm" | "md";
  tone?: "default" | "danger";
  active?: boolean;
  type?: "button" | "submit";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon: Icon, size = "sm", tone = "default", active, className, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-lg text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        tone === "danger" ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-surface-2 hover:text-ink",
        active && "bg-surface-2 text-ink",
        className,
      )}
      {...rest}
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={1.75} aria-hidden />
    </button>
  ),
);
IconButton.displayName = "IconButton";
