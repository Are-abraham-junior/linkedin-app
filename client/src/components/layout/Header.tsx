import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import { WorkspaceAvatar } from "../common/WorkspaceAvatar";
import { apiRequest } from "../../services/api";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { EnrichmentTokensChip } from "./EnrichmentTokensChip";
import { Menu, ArrowRightLeft, ChevronDown, Check } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { useOnClickOutside } from "../ui/hooks";

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenProfile: () => void;
}

const TITLES: Array<[string, string]> = [
  ["/admin/users", "Utilisateurs"],
  ["/admin/settings", "Paramètres plateforme"],
  ["/admin", "Hub plateforme"],
  ["/bleadin-ia", "Bleadin IA"],
  ["/dashboard", "Tableau de bord"],
  ["/prospects", "Contacts & Prospects"],
  ["/campaigns", "Campagnes"],
  ["/inbox", "Messagerie"],
  ["/team", "Équipe & Rôles"],
  ["/reports", "Rapports"],
  ["/settings", "Paramètres"],
];

export const popoverClass = "modal-in absolute right-0 mt-2 rounded-xl border border-line bg-surface p-1.5 shadow-pop";
export const popoverRowClass = (selected: boolean) =>
  clsx(
    "flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-sm transition-colors",
    selected ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
  );

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const location = useLocation();
  const { user, selectedMemberId, setSelectedMemberId, impersonatedOrg } = useAuth();

  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [memberSwitcherOpen, setMemberSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(switcherRef, () => setMemberSwitcherOpen(false), memberSwitcherOpen);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    let isMounted = true;
    if (user?.orgRole === "OWNER" || isSuperAdmin) {
      apiRequest<{ members: any[] }>("/team/members")
        .then((res) => {
          if (isMounted && res.success && Array.isArray(res.members)) setTeamMembers(res.members);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.orgRole, impersonatedOrg]);

  const pageTitle = TITLES.find(([p]) => location.pathname === p || location.pathname.startsWith(p + "/"))?.[1] ?? "Bleadin";

  const activeMember = teamMembers.find((m) => m.id === selectedMemberId);
  const canSwitchAccounts = (user?.orgRole === "OWNER" || isSuperAdmin) && teamMembers.length > 0;

  const pick = (id: string | null) => {
    setSelectedMemberId(id);
    setMemberSwitcherOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <IconButton label="Ouvrir le menu" icon={Menu} size="md" onClick={onOpenMobileMenu} className="-ml-2 lg:hidden" />
        <h1 className="truncate text-base font-semibold text-ink">{pageTitle}</h1>
        {isSuperAdmin && impersonatedOrg && (
          <Badge tone="accent" className="hidden sm:inline-flex">
            <WorkspaceAvatar
              name={impersonatedOrg.name}
              avatarUrl={user?.organization?.avatarUrl || impersonatedOrg.avatarUrl}
              className="h-4 w-4 rounded"
              textClassName="text-[9px]"
            />
            <span className="max-w-[160px] truncate">{impersonatedOrg.name}</span>
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {canSwitchAccounts && (
          <div className="relative hidden sm:block" ref={switcherRef}>
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowRightLeft}
              iconRight={ChevronDown}
              onClick={() => setMemberSwitcherOpen((v) => !v)}
              aria-expanded={memberSwitcherOpen}
              aria-haspopup="listbox"
              title="Filtrer les données par collaborateur"
              className={clsx(selectedMemberId && "border-ink")}
            >
              <span className="max-w-[120px] truncate font-medium">
                {activeMember ? activeMember.name || activeMember.email : "Toute l'équipe"}
              </span>
            </Button>

            {memberSwitcherOpen && (
              <div className={clsx(popoverClass, "w-64")} role="listbox">
                <p className="px-2.5 pb-1.5 pt-1 text-xs text-muted">Afficher les données de</p>
                <button type="button" role="option" aria-selected={!selectedMemberId} onClick={() => pick(null)} className={popoverRowClass(!selectedMemberId)}>
                  <span className="truncate">Toute l'équipe</span>
                  {!selectedMemberId && <Check className="h-4 w-4 text-accent" strokeWidth={1.75} />}
                </button>
                <div className="mt-1 max-h-56 space-y-0.5 overflow-y-auto border-t border-line pt-1">
                  {teamMembers.map((m) => {
                    const isSelected = selectedMemberId === m.id;
                    return (
                      <button key={m.id} type="button" role="option" aria-selected={isSelected} onClick={() => pick(m.id)} className={popoverRowClass(isSelected)}>
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar name={m.name || m.email} src={m.avatarUrl} size="xs" />
                          <span className="truncate">{m.name || m.email}</span>
                        </span>
                        {isSelected && <Check className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <EnrichmentTokensChip />
        <WorkspaceSwitcher />
      </div>
    </header>
  );
};
