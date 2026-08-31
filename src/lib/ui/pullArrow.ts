/**
 * Géométrie d'une flèche de rechargement circulaire pour le pull-to-refresh.
 *
 * Le POURQUOI : on veut le geste standard des apps mobiles, une flèche
 * circulaire qui se *dessine* au fil du tir (le balayage de l'arc croît avec
 * la progression) et dont la pointe suit l'extrémité, plutôt qu'une flèche
 * droite qui se retourne. Cette logique de tracé (arc de cercle + chevron
 * tangent) est pure et vit donc ici, testée en isolation ; le composant se
 * contente d'injecter le résultat dans un `<svg viewBox="0 0 24 24">`.
 */

/** Chemins SVG (repère `0 0 24 24`) d'une flèche circulaire à une progression donnée. */
export interface PullArrowGeometry {
  /** Attribut `d` de l'arc balayé (portion de cercle). Vide tant que rien n'est tiré. */
  readonly arc: string;
  /** Points du chevron de pointe au bout de l'arc : `x1 y1 x2 y2 x3 y3`. */
  readonly head: string;
}

const CENTER = 12;
const RADIUS = 7;
/** Balayage maximal : cercle presque complet, une échancrure signe la flèche. */
const MAX_SWEEP = Math.PI * 2 * 0.82;
const START = -Math.PI / 2; // haut du cercle
const HEAD_LEN = 4.2;
const HEAD_SPREAD = 2.5; // radians, demi-ouverture du chevron

const round = (n: number): number => Math.round(n * 100) / 100;

const point = (angle: number): readonly [number, number] => [
  CENTER + RADIUS * Math.cos(angle),
  CENTER + RADIUS * Math.sin(angle),
];

/**
 * Calcule l'arc et la pointe de la flèche circulaire pour une progression de
 * tir `progress` (clampée dans [0, 1]). L'arc part du haut du cercle et
 * balaie dans le sens horaire ; la pointe est un chevron tangent à son
 * extrémité, orienté dans le sens de progression.
 *
 * @param progress ratio de tir (`pull / threshold`), valeurs hors [0, 1] tolérées et clampées.
 * @returns les chemins `arc` et `head` prêts à poser dans le SVG.
 */
export function pullArrowGeometry(progress: number): PullArrowGeometry {
  const p = Math.min(1, Math.max(0, progress));
  const sweep = p * MAX_SWEEP;
  if (sweep === 0) return { arc: "", head: "" };

  const end = START + sweep;
  const [x0, y0] = point(START);
  const [x1, y1] = point(end);
  const largeArc = sweep > Math.PI ? 1 : 0;
  const arc = `M${round(x0)} ${round(y0)} A${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${round(x1)} ${round(y1)}`;

  const tangent = end + Math.PI / 2; // sens horaire de progression
  const wing = (offset: number): readonly [number, number] => [
    x1 + HEAD_LEN * Math.cos(tangent + offset),
    y1 + HEAD_LEN * Math.sin(tangent + offset),
  ];
  const [ax, ay] = wing(HEAD_SPREAD);
  const [bx, by] = wing(-HEAD_SPREAD);
  const head = `${round(ax)} ${round(ay)} ${round(x1)} ${round(y1)} ${round(bx)} ${round(by)}`;

  return { arc, head };
}
