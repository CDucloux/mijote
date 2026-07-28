import { useState, useEffect } from "react";
import { flushSync } from "react-dom";

// ─── THÈME CLAIR / SOMBRE ─────────────────────────────────────────────────────
// État persistant (localStorage) + bascule fluide via l'API View Transitions.
// Entièrement autonome (aucune dépendance applicative) — extrait d'App.jsx.

// Applique le thème au DOM : classe <html> + theme-color de la barre PWA.
function applyThemeToDOM(dark) {
  document.documentElement.classList.toggle("light", !dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0e0e0f" : "#f5f0eb");
}

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem("rf_theme") !== "light"; } catch { return true; }
  });

  const toggleTheme = () => {
    const next = !isDark;
    // Le fondu de thème par élément (règle globale `*`) est écrasé sur toute page
    // dont les éléments portent une `transition` inline → bascule sèche. L'API View
    // Transitions capture un instantané du viewport entier et le fait cross-fader
    // uniformément, indépendamment des transitions par élément.
    const run = () => {
      // flushSync : le commit React doit être appliqué DANS le callback pour que
      // l'instantané « après » du view-transition reflète déjà le nouveau thème.
      flushSync(() => setIsDark(next));
      applyThemeToDOM(next);
      try { localStorage.setItem("rf_theme", next ? "dark" : "light"); } catch { /* quota */ }
    };
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduce) document.startViewTransition(run);
    else run();
  };

  // Synchronisation initiale (au montage) : aligne le DOM sur l'état persistant.
  useEffect(() => { applyThemeToDOM(isDark); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isDark, toggleTheme };
}
