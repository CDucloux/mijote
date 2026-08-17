import { useEffect } from "react";
import { overlayHex } from "@/lib/ui/themeColor.js";

// Opacité de la teinte accent posée sur le fond pour la barre système de la
// landing : un rien plus marquée en sombre (l'accent chaud ressort peu sur du
// quasi-noir), discrète en clair. Assez pour prolonger la lueur du dégradé sans
// virer à la bande colorée franche.
const TINT_DARK = 0.14;
const TINT_LIGHT = 0.1;

/**
 * Teinte la barre système PWA (`theme-color`) vers l'accent chaud le temps de
 * l'écran d'accueil (landing), pour que la barre de statut prolonge la lueur du
 * haut du dégradé au lieu de rester sur le fond plat neutre.
 *
 * En PWA installée, la barre de statut est un aplat unique peint par l'OS : on ne
 * peut pas y rendre un vrai dégradé. Comme le haut du dégradé est quasi uniforme
 * (blobs très flous, faible opacité), un aplat accent-teinté suffit à faire lire la
 * continuité. Les tokens `--bg` / `--accent` sont lus en direct : la teinte suit
 * donc le thème courant, et la couleur du thème est restaurée à la sortie de l'écran.
 *
 * @param isDark - Thème actif, pour recomposer la teinte et la restauration à la bascule.
 */
export function useLandingThemeColor(isDark: boolean): void {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const css = getComputedStyle(document.documentElement);
    const bg = css.getPropertyValue("--bg").trim() || (isDark ? "#0e0e0f" : "#f5f0eb");
    const accent = css.getPropertyValue("--accent").trim();
    meta.setAttribute("content", overlayHex(bg, accent, isDark ? TINT_DARK : TINT_LIGHT));
    return () => { meta.setAttribute("content", bg); };
  }, [isDark]);
}
