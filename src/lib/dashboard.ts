/**
 * Dashboard (helpers purs pour l'onglet Accueil). Le bloc « Aujourd'hui » se dérive
 * de l'état local déjà présent (planning, listes de courses, stock bas). Fonctions
 * pures pour rester testables et réutilisables côté découverte.
 *
 * @module dashboard
 */
import { slotOrder } from "../constants/mealSlots.js";

/** Item de planning (forme minimale). */
export interface PlanEntry {
  recipeId?: string;
  portions?: number;
  slot?: string;
}

/** Recette résolue (forme minimale). */
export interface DashRecipe {
  id?: string;
  name?: string;
}

/** Liste de courses (forme minimale). */
export interface ShoppingList {
  items?: { checked?: boolean }[];
}

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
 * Nombre total d'articles non cochés sur l'ensemble des listes de courses.
 *
 * @param lists - Les listes de courses.
 * @returns Le total d'articles restant à acheter.
 */
export function countShoppingTodo(lists: ShoppingList[] = []): number {
  return lists.reduce((sum, l) => sum + ((l.items || []).filter(i => !i.checked).length), 0);
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
  ingredientDB?: DashIngredient[];
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
  const shoppingTodo = countShoppingTodo(shoppingLists);
  const lowStockNames = getLowStockNames(lowStock, ingredientDB);
  return {
    meals,
    upcomingSlot: upcomingSlot(date),
    shoppingTodo,
    lowStockNames,
    isCalm: meals.length === 0 && shoppingTodo === 0 && lowStockNames.length === 0,
  };
}
