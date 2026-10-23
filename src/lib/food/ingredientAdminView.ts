import type { IngredientDbItem } from "@/lib/types.js";
import { matchesTrackingFilter } from "@/lib/food/ingredientTracking.js";
import type { IngredientTrackingFilter } from "@/lib/food/ingredientTracking.js";
import { countAdminCategories, groupAdminList } from "@/lib/admin/adminList.js";
import type { AdminListGroup, AdminListQuery } from "@/lib/admin/adminList.js";

type AdminIngredient = Pick<IngredientDbItem, "name" | "aliases" | "category" | "status" | "image" | "nutrition">;

/** Critères de la liste d'ingrédients de la console admin. */
export interface AdminIngredientQuery extends AdminListQuery {
  /** Filtre de suivi éditorial, `null` pour tous. */
  filter: IngredientTrackingFilter | null;
}

const ingredientCategory = (ingredient: AdminIngredient): string => ingredient.category ?? "";

/**
 * Regroupe la base d'ingrédients par catégorie pour la console admin (recherche
 * sur le nom et les alias, filtre de suivi), cf. `groupAdminList`.
 * @param ingredients - Base master.
 * @param categoryOrder - Clés de catégorie dans l'ordre d'affichage.
 * @param query - Catégorie, filtre de suivi et recherche actifs.
 * @returns Les groupes non vides, ingrédients triés par nom (français).
 */
export function groupAdminIngredients<T extends AdminIngredient>(ingredients: readonly T[], categoryOrder: readonly string[], query: AdminIngredientQuery): AdminListGroup<T>[] {
  return groupAdminList(ingredients, categoryOrder, query, {
    category: ingredientCategory,
    labels: ingredient => [ingredient.name, ...(ingredient.aliases ?? [])],
    name: ingredient => ingredient.name,
    keep: ingredient => matchesTrackingFilter(ingredient, query.filter),
  });
}

/**
 * Effectif par catégorie d'ingrédients sous un filtre de suivi.
 * @param ingredients - Base master.
 * @param filter - Filtre de suivi actif, `null` pour tous.
 * @returns Nombre d'ingrédients par clé de catégorie (clé absente = `""`).
 */
export function countByCategory(ingredients: readonly AdminIngredient[], filter: IngredientTrackingFilter | null): Record<string, number> {
  return countAdminCategories(ingredients, ingredientCategory, ingredient => matchesTrackingFilter(ingredient, filter));
}
