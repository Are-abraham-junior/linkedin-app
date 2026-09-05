import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import {
  Menu,
  Users,
  ArrowRightLeft,
  ChevronDown,
  Check,
  Shield,
  Building2,
  Plus,
  Bell,
  Sparkles,
} from "lucide-react";

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  onOpenProfile,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    selectedMemberId,
    setSelectedMemberId,
    impersonatedOrg,
    openLinkedInModal,
  } = useAuth();

  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [memberSwitcherOpen, setMemberSwitcherOpen] = useState(false);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  // Charger les membres de l'équipe pour la bascule de compte collaborateur
  useEffect(() => {
    let isMounted = true;
    if (user?.orgRole === "OWNER" || isSuperAdmin) {
      apiRequest<{ members: any[] }>("/team/members")
        .then((res) => {
          if (isMounted && res.success && Array.isArray(res.members)) {
            setTeamMembers(res.members);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.orgRole, impersonatedOrg]);

  // Déterminer le titre de la vue active
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/admin") return "Hub Plateforme";
    if (path.startsWith("/admin/users")) return "Gestion des Utilisateurs";
    if (path.startsWith("/dashboard")) return "Tableau de bord";
    if (path.startsWith("/prospects")) return "Contacts & Prospects";
    if (path.startsWith("/campaigns")) return "Campagnes";
    if (path.startsWith("/inbox")) return "Messagerie";
    if (path.startsWith("/team")) return "Équipe & Collaborateurs";
    return "Tableau de bord";
  };

  const activeMember = teamMembers.find((m) => m.id === selectedMemberId);
  const canSwitchAccounts =
    (user?.orgRole === "OWNER" || isSuperAdmin) && teamMembers.length > 0;

  return (
    <header className="h-16 bg-white/90 backdrop-blur-md border-b border-[#e0e0db] px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-40 shrink-0">
      {/* Partie Gauche : Hamburger (Mobile) + Titre de page + Badge Supervision */}
      <div className="flex items-center gap-3 truncate">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-[#5f5f69] hover:text-[#592eff] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
          title="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 truncate">
          <h1 className="text-base sm:text-lg font-extrabold text-[#21164c] tracking-tight truncate">
            {getPageTitle()}
          </h1>

          {/* Badge discret si le Super Admin est en supervision d'espace */}
          {isSuperAdmin && impersonatedOrg && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20 text-[11px] font-bold">
              <Shield className="w-3 h-3" />
              <span className="truncate">{impersonatedOrg.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Partie Droite : Bascule Collaborateur + WorkspaceSwitcher + LinkedIn + CTA */}
      <div className="flex items-center gap-2.5 sm:gap-3">

        {/* Sélecteur de Collaborateur (Vue 360° / Multi-comptes équipe) */}
        {canSwitchAccounts && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMemberSwitcherOpen(!memberSwitcherOpen)}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                selectedMemberId
                  ? "bg-[#592eff] text-white border-[#592eff] shadow-xs shadow-[#592eff]/30"
                  : "bg-white border-[#e0e0db] hover:border-[#592eff]/40 text-[#21164c]"
              }`}
              title="Filtrer les données par collaborateur"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span className="max-w-[100px] truncate">
                {activeMember ? activeMember.name || activeMember.email : "Toute l'équipe"}
              </span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  memberSwitcherOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {memberSwitcherOpen && (
              <div
                className="absolute right-0 mt-2 w-64 bg-white border border-[#e0e0db] rounded-3xl shadow-2xl p-2 z-50 animate-modal-pop"
                onMouseLeave={() => setMemberSwitcherOpen(false)}
              >
                <div className="p-2 border-b border-[#e0e0db]/60 mb-1">
                  <p className="text-xs font-bold text-[#21164c]">Filtre Collaborateur</p>
                  <p className="text-[10px] text-[#5f5f69]">Visualisez les actions d'un membre précis</p>
                </div>

                {/* Option Tous / Global */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMemberId(null);
                    setMemberSwitcherOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    !selectedMemberId
                      ? "bg-[#592eff]/10 text-[#592eff] font-bold"
                      : "hover:bg-[#f8f9fc] text-[#21164c]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#592eff] text-white flex items-center justify-center text-[10px] font-bold">
                      🌟
                    </div>
                    <span className="truncate">Toute l'équipe (Vue consolidée)</span>
                  </div>
                  {!selectedMemberId && <Check className="w-3.5 h-3.5 text-[#592eff]" />}
                </button>

                {/* Liste des collaborateurs */}
                <div className="max-h-48 overflow-y-auto mt-1 space-y-0.5">
                  {teamMembers.map((m) => {
                    const isSelected = selectedMemberId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMemberId(m.id);
                          setMemberSwitcherOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#592eff]/10 text-[#592eff] font-bold"
                            : "hover:bg-[#f8f9fc] text-[#21164c]"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <img
                            src={
                              m.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                m.name || m.email
                              )}&background=21164c&color=fff`
                            }
                            alt={m.name}
                            className="w-5 h-5 rounded-full object-cover shrink-0"
                          />
                          <span className="truncate font-medium">{m.name || m.email}</span>
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

        {/* Bouton CHANGER D'ESPACE (Workspace Switcher) */}
        <WorkspaceSwitcher />

        {/* Bouton Rapide d'Action Contextuelle */}
        {!user?.hasLinkedInAccount && !isSuperAdmin ? (
          <button
            type="button"
            onClick={openLinkedInModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#0077b5] hover:bg-[#005f93] text-white font-bold text-xs rounded-2xl shadow-sm transition-all cursor-pointer shrink-0"
          >
            <span>Lier LinkedIn</span>
          </button>
        ) : null}
      </div>
    </header>
  );
};
