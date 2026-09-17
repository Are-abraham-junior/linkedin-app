import React, { useEffect, useState } from "react";
import clsx from "clsx";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizes: Record<AvatarSize, string> = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
};

/** Deux lettres max, sans service externe (remplace ui-avatars.com). */
export function getInitials(name?: string | null): string {
  const parts = (name ?? "").trim().split(/[\s-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: AvatarSize;
  shape?: "circle" | "rounded";
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = "md", shape = "circle", className }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const radius = shape === "circle" ? "rounded-full" : size === "xs" || size === "sm" ? "rounded-md" : "rounded-lg";
  const base = clsx("shrink-0 border border-line", sizes[size], radius, className);

  if (src && !failed) {
    return <img src={src} alt={name ?? ""} onError={() => setFailed(true)} className={clsx(base, "bg-surface object-cover")} />;
  }
  return (
    <span
      className={clsx(base, "inline-flex select-none items-center justify-center bg-surface-2 font-semibold text-ink")}
      aria-label={name ?? undefined}
      role={name ? "img" : undefined}
    >
      {getInitials(name)}
    </span>
  );
};
