/* eslint-disable react-hooks/set-state-in-effect -- hook de chargement piloté par l'URL */
import { useState, useEffect, useRef, useCallback } from "react";
import { fetchPublicDocsByIds } from "../lib/firestore.js";
import { publicId } from "../lib/publicRecipes.js";

// ─── VUE D'UNE RECETTE PUBLIQUE (pilotée par l'URL /discover/:pubId) ──────────
// pubId = "{authorUid}__{recipeId}" : l'auteur est lisible dans l'URL, la vue est
// deep-linkable et le bouton « retour » du navigateur fonctionne. Un clic interne
// passe par le cache (pas de refetch) ; un accès direct / rafraîchissement va
// chercher le doc public ET ses préparations de base.
export const DISCOVER_PREFIX = "/discover/";

export function usePublicRecipeView({ user, recipes, location, navigate }) {
  const pubId = location.pathname.startsWith(DISCOVER_PREFIX)
    ? decodeURIComponent(location.pathname.slice(DISCOVER_PREFIX.length)) || null
    : null;
  const [docs, setDocs] = useState(null); // null = aucun · undefined = chargement · { pub, components }
  const cacheRef = useRef(new Map());

  // Ouvre une recette publique : ma propre recette → ma version locale éditable ;
  // sinon route vers /discover/:pubId (en mémorisant le doc déjà chargé).
  const open = useCallback((pub, components) => {
    if (pub?.authorUid === user?.uid && recipes.some(r => r.id === pub.originalId)) {
      navigate(`/recipes/${pub.originalId}`);
      return;
    }
    cacheRef.current.set(pub.pubId, { pub, components: components || [] });
    navigate(`${DISCOVER_PREFIX}${encodeURIComponent(pub.pubId)}`);
  }, [user, recipes, navigate]);

  useEffect(() => {
    if (!pubId) { setDocs(null); return; }
    const cached = cacheRef.current.get(pubId);
    if (cached) { setDocs(cached); return; }
    let alive = true;
    setDocs(undefined);
    (async () => {
      try {
        const [pub] = await fetchPublicDocsByIds([pubId]);
        if (!alive) return;
        if (!pub) { setDocs(null); return; }
        const compIds = (pub.componentRefs || []).map(o => publicId(pub.authorUid, o));
        const comps = compIds.length ? await fetchPublicDocsByIds(compIds) : [];
        if (!alive) return;
        const v = { pub, components: comps.map(c => c.recipe) };
        cacheRef.current.set(pubId, v);
        setDocs(v);
      } catch { if (alive) setDocs(null); }
    })();
    return () => { alive = false; };
  }, [pubId]);

  return { pubId, docs, open };
}
