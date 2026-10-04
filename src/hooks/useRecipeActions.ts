import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { recomputeCollectionCounts } from "@/lib/recipes/recipeActions.js";
import { canAddRecipes, FREE_RECIPE_LIMIT } from "@/lib/recipes/plan.js";
import { newGroupId, roleForCategory } from "@/lib/planning/composedMeal.js";
import { DEFAULT_PREFERENCES } from "../constants/preferences.js";
import type { Recipe, Collection, MealPlan } from "@/lib/types.js";
import type { ActivityInput } from "@/lib/notifications/activity.js";

type Preferences = typeof DEFAULT_PREFERENCES;

/** Dépendances injectées (état de l'app + setters + notify/navigate). */
export interface RecipeActionsDeps {
  recipes: Recipe[];
  setRecipes: Dispatch<SetStateAction<Recipe[]>>;
  setCollections: Dispatch<SetStateAction<Collection[]>>;
  setMealPlan: Dispatch<SetStateAction<MealPlan>>;
  setPreferences: Dispatch<SetStateAction<Preferences>>;
  isPlus: boolean;
  notify: (msg: string, type?: string) => void;
  navigate: (path: string) => void;
  logActivity: (input: ActivityInput) => void;
}

/**
 * Actions secondaires sur les recettes, partagées par la fiche et le menu d'appui
 * long de la liste : carnets, planning, journal de cuisine, duplication.
 *
 * @param deps - État de l'app, setters et `notify`/`navigate`.
 * @returns `{ guardQuota, toggleRecipeCollection, addRecipeToMealPlan, logCooked, duplicateRecipe }`.
 */
export function useRecipeActions({ recipes, setRecipes, setCollections, setMealPlan, setPreferences, isPlus, notify, navigate, logActivity }: RecipeActionsDeps) {
  // Quota du plan gratuit : faux (et redirection vers l'offre) au-delà de la limite.
  const guardQuota = useCallback((): boolean => {
    if (canAddRecipes(recipes, isPlus, 1)) return true;
    notify(`Plan gratuit limité à ${FREE_RECIPE_LIMIT} recettes. Passe à Cardamome+ pour en créer plus.`, "warning");
    navigate("/plan");
    return false;
  }, [recipes, isPlus, notify, navigate]);

  const toggleRecipeCollection = useCallback((recipeId: string, colId: string) => {
    setRecipes(prev => {
      const updated = prev.map(r => {
        if (r.id !== recipeId) return r;
        const cols = r.collections || [];
        return { ...r, collections: cols.includes(colId) ? cols.filter(c => c !== colId) : [...cols, colId] };
      });
      setCollections(c => recomputeCollectionCounts(c, updated));
      return updated;
    });
  }, [setRecipes, setCollections]);

  const addRecipeToMealPlan = useCallback((recipe: Recipe, date: string, portions?: number, slot?: string) => {
    setMealPlan(prev => ({ ...prev, [date]: [...(prev[date] || []), { recipeId: recipe.id, portions: portions || 1, slot: slot || "midi", groupId: newGroupId(), role: roleForCategory(recipe.category) }] }));
    notify("Ajouté au planning");
    logActivity({ type: "mealplan.add", target: recipe.name });
  }, [setMealPlan, notify, logActivity]);

  // Journal de cuisine (préférences synchronisées) : c'est lui, et non le planning,
  // qui alimente la heatmap d'activité du profil.
  const logCooked = useCallback((recipeId: string) => {
    if (!recipeId) return;
    const day = new Date().toISOString().slice(0, 10);
    setPreferences(p => {
      const base = { ...DEFAULT_PREFERENCES, ...(p || {}) };
      const log: Record<string, string[]> = { ...(base.cookLog as Record<string, string[]>) };
      log[day] = [...(log[day] || []), recipeId].slice(-50); // borne raisonnable par jour
      return { ...base, cookLog: log };
    });
    const cooked = recipes.find(r => r.id === recipeId);
    if (cooked) logActivity({ type: "recipe.cooked", target: cooked.name, targetId: cooked.id });
  }, [setPreferences, recipes, logActivity]);

  // Copie privée (sans lien public), nom suffixée, en tête de liste.
  const duplicateRecipe = useCallback((recipe: Recipe) => {
    if (!guardQuota()) return;
    const copy: Recipe = { ...recipe, id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: `${recipe.name} (copie)`, createdAt: Date.now(), updatedAt: Date.now() };
    delete copy.visibility; delete copy.publicId; delete copy.clonedFrom;
    setRecipes(prev => {
      const next = [copy, ...prev];
      setCollections(c => recomputeCollectionCounts(c, next));
      return next;
    });
    notify("Recette dupliquée");
    logActivity({ type: "recipe.add", target: copy.name });
  }, [guardQuota, setRecipes, setCollections, notify, logActivity]);

  return { guardQuota, toggleRecipeCollection, addRecipeToMealPlan, logCooked, duplicateRecipe };
}
