/**
 * Helpers et types d'erreurs d'authentification, SANS dépendance à l'init Firebase
 * (donc testables unitairement sans charger le SDK). Séparé de `googleAuth`/`auth`
 * pour cette raison.
 *
 * @module authErrors
 */

/** Nature d'un échec de connexion NON annulé, pour choisir le bon message. */
export type SignInErrorReason = "network" | "config" | "unauthorized" | "generic";

/**
 * Résultat discriminé d'une tentative de connexion, exposé à l'UI en lieu et place
 * d'un simple `void` + callback d'erreur : le composant visuel décide de l'affichage
 * (message, ton, réarmement du bouton) sans jamais toucher au SDK.
 *
 * - `success` : session ouverte et autorisée.
 * - `cancelled` : abandon volontaire (popup fermée, flux natif annulé).
 * - `redirect` : la popup web était bloquée, on bascule sur une redirection plein
 *   écran ; la page va se recharger, aucun message à afficher.
 * - `error` : échec réel, qualifié par `reason`.
 */
export type SignInOutcome =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "redirect" }
  | { status: "error"; reason: SignInErrorReason };

/**
 * Qualifie un échec de connexion NON annulé pour router le bon message utilisateur.
 * Distingue le défaut réseau (réessayable tel quel) des défauts de configuration
 * (côté projet Firebase / OAuth) ; tout le reste retombe sur `generic`.
 *
 * @param error - L'erreur levée par la tentative de connexion.
 * @returns La catégorie d'échec.
 */
export function classifySignInError(error: unknown): SignInErrorReason {
  const code = (error as { code?: string })?.code || "";
  if (code === "auth/network-request-failed" || code === "auth/timeout") return "network";
  if (
    code === "auth/operation-not-allowed" ||
    code === "auth/invalid-api-key" ||
    code === "auth/unauthorized-domain" ||
    code === "auth/configuration-not-found" ||
    code === "auth/invalid-oauth-client-id" ||
    code === "auth/internal-error"
  ) return "config";
  // « connexion » (français) est trop ambigu (il apparaît dans des messages non
  // réseau, ex. « connexion native ») : on s'en tient à des termes réseau nets.
  const msg = (error as { message?: string })?.message || "";
  if (/network|offline|internet|réseau|hors[- ]?ligne/i.test(msg)) return "network";
  return "generic";
}

/**
 * L'échec de connexion est-il une annulation VOLONTAIRE de l'utilisateur ? À traiter
 * en silence (ni erreur, ni notification). Couvre les codes Firebase du web (popup
 * fermée/annulée) et le flux natif annulé, qui ne porte pas de code standard : on se
 * rabat alors sur le message (« cancel »/« annul »).
 *
 * @param error - L'erreur levée par la tentative de connexion.
 * @returns `true` s'il s'agit d'une annulation à ignorer.
 */
export function isCancelledSignIn(error: unknown): boolean {
  const code = (error as { code?: string })?.code || "";
  if (code === "auth/cancelled-popup-request" || code === "auth/popup-closed-by-user" || code === "auth/user-cancelled") return true;
  const msg = (error as { message?: string })?.message || "";
  return /cancel|annul/i.test(msg);
}
