/**
 * Recettes enregistrées : seules les recettes identifiées s'ouvrent, se rangent ou
 * se suppriment depuis la bibliothèque.
 *
 * @module recipes/savedRecipes
 */
import type { Recipe, SavedRecipe } from "@/lib/types.js";

/**
 * La recette est-elle enregistrée (identifiant non vide) ?
 *
 * @param recipe - Recette candidate.
 */
export function isSavedRecipe(recipe: Recipe): recipe is SavedRecipe {
  return typeof recipe.id === "string" && recipe.id.length > 0;
}

const isOptional = (value: unknown, check: (v: unknown) => boolean): boolean => value === undefined || check(value);

/**
 * La valeur a-t-elle la forme d'un brouillon de recette (relu depuis un cache non
 * fiable) ? Objet dont le nom, s'il existe, est un texte et dont les ingrédients,
 * ustensiles et étapes, s'ils existent, sont des listes.
 *
 * @param raw - Valeur relue (JSON du cache de session…).
 */
export function isRecipeDraft(raw: unknown): raw is Recipe {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const r = raw as Record<string, unknown>;
  return isOptional(r.name, v => typeof v === "string")
    && isOptional(r.id, v => typeof v === "string")
    && [r.ingredients, r.utensils, r.steps].every(list => isOptional(list, Array.isArray));
}
