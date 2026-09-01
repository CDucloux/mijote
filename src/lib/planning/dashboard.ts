/**
 * Dashboard (helpers purs pour l'onglet Accueil). Le bloc « Aujourd'hui » se dérive
 * de l'état local déjà présent (planning, listes de courses, stock bas). Fonctions
 * pures pour rester testables et réutilisables côté découverte.
 *
 * @module dashboard
 */
import { slotOrder } from "@/constants/mealSlots.js";
import { aggregateShopping, type ShoppingList } from "@/lib/food/shoppingAggregate.js";
import type { DbEntry } from "@/lib/food/nameMatcher.js";
import type { MealItem } from "@/lib/types.js";

/** Item de planning (alias de domaine). */
export type PlanEntry = MealItem;

/** Recette résolue (forme minimale). */
export interface DashRecipe {
  id?: string;
  name?: string;
}

export type { ShoppingList };

/** Ingrédient de la base (forme minimale). */
export interface DashIngredient {
  id: string;
  name?: string;
}

/** Repas planifié enrichi de sa recette résolue. */
export interface TodayMeal extends PlanEntry {
  recipe: DashRecipe | undefined;
}

/**
 * Clé ISO du jour (`YYYY-MM-DD`), cohérente avec les clés de planning.
 *
 * @param date - Date de référence (défaut : aujourd'hui).
 * @returns La clé `YYYY-MM-DD`.
 */
export function todayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Repas planifiés pour une date donnée, enrichis de la recette résolue et triés
 * matin → midi → soir.
 *
 * @param mealPlan - Le planning indexé par date.
 * @param recipes - Les recettes (résolution par id).
 * @param key - La clé du jour (défaut : aujourd'hui).
 * @returns Les repas du jour résolus et triés (repas sans recette exclus).
 */
export function getTodayMeals(
  mealPlan: Record<string, PlanEntry[]> = {},
  recipes: DashRecipe[] = [],
  key: string = todayKey(),
): TodayMeal[] {
  const entries = (mealPlan && mealPlan[key]) || [];
  const byId = new Map(recipes.map(r => [r.id, r]));
  return entries
    .map(m => ({ ...m, recipe: byId.get(m.recipeId) }))
    .filter((m): m is TodayMeal => !!m.recipe)
    .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
}

/**
 * Le créneau « à venir » selon l'heure : matin avant 11h, midi avant 15h, sinon soir.
 *
 * @param date - Date/heure de référence (défaut : maintenant).
 * @returns Le créneau à venir (`matin`, `midi` ou `soir`).
 */
export function upcomingSlot(date: Date = new Date()): "matin" | "midi" | "soir" {
  const h = date.getHours();
  return h < 11 ? "matin" : h < 15 ? "midi" : "soir";
}

/**
 * Nombre d'articles restant à acheter, tel qu'affiché dans « Toutes les courses ».
 *
 * Avec une seule liste, aucun doublon inter-listes n'est possible : on somme
 * directement les articles non cochés. Dès deux listes, la vue de courses
 * fusionne les articles identiques (le même ingrédient venu de deux recettes
 * ne compte que pour un) ; le compteur d'accueil doit refléter cette liste
 * concaténée, et non la somme brute qui gonflerait le total.
 *
 * @param lists - Les listes de courses.
 * @param ingredientDB - Base d'ingrédients pour la déduplication (>= 2 listes).
 * @returns Le nombre d'articles restant à acheter.
 */
export function countShoppingTodo(lists: ShoppingList[] = [], ingredientDB: DbEntry[] = []): number {
  if (lists.length < 2) {
    return lists.reduce((sum, l) => sum + ((l.items || []).filter(i => !i.checked).length), 0);
  }
  return aggregateShopping(lists, ingredientDB).filter(a => !a.checked).length;
}

/**
 * Noms (résolus via la base d'ingrédients) des ingrédients marqués « bientôt vide ».
 *
 * @param lowStock - Ids des ingrédients en stock bas.
 * @param ingredientDB - Base d'ingrédients (résolution id → nom).
 * @returns Les noms des ingrédients bientôt épuisés.
 */
export function getLowStockNames(lowStock: string[] = [], ingredientDB: DashIngredient[] = []): string[] {
  const byId = new Map(ingredientDB.map(i => [i.id, i]));
  return lowStock.map(id => byId.get(id)).filter((i): i is DashIngredient => !!i).map(i => i.name || "");
}

/** Entrée agrégée du résumé « Aujourd'hui ». */
export interface DashboardInput {
  mealPlan?: Record<string, PlanEntry[]>;
  recipes?: DashRecipe[];
  shoppingLists?: ShoppingList[];
  lowStock?: string[];
  ingredientDB?: DbEntry[];
  date?: Date;
}

/**
 * Agrège tout ce dont l'en-tête « Aujourd'hui » a besoin, plus un drapeau
 * « rien à signaler ».
 *
 * @param input - Sources agrégées (planning, recettes, listes, stock bas, base, date).
 * @returns Le résumé du jour : repas, créneau à venir, courses, stock bas, `isCalm`.
 */
export function buildDashboardSummary({ mealPlan, recipes, shoppingLists, lowStock, ingredientDB, date = new Date() }: DashboardInput = {}) {
  const key = todayKey(date);
  const meals = getTodayMeals(mealPlan, recipes, key);
  const shoppingTodo = countShoppingTodo(shoppingLists, ingredientDB);
  const lowStockNames = getLowStockNames(lowStock, ingredientDB);
  return {
    meals,
    upcomingSlot: upcomingSlot(date),
    shoppingTodo,
    lowStockNames,
    isCalm: meals.length === 0 && shoppingTodo === 0 && lowStockNames.length === 0,
  };
}
