import React, { useId } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const fieldClass =
  "h-9 w-full rounded-lg border border-line-2 bg-surface px-3 text-base text-ink placeholder:text-muted-2 transition-colors focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted read-only:bg-surface-2 aria-[invalid=true]:border-danger-line";

export const labelClass = "mb-1.5 block text-sm font-medium text-ink";
export const hintClass = "mt-1.5 text-xs text-muted";

/* ---------------------------------------------------------------- Field */

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** Élément aligné à droite du libellé (lien, compteur…). */
  action?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

/** Libellé + champ + aide/erreur. Le `htmlFor` est propagé au premier enfant s'il n'a pas d'id. */
export const Field: React.FC<FieldProps> = ({ label, hint, error, required, action, htmlFor, className, children }) => {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const child = React.Children.only(children) as React.ReactElement<Record<string, unknown>>;
  const control = React.cloneElement(child, {
    id: (child.props.id as string | undefined) ?? id,
    "aria-invalid": error ? true : child.props["aria-invalid"],
  });
  return (
    <div className={className}>
      {(label || action) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={(child.props.id as string | undefined) ?? id} className="text-sm font-medium text-ink">
              {label}
              {required && (
                <span className="text-danger" aria-hidden>
                  {" "}
                  *
                </span>
              )}
            </label>
          )}
          {action}
        </div>
      )}
      {control}
      {error ? (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={hintClass}>{hint}</p>
      ) : null}
    </div>
  );
};

/* ---------------------------------------------------------------- Input */

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "sm" | "md";
  leftIcon?: LucideIcon;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ size = "md", leftIcon: Icon, className, ...rest }, ref) => {
    const input = (
      <input
        ref={ref}
        className={clsx(fieldClass, size === "sm" && "h-8 text-sm", Icon && "pl-9", className)}
        {...rest}
      />
    );
    if (!Icon) return input;
    return (
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          strokeWidth={1.75}
          aria-hidden
        />
        {input}
      </div>
    );
  },
);
Input.displayName = "Input";

/* ------------------------------------------------------------- Textarea */

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => (
    <textarea ref={ref} className={clsx(fieldClass, "h-auto min-h-[96px] resize-y py-2 leading-[1.5]", className)} {...rest} />
  ),
);
Textarea.displayName = "Textarea";

/* --------------------------------------------------------------- Select */

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: "sm" | "md";
  /** Largeur auto (barres d'outils) au lieu de `w-full`. */
  inline?: boolean;
}

/** `<select>` natif habillé — même hauteur et bordure que `Input`. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ size = "md", inline, className, children, ...rest }, ref) => (
    <div className={clsx("relative", inline ? "inline-block" : "w-full")}>
      <select
        ref={ref}
        className={clsx(
          fieldClass,
          "cursor-pointer appearance-none pr-9",
          size === "sm" && "h-8 text-sm",
          inline && "w-auto",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        strokeWidth={1.75}
        aria-hidden
      />
    </div>
  ),
);
Select.displayName = "Select";

/* ------------------------------------------------------------- Checkbox */

export const checkboxClass =
  "h-4 w-4 shrink-0 cursor-pointer rounded border-line-2 accent-[#592eff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => <input ref={ref} type="checkbox" className={clsx(checkboxClass, className)} {...rest} />,
);
Checkbox.displayName = "Checkbox";

/* --------------------------------------------------------------- Switch */

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled, label, className }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={clsx(
      "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-accent" : "bg-line-2",
      className,
    )}
  >
    <span
      className={clsx(
        "inline-block h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(33,22,76,0.2)] transition-transform",
        checked ? "translate-x-[18px]" : "translate-x-0.5",
      )}
      aria-hidden
    />
  </button>
);
