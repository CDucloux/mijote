import { useState, useEffect } from "react";

/**
 * Vrai sur les écrans larges (≥ 768 px), réévalué au redimensionnement.
 *
 * @returns `true` si la fenêtre fait au moins 768 px de large.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  useEffect(() => {
    const handler = (): void => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isDesktop;
}
