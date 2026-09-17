import React, { useState, useMemo, useRef } from "react";
import clsx from "clsx";
import { Plus, Search, ChevronLeft, ChevronRight, MoreHorizontal, Edit2, Trash2, Users, ShieldAlert } from "lucide-react";
import { Input, Select } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Tooltip } from "../ui/Tooltip";
import { useOnClickOutside } from "../ui/hooks";
import { popoverClass } from "../layout/Header";

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

const rowClass = (selected: boolean) =>
  clsx(
    "flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
    selected ? "bg-accent-soft font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
  );

const Count: React.FC<{ value: number }> = ({ value }) => <span className="shrink-0 tabular-nums text-xs text-muted">{value}</span>;

/** Volet des listes : navigation à gauche du tableau, pastille de couleur par liste. */
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
  const menuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(menuRef, () => setMenuOpenListId(null), Boolean(menuOpenListId));

  const filteredLists = useMemo(() => {
    const result = lists.filter((l) => l.name.toLowerCase().includes(searchTerm.toLowerCase().trim()));
    if (sortBy === "ALPHA") result.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "COUNT") result.sort((a, b) => (b.prospectsCount || 0) - (a.prospectsCount || 0));
    else result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return result;
  }, [lists, searchTerm, sortBy]);

  const colorDot = (color?: string, size = "h-2.5 w-2.5") => (
    <span className={clsx("shrink-0 rounded-full", size)} style={{ backgroundColor: color || "#592eff" }} aria-hidden />
  );

  if (isCollapsed) {
    return (
      <aside className="flex h-full min-h-0 w-12 shrink-0 select-none flex-col items-center gap-1 rounded-2xl border border-line bg-surface py-2">
        <IconButton label="Déplier les listes" icon={ChevronRight} onClick={onToggleCollapse} />
        <IconButton label="Créer une liste" icon={Plus} onClick={onCreateList} />
        <div className="my-1 h-px w-6 bg-line" />
        <Tooltip label={`Tous les prospects (${totalProspects})`}>
          <IconButton label="Tous les prospects" icon={Users} active={selectedListId === "ALL"} onClick={() => onSelectList("ALL")} />
        </Tooltip>
        <div className="custom-scrollbar flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto py-1">
          {lists.map((l) => (
            <Tooltip key={l.id} label={`${l.name} (${l.prospectsCount || 0})`}>
              <button
                type="button"
                onClick={() => onSelectList(l.id)}
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  selectedListId === l.id ? "bg-accent-soft" : "hover:bg-surface-2",
                )}
                aria-label={l.name}
              >
                {colorDot(l.color, "h-3 w-3")}
              </button>
            </Tooltip>
          ))}
        </div>
        <div className="mt-auto border-t border-line pt-1">
          <Tooltip label={`Ne pas contacter (${doNotContactCount})`}>
            <IconButton label="Ne pas contacter" icon={ShieldAlert} active={selectedListId === "DO_NOT_CONTACT"} onClick={() => onSelectList("DO_NOT_CONTACT")} />
          </Tooltip>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 w-[260px] shrink-0 select-none flex-col rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2 pb-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          Listes <Count value={lists.length} />
        </h2>
        <div className="flex items-center gap-0.5">
          <IconButton label="Créer une liste" icon={Plus} onClick={onCreateList} />
          <IconButton label="Replier les listes" icon={ChevronLeft} onClick={onToggleCollapse} />
        </div>
      </div>

      <div className="space-y-2">
        <Input size="sm" leftIcon={Search} placeholder="Rechercher une liste…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <Select size="sm" aria-label="Trier par" value={sortBy} onChange={(e: any) => setSortBy(e.target.value)}>
          <option value="RECENT">Créées récemment</option>
          <option value="ALPHA">Nom (A–Z)</option>
          <option value="COUNT">Nombre de prospects</option>
        </Select>
      </div>

      <nav className="custom-scrollbar mt-3 min-h-0 flex-1 space-y-0.5 overflow-y-auto" aria-label="Listes">
        <button type="button" onClick={() => onSelectList("ALL")} className={rowClass(selectedListId === "ALL")} aria-current={selectedListId === "ALL" ? "true" : undefined}>
          <span className="flex min-w-0 items-center gap-2.5">
            <Users className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
            <span className="truncate">Tous les prospects</span>
          </span>
          <Count value={totalProspects} />
        </button>

        <div className="my-1.5 h-px bg-line" />

        {filteredLists.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">Aucune liste</p>
        ) : (
          filteredLists.map((l) => {
            const isSelected = selectedListId === l.id;
            const isMenuOpen = menuOpenListId === l.id;
            return (
              <div key={l.id} className="group relative" ref={isMenuOpen ? menuRef : undefined}>
                <button type="button" onClick={() => onSelectList(l.id)} className={clsx(rowClass(isSelected), "pr-8")} aria-current={isSelected ? "true" : undefined}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">{colorDot(l.color)}</span>
                    <span className="truncate" title={l.name}>
                      {l.name}
                    </span>
                  </span>
                  <Count value={l.prospectsCount || 0} />
                </button>
                <IconButton
                  label="Options de la liste"
                  icon={MoreHorizontal}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenListId(isMenuOpen ? null : l.id);
                  }}
                  className={clsx("absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 opacity-0 focus-visible:opacity-100 group-hover:opacity-100", isMenuOpen && "opacity-100")}
                />
                {isMenuOpen && (
                  <div className={clsx(popoverClass, "right-1 z-40 w-40")} role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenListId(null);
                        onRenameList(l);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-ink hover:bg-surface-2"
                    >
                      <Edit2 className="h-4 w-4 text-muted" strokeWidth={1.75} /> Renommer
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenListId(null);
                        onDeleteList(l.id);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-danger hover:bg-danger-soft"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} /> Supprimer
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </nav>

      <div className="mt-2 border-t border-line pt-2">
        <button
          type="button"
          onClick={() => onSelectList("DO_NOT_CONTACT")}
          className={rowClass(selectedListId === "DO_NOT_CONTACT")}
          aria-current={selectedListId === "DO_NOT_CONTACT" ? "true" : undefined}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <ShieldAlert className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
            <span className="truncate">Ne pas contacter</span>
          </span>
          <Count value={doNotContactCount} />
        </button>
      </div>
    </aside>
  );
};
