import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createIngredientResolver } from "@/lib/food/nameMatcher.js";
import { currentMonth } from "@/lib/food/seasonality.js";
import { generateWeek, GEN_STYLES, type PlannerRecipe, type PlannerContext } from "@/lib/planning/mealPlanner.js";
import type { MealItem, MealPlan, IngredientDbItem } from "@/lib/types.js";

/** Dépendances du générateur de planning (données de l'app + setter). */
export interface MealPlannerDeps {
  recipes?: PlannerRecipe[];
  ingredientDB?: IngredientDbItem[];
  preferences?: PlannerContext["preferences"];
  stock?: string[];
  mealPlan?: MealPlan;
  setMealPlan: Dispatch<SetStateAction<MealPlan>>;
}

/** Options d'une génération. */
export interface GenerateOptions {
  replace?: boolean;
  compose?: boolean;
  portionsPerMeal?: number;
  style?: string;
}

/**
 * Génération du planning (couche I/O). Assemble le contexte (résolveur d'ingrédients,
 * stock, préférences, mois) et applique `generateWeek` au `mealPlan`, avec un UNDO
 * (snapshot avant génération). Logique pure déléguée à `mealPlanner.ts`.
 *
 * @param deps - Données de l'app + `setMealPlan`.
 * @returns `{ generate, undo, canUndo }`.
 */
export function useMealPlanner({ recipes = [], ingredientDB = [], preferences = {}, stock = [], mealPlan = {}, setMealPlan }: MealPlannerDeps) {
  const resolver = useMemo(() => createIngredientResolver((ingredientDB || []) as Parameters<typeof createIngredientResolver>[0]), [ingredientDB]);
  const undoRef = useRef<MealPlan | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const generate = useCallback((dates: string[] = [], slots: string[] = ["midi", "soir"], { replace = false, compose = false, portionsPerMeal = 2, style = "equilibre" }: GenerateOptions = {}) => {
    const byId = new Map(recipes.map(r => [r.id as string, r]));
    const weights = GEN_STYLES[style] || GEN_STYLES.equilibre;
    const ctx: PlannerContext = { resolver, byId, month: currentMonth(), stockSet: new Set(stock || []), preferences: preferences || {}, weights };
    const assignments = generateWeek({ dates, slots, recipes, ctx, existing: mealPlan, replace, compose, portionsPerMeal });
    if (!assignments.length) return { count: 0 };

    undoRef.current = mealPlan; // snapshot avant modification
    setCanUndo(true);
    setMealPlan(prev => {
      const next: MealPlan = { ...prev };
      if (replace) {
        for (const date of dates) next[date] = (next[date] || []).filter(m => !slots.includes(m.slot ?? ""));
      }
      for (const a of assignments) {
        const meal: MealItem = { recipeId: a.recipeId, slot: a.slot, portions: 1 };
        if (a.role) meal.role = a.role;
        if (a.groupId) meal.groupId = a.groupId;
        next[a.date] = [...(next[a.date] || []), meal];
      }
      return next;
    });
    // Nombre de REPAS (plats), pas d'items : les accompagnements ne comptent pas double.
    return { count: assignments.filter(a => a.role !== "accompagnement").length };
  }, [recipes, resolver, stock, preferences, mealPlan, setMealPlan]);

  const undo = useCallback((): boolean => {
    if (!undoRef.current) return false;
    setMealPlan(undoRef.current);
    undoRef.current = null;
    setCanUndo(false);
    return true;
  }, [setMealPlan]);

  return { generate, undo, canUndo };
}
