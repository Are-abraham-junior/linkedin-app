import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import {
  ShieldAlert,
  Users,
  LayoutDashboard,
  Send,
  MessageSquare,
  Sparkles,
  LogOut,
  ChevronDown,
  UserCheck,
  Building2,
  ExternalLink,
  Contact,
  ArrowRightLeft,
  Check,
} from "lucide-react";

interface FloatingNavPillProps {
  onOpenProfile: () => void;
}

export const FloatingNavPill: React.FC<FloatingNavPillProps> = ({
  onOpenProfile,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, selectedMemberId, setSelectedMemberId, impersonatedOrg } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    if (user?.orgRole === "OWNER" || user?.role === "SUPER_ADMIN") {
      apiRequest<{ members: any[] }>("/team/members")
        .then((res) => {
          if (res.success && res.members) {
            setTeamMembers(res.members);
          }
        })
        .catch(() => {});
    }
  }, [user?.id, user?.orgRole, impersonatedOrg]);

  if (!user) return null;

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const activeMember = teamMembers.find((m) => m.id === selectedMemberId);
  const canSwitchAccounts = (user?.orgRole === "OWNER" || isSuperAdmin) && teamMembers.length > 0;

  return (
    <header
      className={`px-4 sm:px-6 max-w-[1640px] mx-auto w-full transition-all shrink-0 ${
        location.pathname.startsWith("/prospects")
          ? "relative pt-2.5 pb-1.5 z-20"
          : "sticky top-4 z-40"
      }`}
    >
      <div className="adora-nav-pill px-4 sm:px-5 py-2 flex items-center justify-between shadow-sm">
        {/* Brand Logo */}
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => navigate(isSuperAdmin ? "/admin" : "/dashboard")}
        >
          <div className="w-8 h-8 rounded-full bg-[#592eff] flex items-center justify-center text-white shadow-md shadow-[#592eff]/25 transition-transform hover:scale-105">
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
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-[#21164c] tracking-tight">Bime Link</span>
              {isSuperAdmin && (
                <span className="bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20 text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Super Admin
                </span>
              )}
            </div>
            {user.organization && (
              <span className="text-xs text-[#5f5f69] flex items-center gap-1">
                <Building2 className="w-3 h-3 text-[#592eff]" /> {user.organization.name}
              </span>
            )}
          </div>
        </div>

        {/* Navigation items */}
        <nav className="hidden md:flex items-center gap-1 bg-[#f5f5f7] p-1.5 rounded-full">
          {isSuperAdmin && (
            <>
              <button
                onClick={() => navigate("/admin")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  location.pathname === "/admin"
                    ? "bg-[#592eff] text-white shadow-sm"
                    : "text-[#353241] hover:text-[#592eff]"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Plateforme
              </button>
              <button
                onClick={() => navigate("/admin/users")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  location.pathname === "/admin/users"
                    ? "bg-[#592eff] text-white shadow-sm"
                    : "text-[#353241] hover:text-[#592eff]"
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Utilisateurs
              </button>
            </>
          )}

          <button
            onClick={() => navigate("/dashboard")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              location.pathname === "/dashboard"
                ? "bg-[#592eff] text-white shadow-sm"
                : "text-[#353241] hover:text-[#592eff]"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
          </button>

          <button
            onClick={() => navigate("/campaigns")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              location.pathname.startsWith("/campaigns")
                ? "bg-[#592eff] text-white shadow-sm"
                : "text-[#353241] hover:text-[#592eff]"
            }`}
          >
            <Send className="w-3.5 h-3.5" /> Campagnes
          </button>

          <button
            onClick={() => navigate("/prospects")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              location.pathname.startsWith("/prospects")
                ? "bg-[#592eff] text-white shadow-sm"
                : "text-[#353241] hover:text-[#592eff]"
            }`}
          >
            <Contact className="w-3.5 h-3.5" /> Prospects
          </button>

          <button
            onClick={() => navigate("/inbox")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              location.pathname.startsWith("/inbox")
                ? "bg-[#592eff] text-white shadow-sm"
                : "text-[#353241] hover:text-[#592eff]"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Messagerie
          </button>

          {!isSuperAdmin && (
            <button
              onClick={() => navigate("/team")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                location.pathname.startsWith("/team")
                  ? "bg-[#592eff] text-white shadow-sm"
                  : "text-[#353241] hover:text-[#592eff]"
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Équipe
            </button>
          )}
        </nav>

        {/* Right Controls: Account Switcher + User Profile */}
        <div className="flex items-center gap-2.5">
          {canSwitchAccounts && (
            <div className="relative">
              <button
                onClick={() => setSwitcherOpen(!switcherOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer shadow-xs ${
                  selectedMemberId
                    ? "bg-[#592eff] text-white border-[#592eff] shadow-sm shadow-[#592eff]/30"
                    : "bg-white border-[#e0e0db] hover:border-[#592eff]/40 text-[#21164c]"
                }`}
                title="Basculez facilement d'un compte à un autre pour gérer leurs campagnes"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span className="max-w-[110px] sm:max-w-[140px] truncate">
                  {activeMember ? activeMember.name : "Mon compte"}
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
              </button>

              {switcherOpen && (
                <div
                  className="absolute right-0 mt-2 w-72 bg-white border border-[#e0e0db] rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  onMouseLeave={() => setSwitcherOpen(false)}
                >
                  <div className="p-2.5 border-b border-[#e0e0db]/60 mb-1">
                    <p className="text-xs font-bold text-[#21164c]">Bascule de compte (Équipe)</p>
                    <p className="text-[11px] text-[#5f5f69]">Gérez les campagnes et prospects d'un collaborateur</p>
                  </div>

                  {/* Option Moi */}
                  <button
                    onClick={() => {
                      setSelectedMemberId(null);
                      setSwitcherOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      !selectedMemberId ? "bg-[#592eff]/10 text-[#592eff] font-bold" : "hover:bg-[#f8f9fc] text-[#21164c]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#592eff] text-white flex items-center justify-center text-[10px] font-bold">
                        Moi
                      </div>
                      <span className="truncate">Mon compte personnel</span>
                    </div>
                    {!selectedMemberId && <Check className="w-3.5 h-3.5 text-[#592eff]" />}
                  </button>

                  {/* Liste des autres membres */}
                  <div className="max-h-48 overflow-y-auto mt-1 space-y-0.5">
                    {teamMembers
                      .filter((m) => m.id !== user.id)
                      .map((m) => {
                        const isSelected = selectedMemberId === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              setSelectedMemberId(m.id);
                              setSwitcherOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected ? "bg-[#592eff]/10 text-[#592eff] font-bold" : "hover:bg-[#f8f9fc] text-[#21164c]"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <img
                                src={
                                  m.avatarUrl ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || m.email)}&background=21164c&color=fff`
                                }
                                alt={m.name}
                                className="w-6 h-6 rounded-full object-cover shrink-0"
                              />
                              <div className="text-left truncate">
                                <p className="font-semibold text-[11px] truncate">{m.name || m.email}</p>
                                <p className="text-[10px] text-[#5f5f69]">
                                  {m.accounts?.[0]?.status === "CONNECTED" ? "🟢 LinkedIn actif" : "⚪ Non relié"}
                                </p>
                              </div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#592eff]" />}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Pill & Profile Dropdown */}
          <div className="relative">
            <div
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-full border border-[#e0e0db] hover:border-[#592eff]/40 bg-white cursor-pointer transition-all hover:shadow-sm"
            >
            <img
              src={
                user.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  user.name || user.email
                )}&background=592eff&color=fff`
              }
              alt={user.name || user.email}
              className="w-8 h-8 rounded-full object-cover border border-[#592eff]/20"
            />
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-[#21164c] line-clamp-1">{user.name || user.email}</p>
              <p className="text-[10px] text-[#5f5f69] flex items-center gap-1 font-medium">
                {user.role}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#5f5f69]" />
          </div>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-64 bg-white border border-[#e0e0db] rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              onMouseLeave={() => setDropdownOpen(false)}
            >
              <div className="p-3 border-b border-[#e0e0db]/60 mb-1">
                <p className="text-sm font-bold text-[#21164c]">{user.name || "Utilisateur"}</p>
                <p className="text-xs text-[#5f5f69] truncate">{user.email}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] bg-[#f5f5f7] px-2.5 py-1 rounded-lg">
                  <span className="text-[#5f5f69]">Quota Quotidien :</span>
                  <span className="font-bold text-[#592eff]">
                    {user.maxDailyInvites} inv / {user.maxDailyMsg} msg
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenProfile();
                }}
                className="w-full text-left px-3 py-2 text-sm text-[#353241] hover:bg-[#f5f5f7] rounded-xl flex items-center gap-2 transition-colors font-medium cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-[#592eff]" /> Mon Profil & Sécurité
              </button>

              {isSuperAdmin && (
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate("/admin/users");
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-[#353241] hover:bg-[#f5f5f7] rounded-xl flex items-center gap-2 transition-colors font-medium cursor-pointer"
                >
                  <Users className="w-4 h-4 text-[#2ed6ff]" /> Gérer les Utilisateurs
                </button>
              )}

              <div className="border-t border-[#e0e0db]/60 my-1"></div>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 transition-colors font-medium"
              >
                <LogOut className="w-4 h-4" /> Se Déconnecter
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </header>
  );
};
