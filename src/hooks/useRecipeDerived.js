import { useMemo } from "react";
import { createIngredientResolver } from "@/lib/food/nameMatcher.js";
import { isRecipeInSeason } from "@/lib/food/seasonality.js";
import { isRecipeVegan } from "@/lib/food/dietary.js";
import { computeNutriInfo, buildRecipeIndex } from "@/lib/recipes/nutriscore.js";

/**
 * Données dérivées par recette (saison, vegan, Nutri-Score en direct) + index et
 * résolveur d'ingrédients. Ces calculs sont COÛTEUX (isRecipeVegan remonte
 * récursivement les préparations de base, Nutri-Score par ingrédient) et portaient
 * jusqu'ici sur `RecipesPage`, remontée à CHAQUE bascule d'onglet → recalcul intégral
 * (× nb de recettes) à chaque passage sur « Recettes », de plus en plus lent quand la
 * bibliothèque grossit. En les calculant ici (dans un composant qui NE se démonte pas
 * au changement d'onglet), le résultat est mémoïsé sur `recipes`/`ingredientDB` et la
 * bascule vers « Recettes » redevient quasi instantanée.
 *
 * @param {Array} recipes - Les recettes.
 * @param {Array} ingredientDB - La base d'ingrédients (résolution nom → données).
 * @returns {{ resolver: Function, recipesById: Map, seasonVeganById: Map }}
 */
export function useRecipeDerived(recipes, ingredientDB) {
  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  const recipesById = useMemo(() => buildRecipeIndex(recipes), [recipes]);
  const seasonVeganById = useMemo(() => {
    const m = new Map();
    for (const r of recipes) {
      const nutri = computeNutriInfo(r.ingredients, ingredientDB || [], recipesById);
      m.set(r.id, {
        inSeason: isRecipeInSeason(r, resolver),
        vegan: isRecipeVegan(r, resolver, { recipes }),
        nutriLetter: nutri.letter ?? r.nutriLetter,
        healthScore: nutri.letter ? nutri.score : r.healthScore,
      });
    }
    return m;
  }, [recipes, resolver, ingredientDB, recipesById]);
  return { resolver, recipesById, seasonVeganById };
}
