import type { IngredientDbItem } from "@/lib/types.js";
import { matchesTrackingFilter } from "@/lib/food/ingredientTracking.js";
import type { IngredientTrackingFilter } from "@/lib/food/ingredientTracking.js";
import { normalizeName } from "@/lib/food/nameMatcher.js";

type AdminIngredient = Pick<IngredientDbItem, "name" | "aliases" | "category" | "status" | "image" | "nutrition">;

/** Critères de la liste d'ingrédients de la console admin. */
export interface AdminIngredientQuery {
  /** Clé de catégorie retenue, `null` pour toutes. */
  category: string | null;
  /** Filtre de suivi éditorial, `null` pour tous. */
  filter: IngredientTrackingFilter | null;
  /** Recherche libre sur le nom et les alias (casse et accents ignorés). */
  search: string;
}

/** Ingrédients d'une catégorie, triés par nom. */
export interface AdminIngredientGroup<T> {
  category: string;
  items: T[];
}

function matchesSearch(ingredient: AdminIngredient, needle: string): boolean {
  if (!needle) return true;
  return [ingredient.name, ...(ingredient.aliases ?? [])].some(label => normalizeName(label).includes(needle));
}

/**
 * Regroupe la base d'ingrédients par catégorie pour la console admin, dans
 * l'ordre des catégories fourni, après filtre de suivi et recherche. Les
 * catégories absentes de l'ordre (clé inconnue ou manquante) suivent, triées,
 * pour qu'aucune fiche ne disparaisse de la console. Seuls les groupes non vides
 * sont rendus.
 * @param ingredients - Base master.
 * @param categoryOrder - Clés de catégorie dans l'ordre d'affichage.
 * @param query - Catégorie, filtre de suivi et recherche actifs.
 * @returns Les groupes non vides, ingrédients triés par nom (français).
 */
export function groupAdminIngredients<T extends AdminIngredient>(ingredients: readonly T[], categoryOrder: readonly string[], query: AdminIngredientQuery): AdminIngredientGroup<T>[] {
  const needle = normalizeName(query.search);
  const byCategory = new Map<string, T[]>();
  for (const ingredient of ingredients) {
    const category = ingredient.category ?? "";
    if (query.category !== null && category !== query.category) continue;
    if (!matchesTrackingFilter(ingredient, query.filter) || !matchesSearch(ingredient, needle)) continue;
    const bucket = byCategory.get(category);
    if (bucket) bucket.push(ingredient);
    else byCategory.set(category, [ingredient]);
  }
  const known = new Set(categoryOrder);
  const unknown = [...byCategory.keys()].filter(key => !known.has(key)).sort();
  return [...categoryOrder, ...unknown]
    .filter(category => byCategory.has(category))
    .map(category => ({
      category,
      items: (byCategory.get(category) ?? []).sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" })),
    }));
}

/**
 * Effectif par catégorie sous un filtre de suivi, pour la navigation par
 * catégorie (les compteurs suivent le filtre actif, pas la recherche).
 * @param ingredients - Base master.
 * @param filter - Filtre de suivi actif, `null` pour tous.
 * @returns Nombre d'ingrédients par clé de catégorie (clé absente = `""`).
 */
export function countByCategory(ingredients: readonly AdminIngredient[], filter: IngredientTrackingFilter | null): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ingredient of ingredients) {
    if (!matchesTrackingFilter(ingredient, filter)) continue;
    const category = ingredient.category ?? "";
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
}
