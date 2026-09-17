import React from "react";
import clsx from "clsx";
import { getInitials } from "../ui/Avatar";

interface WorkspaceAvatarProps {
  name: string;
  avatarUrl?: string | null;
  /** Taille + arrondi (ex. "w-6 h-6 rounded-md"). */
  className?: string;
  /** Style de la pastille initiale quand il n'y a pas de photo. */
  fallbackClassName?: string;
  textClassName?: string;
}

/**
 * Photo de l'espace de travail : image si définie, sinon initiales locales
 * (jamais de service externe). Pastille carrée arrondie pour distinguer
 * un espace d'une personne (cercle).
 */
export const WorkspaceAvatar: React.FC<WorkspaceAvatarProps> = ({
  name,
  avatarUrl,
  className = "w-6 h-6 rounded-md",
  fallbackClassName = "bg-surface-2 text-ink",
  textClassName = "text-[10px]",
}) => {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={clsx(className, "shrink-0 border border-line bg-surface object-cover")} />;
  }
  return (
    <span
      className={clsx(className, fallbackClassName, textClassName, "inline-flex shrink-0 select-none items-center justify-center border border-line font-semibold")}
      aria-label={name}
      role="img"
    >
      {getInitials(name)}
    </span>
  );
};
