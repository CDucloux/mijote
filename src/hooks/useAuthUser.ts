/**
 * Suit l'état d'authentification Firebase et l'expose à React.
 *
 * Trois états distincts : `undefined` (résolution en cours, avant le premier
 * callback), `null` (déconnecté) et un {@link User} (connecté). Cette distinction
 * permet au routeur d'afficher un écran de chargement plutôt que de rediriger
 * prématurément vers /login au premier rendu.
 *
 * @module useAuthUser
 */
import { useState, useEffect } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/firebase.js";

/**
 * S'abonne à l'écouteur d'auth Firebase et renvoie l'utilisateur courant.
 *
 * @returns `undefined` tant que l'état n'est pas résolu, `null` si déconnecté,
 *   sinon l'utilisateur Firebase connecté.
 *
 * @example
 * ```tsx
 * const user = useAuthUser();
 * if (user === undefined) return <LoadingPage />;
 * if (!user) return <Navigate to="/login" replace />;
 * ```
 */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(() => auth.currentUser ?? undefined);
  useEffect(() => onAuthStateChanged(auth, u => setUser(u ?? null)), []);
  return user;
}
