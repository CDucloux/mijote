/**
 * Activation du feel « app native » : décide si l'app tourne dans une coquille où
 * le comportement web par défaut (sélection de texte, menu callout iOS au
 * long-press) doit être supprimé pour se rapprocher d'une vraie app. C'est le cas
 * dans la coquille Capacitor comme en PWA installée (standalone). La décision est
 * pure (booléens injectés) ; la pose de la classe `.native-feel` sur `<html>` est
 * une glue fine sans logique, cf. `markNativeFeel`.
 *
 * @module nativeFeel
 */

/** Classe posée sur `<html>` quand le feel natif est actif (cf. règles CSS). */
export const NATIVE_FEEL_CLASS = "native-feel";

/**
 * Faut-il activer le feel natif (pas de sélection de texte ni de callout) ? Vrai
 * dans l'app native (Capacitor) ou en PWA installée en standalone ; faux dans un
 * onglet de navigateur classique, où la sélection reste offerte (accessibilité).
 *
 * @param isNative - Exécution dans la coquille Capacitor (`Capacitor.isNativePlatform()`).
 * @param isStandalone - PWA installée / affichage standalone (media query ou `navigator.standalone`).
 * @returns `true` s'il faut poser le feel natif.
 */
export function shouldUseNativeFeel(isNative: boolean, isStandalone: boolean): boolean {
  return isNative || isStandalone;
}

/**
 * Pose (ou retire) la classe `.native-feel` sur l'élément racine selon la décision
 * de `shouldUseNativeFeel`. Idempotent ; sans effet si le DOM est absent (SSR/tests).
 *
 * @param root - L'élément racine à marquer (typiquement `document.documentElement`).
 * @param isNative - Exécution dans la coquille Capacitor.
 * @param isStandalone - PWA installée / affichage standalone.
 */
export function markNativeFeel(root: Element | null | undefined, isNative: boolean, isStandalone: boolean): void {
  if (!root) return;
  root.classList.toggle(NATIVE_FEEL_CLASS, shouldUseNativeFeel(isNative, isStandalone));
}
