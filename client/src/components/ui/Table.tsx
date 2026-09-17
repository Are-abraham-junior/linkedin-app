import React from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cardClass } from "./Card";
import { IconButton } from "./IconButton";

/** Conteneur scrollable : les tables défilent dedans, jamais la page. */
export const TableWrap: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div className={clsx(cardClass, "overflow-auto", className)} {...rest} />
);

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ className, ...rest }) => (
  <table className={clsx("w-full border-collapse text-sm", className)} {...rest} />
);

export const Th: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className, ...rest }) => (
  <th
    scope="col"
    className={clsx(
      "sticky top-0 z-10 h-10 whitespace-nowrap border-b border-line bg-surface px-4 text-left align-middle text-xs font-medium text-muted",
      className,
    )}
    {...rest}
  />
);

export const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className, ...rest }) => (
  <td className={clsx("border-b border-line px-4 py-3 align-middle text-ink-2", className)} {...rest} />
);

export interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  clickable?: boolean;
}

export const Tr: React.FC<TrProps> = ({ selected, clickable, className, ...rest }) => (
  <tr
    aria-selected={selected || undefined}
    className={clsx(
      "group transition-colors hover:bg-surface-2 [&:last-child>td]:border-b-0",
      selected && "bg-accent-soft hover:bg-accent-soft",
      clickable && "cursor-pointer",
      className,
    )}
    {...rest}
  />
);

/** Cellule d'actions : icônes discrètes révélées au survol/focus de la ligne. */
export const TdActions: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className, children, ...rest }) => (
  <Td className={clsx("w-px whitespace-nowrap text-right", className)} {...rest}>
    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [tr[aria-selected]_&]:opacity-100">
      {children}
    </div>
  </Td>
);

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  /** Texte à gauche (« 1–10 sur 42 »). */
  summary?: React.ReactNode;
  /** Sélecteur de taille de page, etc. */
  extra?: React.ReactNode;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({ page, pageCount, onPage, summary, extra, className }) => (
  <div className={clsx("flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted", className)}>
    <div className="flex items-center gap-3">
      {extra}
      {summary}
    </div>
    <div className="flex items-center gap-1">
      <IconButton label="Page précédente" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} />
      <span className="px-2 tabular-nums text-ink">
        {page} / {Math.max(1, pageCount)}
      </span>
      <IconButton label="Page suivante" icon={ChevronRight} disabled={page >= pageCount} onClick={() => onPage(page + 1)} />
    </div>
  </div>
);
