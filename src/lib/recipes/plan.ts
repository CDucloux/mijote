/**
 * Quota de recettes du plan gratuit (Mijoté+ = illimité). Les préparations de base
 * (`isComponent`) ne comptent pas dans le quota : ce sont des briques, pas des recettes.
 *
 * @module plan
 */
import type { Recipe } from "@/lib/types.js";

/** Nombre maximal de recettes en plan gratuit. */
export const FREE_RECIPE_LIMIT = 50;

/**
 * Nombre de recettes comptées pour le quota (hors préparations de base).
 *
 * @param recipes - La bibliothèque de recettes.
 * @returns Le décompte des recettes non-composants.
 */
export function recipeQuotaCount(recipes: Recipe[]): number {
  return (recipes || []).filter(r => !r?.isComponent).length;
}

/**
 * L'ajout de `adding` recette(s) reste-t-il dans le quota du plan ?
 *
 * @param recipes - La bibliothèque actuelle.
 * @param isPlus - L'utilisateur a-t-il l'offre Mijoté+ (quota illimité) ?
 * @param adding - Nombre de recettes à ajouter (défaut 1).
 * @returns `true` si l'ajout est autorisé.
 */
export function canAddRecipes(recipes: Recipe[], isPlus: boolean, adding = 1): boolean {
  return !!isPlus || recipeQuotaCount(recipes) + adding <= FREE_RECIPE_LIMIT;
}
