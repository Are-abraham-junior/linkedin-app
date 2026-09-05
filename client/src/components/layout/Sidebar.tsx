import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  ShieldAlert,
  Users,
  Contact,
  MessageSquare,
  Send,
  UserCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Building2,
  X,
  Layers,
} from "lucide-react";

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
  icon: React.FC<{ className?: string }>;
  badge?: string;
  exact?: boolean;
}

interface NavSection {
  category: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggle,
  isMobileOpen,
  onMobileClose,
  onOpenProfile,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, impersonatedOrg } = useAuth();

  if (!user) return null;

  const isSuperAdmin = user.role === "SUPER_ADMIN";

  // Construction des menus Bime Link par catégories
  const navSections: NavSection[] = [
    {
      category: "Pilotage",
      items: [
        ...(isSuperAdmin
          ? [
              {
                id: "admin-hub",
                label: "Plateforme Hub",
                path: "/admin",
                icon: ShieldAlert,
                exact: true,
              },
              {
                id: "admin-users",
                label: "Utilisateurs",
                path: "/admin/users",
                icon: Users,
              },
            ]
          : []),
        {
          id: "dashboard",
          label: "Tableau de bord",
          path: "/dashboard",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      category: "Contacts",
      items: [
        {
          id: "prospects",
          label: "Contacts & Prospects",
          path: "/prospects",
          icon: Contact,
        },
        {
          id: "inbox",
          label: "Messagerie (Inbox)",
          path: "/inbox",
          icon: MessageSquare,
        },
      ],
    },
    {
      category: "Campagnes",
      items: [
        {
          id: "campaigns",
          label: "Campagnes",
          path: "/campaigns",
          icon: Send,
        },
      ],
    },
    // Section Organisation (visible pour tous les membres ou en supervision)
    ...(isSuperAdmin && !impersonatedOrg
      ? []
      : [
          {
            category: "Organisation",
            items: [
              {
                id: "team",
                label: "Équipe & Rôles",
                path: "/team",
                icon: Users,
              },
            ],
          },
        ]),
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobileOpen) {
      onMobileClose();
    }
  };

  const isItemActive = (item: NavItem) => {
    if (item.exact) {
      return location.pathname === item.path;
    }
    return location.pathname.startsWith(item.path);
  };

  const sidebarContent = (
    <aside
      className={`flex flex-col h-full bg-white border-r border-[#e0e0db] transition-all duration-300 select-none ${
        isCollapsed ? "w-[76px]" : "w-[260px]"
      }`}
    >
      {/* Header de la Sidebar : Logo + Titre + Bouton Rétractable */}
      <div
        className={`flex items-center justify-between px-4 py-4 border-b border-[#e0e0db]/70 shrink-0 ${
          isCollapsed ? "flex-col gap-3 px-2" : ""
        }`}
      >
        <div
          onClick={() => handleNavigate(isSuperAdmin ? "/admin" : "/dashboard")}
          className={`flex items-center gap-2.5 cursor-pointer group ${
            isCollapsed ? "justify-center" : ""
          }`}
          title="Bime Link"
        >
          {/* Logo Bime Link */}
          <div className="w-9 h-9 rounded-2xl bg-[#592eff] flex items-center justify-center text-white shadow-md shadow-[#592eff]/30 group-hover:scale-105 transition-transform shrink-0">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a10 10 0 1 0 10 10" />
              <path d="M12 6a6 6 0 1 0 6 6" />
              <path d="M12 10a2 2 0 1 0 2 2" />
            </svg>
          </div>

          {/* Titre & Sous-titre si non rétracté */}
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base text-[#21164c] tracking-tight truncate">
                  Bime Link
                </span>
                {isSuperAdmin && (
                  <span className="bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    Super Admin
                  </span>
                )}
              </div>
              {impersonatedOrg ? (
                <span className="text-[11px] text-[#592eff] font-bold truncate flex items-center gap-1">
                  <Building2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{impersonatedOrg.name}</span>
                </span>
              ) : user.organization ? (
                <span className="text-[11px] text-[#5f5f69] font-medium truncate flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-[#592eff] shrink-0" />
                  <span className="truncate">{user.organization.name}</span>
                </span>
              ) : (
                <span className="text-[11px] text-[#5f5f69] font-medium truncate">
                  Automation Suite
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bouton de bascule compact/développé (Desktop) */}
        <button
          type="button"
          onClick={onToggle}
          className="hidden lg:flex w-7 h-7 rounded-xl items-center justify-center text-[#5f5f69] hover:text-[#592eff] hover:bg-[#f5f5f7] border border-transparent hover:border-[#e0e0db] transition-all cursor-pointer"
          title={isCollapsed ? "Agrandir le menu" : "Réduire le menu"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* Bouton Fermer sur Mobile */}
        <button
          type="button"
          onClick={onMobileClose}
          className="lg:hidden w-8 h-8 rounded-xl flex items-center justify-center text-[#5f5f69] hover:bg-[#f5f5f7] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation principale par catégories */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navSections.map((section) => (
          <div key={section.category} className="space-y-1">
            {/* Titre de catégorie */}
            {!isCollapsed ? (
              <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-[#5f5f69]/80 mb-1.5">
                {section.category}
              </p>
            ) : (
              <div className="w-full flex justify-center py-1">
                <div className="w-5 h-[1px] bg-[#e0e0db]" />
              </div>
            )}

            {/* Liens de la catégorie */}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isItemActive(item);
                const IconComponent = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.path)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full group relative flex items-center gap-3 transition-all duration-150 cursor-pointer ${
                      isCollapsed
                        ? "justify-center p-2.5 rounded-2xl"
                        : "px-3.5 py-2.5 rounded-2xl text-left"
                    } ${
                      active
                        ? "bg-[#592eff] text-white font-bold shadow-md shadow-[#592eff]/25"
                        : "text-[#353241] hover:text-[#592eff] hover:bg-[#f5f5f7] font-semibold"
                    }`}
                  >
                    <IconComponent
                      className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                        active ? "text-white" : "text-[#5f5f69] group-hover:text-[#592eff]"
                      }`}
                    />

                    {!isCollapsed && (
                      <span className="text-xs truncate flex-1">{item.label}</span>
                    )}

                    {/* Tooltip flottant en mode compact */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#21164c] text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                        {item.label}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Carte Profil Utilisateur ancrée en bas */}
      <div className="p-3 border-t border-[#e0e0db]/70 shrink-0 bg-white">
        {!isCollapsed ? (
          <div className="p-2.5 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]/80 flex items-center justify-between gap-2">
            <div
              className="flex items-center gap-2.5 truncate cursor-pointer flex-1"
              onClick={onOpenProfile}
              title="Voir mon profil"
            >
              {/* Avatar */}
              <img
                src={
                  user.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user.name || user.email
                  )}&background=592eff&color=fff`
                }
                alt={user.name || user.email}
                className="w-8 h-8 rounded-full object-cover border border-[#592eff]/30 shrink-0"
              />
              {/* Infos */}
              <div className="truncate text-left">
                <p className="text-xs font-bold text-[#21164c] truncate">
                  {user.name || user.email.split("@")[0]}
                </p>
                <p className="text-[10px] text-[#5f5f69] font-medium truncate">
                  {isSuperAdmin
                    ? impersonatedOrg
                      ? `Super Admin · ${impersonatedOrg.name}`
                      : "Super Admin"
                    : user.organization?.name || "Membre"}
                </p>
              </div>
            </div>

            {/* Actions rapides profil & déconnexion */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onOpenProfile}
                className="p-1.5 rounded-lg text-[#5f5f69] hover:text-[#592eff] hover:bg-white transition-colors cursor-pointer"
                title="Mon profil & Quotas"
              >
                <UserCheck className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={logout}
                className="p-1.5 rounded-lg text-[#5f5f69] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                title="Se déconnecter"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Mode compact : icône avatar avec actions au survol */
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onOpenProfile}
              className="relative group p-1 rounded-2xl hover:ring-2 hover:ring-[#592eff]/30 transition-all cursor-pointer"
              title={user.name || user.email}
            >
              <img
                src={
                  user.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user.name || user.email
                  )}&background=592eff&color=fff`
                }
                alt={user.name || user.email}
                className="w-8 h-8 rounded-full object-cover border border-[#592eff]/30"
              />
              <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#21164c] text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                {user.name || user.email}
              </div>
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[#5f5f69] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Affichage Desktop fixe */}
      <div className="hidden lg:block shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </div>

      {/* Affichage Mobile Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop sombre */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={onMobileClose}
          />
          {/* Panneau drawer */}
          <div className="relative z-10 w-72 h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
