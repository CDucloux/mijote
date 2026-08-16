import { useState, useEffect } from "react";

/**
 * Vrai si le pointeur PRINCIPAL sait survoler (souris/trackpad), faux sur tactile.
 * À utiliser pour n'appliquer les états de survol (surbrillance JS via `onMouseEnter`)
 * que là où ils ont du sens : sur mobile, un `mouseenter` synthétisé au tap (ou à
 * l'appui long) reste « collé » faute de `mouseleave`, laissant une carte surlignée.
 *
 * @returns `true` quand `(hover: hover)` est satisfait (réévalué si la capacité change).
 */
export function useCanHover(): boolean {
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [canHover, setCanHover] = useState(() => (supported ? window.matchMedia("(hover: hover)").matches : true));
  useEffect(() => {
    if (!supported) return;
    const mq = window.matchMedia("(hover: hover)");
    const onChange = (): void => setCanHover(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [supported]);
  return canHover;
}
