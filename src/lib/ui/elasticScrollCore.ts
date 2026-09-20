import { trackFlingPeak, bounceImpact } from "@/lib/ui/flingVelocity.js";
import { canArmBottomStretch } from "@/lib/ui/elasticStretch.js";

/**
 * Coeur DOM (sans React) de l'overscroll vertical « stretch » du bas : arrivé en
 * butée basse, tirer vers le haut ÉTIRE le contenu (scaleY ancré au bas, le dernier
 * élément reste fixe, ceux au-dessus s'espacent), piloté au doigt, puis retour en
 * ressort ; un rebond d'inertie est joué quand un fling franchit la butée par sa
 * seule vélocité. Partagé par `useElasticScroll` (React) et `installGlobalElasticScroll`
 * (délégation globale) pour n'avoir qu'UNE implémentation de la machine à gestes.
 *
 * @module ui/elasticScrollCore
 */

/** Constante de rubber-band iOS/WebKit (suivi volontairement discret). */
export const RUBBER_C = 0.32;

/**
 * Résistance élastique authentique `b = (c·x·d) / (d + c·x)`, bornée à `max`.
 *
 * @param x - Distance tirée au-delà de la butée (px, positif).
 * @param dim - Hauteur du conteneur (px), qui règle la raideur.
 * @param max - Décalage maximal restitué (px).
 * @returns Le décalage élastique résisté, dans `[0, max]`.
 */
export function rubberBand(x: number, dim: number, max: number): number {
  if (x <= 0 || dim <= 0) return 0;
  return Math.min((RUBBER_C * x * dim) / (dim + RUBBER_C * x), max);
}

/**
 * Convertit un tirage (px) en facteur d'ÉTIREMENT vertical (scaleY), plafonné à ~5 %
 * pour rester subtil. Le contenu ne « monte » pas : il s'expanse dans le sens du geste.
 *
 * @param px - Décalage élastique courant (px, signe indifférent).
 * @param clientHeight - Hauteur visible du conteneur (px).
 * @returns Le facteur `scaleY` (≥ 1).
 */
export function stretchFactor(px: number, clientHeight: number): number {
  if (clientHeight <= 0) return 1;
  return 1 + Math.min(0.025, Math.abs(px) / (clientHeight * 2));
}

/** Réglages de l'étirement élastique. */
export interface ElasticScrollOptions {
  /** Décalage maximal en pixels (défaut 38, volontairement subtil). */
  max?: number;
  /** Armer l'étirement sur un geste vers le haut même quand rien ne défile (page courte). */
  armWhenUnscrollable?: boolean;
}

/**
 * Attache l'overscroll « stretch » à un conteneur défilant et son enfant transformé.
 * Écrit directement dans le DOM (transform sur `contentEl`), listeners natifs
 * (touchmove non passif pour `preventDefault` au bord, scroll passif pour l'inertie).
 * Neutre en `prefers-reduced-motion` (retourne alors un nettoyage vide sans rien
 * attacher). La résistance suit le rubber-band iOS ; l'inertie déclenche un rebond bref.
 *
 * @param scrollEl - Le conteneur `overflow-y` défilable.
 * @param contentEl - L'enfant transformé, englobant tout le contenu défilable.
 * @param options - Réglages (`max`, `armWhenUnscrollable`).
 * @returns Fonction de détachement (retrait des listeners, annulation d'anim en cours).
 */
