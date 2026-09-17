import React from "react";
import { NavLink, Link } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  ShieldAlert,
  Users,
  Contact,
  MessageSquare,
  Send,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Settings,
  FileBarChart,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { normalizePlanId } from "../../marketing/content/plans";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { IconButton } from "../ui/IconButton";
import { Tooltip } from "../ui/Tooltip";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  onOpenProfile: () => void;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
}

interface NavSection {
  category: string;
  items: NavItem[];
}

const LogoMark: React.FC = () => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white" aria-hidden>
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 6a6 6 0 1 0 6 6" />
      <path d="M12 10a2 2 0 1 0 2 2" />
    </svg>
  </span>
);

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, isMobileOpen, onMobileClose }) => {
  const { user, logout, impersonatedOrg } = useAuth();

  if (!user) return null;

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const aiPlanAllowed = isSuperAdmin || ["PRO", "BUSINESS"].includes(normalizePlanId(user.organization?.plan));

  const navSections: NavSection[] = [
    {
      category: "Pilotage",
      items: [
        ...(isSuperAdmin
          ? [
              { id: "admin-hub", label: "Plateforme Hub", path: "/admin", icon: ShieldAlert, exact: true },
              { id: "admin-users", label: "Utilisateurs", path: "/admin/users", icon: Users },
              { id: "admin-settings", label: "Paramètres plateforme", path: "/admin/settings", icon: SlidersHorizontal },
            ]
          : []),
        { id: "dashboard", label: "Tableau de bord", path: "/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      category: "Assistant",
      items: [{ id: "bleadin-ia", label: "Bleadin IA", path: "/bleadin-ia", icon: Sparkles, badge: aiPlanAllowed ? undefined : "Pro" }],
    },
    {
      category: "Contacts",
      items: [
        { id: "prospects", label: "Contacts & Prospects", path: "/prospects", icon: Contact },
        { id: "inbox", label: "Messagerie", path: "/inbox", icon: MessageSquare },
      ],
    },
    {
      category: "Campagnes",
      items: [
        { id: "campaigns", label: "Campagnes", path: "/campaigns", icon: Send },
        { id: "reports", label: "Rapports", path: "/reports", icon: FileBarChart },
      ],
    },
    ...(isSuperAdmin && !impersonatedOrg
      ? []
      : [{ category: "Organisation", items: [{ id: "team", label: "Équipe & Rôles", path: "/team", icon: Users }] }]),
    {
      category: "Configuration",
      items: [{ id: "settings", label: "Paramètres", path: "/settings", icon: Settings }],
    },
  ];

  const closeMobile = () => {
    if (isMobileOpen) onMobileClose();
  };

  const orgLabel = isSuperAdmin
    ? impersonatedOrg
      ? `Super Admin · ${impersonatedOrg.name}`
      : "Super Admin"
    : user.organization?.name || "Membre";

  const sidebarContent = (
    <aside
      className={clsx(
        "flex h-full select-none flex-col overflow-hidden border-r border-line bg-surface transition-[width] duration-200",
        isCollapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      {/* Marque + bascule */}
      <div className={clsx("flex h-14 shrink-0 items-center border-b border-line", isCollapsed ? "justify-center px-2" : "justify-between px-4")}>
        <Link
          to={isSuperAdmin ? "/admin" : "/dashboard"}
          onClick={closeMobile}
          className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title="Bleadin"
        >
          <LogoMark />
          {!isCollapsed && (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-base font-semibold text-ink">Bleadin</span>
              {isSuperAdmin && <Badge size="sm">Super Admin</Badge>}
            </span>
          )}
        </Link>
        {!isCollapsed && (
          <IconButton
            label={isCollapsed ? "Agrandir le menu" : "Réduire le menu"}
            icon={ChevronLeft}
            onClick={onToggle}
            className="hidden lg:inline-flex"
          />
        )}
        <IconButton label="Fermer le menu" icon={X} onClick={onMobileClose} className="lg:hidden" />
      </div>

      {isCollapsed && (
        <div className="hidden justify-center py-2 lg:flex">
          <IconButton label="Agrandir le menu" icon={ChevronRight} onClick={onToggle} />
        </div>
      )}

      {/* Navigation */}
      <nav className={clsx("no-scrollbar flex-1 overflow-y-auto overflow-x-hidden", isCollapsed ? "space-y-3 px-3 py-2" : "space-y-5 px-3 py-4")}>
        {navSections.map((section) => (
          <div key={section.category} className="space-y-0.5">
            {!isCollapsed ? (
              <p className="mb-1.5 px-3 text-xs font-medium text-muted">{section.category}</p>
            ) : (
              <div className="mx-auto mb-1.5 h-px w-6 bg-line" />
            )}

            {section.items.map((item) => {
              const Icon = item.icon;
              const link = (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.exact}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    clsx(
                      "group flex items-center rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      isCollapsed ? "h-9 w-9 justify-center" : "h-9 w-full gap-3 px-3",
                      isActive
                        ? "bg-accent-soft font-medium text-ink [&>svg]:text-accent"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink [&>svg]:text-muted",
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!isCollapsed && item.badge && (
                    <Badge tone="accent" size="sm">
                      {item.badge}
                    </Badge>
                  )}
                </NavLink>
              );
              return isCollapsed ? (
                <Tooltip key={item.id} label={item.label} className="w-full justify-center">
                  {link}
                </Tooltip>
              ) : (
                link
              );
            })}
          </div>
        ))}
      </nav>

      {/* Profil */}
      <div className={clsx("shrink-0 border-t border-line", isCollapsed ? "p-2" : "p-3")}>
        {!isCollapsed ? (
          <div className="flex items-center gap-1">
            <Link
              to="/settings"
              onClick={closeMobile}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              title="Paramètres & profil"
            >
              <Avatar name={user.name || user.email} src={user.avatarUrl} size="md" />
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-medium text-ink">{user.name || user.email.split("@")[0]}</span>
                <span className="block truncate text-xs text-muted">{orgLabel}</span>
              </span>
            </Link>
            <IconButton label="Se déconnecter" icon={LogOut} tone="danger" onClick={logout} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Tooltip label={user.name || user.email}>
              <Link to="/settings" onClick={closeMobile} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <Avatar name={user.name || user.email} src={user.avatarUrl} size="md" />
              </Link>
            </Tooltip>
            <IconButton label="Se déconnecter" icon={LogOut} tone="danger" onClick={logout} />
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <div className="sticky top-0 z-30 hidden h-screen shrink-0 overflow-hidden lg:block">{sidebarContent}</div>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-ink/40" onClick={onMobileClose} aria-hidden />
          <div className="modal-in relative z-10 h-full w-[260px] shadow-pop">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
