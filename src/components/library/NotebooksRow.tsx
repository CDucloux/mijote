import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "../ui/Icon.jsx";
import { OverscrollRow } from "../ui/OverscrollRow.jsx";
import { NotebookCover } from "./NotebookCover.jsx";
import { spawnRipple } from "@/lib/ui/ripple.js";
import { DEFAULT_NOTEBOOK_COLOR, DEFAULT_NOTEBOOK_ICON } from "@/lib/recipes/notebooks.js";
import type { Notebook } from "@/lib/types.js";
import type { useLongPress } from "../../hooks/useLongPress.js";

type LongPress = ReturnType<typeof useLongPress>;

interface NotebooksRowProps {
  notebooks: Notebook[];
  countOf: (notebook: Notebook) => number;
  isActive: (notebook: Notebook) => boolean;
  hidden: boolean;
  onToggleHidden: () => void;
  onOpen: (notebook: Notebook) => void;
  onMenu: (notebook: Notebook) => void;
  onCreate: () => void;
  onReorder: (fromId: string, toId: string) => void;
  longPress: LongPress;
}

// Onde tactile sur une carte carnet : la face est opaque, l'onde est donc posée sur
// un calque dédié PLACÉ AU-DESSUS du contenu (`.carnet-ripple`), sinon elle resterait
// masquée derrière la page lignée. Tactile uniquement (le desktop garde son survol).
function rippleNotebook(e: ReactPointerEvent<HTMLElement>): void {
  if (e.pointerType === "mouse") return;
  const host = e.currentTarget.querySelector<HTMLElement>(".carnet-ripple");
  if (host) spawnRipple({ currentTarget: host, clientX: e.clientX, clientY: e.clientY });
}

const rippleLayer = <span className="carnet-ripple" aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: 14, overflow: "hidden", pointerEvents: "none", zIndex: 5 }} />;

/**
 * Section « Carnets » de la bibliothèque : titre masquable, rangée de carnets
 * (ouverture au tap, menu à l'appui long ou au clic droit, réordonnancement par
 * glisser-déposer sur desktop) et carte « Nouveau ».
 */
export function NotebooksRow({ notebooks, countOf, isActive, hidden, onToggleHidden, onOpen, onMenu, onCreate, onReorder, longPress }: NotebooksRowProps) {
  const { startLongPress, cancelLongPress, moveLongPress, wasLongPress } = longPress;
  const [dragId, setDragId] = useState<string | null>(null);
  const eyeLabel = hidden ? "Afficher les carnets" : "Masquer les carnets";

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Carnets</h2>
        <button onClick={onToggleHidden} title={eyeLabel} aria-label={eyeLabel} className="pressable hover-neutral" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", background: "transparent", border: "none", color: "var(--text3)", cursor: "pointer" }}>
          <Icon name={hidden ? "eyeOff" : "eye"} size={16} color="var(--text3)" />
        </button>
        {!hidden && notebooks.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text3)" }}>Appui long pour gérer</span>}
      </div>
      {!hidden && (
        <OverscrollRow stretch className="collections-row" style={{ gap: 14, padding: "7px 3px 8px" }}>
          {notebooks.map((nb) => {
            const active = isActive(nb);
            const count = countOf(nb);
            const color = nb.color || DEFAULT_NOTEBOOK_COLOR;
            return (
              <button key={nb.id} className="notebook-card" data-active={active ? "1" : undefined}
                onClick={() => { if (wasLongPress()) return; onOpen(nb); }}
                onPointerDown={(e) => { rippleNotebook(e); startLongPress(e, () => onMenu(nb)); }} onPointerMove={moveLongPress} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress} onPointerCancel={cancelLongPress}
                onContextMenu={(e) => { e.preventDefault(); onMenu(nb); }}
                draggable
                onDragStart={() => { cancelLongPress(); setDragId(nb.id); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (dragId && dragId !== nb.id) onReorder(dragId, nb.id); setDragId(null); }}
                onDragEnd={() => setDragId(null)}
                title="Glisser pour réordonner"
                style={{ flexShrink: 0, width: 134, padding: 0, border: "none", background: "transparent", cursor: "grab", borderRadius: 14, opacity: dragId === nb.id ? 0.4 : 1 }}>
                <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: active ? `0 0 0 2px ${color}` : "none" }}>
                  <NotebookCover color={color} icon={nb.icon || DEFAULT_NOTEBOOK_ICON}>
                    <div style={{ position: "absolute", top: 8, right: 8, minWidth: 22, height: 22, borderRadius: 11, background: count ? color : "var(--surface3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: count ? "#fff" : "var(--text3)", padding: "0 6px", boxShadow: count ? `0 2px 6px -1px ${color}99` : "none" }}>{count}</div>
                  </NotebookCover>
                  <div style={{ padding: "9px 11px 11px", background: "var(--surface)", borderTop: `1px solid ${color}22` }}>
                    <div style={{ fontFamily: "var(--ff-display)", fontSize: 15, fontWeight: 700, textAlign: "left", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>{nb.name}</div>
                    <div style={{ fontSize: 11, color: count ? "var(--text2)" : "var(--text3)", textAlign: "left", marginTop: 1 }}>{count === 0 ? "Vide" : `${count} recette${count > 1 ? "s" : ""}`}</div>
                  </div>
                  {rippleLayer}
                </div>
              </button>
            );
          })}
          <button className="notebook-card notebook-card-add" onClick={onCreate} onPointerDown={rippleNotebook} style={{ flexShrink: 0, width: 134, padding: 0, border: "none", background: "transparent", cursor: "pointer", borderRadius: 14 }}>
            <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", border: "2px dashed var(--border)" }}>
              <div style={{ position: "relative", aspectRatio: "1/1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text3)" }}>
                <span className="notebook-add-plus" style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={20} color="currentColor" /></span>
              </div>
              <div style={{ padding: "9px 11px 11px", background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
                <div style={{ fontFamily: "var(--ff-display)", fontSize: 15, fontWeight: 700, textAlign: "left", letterSpacing: "-0.01em", color: "var(--text2)" }}>Nouveau</div>
                <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "left", marginTop: 1 }}>Créer un carnet</div>
              </div>
              {rippleLayer}
            </div>
          </button>
        </OverscrollRow>
      )}
    </div>
  );
}
