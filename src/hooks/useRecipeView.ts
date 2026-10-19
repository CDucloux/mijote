import { useMemo } from "react";
import type { NavigateFunction } from "react-router-dom";
import { findIngredientMatch, createIngredientResolver, resolveLineEntry, type DbEntry } from "@/lib/food/nameMatcher.js";
import { formatParamSummary } from "@/lib/utensils/appliances.js";
import { resolveQualityRecommendation } from "@/lib/food/qualityRecommendation.js";
import { resolveUsagePrecaution } from "@/lib/utensils/usagePrecaution.js";
import { findUtensilEntry } from "@/lib/utensils/utensilLookup.js";
import { flattenForShopping } from "@/lib/recipes/recipeComponents.js";
import type { IngredientLine, Recipe, UtensilDbItem } from "@/lib/types.js";
import type { RecipeView } from "../components/recipeDetail/recipeView.js";
import type { FlatIng } from "../components/recipeDetail/ShoppingSelectSheet.js";

interface UseRecipeViewParams {
  recipe: Recipe;
  recipes: Recipe[];
  ingredientDB: DbEntry[];
  utensilDB: UtensilDbItem[];
  /** IDs en stock : ingrédients de base et préparations de base déjà réalisées. */
  stock: string[];
  /** IDs d'ingrédients marqués « bientôt vide ». */
  lowStock: string[];
  /** Facteur appliqué aux quantités (portions × moule). */
  mult: number;
  navigate: NavigateFunction;
}

/** Données dérivées de la fiche recette, partagées par ses vues et ses feuilles. */
export interface UseRecipeViewResult {
  /** Contexte de rendu des contenus mobile et desktop. */
  view: RecipeView;
  recipesById: Map<string, Recipe>;
  stockSet: Set<string>;
  /** Préparations de base à étapes, dédupliquées, affichées avant les étapes de la recette. */
  baseSteps: Recipe[];
  /** Toutes les préparations de base référencées (publiées avec la recette). */
  componentDeps: Recipe[];
  /** Ingrédients aplatis pour la feuille courses (bases éclatées en ingrédients bruts). */
  flatIngs: FlatIng[];
  isInStock: (ing: IngredientLine) => boolean;
  isLowStock: (ing: IngredientLine) => boolean;
}

/**
 * Résolveurs d'affichage de la fiche recette : fiches de base des ingrédients et
 * ustensiles (par `dbId` figé, sinon par nom), préparations de base, état du stock.
 * Regroupés ici pour que la page ne porte que l'état d'interface.
 */
export function useRecipeView({ recipe, recipes, ingredientDB, utensilDB, stock, lowStock, mult, navigate }: UseRecipeViewParams): UseRecipeViewResult {
  const stockSet = useMemo(() => new Set(stock), [stock]);
  const lowSet = useMemo(() => new Set(lowStock), [lowStock]);
  const recipesById = useMemo(() => new Map(recipes.flatMap(r => (r.id ? [[r.id, r] as const] : []))), [recipes]);
  const seasonResolver = useMemo(() => createIngredientResolver(ingredientDB), [ingredientDB]);

  const baseSteps = useMemo(() => {
    const seen = new Set<string>();
    const out: Recipe[] = [];
    for (const ing of recipe.ingredients || []) {
      if (!ing.recipeId || seen.has(ing.recipeId)) continue;
      const comp = recipesById.get(ing.recipeId);
      if (comp?.steps?.length) { seen.add(ing.recipeId); out.push(comp); }
    }
    return out;
  }, [recipe, recipesById]);

  const componentDeps = useMemo(() => {
    const ids = new Set<string>();
    for (const line of recipe.ingredients || []) if (line.recipeId) ids.add(line.recipeId);
    return [...ids].map(id => recipesById.get(id)).filter((comp): comp is Recipe => comp !== undefined);
  }, [recipe, recipesById]);

  // Une base en stock est déjà préparée : pas d'éclatement en ingrédients bruts.
  const flatIngs = useMemo(
    () => flattenForShopping(recipe.ingredients, recipesById, stockSet).map((ing, i) => ({ ...ing, _fid: String(i) })),
    [recipe.ingredients, recipesById, stockSet],
  );

  const isInStock = (ing: IngredientLine) => {
    if (ing.recipeId) return stockSet.has(ing.recipeId);
    const match = findIngredientMatch(ing.name, ingredientDB);
    return match ? stockSet.has(match.id) : false;
  };
  const isLowStock = (ing: IngredientLine) => {
    const match = findIngredientMatch(ing.name, ingredientDB);
    return match ? lowSet.has(match.id) : false;
  };

  const lineEntry = (dbId: string | undefined, name: string | undefined) => resolveLineEntry(dbId, name, ingredientDB, seasonResolver);
  const view: RecipeView = {
    mult, recipesById, seasonResolver, ingredientDB, navigate, isInStock,
    getIngImage: (dbId, name) => lineEntry(dbId, name)?.image || "",
    getIngId: ing => lineEntry(ing.dbId, ing.name)?.id || "",
    getUtImage: (dbId, name) => findUtensilEntry(utensilDB, dbId, name)?.image || "",
    // Résumé des réglages d'appareil posés sur l'étape (vide si l'ustensile n'en est pas un).
    getUtDetail: (u, step) => formatParamSummary(utensilDB.find(d => d.id === u.dbId)?.appliance, u.id ? step.utensilParams?.[u.id] : undefined),
    getIngReco: ing => resolveQualityRecommendation(lineEntry(ing.dbId, ing.name)),
    getUtPrecaution: u => resolveUsagePrecaution(findUtensilEntry(utensilDB, u.dbId, u.name)),
    resolveComp: ing => {
      if (!ing.recipeId) return null;
      const comp = recipesById.get(ing.recipeId);
      return { comp, missing: !comp };
    },
  };

  return { view, recipesById, stockSet, baseSteps, componentDeps, flatIngs, isInStock, isLowStock };
}
