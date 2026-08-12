/**
 * Onde tactile « ripple » (feel natif Android) : pose un disque au point de
 * contact du doigt/curseur, qui s'étend sur toute la cible et s'estompe. Le disque
 * est inséré en 1er enfant de la cible (donc SOUS son contenu), borné par un
 * `overflow: hidden` porté par la cible, et auto-nettoyé en fin d'animation.
 *
 * La cible doit être `position: relative; overflow: hidden` et l'animation CSS
 * `.ripple-ink` / `@keyframes rippleInk` doit exister (cf. global.css).
 *
 * @module ripple
 */

/** Sous-ensemble d'un évènement pointeur suffisant pour placer l'onde. */
interface RippleEvent {
  currentTarget: HTMLElement;
  clientX?: number;
  clientY?: number;
}

/**
 * Déclenche une onde tactile sur la cible de l'évènement, centrée sur le point de
 * contact (ou sur le centre de la cible si les coordonnées sont absentes).
 *
 * @param e - L'évènement pointeur (React ou natif) dont `currentTarget` reçoit l'onde.
 */
export function spawnRipple(e: RippleEvent): void {
  const el = e.currentTarget;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const x = (e.clientX ?? rect.left + rect.width / 2) - rect.left;
  const y = (e.clientY ?? rect.top + rect.height / 2) - rect.top;
  const ink = document.createElement("span");
  ink.className = "ripple-ink";
  ink.style.width = ink.style.height = `${size}px`;
  ink.style.left = `${x - size / 2}px`;
  ink.style.top = `${y - size / 2}px`;
  ink.addEventListener("animationend", () => ink.remove(), { once: true });
  el.insertBefore(ink, el.firstChild);
}

/**
 * Installe une délégation GLOBALE de l'onde tactile : tout élément portant la classe
 * `.ripple` (lui-même ou un ancêtre du point de contact) reçoit une onde au toucher.
 * Permet de généraliser le feel natif Android sans câbler `onPointerDown` partout —
 * il suffit d'ajouter la classe `.ripple` (qui pose aussi `position:relative;
 * overflow:hidden` côté CSS). Réservé aux pointeurs grossiers (mobile/tactile) : sur
 * souris, on garde les états `:hover`/`:active` classiques. Idempotent.
 *
 * @returns Fonction de désinstallation (retrait de l'écouteur).
 */
export function installGlobalRipple(): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") return () => {};
  // Souris fine → pas d'onde (on conserve hover/active). Tactile → onde.
  if (window.matchMedia && !window.matchMedia("(hover: none)").matches) return () => {};
  const handler = (ev: PointerEvent): void => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const el = target.closest<HTMLElement>(".ripple");
    if (!el) return;
    spawnRipple({ currentTarget: el, clientX: ev.clientX, clientY: ev.clientY });
  };
  document.addEventListener("pointerdown", handler, { passive: true });
  return () => document.removeEventListener("pointerdown", handler);
}
