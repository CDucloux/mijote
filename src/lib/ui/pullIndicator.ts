/**
 * Géométrie de l'indicateur « tirer pour actualiser » : un arc qui se dessine au
 * fil du geste, terminé par une pointe de flèche, plutôt qu'une icône figée qu'on
 * ferait tourner. La progression du doigt EST le tracé : on lit d'un coup d'œil
 * combien il reste à tirer, et le seuil atteint se voit (arc complet, état armé).
 *
 * @module ui/pullIndicator
 */

/** Rayon de l'arc dans un repère 24 × 24 centré en (12, 12). */
export const PULL_ARC_RADIUS = 8;
/** Circonférence de l'arc complet, pour `stroke-dasharray`. */
export const PULL_ARC_CIRCUMFERENCE = 2 * Math.PI * PULL_ARC_RADIUS;
/** Part du cercle tracée au seuil : un arc ouvert garde la lecture « flèche de rechargement ». */
export const PULL_ARC_MAX = 0.8;

/** Tout ce qu'il faut pour dessiner l'indicateur à un instant du geste. */
export interface PullIndicatorFrame {
  /** Part du cercle tracée (0 à {@link PULL_ARC_MAX}). */
  arc: number;
  /** Longueur tracée, en unités du repère (premier terme de `stroke-dasharray`). */
  dash: number;
  /** Rotation de l'ensemble (deg) : l'arc avance en tournant légèrement, comme entraîné par le doigt. */
  rotation: number;
  /** Pointe de flèche : position du bout de l'arc et orientation tangente (deg). */
  head: { x: number; y: number; angle: number; scale: number };
  /** Vrai dès que le seuil est atteint : relâcher déclenchera l'actualisation. */
  armed: boolean;
}

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);
/** Départ franc puis approche douce du seuil : le tracé « accroche » le doigt sans finir brutalement. */
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

/**
 * Calcule l'état de l'indicateur pour une progression du geste.
 *
 * @param progress - Distance tirée rapportée au seuil (0 au repos, 1 au seuil ;
 *   au-delà, NaN ou négatif sont ramenés dans [0, 1]).
 * @returns Le tracé de l'arc, sa rotation, la pointe et l'état armé.
 */
export function pullIndicatorFrame(progress: number): PullIndicatorFrame {
  const p = clamp01(progress);
  const arc = easeOut(p) * PULL_ARC_MAX;
  // Le tracé part de midi (-90°) dans le sens horaire ; la pointe suit son extrémité.
  const end = (-90 + arc * 360) * (Math.PI / 180);
  return {
    arc,
    dash: arc * PULL_ARC_CIRCUMFERENCE,
    rotation: p * 120,
    head: {
      x: 12 + PULL_ARC_RADIUS * Math.cos(end),
      y: 12 + PULL_ARC_RADIUS * Math.sin(end),
      angle: (end * 180) / Math.PI + 90,
      scale: p < 0.15 ? 0 : clamp01((p - 0.15) / 0.35),
    },
    armed: p >= 1,
  };
}
