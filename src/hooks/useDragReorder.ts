import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { dropTargetIndex, edgeScrollSpeed, type DragRow } from "@/lib/ui/dragReorder.js";

/**
 * Glisser-déposer de réordonnancement en **événements pointeur**, donc opérationnel au
 * DOIGT : l'API HTML5 (`draggable` + `dataTransfer`) n'émet rien sur mobile, où aucun
 * `dragstart` n'est synthétisé à partir d'un toucher.
 *
 * Le geste part d'une poignée dédiée (`touch-action: none` pour que le navigateur ne
 * le confonde pas avec un défilement) ; la ligne saisie suit le doigt via un
 * `transform` écrit DIRECTEMENT dans le DOM, sans repasser par React : un rendu par
 * frame sur une carte d'étape (vignettes, pastilles) saccaderait sur mobile. Seuls le
 * début/la fin du geste et les changements de ligne visée touchent l'état React.
 *
 * @param options - Réglages du geste.
 * @param options.index - Index de la ligne dans la liste complète.
 * @param options.enabled - Active le glisser (faux sur desktop, qui a des flèches).
 * @param options.onMove - Applique le déplacement `(from, to)` au relâcher.
 * @param options.onTargetChange - Ligne actuellement visée (`null` hors glisser),
 *   remontée au parent pour qu'il la mette en surbrillance.
 * @returns `rowProps` à poser sur la ligne, `handleProps` sur la poignée, et
 *   `dragging` (cette ligne est en cours de glisser).
 */
export interface DragReorderOptions {
  index: number;
  enabled?: boolean;
  onMove: (from: number, to: number) => void;
  onTargetChange?: (index: number | null) => void;
}

export interface DragReorderApi {
  dragging: boolean;
  rowProps: { ref: RefObject<HTMLDivElement | null>; "data-drag-index": number };
  handleProps: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
    "data-drag-handle": string;
    style: CSSProperties;
  };
}

/** Retour visuel commun aux lignes réordonnables : la ligne saisie se soulève. */
export const LIFTED_ROW_STYLE: CSSProperties = {
  position: "relative",
  zIndex: 40,
  boxShadow: "0 16px 34px -14px rgba(0,0,0,0.45)",
  cursor: "grabbing",
};

/** Session de glisser en cours. Hors état React : aucun rendu par frame. */
interface DragSession {
  pointerId: number;
  startY: number;
  pointerY: number;
  startScrollTop: number;
  scroller: HTMLElement | null;
  target: number;
  raf: number;
}

/** Premier ancêtre défilant verticalement (le panneau de l'onglet, ici). */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflowY = getComputedStyle(p).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return p;
  }
  return null;
}

/**
 * Bandes de MISE EN PAGE des lignes sœurs. La ligne glissée porte un `translateY`
 * qu'on retranche pour lui rendre sa place d'origine : sans cela elle se viserait
 * elle-même en permanence, et survoler son propre emplacement déclencherait un
 * déplacement parasite vers la ligne voisine.
 */
function measureRows(row: HTMLElement, selfIndex: number, selfShift: number): DragRow[] {
  const parent = row.parentElement;
  if (!parent) return [];
  const rows: DragRow[] = [];
  for (const child of Array.from(parent.children)) {
    const raw = (child as HTMLElement).dataset?.dragIndex;
    if (raw === undefined) continue;
    const index = Number(raw);
    const rect = child.getBoundingClientRect();
    const shift = index === selfIndex ? selfShift : 0;
    rows.push({ index, top: rect.top - shift, bottom: rect.bottom - shift });
  }
  return rows;
}

export function useDragReorder({ index, enabled = true, onMove, onTargetChange }: DragReorderOptions): DragReorderApi {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const session = useRef<DragSession | null>(null);
  const [dragging, setDragging] = useState(false);

  // Décalage de la ligne depuis la prise : le doigt, corrigé du défilement survenu
  // depuis (auto-défilement compris) pour qu'elle reste exactement sous lui.
  const shift = (s: DragSession): number => s.pointerY - s.startY + ((s.scroller?.scrollTop ?? 0) - s.startScrollTop);

  const paint = (): void => {
    const s = session.current, row = rowRef.current;
    if (s && row) row.style.transform = `translateY(${shift(s).toFixed(1)}px)`;
  };

  const retarget = (): void => {
    const s = session.current, row = rowRef.current;
    if (!s || !row) return;
    const next = dropTargetIndex(measureRows(row, index, shift(s)), s.pointerY, index);
    if (next !== s.target) { s.target = next; onTargetChange?.(next); }
  };

  // Auto-défilement quand le doigt atteint un bord du panneau, sinon on ne pourrait
  // pas déplacer un item au-delà de la partie visible.
  const tick = (): void => {
    const s = session.current;
    if (!s) return;
    if (s.scroller) {
      const rect = s.scroller.getBoundingClientRect();
      const speed = edgeScrollSpeed(s.pointerY, rect.top, rect.bottom);
      if (speed !== 0) {
        const before = s.scroller.scrollTop;
        s.scroller.scrollTop = before + speed;
        if (s.scroller.scrollTop !== before) { paint(); retarget(); }
      }
    }
    s.raf = requestAnimationFrame(tick);
  };

  const stop = (commit: boolean): void => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    cancelAnimationFrame(s.raf);
    // Le transform a été posé hors React : c'est donc à nous de le retirer.
    if (rowRef.current) rowRef.current.style.transform = "";
    setDragging(false);
    onTargetChange?.(null);
    if (commit && s.target !== index) onMove(index, s.target);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>): void => {
    if (!enabled || session.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const row = rowRef.current;
    if (!row) return;
    e.preventDefault();  // pas de sélection de texte ni de clic fantôme
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* capture indisponible */ }
    const scroller = scrollParent(row);
    const s: DragSession = {
      pointerId: e.pointerId, startY: e.clientY, pointerY: e.clientY,
      startScrollTop: scroller?.scrollTop ?? 0, scroller, target: index, raf: 0,
    };
    session.current = s;
    setDragging(true);
    onTargetChange?.(index);
    s.raf = requestAnimationFrame(tick);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>): void => {
    const s = session.current;
    if (!s || e.pointerId !== s.pointerId) return;
    s.pointerY = e.clientY;
    paint();
    retarget();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>): void => {
    if (session.current?.pointerId === e.pointerId) stop(true);
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLElement>): void => {
    if (session.current?.pointerId === e.pointerId) stop(false);
  };

  // Démontage en plein geste (sauvegarde, changement d'onglet) : on coupe la boucle.
  useEffect(() => () => {
    const s = session.current;
    if (s) { cancelAnimationFrame(s.raf); session.current = null; }
  }, []);

  return {
    dragging,
    rowProps: { ref: rowRef, "data-drag-index": index },
    handleProps: {
      onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
      "data-drag-handle": "",
      style: { touchAction: "none", cursor: dragging ? "grabbing" : "grab" },
    },
  };
}
