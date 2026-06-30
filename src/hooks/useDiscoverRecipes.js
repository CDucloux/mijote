import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPublicRecipes } from "../lib/firestore.js";
import { useOnline } from "./useOnline.js";

// ─── DÉCOUVERTE – chargement des recettes publiques ───────────────────────────
// Récupère les recettes publiques récentes une fois l'utilisateur connecté, avec
// un état de chargement/erreur et un rechargement manuel. Le filtrage (texte,
// cuisine, saison, Nutri-Score, régime…) reste pur côté composant via
// filterPublicRecipes – ce hook ne fait que l'I/O.
// Hors-ligne : le cache persistant Firestore sert ce qu'il a ; et si la 1re charge
// s'est faite sans données (hors-ligne, cache vide), on relance automatiquement
// au retour de la connexion.
export function useDiscoverRecipes(user, { enabled = true, max = 120 } = {}) {
  const online = useOnline();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const wasOnline = useRef(online);

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

  // Retour en ligne sans données → on retente (cas de la 1re charge faite hors-ligne).
  useEffect(() => {
    const reconnected = online && !wasOnline.current;
    wasOnline.current = online;
    if (reconnected && enabled && user && recipes.length === 0) load();
  }, [online, enabled, user, recipes.length, load]);

  return { recipes, loading, error, loadedOnce, online, reload: load };
}
