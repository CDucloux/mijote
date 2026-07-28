import { signInWithPopup, signInWithRedirect, signOut, deleteUser } from "firebase/auth";
import { auth, provider } from "../lib/firebase.js";
import { deleteAllUserData } from "../lib/firestore.js";

const ALLOWED_EMAIL = import.meta.env.VITE_ALLOWED_EMAIL;

// ─── COMPTE (auth + zone de danger) ───────────────────────────────────────────
// Connexion / déconnexion Google, purge ciblée des données et suppression RGPD du
// compte. Extrait d'App.jsx. Les setters d'état concernés sont injectés.
export function useAccount({ user, setUser, notify, setMealPlan, setShoppingLists, setStock, setLowStock, setRecipes, setCollections }) {
  const handleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      if (ALLOWED_EMAIL && result.user.email !== ALLOWED_EMAIL) {
        await signOut(auth);
        notify("Accès non autorisé", "error");
        return;
      }
    } catch (e) {
      if (e.code === "auth/popup-blocked") signInWithRedirect(auth, provider);
      else notify("Connexion échouée", "error");
    }
  };
  const handleSignOut = () => { signOut(auth); setUser(null); };

  // Purge de données (depuis le profil). Vide l'état local ; la synchro propage
  // l'effacement au cloud. « all » remet l'espace à zéro.
  const purgeData = (scope) => {
    if (scope === "planning" || scope === "all") setMealPlan({});
    if (scope === "shopping" || scope === "all") setShoppingLists([]);
    if (scope === "stock" || scope === "all") { setStock([]); setLowStock([]); }
    if (scope === "all") { setRecipes([]); setCollections([]); }
    notify(scope === "all" ? "Données effacées" : "Effacé", "info");
  };

  // Suppression RGPD du compte : efface les données Firestore perso, supprime le
  // compte d'authentification (avec ré-auth si Firebase l'exige), purge le local.
  const deleteAccount = async () => {
    const uid = user?.uid;
    if (!uid) return false;
    try {
      await deleteAllUserData(uid).catch(() => { /* best-effort : on supprime quand même le compte */ });
      try {
        await deleteUser(auth.currentUser);
      } catch (e) {
        if (e?.code === "auth/requires-recent-login") {
          // Firebase exige une connexion récente pour supprimer : on ré-authentifie.
          await signInWithPopup(auth, provider);
          await deleteUser(auth.currentUser);
        } else throw e;
      }
      try { Object.keys(localStorage).filter(k => k.startsWith("rf_") || k.startsWith("mijote")).forEach(k => localStorage.removeItem(k)); } catch { /* quota */ }
      setUser(null);
      return true;
    } catch {
      notify("Suppression du compte impossible. Reconnecte-toi puis réessaie.", "error");
      return false;
    }
  };

  return { handleSignIn, handleSignOut, purgeData, deleteAccount };
}
