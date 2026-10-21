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

/**
 * Égalité structurelle profonde de deux valeurs JSON, indépendante de l'ordre des
 * clés (Firestore ne garantit pas l'ordre d'écriture des champs à la relecture).
 *
 * @param left - Première valeur.
 * @param right - Seconde valeur.
 * @returns `true` si les deux valeurs ont le même contenu.
 */
export function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, i) => sameJson(item, right[i]));
  }
  const leftRec = left as Record<string, unknown>, rightRec = right as Record<string, unknown>;
  // `undefined` est omis par JSON (et par Firestore) : un champ absent et un champ
  // `undefined` sont donc équivalents.
  const leftKeys = Object.keys(leftRec).filter(key => leftRec[key] !== undefined);
  const rightKeys = Object.keys(rightRec).filter(key => rightRec[key] !== undefined);
  return leftKeys.length === rightKeys.length && leftKeys.every(key => sameJson(leftRec[key], rightRec[key]));
}

/**
 * Partage structurel d'un état distant reçu (snapshot) avec l'état local : chaque
 * recette distante identique (même contenu) à la recette locale de même `id`
 * reprend l'OBJET local. Les calculs mémoïsés par recette (Nutri-Score, vegan…)
 * restent valides, et si rien n'a changé (écho de notre propre écriture) l'état
 * local est rendu tel quel, ce qui évite un re-rendu complet de l'application.
 *
 * @param local - État local courant.
 * @param remote - État distant reçu.
 * @returns `local` lui-même si le contenu est identique, sinon `remote` avec les
 *   objets inchangés repris de `local`.
 */
export function reuseUnchanged<T extends Pick<Recipe, "id">>(local: readonly T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const recipe of local) if (recipe.id) byId.set(recipe.id, recipe);
  let same = local.length === remote.length;
  const merged = remote.map((recipe, i) => {
    const prev = recipe.id ? byId.get(recipe.id) : undefined;
    const kept = prev && sameJson(prev, recipe) ? prev : recipe;
    if (kept !== local[i]) same = false;
    return kept;
  });
  return same ? (local as T[]) : merged;
}
