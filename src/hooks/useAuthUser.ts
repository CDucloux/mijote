/**
 * Suit l'état d'authentification Firebase et l'expose à React.
 *
 * Trois états distincts : `undefined` (résolution en cours, avant le premier
 * callback), `null` (déconnecté) et un {@link User} (connecté). Cette distinction
 * permet au routeur d'afficher un écran de chargement plutôt que de rediriger
 * prématurément vers /login au premier rendu.
 *
 * Expose aussi `postLogin` : vrai pendant une brève fenêtre (≥ 1 s) juste après
 * une connexion effective (transition déconnecté → connecté). La connexion Google
 * peut être quasi instantanée (session en cache) ; ce délai garantit que l'écran
 * de chargement « Connexion en cours… » s'affiche au moins une seconde, plutôt
 * qu'un flash imperceptible. Ne s'applique PAS à une session déjà ouverte au
 * démarrage (aucune transition depuis l'état déconnecté).
 *
 * @module useAuthUser
 */
import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/firebase.js";

/** Durée minimale d'affichage de l'écran de connexion après un login (ms). */
const MIN_POST_LOGIN_MS = 1000;

/**
 * S'abonne à l'écouteur d'auth Firebase et renvoie l'utilisateur courant ainsi
 * qu'un indicateur de « connexion en cours » post-login.
 *
 * @returns `{ user, postLogin }` — `user` vaut `undefined` tant que l'état n'est
 *   pas résolu, `null` si déconnecté, sinon l'utilisateur ; `postLogin` est vrai
 *   pendant la fenêtre minimale d'affichage suivant une connexion.
 *
 * @example
 * ```tsx
 * const { user, postLogin } = useAuthUser();
 * if (user === undefined || postLogin) return <LoadingPage />;
 * if (!user) return <Navigate to="/login" replace />;
 * ```
 */
export function useAuthUser(): { user: User | null | undefined; postLogin: boolean } {
  const [user, setUser] = useState<User | null | undefined>(() => auth.currentUser ?? undefined);
  const [postLogin, setPostLogin] = useState(false);
  const prevUser = useRef<User | null | undefined>(user);

  useEffect(() => onAuthStateChanged(auth, u => setUser(u ?? null)), []);

  useEffect(() => {
    const prev = prevUser.current;
    prevUser.current = user;
    // Transition depuis l'état EXPLICITEMENT déconnecté (`null`, pas `undefined`)
    // vers un utilisateur : c'est une connexion effective → grâce d'1 s. Une
    // session déjà ouverte au démarrage (prev === undefined) n'y a pas droit.
    if (prev === null && user) {
      setPostLogin(true);
      const t = setTimeout(() => setPostLogin(false), MIN_POST_LOGIN_MS);
      return () => clearTimeout(t);
    }
  }, [user]);

  return { user, postLogin };
}
