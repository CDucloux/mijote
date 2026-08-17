/**
 * Authentification (Google) découplée de React. Filtre l'e-mail autorisé (app
 * mono-utilisateur) et gère le repli sur la redirection quand la popup est bloquée.
 * Point d'entrée unique de la connexion/déconnexion : l'UI n'appelle jamais le SDK
 * Firebase Auth directement.
 *
 * @module auth
 */
import { signInWithRedirect, signOut, type User } from "firebase/auth";
import { auth, provider } from "@/lib/firebase/firebase.js";
import { googleSignIn } from "@/lib/firebase/googleAuth.js";
import { isCancelledSignIn } from "@/lib/firebase/authErrors.js";

/** E-mail autorisé à se connecter (app perso). Vide/absent = aucune restriction. */
export const ALLOWED_EMAIL = import.meta.env.VITE_ALLOWED_EMAIL;

/**
 * L'utilisateur est-il autorisé (e-mail dans l'allowlist) ?
 *
 * @param user - L'utilisateur Firebase (ou `null`).
 * @returns `true` si aucune restriction, ou si l'e-mail correspond à l'allowlist.
 */
export function isAllowedUser(user: User | null | undefined): boolean {
  return !ALLOWED_EMAIL || user?.email === ALLOWED_EMAIL;
}

/**
 * Connexion Google. Le canal (popup web ou SDK natif) est choisi selon la plateforme
 * par `googleSignIn`. Filtre l'e-mail autorisé (déconnecte sinon) et retombe sur la
 * redirection si la popup web est bloquée. Les annulations volontaires sont silencieuses.
 *
 * @param onError - Rappel optionnel invoqué avec un message lisible en cas d'échec.
 * @returns Une promesse résolue une fois la tentative terminée.
 */
export async function signInWithGoogle(onError?: (msg: string) => void): Promise<void> {
  try {
    const result = await googleSignIn();
    if (!isAllowedUser(result.user)) {
      await signOut(auth);
      onError?.("Accès non autorisé pour ce compte.");
    }
  } catch (e) {
    if ((e as { code?: string })?.code === "auth/popup-blocked") signInWithRedirect(auth, provider);
    else if (!isCancelledSignIn(e)) onError?.("Connexion échouée. Réessaie.");
  }
}

/**
 * Déconnexion. La bascule d'UI (retour à /login) est pilotée par l'écouteur d'auth
 * du routeur racine, ici on ne fait que révoquer la session Firebase.
 *
 * @returns Une promesse résolue une fois la session révoquée.
 */
export function signOutApp(): Promise<void> {
  return signOut(auth);
}
