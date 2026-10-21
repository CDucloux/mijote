// ─── STOCK : NIVEAU D'UN BOCAL ET RECETTES ASSOCIÉES ────────────────────────────
// Logique pure derrière le menu d'un bocal (appui long dans le Stock) : poser un
// niveau précis (plein / bientôt vide / à racheter) et lister les recettes qui
// utilisent l'ingrédient, les plus faisables d'abord.

import { PANTRY_STAPLE_CATEGORIES } from "@/constants/categories.js";
import type { IngredientResolver } from "@/lib/food/nameMatcher.js";
import type { Recipe } from "@/lib/types.js";

/** Niveau d'un ingrédient du placard : plein (en stock), bientôt vide, ou à racheter. */
export type StockLevel = "full" | "low" | "empty";

/** Le stock tel que persisté : IDs en stock, et sous-ensemble « bientôt vide ». */
export interface StockLists {
  stock: string[];
  lowStock: string[];
}

/**
 * Niveau courant d'un ingrédient. « Bientôt vide » prime : un ID présent dans
 * `lowStock` est forcément en stock (invariant entretenu par {@link applyStockLevel}).
 *
 * @param id - Identifiant de l'ingrédient.
 * @param stockSet - IDs en stock.
 * @param lowSet - IDs « bientôt vide ».
 * @returns Le niveau affiché par le bocal.
 */
export function stockLevelOf(id: string, stockSet: ReadonlySet<string>, lowSet: ReadonlySet<string>): StockLevel {
  return lowSet.has(id) ? "low" : stockSet.has(id) ? "full" : "empty";
}

const NEXT_LEVEL: Record<StockLevel, StockLevel> = { empty: "full", full: "low", low: "empty" };

/**
 * Niveau suivant du cycle déclenché par un simple tap sur un bocal :
 * à racheter, puis plein, puis bientôt vide, puis à racheter.
 *
 * @param level - Niveau courant.
 * @returns Le niveau suivant.
 */
export function nextStockLevel(level: StockLevel): StockLevel {
  return NEXT_LEVEL[level];
}

/**
 * Pose directement un niveau sur un ingrédient, en gardant `lowStock ⊆ stock` et
 * sans doublon. Renvoie les tableaux d'origine (même référence) quand rien ne
 * change, pour ne pas déclencher d'écriture inutile.
 *
 * @param lists - Le stock courant.
 * @param id - Identifiant de l'ingrédient.
 * @param level - Niveau voulu.
 * @returns Le stock mis à jour.
 */
export function applyStockLevel(lists: StockLists, id: string, level: StockLevel): StockLists {
  const { stock, lowStock } = lists;
  const inStock = stock.includes(id), isLow = lowStock.includes(id);
  const wantStock = level !== "empty", wantLow = level === "low";
  return {
    stock: wantStock === inStock ? stock : wantStock ? [...stock, id] : stock.filter(x => x !== id),
    lowStock: wantLow === isLow ? lowStock : wantLow ? [...lowStock, id] : lowStock.filter(x => x !== id),
  };
}

/** Une recette qui utilise l'ingrédient, et ce qu'il manque pour la cuisiner. */
export interface RecipeUsingIngredient {
  recipe: Recipe;
  /** Libellés (tels qu'écrits dans la recette, un par fiche) des ingrédients ni en stock ni basiques. */
  missing: string[];
}

/**
 * Recettes qui utilisent un ingrédient, triées de la plus faisable (rien ne
 * manque) à la moins faisable, puis par nom.
 *
 * Mêmes règles que le filtre « ingrédients » de la bibliothèque (rapprochement par
 * nom via `resolver`) pour que le compteur affiché corresponde au filtre ouvert.
 * Les basiques de placard (condiments, « Autres ») ne comptent jamais comme
 * manquants, comme dans l'affinité stock du planning ; une ligne non rapprochée
 * de la base est ignorée (on ne sait pas la vérifier). Une préparation de base
 * (`recipeId`) manque tant qu'elle n'est pas elle-même en stock.
 *
 * @param ingredientId - Identifiant de l'ingrédient tenu.
 * @param recipes - La bibliothèque.
 * @param resolver - Rapprochement nom de ligne vers fiche de la base.
 * @param stockSet - IDs en stock (« bientôt vide » inclus).
 * @returns Les recettes concernées, triées.
 */
export function recipesUsingIngredient(
  ingredientId: string,
  recipes: readonly Recipe[],
  resolver: IngredientResolver,
  stockSet: ReadonlySet<string>,
): RecipeUsingIngredient[] {
  const out: RecipeUsingIngredient[] = [];
  for (const recipe of recipes) {
    let uses = false;
    const missing: string[] = [];
    const seen = new Set<string>();
    for (const line of recipe.ingredients || []) {
      const label = (line.name || "").trim();
      if (line.recipeId) { if (!stockSet.has(line.recipeId) && label) missing.push(label); continue; }
      const entry = resolver(line.name);
      if (!entry) continue;
      if (entry.id === ingredientId) { uses = true; continue; }
      if (stockSet.has(entry.id) || PANTRY_STAPLE_CATEGORIES.has(entry.category ?? "")) continue;
      if (label && !seen.has(entry.id)) { seen.add(entry.id); missing.push(label); }
    }
    if (uses) out.push({ recipe, missing });
  }
  return out.sort((a, b) => a.missing.length - b.missing.length
    || (a.recipe.name || "").localeCompare(b.recipe.name || "", "fr", { sensitivity: "base" }));
}
