import React from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover active:bg-accent-active",
  secondary: "border border-line-2 bg-surface text-ink hover:border-ink active:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2 active:bg-line/60",
  danger: "bg-danger text-white hover:bg-danger-hover",
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-3.5 text-base",
};

export const buttonClass = (variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) =>
  clsx(buttonBase, buttonVariants[variant], buttonSizes[size], extra);

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  /** Rend un lien interne à la place d'un bouton. */
  to?: string;
  type?: "button" | "submit" | "reset";
}

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={clsx(
      "inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current",
      className,
    )}
    aria-hidden
  />
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading,
      icon: Icon,
      iconRight: IconRight,
      to,
      type = "button",
      className,
      children,
      disabled,
      ...rest
    },
    ref,
  ) => {
    const cls = buttonClass(variant, size, className);
    const content = (
      <>
        {loading ? (
          <Spinner />
        ) : Icon ? (
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
        ) : null}
        {children}
        {IconRight && <IconRight className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />}
      </>
    );
    if (to) {
      return (
        <Link to={to} className={cls} aria-disabled={disabled || loading || undefined}>
          {content}
        </Link>
      );
    }
    return (
      <button ref={ref} type={type} className={cls} disabled={disabled || loading} {...rest}>
        {content}
      </button>
    );
  },
);
Button.displayName = "Button";
