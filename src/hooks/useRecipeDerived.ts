import { useMemo } from "react";
import { createIngredientResolver, type Resolver } from "@/lib/food/nameMatcher.js";
import { isRecipeInSeason } from "@/lib/food/seasonality.js";
import { isRecipeVegan } from "@/lib/food/dietary.js";
import { computeNutriInfo, buildRecipeIndex } from "@/lib/recipes/nutriscore.js";
import type { IngredientDbItem, Recipe } from "@/lib/types.js";

/** Données dérivées mémoïsées pour une recette. */
export interface RecipeDerived {
  inSeason: boolean;
  vegan: boolean;
  nutriLetter: string | null | undefined;
  healthScore: number | undefined;
}

/** Résultat du hook : résolveur d'ingrédients, index des recettes et données dérivées. */
export interface UseRecipeDerivedResult {
  resolver: Resolver;
  recipesById: ReturnType<typeof buildRecipeIndex>;
  seasonVeganById: Map<string, RecipeDerived>;
}

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
 * @param recipes - Les recettes.
 * @param ingredientDB - La base d'ingrédients (résolution nom → données).
 * @returns Le résolveur, l'index par id et les données dérivées par id de recette.
 */
export function useRecipeDerived(recipes: Recipe[], ingredientDB: IngredientDbItem[] | null | undefined): UseRecipeDerivedResult {
  const resolver = useMemo(() => createIngredientResolver((ingredientDB || []) as Parameters<typeof createIngredientResolver>[0]), [ingredientDB]);
  const recipesById = useMemo(() => buildRecipeIndex(recipes as Parameters<typeof buildRecipeIndex>[0]), [recipes]);
  const seasonVeganById = useMemo(() => {
    const m = new Map<string, RecipeDerived>();
    const db = (ingredientDB || []) as Parameters<typeof computeNutriInfo>[1];
    for (const r of recipes) {
      if (r.id == null) continue;
      const nutri = computeNutriInfo(r.ingredients, db, recipesById);
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
