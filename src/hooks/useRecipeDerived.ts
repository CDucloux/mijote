import { useMemo, useState } from "react";
import { createIngredientResolver, type IngredientResolver } from "@/lib/food/nameMatcher.js";
import { buildRecipeIndex } from "@/lib/recipes/nutriscore.js";
import { createRecipeDerivedCache, type RecipeDerived } from "@/lib/recipes/recipeDerived.js";
import type { IngredientDbItem, SavedRecipe } from "@/lib/types.js";

/** Résultat du hook : résolveur d'ingrédients, index des recettes et données dérivées. */
export interface UseRecipeDerivedResult {
  resolver: IngredientResolver;
  recipesById: Map<string, SavedRecipe>;
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
export function useRecipeDerived(recipes: SavedRecipe[], ingredientDB: IngredientDbItem[] | null | undefined): UseRecipeDerivedResult {
  const resolver = useMemo(() => createIngredientResolver(ingredientDB), [ingredientDB]);
  const recipesById = useMemo(() => buildRecipeIndex(recipes), [recipes]);
  // Cache par objet recette (cf. createRecipeDerivedCache) : une bascule de carnet
  // ne recalcule que la recette touchée, plus toute la bibliothèque.
  // Repli mémoïsé : un `[]` neuf à chaque rendu viderait le cache à chaque passage.
  const db = useMemo(() => ingredientDB || [], [ingredientDB]);
  const [deriveAll] = useState(() => createRecipeDerivedCache());
  const seasonVeganById = useMemo(
    () => deriveAll({ recipes, resolver, ingredientDB: db, recipesById }),
    [deriveAll, recipes, resolver, db, recipesById],
  );
  return { resolver, recipesById, seasonVeganById };
}
