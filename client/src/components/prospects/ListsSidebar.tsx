import React, { useState, useMemo, useRef, useEffect } from "react";
import gsap from "gsap";
import {
  Folder,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit2,
  Trash2,
  Users,
  ShieldAlert,
  ArrowUpDown,
  Check,
  FolderOpen,
} from "lucide-react";

interface ListsSidebarProps {
  lists: any[];
  selectedListId: string;
  onSelectList: (id: string) => void;
  totalProspects: number;
  doNotContactCount: number;
  onCreateList: () => void;
  onRenameList: (list: any) => void;
  onDeleteList: (listId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const ListsSidebar: React.FC<ListsSidebarProps> = ({
  lists,
  selectedListId,
  onSelectList,
  totalProspects,
  doNotContactCount,
  onCreateList,
  onRenameList,
  onDeleteList,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"RECENT" | "ALPHA" | "COUNT">("RECENT");
  const [menuOpenListId, setMenuOpenListId] = useState<string | null>(null);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // GSAP animation on collapse/expand toggle
  useEffect(() => {
    if (!sidebarRef.current) return;

    if (isCollapsed) {
      gsap.to(sidebarRef.current, {
        width: 68,
        duration: 0.35,
        ease: "power2.inOut",
      });
      if (contentRef.current) {
        gsap.to(contentRef.current, {
          opacity: 0,
          duration: 0.15,
          ease: "power2.out",
        });
      }
    } else {
      gsap.to(sidebarRef.current, {
        width: 290,
        duration: 0.35,
        ease: "power2.inOut",
      });
      if (contentRef.current) {
        gsap.to(contentRef.current, {
          opacity: 1,
          duration: 0.25,
          delay: 0.1,
          ease: "power2.out",
        });
      }
    }
  }, [isCollapsed]);

  // Filter and sort lists
  const filteredLists = useMemo(() => {
    let result = lists.filter((l) =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );

    if (sortBy === "ALPHA") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "COUNT") {
      result.sort((a, b) => (b.prospectsCount || 0) - (a.prospectsCount || 0));
    } else {
      // RECENT: assume original array or createdAt desc
      result.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    }

    return result;
  }, [lists, searchTerm, sortBy]);

  return (
    <aside
      ref={sidebarRef}
      className={`relative flex flex-col bg-white border border-[#e0e0db] rounded-3xl shadow-sm transition-all duration-75 shrink-0 overflow-visible select-none h-full min-h-0 ${
        isCollapsed ? "w-[64px] p-2" : "w-[270px] p-3.5"
      }`}
    >
      {/* Collapse / Expand Toggle Button (Waalaxy chevron style) */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute -right-3.5 top-7 z-30 w-7 h-7 rounded-full bg-white border border-[#e0e0db] shadow-md flex items-center justify-center text-[#5f5f69] hover:text-[#592eff] hover:scale-110 hover:shadow-lg transition-all"
        title={isCollapsed ? "Déplier le volet des listes" : "Replier le volet"}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* COLLAPSED ICON VIEW */}
      {isCollapsed ? (
        <div className="flex flex-col items-center gap-2 pt-2 h-full min-h-0">
          {/* Create Button Icon */}
          <button
            onClick={onCreateList}
            className="w-10 h-10 rounded-2xl bg-[#592eff] text-white flex items-center justify-center shadow-md shadow-[#592eff]/25 hover:bg-[#4d25e0] transition-transform hover:scale-105 shrink-0"
            title="Créer une liste"
          >
            <Plus className="w-5 h-5" />
          </button>

          <div className="w-8 h-px bg-[#e0e0db] my-1 shrink-0"></div>

          {/* All Prospects Icon */}
          <button
            onClick={() => onSelectList("ALL")}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-bold transition-all relative shrink-0 ${
              selectedListId === "ALL"
                ? "bg-[#592eff]/10 text-[#592eff] border-2 border-[#592eff]"
                : "text-[#5f5f69] hover:bg-[#f8f9fc] border border-transparent"
            }`}
            title={`Tous les prospects (${totalProspects})`}
          >
            <Users className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-[#21164c] text-white text-[9px] font-bold rounded-full">
              {totalProspects}
            </span>
          </button>

          {/* Lists Colored Icons */}
          <div className="flex-1 min-h-0 flex flex-col items-center gap-2 overflow-y-auto py-1 w-full custom-scrollbar">
            {lists.map((l) => {
              const isSelected = selectedListId === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => onSelectList(l.id)}
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all relative ${
                    isSelected
                      ? "ring-2 ring-[#592eff] ring-offset-2 scale-105"
                      : "hover:scale-105 opacity-85 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: `${l.color || "#592eff"}20` }}
                  title={`${l.name} (${l.prospectsCount || 0})`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: l.color || "#592eff" }}
                  />
                  {(l.prospectsCount || 0) > 0 && (
                    <span className="absolute -top-1 -right-1 px-1 bg-[#21164c] text-white text-[9px] font-bold rounded-full">
                      {l.prospectsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Do Not Contact Bottom Icon */}
          <div className="mt-auto pt-2 border-t border-[#e0e0db] w-full flex justify-center">
            <button
              onClick={() => onSelectList("DO_NOT_CONTACT")}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all relative ${
                selectedListId === "DO_NOT_CONTACT"
                  ? "bg-red-50 text-red-600 border-2 border-red-500"
                  : "text-[#8a8a93] hover:text-red-600 hover:bg-red-50/60"
              }`}
              title={`Ne pas contacter (${doNotContactCount})`}
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* EXPANDED FULL WAALAXY VIEW */
        <div ref={contentRef} className="flex flex-col h-full">
          {/* Header with Title and '+ Créer une liste' */}
          <div className="flex items-center justify-between pb-3 border-b border-[#e0e0db]/60">
            <h2 className="text-base font-extrabold text-[#21164c] flex items-center gap-2">
              <span>Listes</span>
              <span className="text-[11px] font-semibold text-[#8a8a93] bg-[#f5f5f7] px-2 py-0.5 rounded-full">
                {lists.length}
              </span>
            </h2>

            <button
              onClick={onCreateList}
              className="px-3 py-1.5 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-[#592eff]/25 hover:shadow-md transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer une liste</span>
            </button>
          </div>

          {/* Search inside lists */}
          <div className="relative mt-3.5 mb-2.5">
            <Search className="w-3.5 h-3.5 text-[#8a8a93] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Recherche..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#e0e0db] bg-[#fcfcfe] text-xs text-[#21164c] placeholder-[#8a8a93] focus:outline-none focus:border-[#592eff] transition-all"
            />
          </div>

          {/* Sort bar */}
          <div className="flex items-center justify-between px-1 mb-2 text-[11px] text-[#8a8a93]">
            <span className="flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" /> Trier par :
            </span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-transparent text-[#21164c] font-semibold focus:outline-none cursor-pointer hover:text-[#592eff]"
            >
              <option value="RECENT">Créé récemment</option>
              <option value="ALPHA">Nom (A-Z)</option>
              <option value="COUNT">Prospects</option>
            </select>
          </div>

          {/* Scrollable list items */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {/* Tous les prospects */}
            <div
              onClick={() => onSelectList("ALL")}
              className={`flex items-center justify-between px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${
                selectedListId === "ALL"
                  ? "bg-[#592eff] text-white shadow-md shadow-[#592eff]/20 font-bold"
                  : "text-[#353241] hover:bg-[#f5f3ff] hover:text-[#592eff]"
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    selectedListId === "ALL"
                      ? "bg-white/20 text-white"
                      : "bg-[#592eff]/10 text-[#592eff]"
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs truncate">Tous les prospects</span>
              </div>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  selectedListId === "ALL"
                    ? "bg-white/25 text-white"
                    : "bg-[#f5f5f7] text-[#5f5f69]"
                }`}
              >
                {totalProspects}
              </span>
            </div>

            {/* Separator */}
            <div className="h-px bg-[#e0e0db]/50 my-1.5 mx-2"></div>

            {/* Custom Lists */}
            {filteredLists.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#8a8a93]">
                Aucune liste trouvée
              </div>
            ) : (
              filteredLists.map((l) => {
                const isSelected = selectedListId === l.id;
                const isMenuOpen = menuOpenListId === l.id;

                return (
                  <div
                    key={l.id}
                    className="relative group"
                    onMouseLeave={() => setMenuOpenListId(null)}
                  >
                    <div
                      onClick={() => onSelectList(l.id)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${
                        isSelected
                          ? "bg-white border-2 border-[#592eff] text-[#21164c] shadow-sm font-bold"
                          : "text-[#353241] hover:bg-[#f8f9fc] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {/* Colored list avatar */}
                        <div
                          className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${l.color || "#592eff"}18`,
                            color: l.color || "#592eff",
                          }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: l.color || "#592eff" }}
                          />
                        </div>
                        <span className="text-xs truncate" title={l.name}>
                          {l.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                            isSelected
                              ? "bg-[#592eff]/10 text-[#592eff]"
                              : "bg-[#f5f5f7] text-[#8a8a93]"
                          }`}
                        >
                          {l.prospectsCount || 0}
                        </span>

                        {/* Quick 3-dots action */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenListId(isMenuOpen ? null : l.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#f5f5f7] rounded-lg text-[#8a8a93] hover:text-[#21164c] transition-opacity"
                          title="Options de la liste"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Context Dropdown */}
                    {isMenuOpen && (
                      <div className="absolute right-2 top-10 z-40 w-36 bg-white rounded-2xl border border-[#e0e0db] shadow-xl p-1.5 animate-in fade-in zoom-in-95">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenListId(null);
                            onRenameList(l);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#21164c] hover:bg-[#592eff]/10 hover:text-[#592eff] transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Renommer
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenListId(null);
                            onDeleteList(l.id);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Do Not Contact Entry (Waalaxy style) */}
          <div className="mt-auto pt-3 border-t border-[#e0e0db]">
            <div
              onClick={() => onSelectList("DO_NOT_CONTACT")}
              className={`flex items-center justify-between px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${
                selectedListId === "DO_NOT_CONTACT"
                  ? "bg-red-50 border border-red-200 text-red-700 font-bold"
                  : "text-[#8a8a93] hover:bg-red-50/50 hover:text-red-600"
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-7 h-7 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs truncate font-semibold">
                  Ne pas contacter
                </span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-red-100/70 text-red-700">
                {doNotContactCount}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
