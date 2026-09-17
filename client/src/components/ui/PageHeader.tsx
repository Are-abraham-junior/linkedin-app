import React from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Barre d'onglets rendue sous l'en-tête, pleine largeur. */
  tabs?: React.ReactNode;
  back?: { to: string; label: string };
  /** Titre plus petit (sous-pages, panneaux). */
  size?: "md" | "lg";
  className?: string;
}

/** En-tête de page : un titre éditorial, une phrase, les actions. Pas d'eyebrow, pas d'icône. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions, tabs, back, size = "lg", className }) => (
  <header className={clsx("mb-6", className)}>
    {back && (
      <Link to={back.to} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        {back.label}
      </Link>
    )}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className={clsx("display leading-tight", size === "lg" ? "text-2xl" : "text-xl")}>{title}</h1>
        {description && <p className="mt-1 max-w-[64ch] text-base text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
    {tabs && <div className="mt-5">{tabs}</div>}
  </header>
);
