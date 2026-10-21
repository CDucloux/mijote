import { isRecipeInSeason } from "@/lib/food/seasonality.js";
import { isRecipeVegan } from "@/lib/food/dietary.js";
import { computeNutriInfo } from "@/lib/recipes/nutriscore.js";
import type { IngredientResolver } from "@/lib/food/nameMatcher.js";
import type { IngredientDbItem, SavedRecipe } from "@/lib/types.js";

/** Données dérivées d'une recette (saison, vegan, Nutri-Score en direct). */
export interface RecipeDerived {
  inSeason: boolean;
  vegan: boolean;
  nutriLetter: string | null | undefined;
  healthScore: number | undefined;
}

/** Contexte de calcul partagé par toutes les recettes d'un même passage. */
export interface DeriveContext {
  recipes: SavedRecipe[];
  resolver: IngredientResolver;
  ingredientDB: IngredientDbItem[];
  recipesById: Map<string, SavedRecipe>;
}

/**
 * Calcule les dérivés d'UNE recette. Coûteux : le vegan remonte récursivement les
 * préparations de base et le Nutri-Score résout chaque ingrédient.
 *
 * @param recipe - La recette.
 * @param ctx - Contexte partagé (bibliothèque, résolveur, base d'ingrédients, index).
 * @returns Ses données dérivées.
 */
export function deriveRecipe(recipe: SavedRecipe, ctx: DeriveContext): RecipeDerived {
  const nutri = computeNutriInfo(recipe.ingredients, ctx.ingredientDB, ctx.recipesById);
  return {
    inSeason: isRecipeInSeason(recipe, ctx.resolver),
    vegan: isRecipeVegan(recipe, ctx.resolver, { recipes: ctx.recipes }),
    nutriLetter: nutri.letter ?? recipe.nutriLetter,
    healthScore: nutri.letter ? nutri.score : recipe.healthScore,
  };
}

/**
 * Crée un calculateur de dérivés à cache PAR OBJET recette : quand une seule recette
 * change (bascule de carnet, note…), seul son objet est neuf, et seul lui est
 * recalculé au passage suivant. Le cache est vidé quand change ce dont TOUTES les
 * recettes dépendent : résolveur, base d'ingrédients, ou une préparation de base
 * (objet remplacé, ajoutée ou retirée), que vegan et Nutri-Score traversent.
 *
 * @param derive - Calcul unitaire (injectable pour les tests).
 * @returns Une fonction `(ctx) => Map<id, dérivés>`.
 */
export function createRecipeDerivedCache(derive: (recipe: SavedRecipe, ctx: DeriveContext) => RecipeDerived = deriveRecipe) {
  let byRecipe = new WeakMap<SavedRecipe, RecipeDerived>();
  let deps: unknown[] = [];
  return (ctx: DeriveContext): Map<string, RecipeDerived> => {
    const next: unknown[] = [ctx.resolver, ctx.ingredientDB, ...ctx.recipes.filter(recipe => recipe.isComponent)];
    if (next.length !== deps.length || next.some((dep, i) => dep !== deps[i])) byRecipe = new WeakMap();
    deps = next;
    const out = new Map<string, RecipeDerived>();
    for (const recipe of ctx.recipes) {
      if (recipe.id == null) continue;
      let derived = byRecipe.get(recipe);
      if (!derived) { derived = derive(recipe, ctx); byRecipe.set(recipe, derived); }
      out.set(recipe.id, derived);
    }
    return out;
  };
}
