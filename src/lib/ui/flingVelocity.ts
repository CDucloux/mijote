/**
 * Mesure de l'élan d'un « fling » (lancer inertiel) qui vient percuter le bas d'un
 * conteneur défilant, pour en dériver un rebond élastique proportionnel.
 *
 * Le piège que ça règle : à l'instant PRÉCIS où le défilement atteint la butée,
 * `scrollTop` se fige, donc la vitesse INSTANTANÉE retombe à ~0 pile au moment où
 * l'on voudrait la lire. Lire la vitesse au contact rate donc quasi toujours le
 * seuil (le rebond « ne se déclenche pas toujours »). On retient à la place un PIC
 * amorti de la vitesse récente, qui reflète l'élan réel d'approche.
 *
 * @module flingVelocity
 */

/**
 * Met à jour le pic de vitesse d'approche : garde la valeur montante telle quelle,
 * sinon la laisse décroître doucement. Ainsi la vitesse mesurée juste avant la
 * butée survit au frame de contact (où l'instantané tombe à ~0).
 *
 * @param prevPeak - Pic courant (px/ms, >= 0).
 * @param instantV - Vitesse instantanée de ce frame (px/ms ; négatif = vers le haut, ignoré).
 * @param decay - Facteur de décroissance par frame quand la vitesse ne monte pas (0..1).
 * @returns Le nouveau pic (px/ms, >= 0).
 */
export function trackFlingPeak(prevPeak: number, instantV: number, decay = 0.72): number {
  const v = instantV > 0 ? instantV : 0;
  const kept = prevPeak > 0 ? prevPeak * decay : 0;
  return v > kept ? v : kept;
}

/**
 * Amplitude (px) du rebond d'inertie pour un pic de vitesse donné, bornée à `max`.
 *
 * @param peakV - Pic de vitesse d'approche (px/ms).
 * @param max - Amplitude maximale autorisée (px).
 * @param gain - Conversion vitesse -> pixels (px par px/ms).
 * @returns Amplitude du rebond, dans [0, max].
 */
export function bounceImpact(peakV: number, max: number, gain = 13): number {
  return Math.min(max, Math.max(0, peakV) * gain);
}
