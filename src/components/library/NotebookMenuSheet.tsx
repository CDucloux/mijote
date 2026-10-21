import type { CSSProperties } from "react";
import { Icon } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { spawnRipple } from "@/lib/ui/ripple.js";
import { DEFAULT_NOTEBOOK_COLOR, DEFAULT_NOTEBOOK_ICON, isSmartNotebook } from "@/lib/recipes/notebooks.js";
import type { Notebook } from "@/lib/types.js";

interface NotebookMenuSheetProps {
  notebook: Notebook;
  /** Rang du carnet (0 = premier) et nombre total, pour le sélecteur de position. */
  index: number;
  total: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onAdjustFilters: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const stepBtn = (disabled: boolean): CSSProperties => ({ width: 28, height: 28, display: "grid", placeItems: "center", background: "none", border: "none", borderRadius: "50%", cursor: disabled ? "default" : "pointer", color: disabled ? "var(--text3)" : "var(--accent)", opacity: disabled ? 0.4 : 1 });

// Même glyphe que la barre de filtres : distingue « Ajuster les filtres » de « Modifier ».
const slidersIcon = <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" stroke="var(--text2)" strokeWidth="1.9" strokeLinecap="round" /></svg>;

/** Menu d'un carnet (appui long) : position, filtres d'un carnet intelligent, modifier, supprimer. */
export function NotebookMenuSheet({ notebook, index, total, count, onMove, onAdjustFilters, onEdit, onDelete, onClose }: NotebookMenuSheetProps) {
  const smart = isSmartNotebook(notebook);
  const run = (action: () => void) => () => { onClose(); action(); };
  return (
    <SwipeableSheet onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: (notebook.color || DEFAULT_NOTEBOOK_COLOR) + "33", display: "grid", placeItems: "center", fontSize: 26 }}>{notebook.icon || DEFAULT_NOTEBOOK_ICON}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{notebook.name}</div>
          <div style={{ fontSize: 13, color: "var(--text3)" }}>{smart ? "Carnet intelligent" : "Carnet"} - {count} recette{count > 1 ? "s" : ""}</div>
        </div>
      </div>
      <div className="carnet-menu-list">
        {total > 1 && (
          <div className="menu-row" style={{ cursor: "default", paddingTop: 6, paddingBottom: 6 }}>
            <Icon name="updown" size={19} color="var(--text2)" />
            <span style={{ flex: 1 }}>Position</span>
            <div style={{ display: "flex", alignItems: "center", background: "var(--surface2)", borderRadius: 999, padding: "2px 4px", flexShrink: 0 }}>
              <button disabled={index <= 0} onClick={() => onMove(-1)} style={stepBtn(index <= 0)} aria-label="Reculer"><Icon name="back" size={15} color="currentColor" /></button>
              <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 42, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{index + 1} / {total}</span>
              <button disabled={index >= total - 1} onClick={() => onMove(1)} style={stepBtn(index >= total - 1)} aria-label="Avancer"><Icon name="forward" size={15} color="currentColor" /></button>
            </div>
          </div>
        )}
        {smart && (
          <button className="menu-row" onPointerDown={spawnRipple} onClick={run(onAdjustFilters)}>
            {slidersIcon} Ajuster les filtres
          </button>
        )}
        <button className="menu-row" onPointerDown={spawnRipple} onClick={run(onEdit)}>
          <Icon name="edit" size={19} color="var(--text2)" /> Modifier
        </button>
        <button className="menu-row menu-row-danger" onPointerDown={spawnRipple} onClick={run(onDelete)}>
          <Icon name="trash" size={19} color="var(--red)" /> Supprimer le carnet
        </button>
      </div>
    </SwipeableSheet>
  );
}
