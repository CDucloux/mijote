import { useState, useEffect } from "react";

/**
 * Vrai tant que la media query est satisfaite, réévalué à chaque bascule. Sert à
 * caler un comportement JS sur un point de rupture CSS précis (même requête des
 * deux côtés), là où `useIsDesktop` impose le seuil de 768 px.
 *
 * @param query - Media query CSS, ex. `"(min-width: 900px)"`.
 * @returns `false` hors navigateur ou sans `matchMedia`.
 */
export function useMediaQuery(query: string): boolean {
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = useState(() => supported && window.matchMedia(query).matches);
  useEffect(() => {
    if (!supported) return;
    const mq = window.matchMedia(query);
    const onChange = (): void => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [supported, query]);
  return matches;
}
