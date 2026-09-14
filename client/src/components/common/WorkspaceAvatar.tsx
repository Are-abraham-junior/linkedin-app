import React from "react";

interface WorkspaceAvatarProps {
  name: string;
  avatarUrl?: string | null;
  /** Taille + arrondi (ex. "w-6 h-6 rounded-xl"). */
  className?: string;
  /** Style de la pastille initiale quand il n'y a pas de photo. */
  fallbackClassName?: string;
  textClassName?: string;
}

/**
 * Photo de profil de l'espace de travail : image si définie, sinon pastille avec l'initiale.
 * Utilisé partout où le nom de l'espace est affiché.
 */
export const WorkspaceAvatar: React.FC<WorkspaceAvatarProps> = ({
  name,
  avatarUrl,
  className = "w-6 h-6 rounded-xl",
  fallbackClassName = "bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20",
  textClassName = "text-[11px]",
}) => {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${className} object-cover shrink-0 border border-[#e0e0db] bg-white`}
      />
    );
  }
  return (
    <div
      className={`${className} ${fallbackClassName} ${textClassName} flex items-center justify-center font-bold shrink-0`}
      aria-label={name}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
};
