/**
 * Dashboard (helpers purs pour l'onglet Accueil). Le bloc « Aujourd'hui » se dérive
 * de l'état local déjà présent (planning, listes de courses, stock bas). Fonctions
 * pures pour rester testables et réutilisables côté découverte.
 *
 * @module planning/dashboard
 */
import { slotOrder } from "@/constants/mealSlots.js";
import { aggregateShopping, type ShoppingList } from "@/lib/food/shoppingAggregate.js";
import type { DbEntry } from "@/lib/food/nameMatcher.js";
import { itemRole, roleOrder } from "@/lib/planning/composedMeal.js";
import type { IngredientDbItem, MealItem, Recipe } from "@/lib/types.js";

export type { ShoppingList };

/** Ingrédient de la base (forme minimale). */
export type DashIngredient = Pick<IngredientDbItem, "id" | "name">;

/** Repas planifié enrichi de sa recette résolue. */
export interface TodayMeal extends MealItem {
  recipe: Recipe;
}

/** Carte « repas du jour » : un repas composé (même créneau et groupe) ou un item seul. */
export interface TodayMealCard {
  slot: string | undefined;
  /** Le plat (ou à défaut le premier service), mis en avant sur la carte. */
  primary: TodayMeal;
  /** Les autres services du repas, dans l'ordre entrée → dessert. */
  others: TodayMeal[];
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
  mealPlan: Record<string, MealItem[]> = {},
  recipes: Recipe[] = [],
  key: string = todayKey(),
): TodayMeal[] {
  const entries = (mealPlan && mealPlan[key]) || [];
  const byId = new Map(recipes.map(r => [r.id, r]));
  return entries
    .map(m => ({ ...m, recipe: m.recipeId ? byId.get(m.recipeId) : undefined }))
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
  mealPlan?: Record<string, MealItem[]>;
  recipes?: Recipe[];
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
 * @returns Le résumé du jour : repas, créneau à venir, courses, stock bas, `isCalm`
 *   (rien à signaler aujourd'hui) et `isEmpty` (compte encore vierge, à distinguer
 *   d'un jour calme : sans aucune recette, on ne peut même pas planifier, il faut
 *   inviter à démarrer plutôt que rassurer avec « tout est à jour »).
 */
export function buildDashboardSummary({ mealPlan, recipes, shoppingLists, lowStock, ingredientDB, date = new Date() }: DashboardInput = {}) {
  const key = todayKey(date);
  const meals = getTodayMeals(mealPlan, recipes, key);
  const shoppingTodo = countShoppingTodo(shoppingLists, ingredientDB);
  const lowStockNames = getLowStockNames(lowStock, ingredientDB);
  const isCalm = meals.length === 0 && shoppingTodo === 0 && lowStockNames.length === 0;
  return {
    meals,
    upcomingSlot: upcomingSlot(date),
    shoppingTodo,
    lowStockNames,
    isCalm,
    isEmpty: isCalm && (recipes?.length ?? 0) === 0,
  };
}

/**
 * Regroupe les repas du jour en cartes : les items d'un repas composé (même
 * créneau et même `groupId`) forment UNE carte, le plat en tête et les autres
 * services résumés ; un item sans groupe reste une carte à lui seul. L'ordre
 * des cartes suit celui des repas (déjà triés par créneau).
 *
 * @param meals - Repas du jour, tels que rendus par {@link getTodayMeals}.
 * @returns Les cartes à afficher, dans l'ordre d'apparition.
 */
export function groupTodayMeals(meals: readonly TodayMeal[]): TodayMealCard[] {
  const groups = new Map<string, TodayMeal[]>();
  meals.forEach((meal, i) => {
    const key = `${meal.slot}|${meal.groupId || `solo-${i}`}`;
    const items = groups.get(key);
    if (items) items.push(meal); else groups.set(key, [meal]);
  });
  return [...groups.values()].map(items => {
    const sorted = [...items].sort((a, b) => roleOrder(itemRole(a, a.recipe)) - roleOrder(itemRole(b, b.recipe)));
    const primary = sorted.find(m => itemRole(m, m.recipe) === "plat") || sorted[0];
    return { slot: primary.slot, primary, others: sorted.filter(m => m !== primary) };
  });
}

/** Repas mis en avant sur l'accueil desktop, et ceux qui restent dans la journée. */
export interface HeroPick {
  hero: TodayMealCard | null;
  rest: TodayMealCard[];
}

/**
 * Choisit le repas « à venir » à mettre en avant : la première carte dont le
 * créneau n'est pas encore passé (cf. {@link upcomingSlot}) ; le soir venu, la
 * dernière carte du jour reste en tête plutôt que de laisser le héros vide.
 *
 * @param cards - Cartes du jour, triées par créneau ({@link groupTodayMeals}).
 * @param date - Date/heure de référence (défaut : maintenant).
 * @returns Le héros (`null` sans repas) et les autres cartes, dans l'ordre.
 */
export function pickHeroMeal(cards: readonly TodayMealCard[], date: Date = new Date()): HeroPick {
  if (cards.length === 0) return { hero: null, rest: [] };
  const now = slotOrder(upcomingSlot(date));
  const index = cards.findIndex(card => slotOrder(card.slot) >= now);
  const heroIndex = index === -1 ? cards.length - 1 : index;
  return { hero: cards[heroIndex], rest: cards.filter((_, i) => i !== heroIndex) };
}

/** Un jour de l'aperçu de semaine : créneaux pourvus ou libres. */
export interface WeekOverviewDay {
  key: string;
  isToday: boolean;
  isPast: boolean;
  slots: { slot: string; filled: boolean }[];
}

/** Aperçu de la semaine (lundi → dimanche) et créneaux encore libres. */
export interface WeekOverview {
  days: WeekOverviewDay[];
  /** Créneaux vides d'aujourd'hui à dimanche (le passé ne compte plus). */
  free: number;
}

/**
 * Aperçu compact de la semaine en cours pour l'accueil : pour chaque jour, quels
 * créneaux portent une recette existante. Un repas dont la recette a disparu
 * compte comme libre (il n'apparaît pas non plus dans « Aujourd'hui »).
 *
 * @param mealPlan - Le planning indexé par date.
 * @param recipes - Les recettes (un créneau n'est pourvu que si sa recette existe).
 * @param weekDays - Les 7 clés de la semaine, du lundi au dimanche.
 * @param today - Clé du jour courant.
 * @param slots - Créneaux suivis (défaut : midi et soir).
 * @returns Les 7 jours et le nombre de créneaux libres à venir.
 */
export function buildWeekOverview(mealPlan: Record<string, MealItem[]> = {}, recipes: readonly Pick<Recipe, "id">[] = [], weekDays: readonly string[], today: string, slots: readonly string[] = ["midi", "soir"]): WeekOverview {
  const known = new Set(recipes.map(r => r.id));
  let free = 0;
  const days = weekDays.map(key => {
    const items = (mealPlan[key] || []).filter(m => m.recipeId && known.has(m.recipeId));
    const isPast = key < today;
    const daySlots = slots.map(slot => ({ slot, filled: items.some(m => m.slot === slot) }));
    if (!isPast) free += daySlots.filter(s => !s.filled).length;
    return { key, isToday: key === today, isPast, slots: daySlots };
  });
  return { days, free };
}
