import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { Globe, Check, ChevronDown, Search } from "lucide-react";
import { WorkspaceAvatar } from "../common/WorkspaceAvatar";
import { Input } from "../ui/Field";
import { Spinner } from "../ui/Button";
import { useOnClickOutside } from "../ui/hooks";
import { popoverClass, popoverRowClass } from "./Header";

interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  avatarUrl?: string | null;
  _count?: { users?: number };
}

export const WorkspaceSwitcher: React.FC = () => {
  const { user, impersonatedOrg, setImpersonatedOrg } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    let isMounted = true;
    if (isSuperAdmin) {
      setIsLoading(true);
      apiRequest<{ organizations: OrganizationItem[] }>("/admin/organizations")
        .then((res) => {
          if (isMounted && res.success && Array.isArray(res.organizations)) setOrganizations(res.organizations);
        })
        .catch((err) => console.error("Erreur chargement organisations pour switcher:", err))
        .finally(() => isMounted && setIsLoading(false));
    } else if (user?.organization) {
      setOrganizations([user.organization as OrganizationItem]);
    }
    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin, user?.organization?.id]);

  const currentSpaceName = isSuperAdmin ? (impersonatedOrg ? impersonatedOrg.name : "Hub global") : user?.organization?.name || "Mon espace";
  const currentAvatar = isSuperAdmin && !impersonatedOrg ? null : user?.organization?.avatarUrl || impersonatedOrg?.avatarUrl || null;

  const handleSelectGlobalHub = () => {
    setImpersonatedOrg(null);
    setIsOpen(false);
    navigate("/admin");
  };

  const handleSelectOrg = (org: OrganizationItem) => {
    setImpersonatedOrg({ id: org.id, name: org.name, slug: org.slug, avatarUrl: org.avatarUrl || null });
    setIsOpen(false);
    navigate("/dashboard");
  };

  const filteredOrgs = organizations.filter((org) => org.name.toLowerCase().includes(searchFilter.toLowerCase()));

  // Un seul espace et pas super admin : simple étiquette, rien à basculer.
  const switchable = isSuperAdmin || organizations.length > 1;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => switchable && setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={clsx(
          "flex h-8 items-center gap-2 rounded-lg border px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          switchable ? "cursor-pointer border-line-2 bg-surface hover:border-ink" : "cursor-default border-transparent",
          isOpen && "border-ink",
        )}
        title={switchable ? "Changer d'espace de travail" : currentSpaceName}
      >
        {isSuperAdmin && !impersonatedOrg ? (
          <span className="flex h-5 w-5 items-center justify-center rounded bg-ink text-white" aria-hidden>
            <Globe className="h-3 w-3" strokeWidth={2} />
          </span>
        ) : (
          <WorkspaceAvatar name={currentSpaceName} avatarUrl={currentAvatar} className="h-5 w-5 rounded" textClassName="text-[9px]" />
        )}
        <span className="max-w-[120px] truncate font-medium text-ink sm:max-w-[180px]">{currentSpaceName}</span>
        {switchable && <ChevronDown className={clsx("h-4 w-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} strokeWidth={1.75} aria-hidden />}
      </button>

      {isOpen && (
        <div className={clsx(popoverClass, "z-[100] w-72 sm:w-80")} role="listbox">
          <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1">
            <span className="text-xs text-muted">Changer d'espace</span>
            {isSuperAdmin && <span className="text-xs tabular-nums text-muted">{organizations.length}</span>}
          </div>

          {isSuperAdmin && (
            <>
              <button type="button" role="option" aria-selected={!impersonatedOrg} onClick={handleSelectGlobalHub} className={clsx(popoverRowClass(!impersonatedOrg), "h-auto py-2")}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink text-white" aria-hidden>
                    <Globe className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">Hub global plateforme</span>
                    <span className="block truncate text-xs text-muted">Toutes les organisations</span>
                  </span>
                </span>
                {!impersonatedOrg && <Check className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />}
              </button>
              <div className="my-1.5 border-t border-line" />
            </>
          )}

          {organizations.length > 4 && (
            <div className="mb-1.5 px-0.5">
              <Input size="sm" leftIcon={Search} value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} placeholder="Rechercher un espace…" autoFocus />
            </div>
          )}

          <div className="max-h-60 space-y-0.5 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted">
                <Spinner className="text-muted" />
                Chargement…
              </div>
            ) : filteredOrgs.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted">Aucun espace trouvé</div>
            ) : (
              filteredOrgs.map((org) => {
                const isSelected = impersonatedOrg?.id === org.id;
                return (
                  <button key={org.id} type="button" role="option" aria-selected={isSelected} onClick={() => handleSelectOrg(org)} className={clsx(popoverRowClass(isSelected), "h-auto py-2")}>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <WorkspaceAvatar name={org.name} avatarUrl={org.avatarUrl} className="h-7 w-7 rounded-md" textClassName="text-[10px]" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{org.name}</span>
                        {org._count?.users !== undefined && (
                          <span className="block truncate text-xs text-muted">
                            {org._count.users} {org._count.users > 1 ? "membres" : "membre"}
                          </span>
                        )}
                      </span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
