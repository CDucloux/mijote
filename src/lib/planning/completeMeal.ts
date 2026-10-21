import { roleForCategory, type RoleId } from "./composedMeal.js";
import { suggestSides, type PlannerContext, type PlannerRecipe } from "./mealPlanner.js";
import { normalizeStr } from "../food/parseIngredient.js";
import type { Recipe } from "../types.js";

/** Recette candidate à compléter un repas : de quoi scorer, filtrer et trier. */
export type CompleteCandidate = PlannerRecipe & Pick<Recipe, "name">;

/** Les deux sections de la feuille « Compléter le repas ». */
export interface CompleteMealSections<T> {
  /** Suggestions de saison du rôle (vides pendant une recherche). */
  suggestions: T[];
  /** Le reste de la bibliothèque (ou les résultats de recherche), rôle demandé en tête. */
  library: T[];
}

/** Nombre de suggestions de saison affichées au-dessus de la bibliothèque. */
const MAX_SUGGESTIONS = 6;

/**
 * Compose les sections de la feuille « Compléter le repas ». Sans recherche : quelques
 * suggestions de saison du rôle (vivier éligible), puis TOUTE la bibliothèque restante,
 * pour qu'une recette mal catégorisée (une salade servie en entrée) reste atteignable.
 * Avec recherche : une seule liste filtrée sur la bibliothèque entière. Dans les deux
 * cas la bibliothèque place les recettes du rôle demandé en tête, puis par ordre
 * alphabétique ; le plat de base et les préparations de base sont exclus.
 *
 * @param base - Le plat que l'on complète (exclu des listes).
 * @param library - Toute la bibliothèque de l'utilisateur.
 * @param eligiblePool - Vivier éligible (préférences) où piocher les suggestions.
 * @param ctx - Contexte de scoring des suggestions.
 * @param role - Rôle recherché (entrée, accompagnement, dessert).
 * @param query - Texte de recherche brut (vide = pas de recherche).
 * @returns Les suggestions et la bibliothèque, sans doublon entre les deux.
 */
export function completeMealSections<T extends CompleteCandidate>(
  base: Pick<Recipe, "id"> | null | undefined,
  library: T[],
  eligiblePool: T[],
  ctx: PlannerContext,
  role: RoleId,
  query: string,
): CompleteMealSections<T> {
  const q = normalizeStr(query.trim());
  const isDish = (recipe: T) => !recipe.isComponent && recipe.id !== base?.id;
  const suggestions = q ? [] : suggestSides(base, eligiblePool.filter(isDish), ctx, { role, max: MAX_SUGGESTIONS });
  const taken = new Set(suggestions.map(recipe => recipe.id));
  const rest = library
    .filter(recipe => isDish(recipe) && !taken.has(recipe.id))
    .filter(recipe => !q || normalizeStr(recipe.name).includes(q));
  const inRole = (recipe: T) => (roleForCategory(recipe.category) === role ? 0 : 1);
  rest.sort((a, b) => inRole(a) - inRole(b) || (a.name || "").localeCompare(b.name || "", "fr"));
  return { suggestions, library: rest };
}
