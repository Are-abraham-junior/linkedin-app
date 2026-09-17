import { getInitials } from "./Avatar";

/**
 * Avatar de repli sous forme de data-URI SVG (initiales sur fond ivoire),
 * pour les `<img src>` qui ne peuvent pas devenir un composant `Avatar`.
 * Remplace le service externe ui-avatars.com.
 */
export function initialsDataUrl(name?: string | null): string {
  const initials = getInitials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#f7f7f5"/><text x="32" y="32" dy=".35em" text-anchor="middle" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-size="24" font-weight="600" fill="#21164c">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
