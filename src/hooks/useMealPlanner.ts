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
  batch?: boolean;
}

/** Clé de stockage de l'undo de génération (snapshot + semaine), pour survivre à un reload. */
const UNDO_LS_KEY = "rf_mealplan_undo";

/** Undo persisté : snapshot du planning AVANT génération + semaine (1er jour) concernée. */
interface StoredUndo { key: string; snapshot: MealPlan }

/** Relit l'undo persisté, en ignorant tout contenu malformé (jamais de throw). */
const readStoredUndo = (): StoredUndo | null => {
  try {
    const raw = localStorage.getItem(UNDO_LS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof (parsed as StoredUndo).key === "string"
      && (parsed as StoredUndo).snapshot && typeof (parsed as StoredUndo).snapshot === "object") {
      return parsed as StoredUndo;
    }
  } catch { /* JSON invalide / quota */ }
  return null;
};

/**
 * Génération du planning (couche I/O). Assemble le contexte (résolveur d'ingrédients,
 * stock, préférences, mois) et applique `generateWeek` au `mealPlan`, avec un UNDO
 * (snapshot avant génération). Logique pure déléguée à `mealPlanner.ts`.
 *
 * @param deps - Données de l'app + `setMealPlan`.
 * @returns `{ generate, undo, canUndo, undoKey }`. `undoKey` identifie la semaine
 *   (1er jour, clé `YYYY-MM-DD`) sur laquelle la dernière génération a eu lieu : l'undo
 *   ne doit être proposé QUE là, sans bloquer la génération sur les autres semaines.
 *   Le snapshot est persisté (localStorage) → l'undo survit à un rechargement de page.
 */
export function useMealPlanner({ recipes = [], ingredientDB = [], preferences = {}, stock = [], mealPlan = {}, setMealPlan }: MealPlannerDeps) {
  const resolver = useMemo(() => createIngredientResolver((ingredientDB || []) as Parameters<typeof createIngredientResolver>[0]), [ingredientDB]);
  // Amorçage depuis le stockage (une passe) : l'undo d'une génération précédente
  // reste proposé après un reload, tant qu'on ne l'a pas annulé ou re-généré.
  const undoRef = useRef<MealPlan | null>(null);
  const [undoKey, setUndoKey] = useState<string | null>(() => {
    const s = readStoredUndo();
    undoRef.current = s?.snapshot ?? null;
    return s?.key ?? null;
  });
  const [canUndo, setCanUndo] = useState(() => undoRef.current !== null);

  const generate = useCallback((dates: string[] = [], slots: string[] = ["midi", "soir"], { replace = false, compose = false, portionsPerMeal = 2, style = "equilibre", batch = false }: GenerateOptions = {}) => {
    const byId = new Map(recipes.map(r => [r.id as string, r]));
    const weights = GEN_STYLES[style] || GEN_STYLES.equilibre;
    const ctx: PlannerContext = { resolver, byId, month: currentMonth(), stockSet: new Set(stock || []), preferences: preferences || {}, weights };
    const assignments = generateWeek({ dates, slots, recipes, ctx, existing: mealPlan, replace, compose, portionsPerMeal, batch });
    if (!assignments.length) return { count: 0 };

    undoRef.current = mealPlan; // snapshot avant modification
    setCanUndo(true);
    const weekKey = dates[0] ?? null; // semaine de la génération : l'undo n'est valable que là
    setUndoKey(weekKey);
    // Persiste snapshot + semaine → l'undo survit à un rechargement de page.
    try {
      if (weekKey) localStorage.setItem(UNDO_LS_KEY, JSON.stringify({ key: weekKey, snapshot: mealPlan }));
      else localStorage.removeItem(UNDO_LS_KEY);
    } catch { /* quota */ }
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
    // Nombre de RECETTES distinctes : une même recette étalée sur plusieurs jours
    // (restes) ou apparaissant à plusieurs créneaux ne compte qu'une fois.
    return { count: new Set(assignments.map(a => a.recipeId)).size };
  }, [recipes, resolver, stock, preferences, mealPlan, setMealPlan]);

  const undo = useCallback((): boolean => {
    if (!undoRef.current) return false;
    setMealPlan(undoRef.current);
    undoRef.current = null;
    setCanUndo(false);
    setUndoKey(null);
    try { localStorage.removeItem(UNDO_LS_KEY); } catch { /* quota */ }
    return true;
  }, [setMealPlan]);

  return { generate, undo, canUndo, undoKey };
}
