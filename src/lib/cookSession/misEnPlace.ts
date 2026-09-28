import type { IngredientLine, Recipe } from "@/lib/types";
import { consumptionFraction } from "@/lib/recipes/recipeComponents";
import { findIngredientMatch, type DbEntry } from "@/lib/food/nameMatcher";
import { sortedCategoryEntries } from "@/constants/categories.js";

/** Définition d'un rayon (catégorie) telle que stockée dans les constantes. */
export interface CategoryDef {
  label?: string;
  icon?: string;
  order?: number;
}
export type CategoryMap = Record<string, CategoryDef>;

/** Rayon de la mise en place : un en-tête de catégorie et ses ingrédients. */
export interface IngredientGroup {
  key: string;
  label: string;
  icon?: string;
  items: IngredientLine[];
}

/** Préparation de base à réaliser avant la recette, avec son facteur d'échelle. */
export interface PendingComponent {
  line: IngredientLine;
  comp: Recipe;
  nestedMult: number;
}

/**
 * Regroupe les ingrédients d'une recette par rayon (catégorie), dans l'ordre
 * configuré, pour l'affichage « par catégorie » de la mise en place. La catégorie
 * d'un ingrédient est résolue par `dbId` puis, à défaut, par correspondance de nom ;
 * les ingrédients non résolus tombent dans « other ». Les rayons vides sont omis.
 */
export function groupIngredientsByCategory(
  ingredients: readonly IngredientLine[] | null | undefined,
  ingredientDB: DbEntry[],
  categories: CategoryMap,
): IngredientGroup[] {
  const buckets: Record<string, IngredientLine[]> = {};
  for (const ing of ingredients || []) {
    const info = ingredientDB.find(d => d.id === ing.dbId) || (ing.name ? findIngredientMatch(ing.name, ingredientDB) : undefined);
    const cat = info?.category || "other";
    (buckets[cat] = buckets[cat] || []).push(ing);
  }
  const entries = sortedCategoryEntries(categories) as [string, CategoryDef][];
  return entries
    .filter(([k]) => buckets[k]?.length)
    .map(([k, c]) => ({ key: k, label: c.label || k, icon: c.icon, items: buckets[k] }));
}

/**
 * Liste les préparations de base (composants) référencées par la recette et absentes
 * du stock : ce sont celles à réaliser avant de commencer. Chaque entrée porte le
 * facteur d'échelle imbriqué (`nestedMult`), produit du multiplicateur courant et de
 * la fraction consommée du composant. Les composants introuvables sont ignorés.
 */
export function buildPendingComponents(
  recipe: Recipe,
  recipesById: Map<string, Recipe> | null | undefined,
  stockSet: Set<string> | null | undefined,
  mult: number,
): PendingComponent[] {
  if (!recipesById) return [];
  const out: PendingComponent[] = [];
  for (const ing of recipe.ingredients || []) {
    if (!ing.recipeId || stockSet?.has(ing.recipeId)) continue;
    const comp = recipesById.get(ing.recipeId);
    if (!comp) continue;
    const f = consumptionFraction(ing, comp);
    out.push({ line: ing, comp, nestedMult: (mult || 1) * f });
  }
  return out;
}
