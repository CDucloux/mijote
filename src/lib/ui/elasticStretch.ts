/**
 * Décision d'ARMEMENT de l'overscroll élastique du bas pour un geste vers le haut.
 *
 * Par défaut, l'élastique ne s'arme que sur un conteneur RÉELLEMENT défilant, une
 * fois arrivé tout en bas : sur une page qui tient à l'écran (rien à défiler), tirer
 * vers le haut ne produit donc aucun ressenti. Certaines pages courtes (ex. écran de
 * connexion) veulent quand même l'effet ; `armWhenUnscrollable` autorise alors
 * l'armement même sans défilement possible (le contenu est de fait « en bas »).
 *
 * Décision PURE (booléens injectés), testable sans DOM ; sa lecture depuis le vrai
 * conteneur reste dans `useElasticScroll`.
 *
 * @module elasticStretch
 */

/**
 * L'élastique du bas doit-il s'armer pour ce geste vers le haut ?
 *
 * @param scrollable - Le conteneur peut-il défiler (contenu plus haut que la vue) ?
 * @param atBottom - Est-on déjà à la butée basse du défilement ?
 * @param armWhenUnscrollable - Autoriser l'armement même quand rien ne défile.
 * @returns `true` s'il faut armer l'étirement élastique du bas.
 */
export function canArmBottomStretch(
  scrollable: boolean,
  atBottom: boolean,
  armWhenUnscrollable: boolean,
): boolean {
  return scrollable ? atBottom : armWhenUnscrollable;
}
