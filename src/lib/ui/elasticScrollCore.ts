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
 * @module elasticScrollCore
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

  let dragging = false, y0 = 0, x0 = 0, axis: "x" | "y" | null = null, mode: "bottom" | "scroll" | null = null, pull = 0;
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
  // On ne promeut PAS la couche GPU dès le touchstart : sur une page à beaucoup
  // d'éléments, `will-change` sur tout le contenu à chaque amorce rasterise une couche
  // géante et provoque du jank. On ne « lift » qu'à l'armement réel (mode === "bottom").
  const onDown = (e: TouchEvent): void => {
    if ((e.target as HTMLElement | null)?.closest?.("[data-drag-handle]")) { dragging = false; return; }
    bounce?.cancel(); dragging = true; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; axis = null; mode = null; pull = 0;
  };
  const onMove = (e: TouchEvent): void => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
    if (!axis) { if (Math.abs(dx) > 8 || Math.abs(dy) > 8) axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
    if (axis !== "y") return;
    if (!mode) { mode = canArmBottomStretch(scrollable(), atBottom(), armWhenUnscrollable) && dy < -2 ? "bottom" : "scroll"; if (mode === "bottom") lift(true); }
    if (mode !== "bottom") return;
    pull = dy < 0 ? -rubber(-dy, el.clientHeight) : 0;
    apply(false);
    if (pull && e.cancelable) e.preventDefault();
  };
  const onUp = (): void => {
    if (!dragging) return;
    dragging = false;
    if (mode === "bottom") { pull = 0; apply(true); }
    else lift(false);
    axis = null; mode = null;
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
}
