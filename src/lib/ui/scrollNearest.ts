/**
 * Calcule le défilement HORIZONTAL minimal pour rendre un élément entièrement
 * visible dans sa rangée (équivalent de `scrollIntoView({ inline: "nearest" })`).
 * Utilisé à la place de `scrollIntoView`, qui fait aussi défiler tous les
 * ancêtres verticaux et ramène la page en haut à chaque appel.
 *
 * @param scrollLeft - Défilement actuel de la rangée.
 * @param viewWidth - Largeur visible de la rangée.
 * @param itemLeft - Position gauche de l'élément dans le contenu de la rangée.
 * @param itemWidth - Largeur de l'élément.
 * @returns Le nouveau `scrollLeft` (inchangé si l'élément est déjà visible).
 */
export function nearestScrollLeft(scrollLeft: number, viewWidth: number, itemLeft: number, itemWidth: number): number {
  const itemRight = itemLeft + itemWidth;
  if (itemLeft < scrollLeft) return Math.max(0, itemLeft);
  if (itemRight > scrollLeft + viewWidth) return Math.max(0, Math.min(itemLeft, itemRight - viewWidth));
  return scrollLeft;
}
