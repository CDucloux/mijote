/**
 * Géométrie d'une flèche de rechargement circulaire pour le pull-to-refresh.
 *
 * Le POURQUOI : on veut le geste standard des apps mobiles, une flèche
 * circulaire qui se *dessine* au fil du tir (le balayage de l'arc croît avec
 * la progression) et dont la pointe suit l'extrémité, plutôt qu'une flèche
 * droite qui se retourne. La pointe est un **triangle plein** tangent au bout
 * de l'arc : un chevron ouvert, au ras d'une extrémité quasi verticale, voyait
 * une barbe longer l'arc et l'autre saillir, ce qui se lisait comme un crochet
 * de travers ; un triangle plein se lit sans ambiguïté où qu'il soit sur
 * l'anneau. Cette logique de tracé est pure et vit donc ici, testée en
 * isolation ; le composant se contente d'injecter le résultat dans un
 * `<svg viewBox="0 0 24 24">`.
 */

/** Chemins SVG (repère `0 0 24 24`) d'une flèche circulaire à une progression donnée. */
export interface PullArrowGeometry {
  /** Attribut `d` de l'arc balayé (portion de cercle). Vide tant que rien n'est tiré. */
  readonly arc: string;
  /** Trois sommets du triangle de pointe (`coin1 pointe coin2`) : `x1 y1 x2 y2 x3 y3`. */
  readonly head: string;
}

const CENTER = 12;
const RADIUS = 7;
/** Balayage maximal : cercle presque complet, une échancrure signe la flèche. */
const MAX_SWEEP = Math.PI * 2 * 0.82;
const START = -Math.PI / 2; // haut du cercle
/** Longueur de la pointe en avant du bout de l'arc (dans l'axe tangent). */
const HEAD_TIP = 2.2;
/** Recul de la base de la pointe derrière le bout de l'arc. */
const HEAD_BACK = 2.2;
/** Demi-largeur de la base du triangle (perpendiculaire à la tangente). */
const HEAD_HALF_W = 2.6;

const round = (n: number): number => Math.round(n * 100) / 100;

const point = (angle: number): readonly [number, number] => [
  CENTER + RADIUS * Math.cos(angle),
  CENTER + RADIUS * Math.sin(angle),
];

/**
 * Calcule l'arc et la pointe de la flèche circulaire pour une progression de
 * tir `progress` (clampée dans [0, 1]). L'arc part du haut du cercle et
 * balaie dans le sens horaire ; la pointe est un triangle tangent à son
 * extrémité, centré sur le bout de l'arc et dirigé dans le sens de progression.
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
  const [ex, ey] = point(end);
  const largeArc = sweep > Math.PI ? 1 : 0;
  const arc = `M${round(x0)} ${round(y0)} A${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${round(ex)} ${round(ey)}`;

  // Repère local au bout de l'arc : tangente (sens horaire) et normale.
  const tangent = end + Math.PI / 2;
  const tdx = Math.cos(tangent), tdy = Math.sin(tangent);
  const ndx = -tdy, ndy = tdx;
  const tipX = ex + HEAD_TIP * tdx, tipY = ey + HEAD_TIP * tdy;
  const baseX = ex - HEAD_BACK * tdx, baseY = ey - HEAD_BACK * tdy;
  const c1X = baseX + HEAD_HALF_W * ndx, c1Y = baseY + HEAD_HALF_W * ndy;
  const c2X = baseX - HEAD_HALF_W * ndx, c2Y = baseY - HEAD_HALF_W * ndy;
  const head = `${round(c1X)} ${round(c1Y)} ${round(tipX)} ${round(tipY)} ${round(c2X)} ${round(c2Y)}`;

  return { arc, head };
}
