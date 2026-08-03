import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPublicRecipes } from "@/lib/firebase/firestore.js";
import { useOnline } from "./useOnline.js";

// ─── DÉCOUVERTE – chargement des recettes publiques ───────────────────────────
// Récupère les recettes publiques récentes une fois l'utilisateur connecté, avec
// un état de chargement/erreur et un rechargement manuel. Le filtrage (texte,
// cuisine, saison, Nutri-Score, régime…) reste pur côté composant via
// filterPublicRecipes – ce hook ne fait que l'I/O.
// Hors-ligne : le cache persistant Firestore sert ce qu'il a ; et si la 1re charge
// s'est faite sans données (hors-ligne, cache vide), on relance automatiquement
// au retour de la connexion.
// Cache module du feed public (par uid + taille). Le composant Découvrir se
// remonte à chaque retour sur l'Accueil ; sans cache, la liste repart vide et un
// re-fetch masque la page (le hold de scroll attend l'ancre de la carte). On
// réhydrate donc le dernier feed connu : affichage instantané, ancre présente
// tout de suite. La fraîcheur reste assurée par « Rafraîchir » et le reconnect.
let feedCache = { key: null, recipes: [] };

export function useDiscoverRecipes(user, { enabled = true, max = 120 } = {}) {
  const online = useOnline();
  const key = user ? `${user.uid}:${max}` : null;
  const cached = !!(key && feedCache.key === key);
  const [recipes, setRecipes] = useState(cached ? feedCache.recipes : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(cached);
  const wasOnline = useRef(online);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(false);
    try {
      const list = await fetchPublicRecipes(max);
      setRecipes(list);
      feedCache = { key: `${user.uid}:${max}`, recipes: list };
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
