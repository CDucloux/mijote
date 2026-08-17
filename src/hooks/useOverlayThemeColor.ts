import { useEffect } from "react";
import { scrimThemeColor } from "@/lib/ui/themeColor.js";

// Voile la barre système (theme-color) tant qu'une modale plein écran est ouverte.
// En PWA installée, la barre de statut prend la couleur de `theme-color` (chrome
// système, hors contenu web) : sans ça elle reste claire pendant que le backdrop
// grise le reste de l'écran, laissant une bande blanche disgracieuse en haut.
//
// Détection centralisée par MutationObserver plutôt que par câblage de chaque
// modale : tous les backdrops (sheets `.modal-backdrop`, dialogs `.alert-backdrop`)
// sont portés en ENFANTS DIRECTS de <body> via createPortal. Observer le childList
// de <body> suffit donc, sans `subtree` (bien moins de mutations à traiter), et
// toute future modale réutilisant ces classes en hérite sans code supplémentaire.
//
// L'ordre reflète l'opacité réelle du voile CSS (sheets 0.7, dialogs 0.55) : on
// prend le premier présent pour coller à la teinte effectivement affichée.
const SCRIMS: readonly [selector: string, alpha: number][] = [
  [".modal-backdrop", 0.7],
  [".alert-backdrop", 0.55],
];

/**
 * Aligne la couleur de la barre système PWA (`theme-color`) sur le voile de la
 * modale ouverte : tant qu'un backdrop est présent, la barre est assombrie de la
 * même opacité que le scrim ; à la fermeture, la couleur du thème est restaurée.
 *
 * À monter une seule fois à la racine de l'application.
 */
export function useOverlayThemeColor(): void {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;

    // Couleur du thème mémorisée à l'ouverture du 1er overlay, restaurée à la
    // fermeture du dernier : évite de dupliquer la palette (source unique = la
    // valeur déjà posée par useTheme / le script de <head>).
    let base: string | null = null;

    const activeAlpha = (): number | null => {
      for (const [selector, alpha] of SCRIMS) {
        if (document.body.querySelector(selector)) return alpha;
      }
      return null;
    };

    const sync = (): void => {
      const alpha = activeAlpha();
      if (alpha !== null && base === null) {
        base = meta.getAttribute("content") ?? "";
        meta.setAttribute("content", scrimThemeColor(base, alpha));
      } else if (alpha === null && base !== null) {
        meta.setAttribute("content", base);
        base = null;
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true });
    sync(); // état initial (overlay déjà monté au premier rendu)

    return () => {
      observer.disconnect();
      if (base !== null) meta.setAttribute("content", base); // ne jamais laisser la barre voilée
    };
  }, []);
}
