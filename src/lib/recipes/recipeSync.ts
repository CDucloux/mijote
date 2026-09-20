/**
 * Planification des écritures de recettes pour la synchro par upsert.
 *
 * Principe d'architecture : la synchro ne fait qu'AJOUTER ou METTRE À JOUR. Elle
 * ne supprime JAMAIS une recette distante parce qu'elle est absente de l'état
 * local (ce couplage « absence = suppression » rendait un cache périmé capable
 * d'effacer des données récentes en masse). Les suppressions sont des opérations
 * explicites et ciblées (cf. `deleteSharedRecipe`), pas des déductions.
 *
 * Cette fonction est PURE (aucune I/O, aucun React) pour rester testable.
 */
import type { Recipe } from "@/lib/types.js";

/**
 * Détermine les recettes à écrire : les nouvelles (absentes de la dernière carte
 * de synchro) et les modifiées (contenu différent). Les inchangées sont ignorées
 * (pas d'écriture inutile), et les recettes sans `id` sont écartées.
 *
 * @param recipes - État courant des recettes.
 * @param lastSyncedMap - Dernière carte de synchro (id -> recette) pour le diff.
 * @returns Les recettes à écrire (upsert), toutes garanties avec un `id`.
 */
export function planRecipeUpserts(recipes: Recipe[], lastSyncedMap: Map<string, Recipe>): Recipe[] {
  const upserts: Recipe[] = [];
  for (const r of recipes) {
    if (!r.id) continue;
    const prev = lastSyncedMap.get(r.id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(r)) upserts.push(r);
  }
  return upserts;
}
