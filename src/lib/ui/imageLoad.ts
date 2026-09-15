// ─── DÉTECTION D'IMAGE DÉJÀ CHARGÉE ──────────────────────────────────────────
// Une <img> dont la source est servie depuis le cache peut émettre son évènement
// `load` AVANT que React n'ait attaché le handler onLoad : le composant ne reçoit
// jamais l'évènement et son placeholder reste affiché indéfiniment. On corrige en
// interrogeant l'état de l'élément après montage ; ce prédicat isole la règle
// (pur, testable), l'accès au DOM reste dans le composant.

/** Forme minimale d'un élément image nécessaire au test de complétude. */
export interface ImgReadyState {
  /** L'image a terminé son chargement (succès OU échec). */
  complete: boolean;
  /** Largeur intrinsèque : > 0 uniquement si le décodage a réussi. */
  naturalWidth: number;
}

/**
 * Vrai si l'image est déjà chargée avec succès (donc affichable immédiatement,
 * sans attendre un évènement `load` qui a pu passer avant l'attache du handler).
 * Un `naturalWidth` à 0 sur une image `complete` signale un échec, pas un succès.
 *
 * @param img - L'élément image (ou null s'il n'est pas encore monté).
 */
export function imgAlreadyLoaded(img: ImgReadyState | null | undefined): boolean {
  return !!img && img.complete && img.naturalWidth > 0;
}