export function attachElasticScroll(
  scrollEl: HTMLElement,
  contentEl: HTMLElement,
  { max = 38, armWhenUnscrollable = false }: ElasticScrollOptions = {},
): () => void {
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const el = scrollEl, inner = contentEl;

  const rubber = (x: number, dim: number): number => rubberBand(x, dim, max);
  const scrollable = (): boolean => el.scrollHeight > el.clientHeight + 1;
  const atBottom = (): boolean => el.scrollTop >= el.scrollHeight - el.clientHeight - 1;

  // `rawOver` = distance brute tirée AU-DELÀ de la butée basse (px, >= 0), accumulée au
  // fil du geste ; `pull` = son rendu résisté (rubber-band, <= 0). On garde une distance
  // brute plutôt qu'un simple `dy` pour pouvoir engager l'étirement même quand la butée
  // est atteinte EN COURS de geste (le doigt a d'abord fait défiler, puis pousse au-delà).
  let dragging = false, y0 = 0, x0 = 0, prevY = 0, axis: "x" | "y" | null = null, rawOver = 0, pull = 0;
  let bounce: Animation | null = null; // rebond d'inertie en cours (Web Animations API)
  // Promotion de couche GPU : activée pendant un geste/animation pour éviter le « lag »
  // de première frame, relâchée au repos pour ne pas gaspiller de mémoire.
  const lift = (on: boolean): void => { inner.style.willChange = on ? "transform" : ""; };
  const stretch = (px: number): number => stretchFactor(px, el.clientHeight);
  const apply = (spring: boolean): void => {
    inner.style.transition = spring ? "transform 0.9s cubic-bezier(0.16,0.82,0.24,1)" : "none";
    if (!pull) { inner.style.transform = inner.style.transform ? "scaleY(1)" : ""; return; } // garde l'origine → ressort sans re-ancrage
    inner.style.transformOrigin = "center bottom";
    inner.style.transform = `scaleY(${stretch(pull).toFixed(4)})`;
  };
  const playBounce = (amp: number): void => {
    bounce?.cancel();
    lift(true);
    inner.style.transition = "none";
    inner.style.transformOrigin = "center bottom";
    inner.style.transform = "scaleY(1)";
    bounce = inner.animate(
      [
        { transform: "scaleY(1)", easing: "cubic-bezier(0.17,0.84,0.44,1)" },
        { transform: `scaleY(${stretch(amp).toFixed(4)})`, offset: 0.28, easing: "cubic-bezier(0.16,0.82,0.24,1)" },
        { transform: "scaleY(1)" },
      ],
      { duration: 900 },
    );
    bounce.onfinish = bounce.oncancel = (): void => { inner.style.transform = "scaleY(1)"; lift(false); bounce = null; };
  };
  const onEnd = (): void => { if (!pull) lift(false); };
  inner.addEventListener("transitionend", onEnd);
  // Le `touchmove` non passif n'est attaché QUE le temps d'un geste (touchstart →
  // touchend) : entre deux gestes et pendant l'inertie (fling), le conteneur défile sur
  // le thread compositeur, sans la taxe du listener non passif. C'est ce qui rend le
  // scroll nettement moins saccadé, tout en gardant l'overscroll piloté au doigt.
  let moveAttached = false;
  const addMove = (): void => { if (!moveAttached) { el.addEventListener("touchmove", onMove, { passive: false }); moveAttached = true; } };
  const removeMove = (): void => { if (moveAttached) { el.removeEventListener("touchmove", onMove); moveAttached = false; } };
  const onDown = (e: TouchEvent): void => {
    if ((e.target as HTMLElement | null)?.closest?.("[data-drag-handle]")) { dragging = false; return; }
    bounce?.cancel();
    dragging = true; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; prevY = y0; axis = null; rawOver = 0; pull = 0;
    addMove();
  };
  const onMove = (e: TouchEvent): void => {
    if (!dragging) return;
    const ty = e.touches[0].clientY, tx = e.touches[0].clientX;
    if (!axis) { const dy = ty - y0, dx = tx - x0; if (Math.abs(dx) > 8 || Math.abs(dy) > 8) axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
    if (axis !== "y") { prevY = ty; return; }
    // Incrément vertical du doigt depuis le dernier `move` : > 0 = le doigt monte (le
    // contenu voudrait défiler vers le bas).
    const step = prevY - ty;
    prevY = ty;
    // On accumule l'overscroll dès qu'on est en butée basse (armée) et que le doigt
    // pousse encore vers le haut ; on continue tant que `rawOver > 0`, y compris quand la
    // butée a été atteinte APRÈS un défilement. Un retour du doigt vers le bas la résorbe
    // et rend la main au défilement natif.
    if (rawOver > 0 || (step > 0 && canArmBottomStretch(scrollable(), atBottom(), armWhenUnscrollable))) {
      rawOver = Math.max(0, rawOver + step);
      pull = rawOver > 0 ? -rubber(rawOver, el.clientHeight) : 0;
      if (pull) { lift(true); apply(false); if (e.cancelable) e.preventDefault(); }
      else apply(false); // overscroll résorbé : on relâche, le défilement natif reprend
    }
  };
  const onUp = (): void => {
    if (!dragging) return;
    dragging = false;
    if (pull) { rawOver = 0; pull = 0; apply(true); } else lift(false);
    axis = null; rawOver = 0;
    removeMove();
  };

  // Suivi de vélocité pour le rebond d'inertie : le fling après le doigt est géré
  // nativement (pas de touchmove) ; on lit la vitesse via `scroll` et on retient un PIC
  // amorti de la vitesse d'approche, puis on joue le rebond au franchissement de butée.
  const FLING_MIN = 0.3;
  let lastY = el.scrollTop, lastT = performance.now(), peak = 0, wasBottom = false;
  const onScroll = (): void => {
    const now = performance.now(), y = el.scrollTop, dt = now - lastT;
    peak = trackFlingPeak(peak, dt > 0 ? (y - lastY) / dt : 0);
    lastY = y; lastT = now;
    if (dragging || pull || bounce || peak <= FLING_MIN) { wasBottom = false; return; }
    const nowBottom = scrollable() && atBottom();
    if (nowBottom && !wasBottom) playBounce(bounceImpact(peak, max));
    wasBottom = nowBottom;
  };

  el.addEventListener("touchstart", onDown, { passive: true });
  el.addEventListener("touchend", onUp, { passive: true });
  el.addEventListener("touchcancel", onUp, { passive: true });
  el.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    el.removeEventListener("touchstart", onDown);
    removeMove();
    el.removeEventListener("touchend", onUp);
    el.removeEventListener("touchcancel", onUp);
    el.removeEventListener("scroll", onScroll);
    inner.removeEventListener("transitionend", onEnd);
    bounce?.cancel();
  };
}
