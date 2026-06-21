import { useEffect } from "react";

// On wide desktops, scale the entire UI up proportionally so the fixed-width
// design fills the screen instead of leaving large empty margins. Sets a CSS
// custom property consumed by #root; #root divides its own width/height by the
// same factor so the app shell stays locked to the viewport (no extra scrollbars).
export function usePageZoom({ startWidth = 1500, maxZoom = 1.6 } = {}) {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
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
