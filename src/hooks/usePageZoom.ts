import { useEffect } from "react";

// On wide desktops, scale the entire UI up proportionally so the fixed-width
// design fills the screen instead of leaving large empty margins. Sets a CSS
// custom property consumed by #root; #root divides its own width/height by the
// same factor so the app shell stays locked to the viewport (no extra scrollbars).
/**
 * Sur grand écran, met à l'échelle toute l'UI proportionnellement pour remplir
 * l'écran (design à largeur fixe). Écrit la variable CSS `--page-zoom` consommée
 * par `#root`.
 *
 * @param options - Réglages du zoom.
 * @param options.startWidth - Largeur à partir de laquelle on commence à zoomer (px).
 * @param options.maxZoom - Facteur de zoom maximal.
 */
export function usePageZoom({ startWidth = 1500, maxZoom = 1.6 }: { startWidth?: number; maxZoom?: number } = {}): void {
  useEffect(() => {
    const root = document.documentElement;
    const apply = (): void => {
      const w = window.innerWidth;
      const z = w > startWidth ? Math.min(maxZoom, w / startWidth) : 1;
      root.style.setProperty("--page-zoom", String(+z.toFixed(4)));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--page-zoom");
    };
  }, [startWidth, maxZoom]);
}
