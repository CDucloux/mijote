/**
 * Placement d'une bulle de tooltip par rapport à son ancre, borné au viewport.
 *
 * Logique pure (aucun DOM) : le calque de tooltip mesure l'ancre et la bulle, puis
 * délègue ici le choix « au-dessus / en-dessous », le centrage horizontal clampé et
 * la position du caret. Isolé pour être testable sans navigateur.
 *
 * @module tooltipPosition
 */

/** Rectangle mesuré (repère viewport, comme `getBoundingClientRect`). */
export interface TipRect { left: number; top: number; right: number; bottom: number; width: number; height: number }

/** Taille d'un élément (bulle mesurée). */
export interface TipSize { width: number; height: number }

/** Dimensions du viewport visible. */
export interface TipViewport { width: number; height: number }

/** Côté où la bulle est posée par rapport à l'ancre. */
export type TipPlacement = "top" | "bottom";

/** Résultat : coin haut-gauche `fixed` de la bulle, côté choisi, et décalage du caret. */
export interface TipPosition { left: number; top: number; placement: TipPlacement; caretLeft: number }

const clamp = (v: number, lo: number, hi: number): number => (hi < lo ? lo : Math.min(hi, Math.max(lo, v)));

/**
 * Calcule la position d'une bulle par rapport à l'ancre.
 *
 * Préfère le dessus (posture naturelle d'un tooltip) ; bascule dessous quand il n'y
 * a pas la place au-dessus mais qu'il y en a en dessous ; à défaut, retient le côté
 * le plus dégagé. Le centrage horizontal suit le centre de l'ancre puis est ramené
 * dans le viewport, et le caret pointe vers ce centre même quand la bulle est clampée.
 *
 * @param anchor - Rectangle de l'élément survolé.
 * @param tip - Taille mesurée de la bulle.
 * @param viewport - Dimensions du viewport.
 * @param gap - Espace entre l'ancre et la bulle (px).
 * @param margin - Marge minimale avec les bords du viewport (px).
 * @returns La position `{ left, top, placement, caretLeft }` prête à appliquer.
 */
export function computeTooltipPosition(
  anchor: TipRect,
  tip: TipSize,
  viewport: TipViewport,
  gap = 8,
  margin = 8,
): TipPosition {
  const roomAbove = anchor.top - gap - tip.height >= margin;
  const roomBelow = anchor.bottom + gap + tip.height <= viewport.height - margin;
  const placement: TipPlacement = roomAbove || (!roomBelow && anchor.top > viewport.height - anchor.bottom)
    ? "top"
    : "bottom";

  const centerX = anchor.left + anchor.width / 2;
  const left = clamp(centerX - tip.width / 2, margin, viewport.width - tip.width - margin);
  const top = placement === "top" ? anchor.top - gap - tip.height : anchor.bottom + gap;
  // Le caret reste ancré au centre de la cible, borné aux coins arrondis de la bulle.
  const caretLeft = clamp(centerX - left, 12, tip.width - 12);

  return { left, top, placement, caretLeft };
}
