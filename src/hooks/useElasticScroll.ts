import { useEffect, useRef } from "react";

/**
 * Overscroll vertical « stretch » (rubber band) au BAS d'un conteneur scrollable :
 * arrivé en bas, continuer à tirer décale légèrement le contenu vers le haut puis
 * revient en ressort. Volontairement borné au bas — le haut est réservé au
 * pull-to-refresh global (sinon conflit). Écrit directement dans le DOM (transform
 * sur `contentRef`), listeners natifs (touchmove non passif pour `preventDefault`
 * au bord). Neutre en `prefers-reduced-motion`.
 *
 * @param options - Réglages.
 * @param options.max - Décalage maximal en pixels (défaut 48 — volontairement discret).
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
export function useElasticScroll({ max = 48, disabled = false }: { max?: number; disabled?: boolean } = {}) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current, inner = contentRef.current;
    if (!el || !inner || disabled) return;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const damp = (d: number, m: number): number => m * (1 - Math.exp(-d / m)); // résistance croissante
    const scrollable = (): boolean => el.scrollHeight > el.clientHeight + 1;
    const atBottom = (): boolean => el.scrollTop >= el.scrollHeight - el.clientHeight - 1;

    let dragging = false, y0 = 0, x0 = 0, axis: "x" | "y" | null = null, mode: "bottom" | "scroll" | null = null, pull = 0;
    const apply = (spring: boolean): void => {
      inner.style.transition = spring ? "transform 0.5s cubic-bezier(0.16,1,0.3,1)" : "none";
      inner.style.transform = pull ? `translateY(${pull.toFixed(2)}px)` : "";
    };
    const onDown = (e: TouchEvent): void => { dragging = true; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; axis = null; mode = null; pull = 0; };
    const onMove = (e: TouchEvent): void => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
      if (!axis) { if (Math.abs(dx) > 8 || Math.abs(dy) > 8) axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
      if (axis !== "y") return;
      // On n'arme l'élastique que si on est déjà tout en bas et qu'on tire encore vers le haut.
      if (!mode) mode = scrollable() && atBottom() && dy < -5 ? "bottom" : "scroll";
      if (mode === "bottom") { pull = -damp(-dy, max); apply(false); if (e.cancelable) e.preventDefault(); }
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
