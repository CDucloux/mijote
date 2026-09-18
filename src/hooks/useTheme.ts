import { useState, useEffect } from "react";

// ─── THÈME CLAIR / SOMBRE ─────────────────────────────────────────────────────
// État persistant (localStorage) + bascule fluide via l'API View Transitions.
// Entièrement autonome (aucune dépendance applicative), extrait d'App.jsx.

/** Document doté de l'API View Transitions (pas encore dans la lib DOM standard). */
type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void) => { finished?: Promise<unknown> };
};

/** Applique le thème au DOM : classe `light` sur `<html>` ET sur `#root` (tous
 * deux portent les variables de couleur, cf. global.css) + `theme-color` de la
 * barre système. Poser la classe sur `#root` en plus de `<html>` est essentiel :
 * `#root.light` (piloté par React via `isDark`) redéclare sinon les couleurs du
 * thème clair sur son sous-arbre, et tant que React n'a pas re-rendu il annulerait
 * un passage clair -> sombre. En la posant nous-mêmes, la bascule est correcte
 * immédiatement, sans dépendre du rendu React (donc sans `flushSync`). Pas de
 * pilotage de meta `color-scheme` : déclarée en dur, elle faisait retomber la
 * barre PWA sur le `theme_color` figé du manifest ; le schéma vit côté CSS. */
function applyThemeToDOM(dark: boolean): void {
  document.documentElement.classList.toggle("light", !dark);
  document.getElementById("root")?.classList.toggle("light", !dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0f110d" : "#f3f4ec");
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
      // Bascule visuelle du thème : PUREMENT impérative via `applyThemeToDOM`, qui
      // pose la classe `html.light` portant TOUTES les variables de couleur. Le
      // snapshot « après » du view-transition est donc déjà correct sans attendre
      // React, d'où l'absence de `flushSync` ici : forcer un rendu synchrone de tout
      // l'arbre (toutes les pages + le drawer ouvert) bloquait le thread au pire
      // moment et saccadait la bascule sur mobile. `setIsDark` reste asynchrone : il
      // ne sert qu'au libellé/icône du menu (soleil/lune), invisible sous le fondu.
      applyThemeToDOM(next);
      setIsDark(next);
      try { localStorage.setItem("rf_theme", next ? "dark" : "light"); } catch { /* quota */ }
    };
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Appel LIÉ à `document` : extraire la méthode dans une variable puis l'appeler
    // détachée lève « Illegal invocation » (l'API native exige `this === document`).
    const doc = document as ViewTransitionDocument;
    if (doc.startViewTransition && !reduce) {
      // Pendant la bascule, on coupe le fondu PAR ÉLÉMENT (règle globale `*`) : le
      // cross-fade de l'instantané suffit. Sans ça, sur les pages denses (grille de
      // recettes, feed découverte, stock), des milliers de transitions simultanées
      // se superposent au view-transition et saccadent la bascule. Les pages légères
      // (planning, courses) n'en souffraient pas, d'où la différence ressentie.
      const el = document.documentElement;
      el.classList.add("theme-switching");
      const done = (): void => el.classList.remove("theme-switching");
      const vt = doc.startViewTransition(run);
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
