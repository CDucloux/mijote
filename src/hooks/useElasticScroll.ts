import { useEffect, useRef } from "react";

/**
 * Overscroll vertical « rubber band » au BAS d'un conteneur scrollable : arrivé en
 * bas, continuer à tirer décale le contenu vers le haut avec une résistance
 * croissante, puis revient en ressort au relâcher. Volontairement borné au bas — le
 * haut est réservé au pull-to-refresh global (sinon conflit). Écrit directement dans
 * le DOM (transform sur `contentRef`), listeners natifs (touchmove non passif pour
 * `preventDefault` au bord). Neutre en `prefers-reduced-motion`.
 *
 * Physique fidèle au rubber-band iOS/WebKit : `b = (c·x·d) / (d + c·x)` où `x` est
 * la distance tirée, `d` la hauteur du conteneur et `c = 0.55`. Le contenu suit
 * ~55 % du doigt au départ puis résiste de plus en plus (asymptote = hauteur du
 * conteneur), ce qui donne le vrai « poids » élastique natif. Borné à `max`.
 *
 * @param options - Réglages.
 * @param options.max - Décalage maximal en pixels (défaut 90).
 * @param options.disabled - Désactive l'effet (ex. desktop).
 * @returns `scrollRef` (conteneur `overflow-y`) et `contentRef` (enfant transformé,
 *   englobant tout le contenu défilable).
 *
 * @example
 * ```tsx
 * const { scrollRef, contentRef } = useElasticScroll({ disabled: isDesktop });
 * return <div ref={scrollRef} style={{ overflowY: "auto" }}><div ref={contentRef}>…</div></div>;
 * ```
 */
export function useElasticScroll({ max = 90, disabled = false }: { max?: number; disabled?: boolean } = {}) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current, inner = contentRef.current;
    if (!el || !inner || disabled) return;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const C = 0.55; // constante de rubber-band iOS/WebKit
    // Résistance élastique authentique, bornée à `max` pour rester discret.
    const rubber = (x: number, dim: number): number => Math.min((C * x * dim) / (dim + C * x), max);
    const scrollable = (): boolean => el.scrollHeight > el.clientHeight + 1;
    const atBottom = (): boolean => el.scrollTop >= el.scrollHeight - el.clientHeight - 1;

    let dragging = false, y0 = 0, x0 = 0, axis: "x" | "y" | null = null, mode: "bottom" | "scroll" | null = null, pull = 0;
    const apply = (spring: boolean): void => {
      // Ressort de retour légèrement plus long et « posé » (courbe iOS), gpu-composited.
      inner.style.transition = spring ? "transform 0.55s cubic-bezier(0.22,1,0.36,1)" : "none";
      inner.style.transform = pull ? `translate3d(0,${pull.toFixed(2)}px,0)` : "";
    };
    const onDown = (e: TouchEvent): void => { dragging = true; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; axis = null; mode = null; pull = 0; };
    const onMove = (e: TouchEvent): void => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
      if (!axis) { if (Math.abs(dx) > 8 || Math.abs(dy) > 8) axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
      if (axis !== "y") return;
      // On n'arme l'élastique que si on est déjà tout en bas et qu'on tire encore vers le haut.
      if (!mode) mode = scrollable() && atBottom() && dy < -2 ? "bottom" : "scroll";
      if (mode !== "bottom") return;
      // On n'étire QUE vers le haut ; inverser le geste relâche proprement (pull=0)
      // sans jamais nourrir `rubber` d'une valeur négative (pas d'emballement).
      pull = dy < 0 ? -rubber(-dy, el.clientHeight) : 0;
      apply(false);
      if (pull && e.cancelable) e.preventDefault();
    };
    const onUp = (): void => {
      if (!dragging) return;
      dragging = false;
      if (mode === "bottom") { pull = 0; apply(true); }
      axis = null; mode = null;
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
