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
 * Surfaces éligibles à l'onde tactile par délégation globale : l'opt-in explicite
 * `.ripple`, plus tous les boutons (`.btn`) et pilules/surfaces tappables
 * (`.pressable`). Généraliser l'onde à ce jeu couvre l'UI actionnable (boutons et
 * pills) d'un coup, sans câbler chaque site : le retour tactile natif remplace le
 * flash d'opacité `:active` hérité de `pressable` (neutralisé côté CSS en mobile).
 */
export const RIPPLE_SELECTOR = ".ripple, .btn, .pressable";

/**
 * Remonte du point de contact vers la plus proche surface éligible à l'onde
 * (`RIPPLE_SELECTOR`), ou `null` si le toucher n'a pas eu lieu sur une telle surface.
 *
 * @param target - La cible de l'évènement pointeur (`ev.target`).
 * @returns L'élément qui doit recevoir l'onde, ou `null`.
 */
export function rippleTargetFrom(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(RIPPLE_SELECTOR);
}

/**
 * Installe une délégation GLOBALE de l'onde tactile : tout élément éligible
 * (`RIPPLE_SELECTOR` : `.ripple`, `.btn`, `.pressable`), lui-même ou un ancêtre du
 * point de contact, reçoit une onde au toucher. Permet de généraliser le feel natif
 * Android sans câbler `onPointerDown` partout ni taguer chaque bouton. Réservé aux
 * pointeurs grossiers (mobile/tactile) : sur souris, on garde les états
 * `:hover`/`:active` classiques. Idempotent.
 *
 * @returns Fonction de désinstallation (retrait de l'écouteur).
 */
export function installGlobalRipple(): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") return () => {};
  // Souris fine → pas d'onde (on conserve hover/active). Tactile → onde.
  if (window.matchMedia && !window.matchMedia("(hover: none)").matches) return () => {};
  const handler = (ev: PointerEvent): void => {
    const el = rippleTargetFrom(ev.target);
    if (!el) return;
    spawnRipple({ currentTarget: el, clientX: ev.clientX, clientY: ev.clientY });
  };
  document.addEventListener("pointerdown", handler, { passive: true });
  return () => document.removeEventListener("pointerdown", handler);
}
