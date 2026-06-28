import { useState, useEffect, useCallback } from "react";
import { fetchPublicRecipes } from "../lib/firestore.js";

// ─── DÉCOUVERTE — chargement des recettes publiques ───────────────────────────
// Récupère les recettes publiques récentes une fois l'utilisateur connecté, avec
// un état de chargement/erreur et un rechargement manuel. Le filtrage (texte,
// cuisine, saison, Nutri-Score, régime…) reste pur côté composant via
// filterPublicRecipes — ce hook ne fait que l'I/O.
export function useDiscoverRecipes(user, { enabled = true, max = 120 } = {}) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(false);
    try {
      setRecipes(await fetchPublicRecipes(max));
    } catch {
      setError(true);
    } finally {
      setLoading(false); setLoadedOnce(true);
    }
  }, [user, max]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement réseau au montage
  useEffect(() => { if (enabled && user && !loadedOnce) load(); }, [enabled, user, loadedOnce, load]);

  return { recipes, loading, error, loadedOnce, reload: load };
}
