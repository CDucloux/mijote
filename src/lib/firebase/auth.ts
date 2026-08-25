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
import { isCancelledSignIn, classifySignInError, type SignInOutcome } from "@/lib/firebase/authErrors.js";

export type { SignInOutcome } from "@/lib/firebase/authErrors.js";

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
 * redirection si la popup web est bloquée.
 *
 * Renvoie un résultat DISCRIMINÉ plutôt qu'un callback d'erreur : l'UI choisit seule
 * le message et le ton (cf. `signInFeedback`), sans jamais toucher au SDK. La
 * prévention du double-clic reste à la charge de l'appelant (bouton désarmé).
 *
 * @returns L'issue de la tentative : succès, annulation, redirection en cours, ou
 *   erreur qualifiée.
 */
export async function signInWithGoogle(): Promise<SignInOutcome> {
  try {
    const result = await googleSignIn();
    if (!isAllowedUser(result.user)) {
      await signOut(auth);
      return { status: "error", reason: "unauthorized" };
    }
    return { status: "success" };
  } catch (e) {
    // Popup bloquée : on bascule sur une redirection plein écran. La page va se
    // recharger (résultat repris par l'écouteur d'auth au retour), donc aucun
    // message : on signale juste que la bascule est en cours.
    if ((e as { code?: string })?.code === "auth/popup-blocked") {
      try { await signInWithRedirect(auth, provider); } catch { /* la navigation prend le relais */ }
      return { status: "redirect" };
    }
    if (isCancelledSignIn(e)) return { status: "cancelled" };
    return { status: "error", reason: classifySignInError(e) };
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
