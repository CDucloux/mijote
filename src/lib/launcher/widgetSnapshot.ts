/**
 * Contenu des widgets Android (« Au menu », « Courses »). Un widget ne lit ni
 * Firestore ni le réseau : l'app lui laisse un instantané à chaque changement, et
 * il le relit seul (y compris au passage de minuit, d'où les jours suivants
 * fournis d'avance plutôt que le seul jour courant).
 *
 * @module launcher/widgetSnapshot
 */
import { SLOT_BY_ID } from "@/constants/mealSlots.js";
import { aggregateShopping } from "@/lib/food/shoppingAggregate.js";
import { countShoppingTodo, getTodayMeals, todayKey } from "@/lib/planning/dashboard.js";
import type { LauncherInput } from "./shortcuts.js";

/** Un repas d'une journée du widget « Au menu ». */
export interface WidgetMeal {
  /** Libellé du créneau (« Midi », « Soir »). */
  slot: string;
  /** Couleur du créneau (`#rrggbb`), la même que dans le planning. */
  color: string;
  title: string;
  path: string;
}

/** Une journée du widget « Au menu », repérée par sa clé de planning. */
export interface WidgetDay {
  key: string;
  meals: WidgetMeal[];
}

/** Un article restant du widget « Courses ». */
export interface WidgetItem {
  name: string;
  qty: string;
}

/** Instantané complet relu par les deux widgets. */
export interface WidgetSnapshot {
  days: WidgetDay[];
  shopping: { remaining: number; items: WidgetItem[] };
}

/** Jours fournis d'avance : le widget reste juste après minuit sans relancer l'app. */
export const WIDGET_DAYS = 3;
/** Articles listés au plus : un widget 4x2 n'en montre pas davantage lisiblement. */
export const WIDGET_ITEMS = 4;

const DAY_MS = 24 * 60 * 60 * 1000;
const FALLBACK_COLOR = "#75a63f";

/**
 * Construit l'instantané des widgets.
 *
 * @param input - État du foyer (planning, recettes, listes, base d'ingrédients, instant).
 * @returns Les repas des {@link WIDGET_DAYS} prochains jours et les courses restantes.
 */
export function buildWidgetSnapshot({ mealPlan, recipes, shoppingLists = [], ingredientDB = [], date = new Date() }: LauncherInput): WidgetSnapshot {
  const days = Array.from({ length: WIDGET_DAYS }, (_, i) => {
    const key = todayKey(new Date(date.getTime() + i * DAY_MS));
    const meals = getTodayMeals(mealPlan, recipes, key).map(m => {
      const slot = SLOT_BY_ID[m.slot ?? ""];
      return { slot: slot?.label ?? "Repas", color: slot?.accent ?? FALLBACK_COLOR, title: m.recipe?.name || "Recette", path: `/recipes/${m.recipeId}` };
    });
    return { key, meals };
  });
  const items = aggregateShopping(shoppingLists, ingredientDB)
    .filter(a => !a.checked)
    .slice(0, WIDGET_ITEMS)
    .map(a => ({ name: a.name, qty: a.qtyDisplay }));
  return { days, shopping: { remaining: countShoppingTodo(shoppingLists, ingredientDB), items } };
}
