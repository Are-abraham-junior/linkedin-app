import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { Building2, Globe, Check, ChevronDown, Shield, Search } from "lucide-react";

interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  _count?: {
    users?: number;
  };
}

export const WorkspaceSwitcher: React.FC = () => {
  const { user, impersonatedOrg, setImpersonatedOrg } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  // Charger la liste des organisations si Super Admin
  useEffect(() => {
    let isMounted = true;
    if (isSuperAdmin) {
      setIsLoading(true);
      apiRequest<{ organizations: OrganizationItem[] }>("/admin/organizations")
        .then((res) => {
          if (isMounted && res.success && Array.isArray(res.organizations)) {
            setOrganizations(res.organizations);
          }
        })
        .catch((err) => {
          console.error("Erreur chargement organisations pour switcher:", err);
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    } else if (user?.organization) {
      setOrganizations([user.organization as OrganizationItem]);
    }

    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin, user?.organization?.id]);

  // Fermer le dropdown lors d'un clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Déterminer le libellé et l'initiale de l'espace actuel
  const currentSpaceName = isSuperAdmin
    ? impersonatedOrg
      ? impersonatedOrg.name
      : "Hub Global"
    : user?.organization?.name || "Mon Espace";

  const currentInitial = isSuperAdmin && !impersonatedOrg ? "🌐" : currentSpaceName.charAt(0).toUpperCase();

  const handleSelectGlobalHub = () => {
    setImpersonatedOrg(null);
    setIsOpen(false);
    navigate("/admin");
  };

  const handleSelectOrg = (org: OrganizationItem) => {
    setImpersonatedOrg({
      id: org.id,
      name: org.name,
      slug: org.slug,
    });
    setIsOpen(false);
    navigate("/dashboard");
  };

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton sélecteur dans le Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border transition-all cursor-pointer select-none text-xs font-semibold ${
          isOpen
            ? "border-[#592eff] bg-white shadow-md shadow-[#592eff]/10 ring-2 ring-[#592eff]/20"
            : "border-[#e0e0db] bg-white hover:border-[#592eff]/50 hover:bg-[#fafafc] shadow-xs"
        }`}
        title="Changer d'espace de travail"
      >
        {/* Pastille Logo / Initiale */}
        <div
          className={`w-6 h-6 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
            isSuperAdmin && !impersonatedOrg
              ? "bg-[#592eff] text-white shadow-xs"
              : "bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20"
          }`}
        >
          {currentInitial}
        </div>

        {/* Nom de l'espace */}
        <div className="text-left flex flex-col">
          <span className="text-[#21164c] font-bold truncate max-w-[120px] sm:max-w-[160px] leading-tight">
            {currentSpaceName}
          </span>
          {isSuperAdmin && (
            <span className="text-[10px] text-[#5f5f69] font-medium leading-none">
              {impersonatedOrg ? "Supervision 360°" : "Plateforme Super Admin"}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-[#5f5f69] transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-[#592eff]" : ""
          }`}
        />
      </button>

      {/* Menu déroulant CHANGER D'ESPACE */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white border border-[#e0e0db] rounded-3xl shadow-2xl p-2.5 z-[100] animate-modal-pop">
          {/* Header du popup */}
          <div className="px-3 py-2 flex items-center justify-between border-b border-[#e0e0db]/60 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#5f5f69]">
              Changer d'espace
            </span>
            {isSuperAdmin && (
              <span className="text-[10px] font-bold text-[#592eff] bg-[#592eff]/10 px-2 py-0.5 rounded-full">
                {organizations.length} {organizations.length > 1 ? "espaces" : "espace"}
              </span>
            )}
          </div>

          {/* Option 1 pour le Super Admin : Vue Hub Global */}
          {isSuperAdmin && (
            <>
              <button
                type="button"
                onClick={handleSelectGlobalHub}
                className={`w-full text-left px-3 py-2.5 rounded-2xl text-xs flex items-center justify-between transition-all cursor-pointer mb-1 ${
                  !impersonatedOrg
                    ? "bg-[#592eff]/10 text-[#592eff] font-bold border border-[#592eff]/20"
                    : "hover:bg-[#f8f9fc] text-[#21164c]"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#592eff] to-[#7c3aed] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#592eff]/25">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-xs text-[#21164c] truncate">🌐 Hub Global Plateforme</p>
                    <p className="text-[10px] text-[#5f5f69] truncate">Vue macro supervision & organisations</p>
                  </div>
                </div>
                {!impersonatedOrg && (
                  <div className="w-5 h-5 rounded-full bg-[#592eff] text-white flex items-center justify-center shrink-0 ml-2">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </button>

              <div className="border-t border-[#e0e0db]/60 my-1.5 mx-1" />
            </>
          )}

          {/* Champ de recherche si plusieurs organisations */}
          {organizations.length > 4 && (
            <div className="relative mb-2 px-1">
              <Search className="w-3.5 h-3.5 text-[#5f5f69] absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Rechercher un espace..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#f8f9fc] border border-[#e0e0db] rounded-xl focus:outline-none focus:border-[#592eff] focus:bg-white text-[#21164c] placeholder:text-[#5f5f69]/60"
              />
            </div>
          )}

          {/* Liste des organisations */}
          <div className="max-h-60 overflow-y-auto space-y-1 px-0.5">
            {isLoading ? (
              <div className="py-6 text-center text-xs text-[#5f5f69] flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[#592eff] border-t-transparent rounded-full animate-spin" />
                <span>Chargement des espaces...</span>
              </div>
            ) : filteredOrgs.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#5f5f69]">
                Aucun espace trouvé
              </div>
            ) : (
              filteredOrgs.map((org, index) => {
                const isSelected = impersonatedOrg?.id === org.id;
                const avatarColors = [
                  "bg-violet-100 text-violet-700 border-violet-200",
                  "bg-sky-100 text-sky-700 border-sky-200",
                  "bg-emerald-100 text-emerald-700 border-emerald-200",
                  "bg-amber-100 text-amber-700 border-amber-200",
                  "bg-rose-100 text-rose-700 border-rose-200",
                ];
                const colorClass = avatarColors[index % avatarColors.length];

                return (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => handleSelectOrg(org)}
                    className={`w-full text-left px-3 py-2.5 rounded-2xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#592eff]/10 text-[#592eff] font-bold border border-[#592eff]/20"
                        : "hover:bg-[#f8f9fc] text-[#21164c] border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border ${colorClass}`}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate text-left">
                        <p className="font-bold text-xs text-[#21164c] truncate">{org.name}</p>
                        <p className="text-[10px] text-[#5f5f69] truncate flex items-center gap-1.5">
                          <span>{isSuperAdmin ? "Supervision 360°" : "Membre"}</span>
                          {org._count?.users !== undefined && (
                            <>
                              <span>•</span>
                              <span>{org._count.users} {org._count.users > 1 ? "membres" : "membre"}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#592eff] text-white flex items-center justify-center shrink-0 ml-2">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
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
