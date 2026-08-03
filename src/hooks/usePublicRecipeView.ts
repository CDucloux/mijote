import { useState, useEffect, useRef, useCallback } from "react";
import { fetchPublicDocsByIds } from "@/lib/firebase/firestore.js";
import { publicId } from "@/lib/household/publicRecipes.js";
import type { DocumentData } from "firebase/firestore";

// ─── VUE D'UNE RECETTE PUBLIQUE (pilotée par l'URL /discover/:pubId) ──────────
// pubId = "{authorUid}__{recipeId}" : l'auteur est lisible dans l'URL, la vue est
// deep-linkable et le bouton « retour » du navigateur fonctionne. Un clic interne
// précharge le doc déjà connu (aucun flash) ; un accès direct / rafraîchissement va
// chercher le doc public ET ses préparations de base.
export const DISCOVER_PREFIX = "/discover/";

/** Valeur d'entrée : `undefined` (chargement), `null` (introuvable) ou le doc + bases. */
type ViewValue = undefined | null | { pub: DocumentData; components: unknown[] };
/** Entrée courante, étiquetée par son pubId. */
interface Entry { id: string; value: ViewValue }

/** Dépendances : utilisateur, recettes locales, `location` et `navigate` du routeur. */
export interface PublicRecipeViewDeps {
  user: { uid?: string } | null | undefined;
  recipes: { id?: string }[];
  location: { pathname: string };
  navigate: (path: string, opts?: { state?: unknown }) => void;
}

/**
 * Vue d'une recette publique pilotée par l'URL `/discover/:pubId`. Un clic interne
 * précharge le doc connu (aucun flash) ; un accès direct va chercher le doc public
 * et ses préparations de base.
 *
 * @param deps - Utilisateur, recettes locales, `location` et `navigate`.
 * @returns `{ pubId, docs, open }` (`docs` = `undefined` en chargement, `null` si introuvable).
 */
export function usePublicRecipeView({ user, recipes, location, navigate }: PublicRecipeViewDeps) {
  const pubId = location.pathname.startsWith(DISCOVER_PREFIX)
    ? decodeURIComponent(location.pathname.slice(DISCOVER_PREFIX.length)) || null
    : null;
  // Entrée courante étiquetée par son pubId : { id, value } où value vaut
  // undefined (chargement), null (introuvable) ou { pub, components }.
  const [entry, setEntry] = useState<Entry | null>(null);
  // Miroir lu UNIQUEMENT dans l'effet (jamais au rendu) pour décider d'un refetch.
  const entryRef = useRef<Entry | null>(null);
  useEffect(() => { entryRef.current = entry; });

  // Ouvre une recette publique : ma propre recette → ma version locale éditable ;
  // sinon précharge le doc connu et route vers /discover/:pubId.
  const open = useCallback((pub: DocumentData, components?: unknown[]) => {
    if (pub?.authorUid === user?.uid && recipes.some(r => r.id === pub.originalId)) {
      // On vient de Découvrir (Accueil) : on mémorise l'origine pour que le bouton
      // « retour » de la fiche perso revienne à l'Accueil et non à la liste Recettes.
      navigate(`/recipes/${pub.originalId}`, { state: { fromPath: "/home" } });
      return;
    }
    setEntry({ id: pub.pubId, value: { pub, components: components || [] } });
    navigate(`${DISCOVER_PREFIX}${encodeURIComponent(pub.pubId)}`);
  }, [user, recipes, navigate]);

  useEffect(() => {
    if (!pubId) return;
    const cur = entryRef.current;
    if (cur && cur.id === pubId && cur.value !== undefined) return; // déjà résolu (préchargé / fetché)
    let alive = true;
    setEntry({ id: pubId, value: undefined }); // chargement
    (async () => {
      try {
        const [pub] = await fetchPublicDocsByIds([pubId]);
        if (!alive) return;
        if (!pub) { setEntry({ id: pubId, value: null }); return; }
        const compIds = ((pub.componentRefs || []) as string[]).map(o => publicId(pub.authorUid, o));
        const comps = compIds.length ? await fetchPublicDocsByIds(compIds) : [];
        if (!alive) return;
        setEntry({ id: pubId, value: { pub, components: comps.map(c => c.recipe) } });
      } catch { if (alive) setEntry({ id: pubId, value: null }); }
    })();
    return () => { alive = false; };
  }, [pubId]);

  // Valeur effective dérivée du STATE (aucune lecture de ref au rendu) : si l'entrée
  // ne correspond pas encore au pubId courant → « chargement », pas « introuvable »
  // (évite le clignotement « Recette non trouvée » sur l'état de l'URL précédente).
  const docs = !pubId ? null : (entry && entry.id === pubId ? entry.value : undefined);

  return { pubId, docs, open };
}
