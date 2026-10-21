import { Icon } from "../ui/Icon.jsx";
import { sortOption, dirLabel, type SortDir, type SortKey } from "@/lib/recipes/recipeSort.js";

interface LibraryToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  nActiveFilters: number;
  onOpenFilters: () => void;
  sortBy: SortKey;
  sortDir: SortDir;
  /** Critère de tri suivant (et son sens naturel). */
  onCycleSort: () => void;
  onToggleSortDir: () => void;
  /** Nombre de résultats affiché ; masqué si null (bibliothèque vide). */
  resultCount: number | null;
}

/** Recherche, filtres et tri de la bibliothèque. */
export function LibraryToolbar({ search, onSearch, nActiveFilters, onOpenFilters, sortBy, sortDir, onCycleSort, onToggleSortDir, resultCount }: LibraryToolbarProps) {
  const dir = dirLabel(sortBy, sortDir);
  return (
    <>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}><Icon name="search" size={17} color="var(--text3)" /></span>
        <input className="field-input recipe-search" placeholder="Rechercher un plat, un chef, un ingrédient…" value={search} onChange={e => onSearch(e.target.value)}
          enterKeyHint="search"
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
          style={{ paddingLeft: 44, paddingRight: search ? 40 : 16 }} />
        {search && <button onClick={() => onSearch("")} aria-label="Effacer la recherche" className="search-clear-btn" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}><Icon name="close" size={13} /></button>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button className="toolbar-pill ripple" data-active={nActiveFilters > 0 ? "1" : undefined} onClick={onOpenFilters} title="Filtrer">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          Filtres
          {nActiveFilters > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{nActiveFilters}</span>}
        </button>
        {/* Pilule + flèche accolées : la pilule passe au critère suivant, la flèche inverse le sens. */}
        <div className="sort-control">
          <button className="toolbar-pill sort-cycle ripple" onClick={onCycleSort} title="Changer le critère de tri">
            <Icon name="updown" size={15} color="currentColor" />
            <span style={{ color: "var(--text3)", fontWeight: 500 }}>Trié par :</span>
            <strong style={{ fontWeight: 600 }}>{sortOption(sortBy).label}</strong>
          </button>
          <button className="toolbar-pill sort-dir ripple" onClick={onToggleSortDir} aria-label={`Sens : ${dir}`} title={`Sens : ${dir} (inverser)`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transition: "transform 0.2s ease", transform: sortDir === "asc" ? "rotate(180deg)" : "none" }}>
              <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {resultCount !== null && (
          <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--text3)", whiteSpace: "nowrap", flexShrink: 0 }}>{resultCount} recette{resultCount > 1 ? "s" : ""}</span>
        )}
      </div>
    </>
  );
}
