/**
 * Connexion Google adaptée à la plateforme d'exécution.
 *
 * Dans la coquille native (Capacitor), le `signInWithPopup` web de Firebase ne
 * fonctionne pas (pas de fenêtre popup dans la WebView). On passe alors par le SDK
 * Google NATIF via le plugin `@capacitor-firebase/authentication`, puis on ouvre la
 * MÊME session côté Firebase JS avec le credential obtenu : tout le reste de l'app
 * (Firestore, synchro) continue de s'appuyer sur l'état d'auth du SDK JS, comme sur
 * le web. Sur le web, le comportement est strictement inchangé (popup).
 *
 * @module googleAuth
 */
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, type UserCredential } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { auth, provider } from "@/lib/firebase/firebase.js";

/** Exécution dans l'app native (Capacitor) plutôt que dans un navigateur ? */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

// Connexion NATIVE : OAuth Google via le plugin (SDK natif), puis ouverture de la
// session Firebase JS avec le credential. Import dynamique : le code du plugin n'est
// chargé que dans l'app native, jamais dans le bundle web.
async function nativeGoogleSignIn(): Promise<UserCredential> {
  const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error("Jeton Google absent lors de la connexion native.");
  const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
  return signInWithCredential(auth, credential);
}

/**
 * Ouvre une session Google, par le bon canal selon la plateforme (popup web ou SDK
 * natif). Le contrôle d'autorisation (allowlist) et la gestion d'erreur restent à la
 * charge de l'appelant (cf. `signInWithGoogle` dans `auth`).
 *
 * @returns Le `UserCredential` Firebase de la session ouverte.
 */
export function googleSignIn(): Promise<UserCredential> {
  return isNativeApp() ? nativeGoogleSignIn() : signInWithPopup(auth, provider);
}
