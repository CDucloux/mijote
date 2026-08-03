import { useEffect, useRef } from "react";

/**
 * Overscroll horizontal « stretch » : effet élastique commun sur mobile (WhatsApp,
 * Maps…). Quand une rangée scrollable horizontalement atteint son début/sa fin et
 * qu'on continue de tirer, le contenu se décale légèrement puis revient en ressort.
 * Écrit directement dans le DOM (transform sur `contentRef`), listeners natifs
 * (touchmove non passif pour `preventDefault` au bord).
 *
 * @param options - Réglages.
 * @param options.max - Décalage maximal en pixels (défaut 72).
 * @param options.disabled - Désactive l'effet.
 * @returns `scrollRef` (conteneur `overflow-x`) et `contentRef` (enfant transformé,
 *   idéalement `min-width: 100%`).
 */
export function useHorizontalOverscroll({ max = 72, disabled = false }: { max?: number; disabled?: boolean } = {}) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current, inner = contentRef.current;
    if (!el || !inner || disabled) return;

    const damp = (d: number, m: number): number => m * (1 - Math.exp(-d / m)); // résistance croissante
    // Pas d'effet si la rangée tient sans déborder (rien à « sur-défiler »).
    const scrollable = (): boolean => el.scrollWidth > el.clientWidth + 1;
    const atStart = (): boolean => el.scrollLeft <= 0;
    const atEnd = (): boolean => el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;

    let dragging = false, x0 = 0, y0 = 0, axis: "x" | "y" | null = null, edge: "start" | "end" | "scroll" | null = null, pull = 0;
    const apply = (spring: boolean): void => {
      inner.style.transition = spring ? "transform 0.5s cubic-bezier(0.16,1,0.3,1)" : "none";
      inner.style.transform = pull ? `translateX(${pull.toFixed(2)}px)` : "";
    };
    const onDown = (e: TouchEvent): void => { dragging = true; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; axis = null; edge = null; pull = 0; };
    const onMove = (e: TouchEvent): void => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      if (!axis) { if (Math.abs(dx) > 8 || Math.abs(dy) > 8) axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
      if (axis !== "x") return;
      if (!edge) edge = scrollable() && atStart() && dx > 0 ? "start" : scrollable() && atEnd() && dx < 0 ? "end" : "scroll";
      if (edge === "start") { pull = damp(dx, max); apply(false); if (e.cancelable) e.preventDefault(); }
      else if (edge === "end") { pull = -damp(-dx, max); apply(false); if (e.cancelable) e.preventDefault(); }
    };
    const onUp = (): void => {
      if (!dragging) return;
      dragging = false;
      if (edge === "start" || edge === "end") { pull = 0; apply(true); }
      axis = null; edge = null;
    };

    el.addEventListener("touchstart", onDown, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onUp, { passive: true });
    el.addEventListener("touchcancel", onUp, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onDown);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onUp);
      el.removeEventListener("touchcancel", onUp);
    };
  }, [max, disabled]);

  return { scrollRef, contentRef };
}
