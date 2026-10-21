/**
 * Contenu des widgets Android (« Au menu », « Courses »). Un widget ne lit ni
 * Firestore ni le réseau : l'app lui laisse un instantané à chaque changement, et
 * il le relit seul (y compris au passage de minuit, d'où les jours suivants
 * fournis d'avance plutôt que le seul jour courant).
 *
 * @module launcher/widgetSnapshot
 */
import { SLOT_BY_ID } from "@/constants/mealSlots.js";
import { aggregateShopping, type Contributor } from "@/lib/food/shoppingAggregate.js";
import { capitalize, fmtTime } from "@/lib/format.js";
import { countShoppingTodo, getTodayMeals, todayKey } from "@/lib/planning/dashboard.js";
import type { LauncherInput } from "./shortcuts.js";

type WidgetRecipe = NonNullable<LauncherInput["recipes"]>[number];

/** Un repas d'une journée du widget « Au menu ». */
export interface WidgetMeal {
  /** Libellé du créneau (« Midi », « Soir »). */
  slot: string;
  /** Couleur du créneau (`#rrggbb`), la même que dans le planning. */
  color: string;
  title: string;
  /** Ligne secondaire (« 45m · 4 pers. »), vide quand on ne sait rien. */
  meta: string;
  /** Photo de la recette (http(s) seulement, le widget la télécharge), ou `""`. */
  image: string;
  path: string;
}

/** Une journée du widget « Au menu », repérée par sa clé de planning. */
export interface WidgetDay {
  key: string;
  meals: WidgetMeal[];
}

/** Un article restant du widget « Courses », cochable depuis l'écran d'accueil. */
export interface WidgetItem {
  /** Clé de l'article agrégé : identifie la case cochée côté natif. */
  key: string;
  name: string;
  qty: string;
  /** Articles réels à cocher dans l'app quand le widget coche celui-ci. */
  refs: Contributor[];
}

/** Instantané complet relu par les deux widgets. */
export interface WidgetSnapshot {
  days: WidgetDay[];
  shopping: { remaining: number; items: WidgetItem[] };
}

/** Jours fournis d'avance : le widget reste juste après minuit sans relancer l'app. */
export const WIDGET_DAYS = 3;
/** Articles listés au plus : la liste défile, mais l'instantané reste léger. */
export const WIDGET_ITEMS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const FALLBACK_COLOR = "#75a63f";

/** Photo exploitable par le widget : une URL http(s), jamais un data URI ni un blob. */
const remoteImage = (url: string | undefined): string => (url && /^https?:\/\//.test(url) ? url : "");

/**
 * Ligne secondaire d'un repas : durée totale et portions, chacune omise si inconnue.
 *
 * @param recipe - La recette (temps de préparation et de cuisson).
 * @param portions - Portions planifiées pour ce repas.
 * @returns Par exemple `"1h30 · 4 pers."`, ou `""`.
 */
export function mealMeta(recipe: WidgetRecipe | undefined, portions: number | undefined): string {
  const total = (Number(recipe?.prepTime) || 0) + (Number(recipe?.cookTime) || 0);
  const parts = [total > 0 ? fmtTime(total) : "", portions && portions > 0 ? `${portions} pers.` : ""];
  return parts.filter(Boolean).join(" · ");
}

/**
 * Construit l'instantané des widgets.
 *
 * @param input - État du foyer (planning, recettes, listes, base d'ingrédients, instant).
 * @returns Les repas des {@link WIDGET_DAYS} prochains jours et les courses restantes.
 */
export function buildWidgetSnapshot({ mealPlan, recipes = [], shoppingLists = [], ingredientDB = [], date = new Date() }: LauncherInput): WidgetSnapshot {
  const byId = new Map(recipes.map(recipe => [recipe.id, recipe]));
  const days = Array.from({ length: WIDGET_DAYS }, (_, i) => {
    const key = todayKey(new Date(date.getTime() + i * DAY_MS));
    const meals = getTodayMeals(mealPlan, recipes, key).map(m => {
      const slot = SLOT_BY_ID[m.slot ?? ""];
      const recipe = byId.get(m.recipeId);
      return {
        slot: slot?.label ?? "Repas", color: slot?.accent ?? FALLBACK_COLOR, title: m.recipe?.name || "Recette",
        meta: mealMeta(recipe, m.portions), image: remoteImage(recipe?.image), path: `/recipes/${m.recipeId}`,
      };
    });
    return { key, meals };
  });
  const items = aggregateShopping(shoppingLists, ingredientDB)
    .filter(a => !a.checked)
    .slice(0, WIDGET_ITEMS)
    .map(a => ({ key: a.key, name: capitalize(a.name), qty: a.qtyDisplay, refs: a.contributors }));
  return { days, shopping: { remaining: countShoppingTodo(shoppingLists, ingredientDB), items } };
}
