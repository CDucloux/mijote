import { useCallback, useMemo, useRef, useState } from "react";
import { createIngredientResolver } from "../lib/nameMatcher.js";
import { currentMonth } from "../lib/seasonality.js";
import { generateWeek, GEN_STYLES } from "../lib/mealPlanner.js";

// ─── GÉNÉRATION DU PLANNING (couche I/O) ─────────────────────────────────────
// Assemble le contexte (résolveur d'ingrédients, stock, préférences, mois) et
// applique `generateWeek` au `mealPlan`, avec un UNDO (snapshot de l'état avant
// génération). Logique pure déléguée à mealPlanner.js — ce hook ne fait que le
// branchement aux données de l'app et l'écriture.
export function useMealPlanner({ recipes = [], ingredientDB = [], preferences = {}, stock = [], mealPlan = {}, setMealPlan }) {
  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  const undoRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);

  const generate = useCallback((dates = [], slots = ["midi", "soir"], { replace = false, compose = false, portionsPerMeal = 2, style = "equilibre" } = {}) => {
    const byId = new Map(recipes.map(r => [r.id, r]));
    const weights = GEN_STYLES[style] || GEN_STYLES.equilibre;
    const ctx = { resolver, byId, month: currentMonth(), stockSet: new Set(stock || []), preferences: preferences || {}, weights };
    const assignments = generateWeek({ dates, slots, recipes, ctx, existing: mealPlan, replace, compose, portionsPerMeal });
    if (!assignments.length) return { count: 0 };

    undoRef.current = mealPlan; // snapshot avant modification
    setCanUndo(true);
    setMealPlan(prev => {
      const next = { ...prev };
      if (replace) {
        for (const date of dates) next[date] = (next[date] || []).filter(m => !slots.includes(m.slot));
      }
      for (const a of assignments) {
        const meal = { recipeId: a.recipeId, slot: a.slot, portions: 1 };
        if (a.role) meal.role = a.role;
        if (a.groupId) meal.groupId = a.groupId;
        next[a.date] = [...(next[a.date] || []), meal];
      }
      return next;
    });
    // Nombre de REPAS (plats), pas d'items : les accompagnements ne comptent pas double.
    return { count: assignments.filter(a => a.role !== "accompagnement").length };
  }, [recipes, resolver, stock, preferences, mealPlan, setMealPlan]);

  const undo = useCallback(() => {
    if (!undoRef.current) return false;
    setMealPlan(undoRef.current);
    undoRef.current = null;
    setCanUndo(false);
    return true;
  }, [setMealPlan]);

  return { generate, undo, canUndo };
}
