/**
 * Décide si la fiche recette doit s'effacer par une SORTIE ANIMÉE (glissement vers
 * la droite, « dismiss ») avant de revenir à la liste, plutôt que de disparaître
 * d'un coup. On ne veut ce ressenti « app native » que dans la coquille Capacitor,
 * là où le geste de retour du téléphone est utilisé et où l'absence de transition
 * détonne le plus. En web / PWA ou sur desktop, le retour reste immédiat.
 *
 * La décision est PURE (signaux injectés), donc testable sans globals ;
 * l'orchestration (état, minuterie de sécurité, navigation) est une glue fine, cf.
 * `AppInner`.
 *
 * @module screenTransition
 */
import { isCapacitorContext, type RuntimeContext } from "./runtimeContext.js";

/**
 * Durée (ms) de la sortie animée de la fiche recette. Doit rester alignée sur la
 * durée de l'animation CSS `detailDismissRight` (cf. `.page-dismiss-right`) : elle
 * sert de filet de sécurité si l'évènement `animationend` ne remonte pas (ex.
 * animation neutralisée), pour que la navigation finisse toujours par se produire.
 */
export const DETAIL_DISMISS_MS = 300;

/** Signaux nécessaires à la décision, isolés pour la testabilité. */
export interface DismissSignals {
  /** Contexte d'exécution courant (cf. runtimeContext). */
  ctx: RuntimeContext;
  /** Rendu en disposition desktop (large) ? */
  isDesktop: boolean;
  /** Une fiche recette est-elle actuellement affichée (sinon rien à animer) ? */
  onDetail: boolean;
  /** L'utilisateur a-t-il demandé la réduction des animations (accessibilité) ? */
  reducedMotion: boolean;
}

/**
 * Faut-il jouer la sortie animée avant de quitter la fiche recette ?
 *
 * Vrai uniquement dans la coquille native Capacitor, en disposition mobile, quand
 * une fiche est effectivement affichée et que l'utilisateur n'a pas réclamé la
 * réduction des animations. Faux partout ailleurs -> retour immédiat.
 *
 * @param s - Les signaux de décision.
 * @returns `true` s'il faut animer la sortie plutôt que naviguer d'emblée.
 */
export function shouldAnimateDismiss(s: DismissSignals): boolean {
  return s.onDetail && !s.isDesktop && !s.reducedMotion && isCapacitorContext(s.ctx);
}
