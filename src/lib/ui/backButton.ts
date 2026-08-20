/**
 * Décision du bouton retour matériel (et du geste de retour) sur Android. Par
 * défaut, faute d'écouteur, Capacitor laisse l'évènement remonter au système qui
 * ferme l'app : au lieu de ça on veut reculer dans la navigation interne, comme
 * un navigateur. La décision est pure (route + drapeau d'historique injectés) ;
 * l'exécution (naviguer, rejoindre l'accueil, quitter) est une glue fine côté
 * orchestration, cf. `useAndroidBackButton`.
 *
 * @module backButton
 */

/** Action à exécuter en réponse au bouton retour Android. */
export type BackAction = "back" | "home" | "exit";

/** Routes considérées comme racine de l'app (rien derrière : le retour y quitte). */
const ROOT_PATHS = new Set(["/", "/home"]);

/**
 * Décide de l'action du bouton retour selon la route courante et la présence d'un
 * historique de navigation dans le WebView (fourni par Capacitor).
 *
 * - Historique disponible -> on recule d'un cran (`back`), comme un navigateur.
 * - Sinon, hors de l'accueil -> on rejoint l'accueil (`home`) plutôt que sortir,
 *   pour ne jamais quitter l'app depuis une page profonde ouverte en lien direct.
 * - Sinon (déjà à l'accueil, pile vide) -> on quitte l'app (`exit`).
 *
 * @param pathname - Chemin courant (typiquement `window.location.pathname`).
 * @param canGoBack - Le WebView peut-il reculer d'un cran (drapeau Capacitor).
 * @returns L'action que la couche d'orchestration doit exécuter.
 */
export function decideBackAction(pathname: string, canGoBack: boolean): BackAction {
  if (canGoBack) return "back";
  if (ROOT_PATHS.has(pathname)) return "exit";
  return "home";
}
