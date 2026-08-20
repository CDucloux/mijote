/**
 * Math PURE du repli (« collapse ») du hero de la fiche recette sur mobile. Le hero,
 * grand en haut, se replie en une barre compacte à mesure qu'on défile ; deux
 * progressions distinctes pilotent l'effet :
 *   - `pMove` (0 → `moveEnd`) : parallaxe de l'image, montée en échelle et départ
 *     ÉTAGÉ du texte (badges, puis source, puis titre) ;
 *   - `pBar`  (derniers px, à partir de `barStart`) : apparition TARDIVE du fond et du
 *     flou de la barre, uniquement lorsque le hero a fini de se replier.
 *
 * Ce module ne calcule QUE des nombres (opacités, translations, échelles) : la mise en
 * forme (`toFixed`, `translateY(...)`, seuils de `pointer-events`) et l'écriture dans le
 * DOM restent côté hook d'animation, pour un rendu strictement identique frame à frame.
 *
 * @module heroCollapse
 */

/** Borne `v` dans `[a, b]`. */
export function clamp(v: number, a = 0, b = 1): number {
  return Math.min(b, Math.max(a, v));
}

/** Fenêtre de fondu : 0 avant `a`, 1 après `b`, linéaire entre les deux. */
export function fadeWindow(p: number, a: number, b: number): number {
  return clamp((p - a) / (b - a));
}

/** Paramètres géométriques du repli, dérivés des hauteurs du hero et de la barre. */
export interface HeroCollapseParams {
  /** Distance de défilement sur laquelle le hero se replie entièrement (`HERO_H - BAR_H`). */
  moveEnd: number;
  /** Point de départ (en px de scroll) de l'apparition du fond/flou de la barre. */
  barStart: number;
  /** Respect de `prefers-reduced-motion` : fige image et parallaxe. */
  reduce: boolean;
}

/** Sortie d'une frame : nombres bruts à appliquer au DOM par le hook. */
export interface HeroFrame {
  /** Progression principale (parallaxe/texte), dans `[0, 1]`. */
  pMove: number;
  /** Progression du fond/flou de la barre, dans `[0, 1]`. */
  pBar: number;
  /** Image de fond : translation de parallaxe (px) et facteur d'échelle. */
  img: { translateY: number; scale: number };
  /** Opacité du voile dégradé au-dessus de l'image. */
  shadeOpacity: number;
  /** Badges (première rangée à sortir) : opacité et translation verticale (px). */
  badges: { opacity: number; translateY: number };
  /** Source + attribution (sortent ensuite) : opacité et translation (px). */
  loose: { opacity: number; translateY: number };
  /** Titre (sort en dernier) : opacité, translation (px) et échelle. */
  title: { opacity: number; translateY: number; scale: number };
  /** Boutons overlay du hero : opacité (pilote aussi le seuil pointer-events). */
  controls: { opacity: number };
  /** Contenu de la barre compacte : opacité et translation (px). */
  barInner: { opacity: number; translateY: number };
}

/**
 * Calcule tous les nombres d'une frame de repli pour une position de défilement donnée.
 * Fonction pure : mêmes formules que l'ancien code inline, sans aucun accès au DOM.
 *
 * @param scrollTop - Position de défilement du conteneur (les valeurs négatives, en
 *   sur-défilement iOS, sont ramenées à 0).
 * @param params - Géométrie du repli et respect du mouvement réduit.
 */
export function computeHeroFrame(scrollTop: number, params: HeroCollapseParams): HeroFrame {
  const { moveEnd, barStart, reduce } = params;
  const st = Math.max(0, scrollTop);
  const pMove = clamp(st / moveEnd);
  const pBar = clamp((st - barStart) / (moveEnd - barStart));

  const oB = 1 - fadeWindow(pMove, 0, 0.34);
  const oS = 1 - fadeWindow(pMove, 0.12, 0.48);
  const oT = 1 - fadeWindow(pMove, 0.46, 0.9);
  const oC = 1 - fadeWindow(pMove, 0.5, 0.82);
  const oI = fadeWindow(pMove, 0.74, 1);

  return {
    pMove,
    pBar,
    img: reduce
      ? { translateY: 0, scale: 1 }
      : { translateY: st * 0.42, scale: 1 + pMove * 0.16 },
    shadeOpacity: 0.55 + pMove * 0.45,
    badges: { opacity: oB, translateY: -14 * (1 - oB) },
    loose: { opacity: oS, translateY: -12 * (1 - oS) },
    title: { opacity: oT, translateY: -22 * (1 - oT), scale: 1 - 0.12 * (1 - oT) },
    controls: { opacity: oC },
    barInner: { opacity: oI, translateY: 10 * (1 - oI) },
  };
}

/**
 * Effet « rubber band » iOS/WebKit : suit ~32 % du déplacement du doigt puis résiste,
 * plafonné à `maxPull` px. Sert au sur-défilement élastique en bas d'onglet.
 *
 * @param x - Amplitude du geste (px, valeur positive attendue).
 * @param dim - Dimension de référence (hauteur du conteneur).
 */
export function rubberBand(x: number, dim: number, coeff = 0.32, maxPull = 38): number {
  return Math.min((coeff * x * dim) / (dim + coeff * x), maxPull);
}

/**
 * Facteur d'étirement (`scaleY`) du panneau lors d'un sur-défilement, subtil (≤ 2,5 %)
 * et proportionnel à l'amplitude rapportée à la hauteur du conteneur.
 *
 * @param px - Amplitude de tirage (px, signe indifférent).
 * @param clientHeight - Hauteur visible du conteneur.
 */
export function stretchFactor(px: number, clientHeight: number): number {
  return 1 + Math.min(0.025, Math.abs(px) / (clientHeight * 2));
}
