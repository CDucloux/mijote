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
 * Un **rebond par inertie** est aussi joué quand un lancer (fling) arrive au bas
 * par sa seule vitesse résiduelle (sans doigt) : on suit la vélocité via l'événement
 * `scroll` et on déclenche un rebond proportionnel à l'impact.
 *
 * @param options - Réglages.
 * @param options.max - Décalage maximal en pixels (défaut 64 — discret).
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
export function useElasticScroll({ max = 64, disabled = false }: { max?: number; disabled?: boolean } = {}) {
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
    let bounce: Animation | null = null; // rebond d'inertie en cours (Web Animations API)
    // Promotion de couche GPU : on l'active pendant un geste/animation pour éviter le
    // « lag » de première frame (le navigateur crée sa couche composite en amont), puis
    // on la relâche au repos pour ne pas gaspiller de mémoire.
    const lift = (on: boolean): void => { inner.style.willChange = on ? "transform" : ""; };
    const apply = (spring: boolean): void => {
      // Ressort de retour long et « posé » (décélération très douce) : plus aucun
      // retour abrupt. gpu-composited.
      inner.style.transition = spring ? "transform 0.95s cubic-bezier(0.16,0.82,0.24,1)" : "none";
      inner.style.transform = pull ? `translate3d(0,${pull.toFixed(2)}px,0)` : "";
    };
    // Rebond joué par la seule inertie (fling) : montée douce jusqu'au pic puis
    // retour ressort encore plus lent → aucune cassure de rythme.
    const playBounce = (amp: number): void => {
      bounce?.cancel();
      lift(true);
      inner.style.transition = "none";
      inner.style.transform = "";
      bounce = inner.animate(
        [
          { transform: "translate3d(0,0,0)", easing: "cubic-bezier(0.17,0.84,0.44,1)" }, // impact → pic (décélère)
          { transform: `translate3d(0,${(-amp).toFixed(1)}px,0)`, offset: 0.28, easing: "cubic-bezier(0.16,0.82,0.24,1)" }, // pic → repos (posé)
          { transform: "translate3d(0,0,0)" },
        ],
        { duration: 980 },
      );
      bounce.onfinish = bounce.oncancel = (): void => { inner.style.transform = ""; lift(false); bounce = null; };
    };
    // Relâche la couche GPU une fois le ressort de retour terminé.
    const onEnd = (): void => { if (!pull) lift(false); };
    inner.addEventListener("transitionend", onEnd);
    const onDown = (e: TouchEvent): void => { bounce?.cancel(); lift(true); dragging = true; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; axis = null; mode = null; pull = 0; };
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
      if (mode === "bottom") { pull = 0; apply(true); } // le ressort → transitionend relâchera la couche
      else lift(false);                                 // pas d'anim : on relâche tout de suite
      axis = null; mode = null;
    };

    // ── Suivi de vélocité pour le rebond d'inertie ───────────────────────────
    // Le fling après le doigt est géré nativement par le navigateur (pas de
    // touchmove) : on lit la vitesse via `scroll` et, à l'instant où l'inertie
    // percute le bas, on rejoue un rebond proportionnel à cette vitesse.
    let lastY = el.scrollTop, lastT = performance.now(), vy = 0;
    const onScroll = (): void => {
      const now = performance.now(), y = el.scrollTop, dt = now - lastT;
      if (dt > 0) vy = (y - lastY) / dt; // px/ms, > 0 = vers le bas
      lastY = y; lastT = now;
      // Filtres BON MARCHÉ d'abord (aucune lecture de layout) : ce n'est qu'une fois
      // la vitesse résiduelle suffisante que l'on paie `scrollable()`/`atBottom()`,
      // pour ne pas forcer un reflow à chaque frame de défilement (source de lag).
      if (dragging || pull || bounce || vy <= 0.35) return;
      if (!scrollable() || !atBottom()) return;
      playBounce(Math.min(max, vy * 22));
    };

    el.addEventListener("touchstart", onDown, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onUp, { passive: true });
    el.addEventListener("touchcancel", onUp, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onDown);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onUp);
      el.removeEventListener("touchcancel", onUp);
      el.removeEventListener("scroll", onScroll);
      inner.removeEventListener("transitionend", onEnd);
      bounce?.cancel();
    };
  }, [max, disabled]);

  return { scrollRef, contentRef };
}
