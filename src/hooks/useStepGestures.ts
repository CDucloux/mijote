import { useRef, useEffect, type DependencyList, type RefObject } from "react";

/**
 * Gestes tactiles sur le contenu d'une étape du cook mode :
 *   - swipe horizontal → étape suivante / précédente (`onNext` / `onPrev`) ;
 *   - rubber band vertical en haut ET en bas (le contenu se soulève/descend
 *     élastiquement puis revient en ressort).
 * Listeners natifs (touchmove non passif) : indispensable pour `preventDefault()`
 * pendant l'élastique. Renvoie les deux refs à poser sur le conteneur scrollable
 * (`stepScrollRef`) et sur le contenu animé (`stepElasticRef`).
 *
 * @param active - Faux quand un overlay masque l'étape (sous-recette, écran de fin,
 *   feuille d'itération) : les listeners ne sont alors pas attachés.
 * @param onNext - Passe à l'étape suivante.
 * @param onPrev - Revient à l'étape précédente.
 * @param deps - Dépendances de rebind (index d'étape, total, etc.).
 */
export function useStepGestures(
  active: boolean,
  onNext: () => void,
  onPrev: () => void,
  deps: DependencyList,
): { stepScrollRef: RefObject<HTMLDivElement | null>; stepElasticRef: RefObject<HTMLDivElement | null> } {
  const stepScrollRef = useRef<HTMLDivElement | null>(null);
  const stepElasticRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = stepScrollRef.current;
    if (!el || !active) return;
    // Amplitude plus contenue (max 56 px) et ressort plus posé.
    const MAX_PULL = 56;
    const damp = (d: number, max: number): number => max * (1 - Math.exp(-d / max));
    const atTop = (): boolean => el.scrollTop <= 0;
    const atBottom = (): boolean => el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
    let dragging = false, x0 = 0, y0 = 0, pull = 0, raf = 0;
    let axis: "x" | "y" | null = null;
    let edge: "top" | "bottom" | "scroll" | null = null;
    // Écriture du transform batchée à la frame (évite les écritures multiples par
    // frame pendant le drag → moins de « lag »).
    const flush = (): void => { raf = 0; const p = stepElasticRef.current; if (p) p.style.transform = pull ? `translateY(${pull.toFixed(2)}px)` : ""; };
    const scheduleFlush = (): void => { if (!raf) raf = requestAnimationFrame(flush); };
    const setPull = (v: number): void => { pull = v; scheduleFlush(); };
    const springBack = (): void => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      pull = 0;
      const p = stepElasticRef.current; if (!p) return;
      p.style.transition = "transform 0.8s cubic-bezier(0.22,1,0.3,1)";
      p.style.transform = "translateY(0px)";
      // Retire la couche GPU une fois le ressort terminé (rendu texte net au repos).
      const clear = (): void => { p.style.willChange = ""; p.removeEventListener("transitionend", clear); };
      p.addEventListener("transitionend", clear);
    };
    const onDown = (e: TouchEvent): void => {
      dragging = true; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; axis = null; edge = null; pull = 0;
      // `will-change` posé UNIQUEMENT le temps du drag : une couche GPU permanente
      // sur ce conteneur dégradait le rendu du texte (chiffres « qui bavent »).
      const p = stepElasticRef.current; if (p) { p.style.transition = "none"; p.style.willChange = "transform"; }
    };
    const onMove = (e: TouchEvent): void => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      if (!axis) { if (Math.abs(dx) > 8 || Math.abs(dy) > 8) axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
      if (axis !== "y") return;
      if (!edge) edge = atTop() && dy > 0 ? "top" : atBottom() && dy < 0 ? "bottom" : "scroll";
      if (edge === "top") { setPull(damp(dy, MAX_PULL)); if (e.cancelable) e.preventDefault(); }
      else if (edge === "bottom") { setPull(-damp(-dy, MAX_PULL)); if (e.cancelable) e.preventDefault(); }
    };
    const onUp = (e: TouchEvent): void => {
      if (!dragging) return;
      dragging = false;
      if (axis === "x") {
        const dx = e.changedTouches[0].clientX - x0;
        if (dx < -50) onNext();
        else if (dx > 50) onPrev();
      }
      if (edge === "top" || edge === "bottom") springBack();
      else { const p = stepElasticRef.current; if (p) p.style.willChange = ""; } // pas de ressort → on retire la couche GPU tout de suite
      axis = null; edge = null;
    };
    el.addEventListener("touchstart", onDown, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onUp, { passive: true });
    el.addEventListener("touchcancel", onUp, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("touchstart", onDown);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onUp);
      el.removeEventListener("touchcancel", onUp);
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { stepScrollRef, stepElasticRef };
}
