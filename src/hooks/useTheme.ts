import { useState, useEffect } from "react";
import { flushSync } from "react-dom";

// ─── THÈME CLAIR / SOMBRE ─────────────────────────────────────────────────────
// État persistant (localStorage) + bascule fluide via l'API View Transitions.
// Entièrement autonome (aucune dépendance applicative) — extrait d'App.jsx.

/** Document doté de l'API View Transitions (pas encore dans la lib DOM standard). */
type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void) => { finished?: Promise<unknown> };
};

/** Applique le thème au DOM : classe `<html>` + `theme-color` de la barre PWA. */
function applyThemeToDOM(dark: boolean): void {
  document.documentElement.classList.toggle("light", !dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0e0e0f" : "#f5f0eb");
}

/**
 * État de thème clair/sombre persistant (localStorage), avec bascule fluide via
 * l'API View Transitions (cross-fade de l'instantané du viewport).
 *
 * @returns `{ isDark, toggleTheme }`.
 */
export function useTheme(): { isDark: boolean; toggleTheme: () => void } {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem("rf_theme") !== "light"; } catch { return true; }
  });

  const toggleTheme = (): void => {
    const next = !isDark;
    // Le fondu de thème par élément (règle globale `*`) est écrasé sur toute page
    // dont les éléments portent une `transition` inline → bascule sèche. L'API View
    // Transitions capture un instantané du viewport entier et le fait cross-fader
    // uniformément, indépendamment des transitions par élément.
    const run = (): void => {
      // flushSync : le commit React doit être appliqué DANS le callback pour que
      // l'instantané « après » du view-transition reflète déjà le nouveau thème.
      flushSync(() => setIsDark(next));
      applyThemeToDOM(next);
      try { localStorage.setItem("rf_theme", next ? "dark" : "light"); } catch { /* quota */ }
    };
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const startViewTransition = (document as ViewTransitionDocument).startViewTransition;
    if (startViewTransition && !reduce) {
      // Pendant la bascule, on coupe le fondu PAR ÉLÉMENT (règle globale `*`) : le
      // cross-fade de l'instantané suffit. Sans ça, sur les pages denses (grille de
      // recettes, feed découverte, stock), des milliers de transitions simultanées
      // se superposent au view-transition et saccadent la bascule. Les pages légères
      // (planning, courses) n'en souffraient pas, d'où la différence ressentie.
      const el = document.documentElement;
      el.classList.add("theme-switching");
      const done = (): void => el.classList.remove("theme-switching");
      const vt = startViewTransition(run);
      (vt.finished || Promise.resolve()).finally(done);
      setTimeout(done, 600); // filet de sécurité : ne jamais rester figé sans transitions

    } else {
      run();
    }
  };

  // Synchronisation initiale (au montage) : aligne le DOM sur l'état persistant.
  useEffect(() => { applyThemeToDOM(isDark); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isDark, toggleTheme };
}
