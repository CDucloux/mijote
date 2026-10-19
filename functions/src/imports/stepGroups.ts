/**
 * Normalisation des sections (`group`) des étapes renvoyées par le LLM.
 *
 * @module imports/stepGroups
 */

/**
 * Comble les trous de section : une suite d'étapes sans `group` encadrée par deux
 * étapes de la MÊME section est un oubli du modèle (A, A, "", A), qui couperait sinon
 * la section en deux à l'affichage. Ces étapes rejoignent la section qui les encadre.
 * Les étapes hors-section en tête, en fin ou entre deux sections DIFFÉRENTES restent
 * hors-section : leur rattachement est ambigu, et mieux vaut aucun nom qu'un faux nom.
 *
 * @param groups - Libellés de section des étapes, dans l'ordre (`""` = hors-section).
 * @returns Un nouveau tableau de même longueur, trous comblés.
 */
export function fillStepGroupGaps(groups: readonly string[]): string[] {
  const out = groups.map((g) => g.trim());
  let k = 0;
  while (k < out.length) {
    if (out[k]) { k++; continue; }
    const start = k;
    while (k < out.length && !out[k]) k++;
    const before = start > 0 ? out[start - 1] : "";
    const after = k < out.length ? out[k] : "";
    if (before && before === after) out.fill(before, start, k);
  }
  return out;
}
