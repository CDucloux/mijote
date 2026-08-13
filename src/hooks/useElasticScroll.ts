import { useEffect, useRef } from "react";

/**
 * Overscroll vertical « stretch » au BAS d'un conteneur scrollable : arrivé en bas,
 * continuer à tirer ÉTIRE le contenu (scaleY ancré au bas, le dernier élément reste
 * fixe, ceux au-dessus s'espacent), piloté au doigt, puis revient en ressort au
 * relâcher. Le contenu ne « monte » pas : il s'expanse dans le sens du geste.
 * Volontairement borné au bas, le haut est réservé au pull-to-refresh global (sinon
 * conflit). Écrit directement dans le DOM (transform sur `contentRef`), listeners
 * natifs (touchmove non passif pour `preventDefault` au bord). Neutre en
 * `prefers-reduced-motion`.
 *
 * La RÉSISTANCE du geste suit le rubber-band iOS/WebKit : `b = (c·x·d) / (d + c·x)`
 * (x = distance tirée, d = hauteur du conteneur, c = 0.32), borné à `max` ; cette
 * distance est ensuite convertie en un facteur d'étirement subtil (≤ 5 %).
 *
 * Un **rebond par inertie** est aussi joué quand un lancer (fling) arrive au bas par
 * sa seule vitesse résiduelle (sans doigt) : on suit la vélocité via l'événement
 * `scroll` et on déclenche une brève expansion proportionnelle à l'impact.
 *
 * @param options - Réglages.
 * @param options.max - Décalage maximal en pixels (défaut 38, volontairement subtil).
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
export function useElasticScroll({ max = 38, disabled = false }: { max?: number; disabled?: boolean } = {}) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current, inner = contentRef.current;
    if (!el || !inner || disabled) return;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const C = 0.32; // constante de rubber-band (suivi volontairement discret)
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
    // Conversion d'un tirage (px) en facteur d'ÉTIREMENT (scaleY), plafonné à ~5 %.
    // Le contenu ne « monte » pas : il s'étire, ancré au bas (le dernier élément reste
    // en place, ceux au-dessus s'espacent) → expansion élastique dans le sens du geste.
    const stretch = (px: number): number => 1 + Math.min(0.025, Math.abs(px) / (el.clientHeight * 2));
    const apply = (spring: boolean): void => {
      // Ressort de retour long et « posé » (décélération très douce). gpu-composited.
      inner.style.transition = spring ? "transform 0.9s cubic-bezier(0.16,0.82,0.24,1)" : "none";
      if (!pull) { inner.style.transform = inner.style.transform ? "scaleY(1)" : ""; return; } // garde l'origine → ressort sans re-ancrage
      inner.style.transformOrigin = "center bottom";
      inner.style.transform = `scaleY(${stretch(pull).toFixed(4)})`;
    };
    // Rebond joué par la seule inertie (fling) : brève expansion (scaleY) ancrée au
    // bas puis retour ressort posé, même langage que le geste au doigt.
    const playBounce = (amp: number): void => {
      bounce?.cancel();
      lift(true);
      inner.style.transition = "none";
      inner.style.transformOrigin = "center bottom";
      inner.style.transform = "scaleY(1)";
      bounce = inner.animate(
        [
          { transform: "scaleY(1)", easing: "cubic-bezier(0.17,0.84,0.44,1)" }, // impact → pic (décélère)
          { transform: `scaleY(${stretch(amp).toFixed(4)})`, offset: 0.28, easing: "cubic-bezier(0.16,0.82,0.24,1)" }, // pic → repos (posé)
          { transform: "scaleY(1)" },
        ],
        { duration: 900 },
      );
      bounce.onfinish = bounce.oncancel = (): void => { inner.style.transform = "scaleY(1)"; lift(false); bounce = null; };
    };
    // Relâche la couche GPU une fois le ressort de retour terminé.
    const onEnd = (): void => { if (!pull) lift(false); };
    inner.addEventListener("transitionend", onEnd);
    // IMPORTANT : on ne promeut PAS la couche GPU dès le touchstart, sur une page à
    // beaucoup d'éléments (ex. 55 cartes), `will-change` sur tout le contenu à chaque
    // amorce de scroll rasterise une couche géante et provoque du jank. On ne « lift »
    // qu'au moment où l'élastique s'arme réellement (mode === "bottom").
    // Un geste amorcé sur une poignée de réordonnancement pilote un glisser d'item,
    // pas le défilement : l'élastique ne doit pas s'y superposer (sinon le contenu
    // s'étire sous la ligne qu'on déplace).
    const onDown = (e: TouchEvent): void => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-drag-handle]")) { dragging = false; return; }
      bounce?.cancel(); dragging = true; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; axis = null; mode = null; pull = 0;
    };
    const onMove = (e: TouchEvent): void => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
      if (!axis) { if (Math.abs(dx) > 8 || Math.abs(dy) > 8) axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
      if (axis !== "y") return;
      // On n'arme l'élastique que si on est déjà tout en bas et qu'on tire encore vers le haut.
      if (!mode) { mode = scrollable() && atBottom() && dy < -2 ? "bottom" : "scroll"; if (mode === "bottom") lift(true); }
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
      playBounce(Math.min(max, vy * 13));
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
