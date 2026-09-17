import React from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

export type CalloutTone = "info" | "warn" | "danger" | "ok";

const tones: Record<CalloutTone, string> = {
  info: "border-line bg-surface-2 text-ink-2",
  warn: "border-warn/30 bg-warn-soft text-warn",
  danger: "border-danger-line bg-danger-soft text-danger",
  ok: "border-ok/30 bg-ok-soft text-ok",
};

const icons: Record<CalloutTone, React.ElementType> = {
  info: Info,
  warn: AlertTriangle,
  danger: AlertTriangle,
  ok: CheckCircle2,
};

export const calloutClass = (tone: CalloutTone = "info") =>
  clsx("flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-[1.5]", tones[tone]);

export interface CalloutProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: CalloutTone;
  icon?: boolean;
  title?: React.ReactNode;
}

/** Message contextuel discret (erreur de formulaire, avertissement, note). */
export const Callout: React.FC<CalloutProps> = ({ tone = "info", icon = true, title, className, children, ...rest }) => {
  const Icon = icons[tone];
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={clsx(calloutClass(tone), className)} {...rest}>
      {icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={clsx(title && "mt-0.5 opacity-90")}>{children}</div>}
      </div>
    </div>
  );
};
