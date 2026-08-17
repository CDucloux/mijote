/**
 * Helpers d'erreurs d'authentification, SANS dépendance à l'init Firebase (donc
 * testables unitairement sans charger le SDK). Séparé de `googleAuth`/`auth` pour
 * cette raison.
 *
 * @module authErrors
 */

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
