/**
 * Réordonnancement par glisser vertical : calculs purs (aucun DOM, aucun React)
 * partagés par les lignes d'ingrédients et les cartes d'étapes de l'éditeur.
 *
 * @module dragReorder
 */

/** Bande verticale occupée par une ligne réordonnable (coordonnées viewport). */
export interface DragRow {
  /** Index de la ligne dans la liste complète (celui attendu par `moveWithAdopt`). */
  index: number;
  top: number;
  bottom: number;
}

/**
 * Ligne visée par le pointeur pendant un glisser : celle dont la bande contient `y`.
 * Au-delà des extrémités on retient la première ou la dernière ligne (relâcher
 * au-dessus de la liste = placer en tête) ; entre deux bandes (gouttière) la ligne la
 * plus proche l'emporte, pour qu'aucune position ne soit « morte ».
 *
 * Les bandes doivent être des positions de MISE EN PAGE : la ligne en cours de glisser
 * est translatée à l'écran, l'appelant doit lui rendre sa bande d'origine, sinon elle
 * suivrait le doigt et se viserait elle-même en permanence.
 *
 * @param rows - Bandes des lignes, dans l'ordre d'affichage.
 * @param y - Ordonnée du pointeur (viewport).
 * @param fallback - Index renvoyé si aucune ligne n'est mesurable (dépôt sans effet).
 * @returns L'index de destination à passer au réordonnancement.
 */
export function dropTargetIndex(rows: readonly DragRow[], y: number, fallback: number): number {
  if (rows.length === 0) return fallback;
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (y <= first.top) return first.index;
  if (y >= last.bottom) return last.index;
  let nearest = fallback;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const r of rows) {
    if (y >= r.top && y < r.bottom) return r.index;
    const gap = y < r.top ? r.top - y : y - r.bottom;
    if (gap < bestGap) { bestGap = gap; nearest = r.index; }
  }
  return nearest;
}

/**
 * Vitesse d'auto-défilement quand le doigt approche d'un bord du conteneur, en pixels
 * par frame (négatif = vers le haut). Sans elle, impossible de sortir un item de la
 * partie visible sur mobile : la liste ne suivrait pas. Nulle au centre, elle croît
 * linéairement jusqu'à `max` au ras du bord.
 *
 * Un conteneur trop court pour loger deux bandes de déclenchement plus une zone neutre
 * ne défile pas du tout : le doigt y serait en permanence « au bord ».
 *
 * @param y - Ordonnée du pointeur (viewport).
 * @param top - Bord haut du conteneur défilant (viewport).
 * @param bottom - Bord bas du conteneur défilant (viewport).
 * @param zone - Épaisseur de la bande de déclenchement, en px.
 * @param max - Vitesse maximale, en px par frame.
 * @returns Le déplacement à appliquer à `scrollTop` sur cette frame.
 */
export function edgeScrollSpeed(y: number, top: number, bottom: number, zone = 72, max = 16): number {
  if (zone <= 0 || max <= 0) return 0;
  if (bottom - top <= zone * 2) return 0;
  if (y < top + zone) return -max * Math.min(1, (top + zone - y) / zone);
  if (y > bottom - zone) return max * Math.min(1, (y - (bottom - zone)) / zone);
  return 0;
}
