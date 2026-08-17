/**
 * Couleur de la barre système d'une PWA (`theme-color`) « voilée » : la couleur de
 * fond du thème courant assombrie comme si un scrim noir semi-opaque la recouvrait.
 *
 * Sert à faire suivre la barre de statut au voile d'une modale : sans ça, en PWA
 * installée, le haut de l'écran (chrome système, hors du contenu web) reste clair
 * pendant que le reste de la page est grisé par le backdrop, ce qui casse l'effet.
 *
 * @module themeColor
 */

/** Parse une couleur hex (`#rgb` ou `#rrggbb`, avec ou sans `#`) en canaux [0,255]. */
function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Compose la couleur de base sur du noir à l'opacité `alpha` (voile) et renvoie le
 * résultat opaque, ce qui reproduit exactement l'aspect d'un scrim `rgba(0,0,0,alpha)`
 * posé au-dessus de `baseHex`.
 *
 * @param baseHex - Couleur de fond du thème (`#rgb` ou `#rrggbb`).
 * @param alpha - Opacité du voile noir : 0 laisse la couleur inchangée, 1 la rend noire. Bornée à [0,1].
 * @returns La couleur composée en `#rrggbb`. Renvoie `baseHex` tel quel s'il n'est pas parsable.
 */
export function scrimThemeColor(baseHex: string, alpha: number): string {
  const rgb = parseHex(baseHex);
  if (!rgb) return baseHex;
  const k = 1 - Math.min(1, Math.max(0, alpha));
  const to2 = (n: number): string => Math.round(n * k).toString(16).padStart(2, "0");
  return `#${to2(rgb[0])}${to2(rgb[1])}${to2(rgb[2])}`;
}
