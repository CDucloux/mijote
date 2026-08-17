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

/** Formate trois canaux [0,255] en `#rrggbb`. */
function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map(n => Math.round(n).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Compose `overlay` par-dessus `base` à l'opacité `alpha` (alpha compositing sur
 * fond opaque) et renvoie la couleur opaque résultante, exactement l'aspect d'un
 * calque `rgba(overlay, alpha)` posé sur `base`.
 *
 * @param baseHex - Couleur de fond opaque (`#rgb` ou `#rrggbb`).
 * @param overlayHexColor - Couleur du calque posé au-dessus (`#rgb` ou `#rrggbb`).
 * @param alpha - Opacité du calque : 0 laisse `base` inchangé, 1 renvoie `overlay`. Bornée à [0,1].
 * @returns La couleur composée en `#rrggbb`. Renvoie `baseHex` tel quel si `base` n'est pas parsable ; ignore un `overlay` non parsable (renvoie `base` normalisé).
 */
export function overlayHex(baseHex: string, overlayHexColor: string, alpha: number): string {
  const base = parseHex(baseHex);
  if (!base) return baseHex;
  const over = parseHex(overlayHexColor);
  if (!over) return toHex(base);
  const a = Math.min(1, Math.max(0, alpha));
  return toHex([0, 1, 2].map(i => base[i] * (1 - a) + over[i] * a) as [number, number, number]);
}

/**
 * Couleur de base « voilée » : composée sur un scrim noir semi-opaque. Cas
 * particulier de {@link overlayHex} avec un calque noir, pour faire suivre la
 * barre système au voile d'une modale.
 *
 * @param baseHex - Couleur de fond du thème (`#rgb` ou `#rrggbb`).
 * @param alpha - Opacité du voile noir : 0 laisse la couleur inchangée, 1 la rend noire. Bornée à [0,1].
 * @returns La couleur composée en `#rrggbb`. Renvoie `baseHex` tel quel s'il n'est pas parsable.
 */
export function scrimThemeColor(baseHex: string, alpha: number): string {
  return overlayHex(baseHex, "#000000", alpha);
}

/**
 * Variante imperceptible d'une couleur : un unique canal décalé de 1/255, pour
 * obtenir une valeur GARANTIE différente de l'entrée mais visuellement identique.
 *
 * Sert à forcer un repaint de la barre système PWA sur Android : reposer deux fois
 * la MÊME couleur ne déclenche aucun redraw (Chrome ignore un `theme-color` inchangé),
 * or après une bascule clair -> sombre -> clair Android laisse un calque de contraste
 * « collé » sous la barre de statut. Intercaler cette valeur voisine puis la vraie
 * base constitue un changement réel que Chrome honore, ce qui nettoie le résidu, sans
 * flash visible (le canal bleu bouge d'un pas, sous le seuil de perception).
 *
 * @param hex - Couleur à décaler (`#rgb` ou `#rrggbb`).
 * @returns Une couleur `#rrggbb` distincte de `hex` d'exactement 1/255 sur le bleu (rebondit en +1 si le canal est à 0). Renvoie `hex` tel quel s'il n'est pas parsable.
 */
export function nudgeThemeColor(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex([rgb[0], rgb[1], rgb[2] > 0 ? rgb[2] - 1 : rgb[2] + 1]);
}
