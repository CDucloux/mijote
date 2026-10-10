/**
 * Raccourcis de l'icône Android (appui long) : quatre accès choisis selon l'état
 * du foyer plutôt qu'une liste figée. Le prochain repas planifié passe devant
 * (c'est ce qu'on vient chercher en ouvrant l'app à 18h), les courses affichent
 * ce qu'il reste à acheter, et l'import photo reste à portée de pouce.
 *
 * @module launcher/shortcuts
 */
import { SLOT_BY_ID, slotOrder } from "@/constants/mealSlots.js";
import { countShoppingTodo, getTodayMeals, todayKey, upcomingSlot, type DashRecipe, type TodayMeal } from "@/lib/planning/dashboard.js";
import type { ShoppingList } from "@/lib/food/shoppingAggregate.js";
import type { DbEntry } from "@/lib/food/nameMatcher.js";
import type { MealPlan } from "@/lib/types.js";

/** Glyphe d'un raccourci. Miroir des drawables `ic_shortcut_<icon>` côté Android. */
export type ShortcutIcon = "meal" | "cart" | "camera" | "calendar" | "book";

/** Un raccourci tel que le pousse le plugin natif `Launcher`. */
export interface LauncherShortcut {
  /** Identifiant stable : le lanceur s'en sert pour garder un raccourci épinglé. */
  id: string;
  /** Libellé court (~10 caractères), quand la place manque. */
  shortLabel: string;
  /** Libellé complet affiché dans le menu. */
  longLabel: string;
  /** Chemin d'app ouvert au tap. */
  path: string;
  icon: ShortcutIcon;
}

/** État du foyer dont les raccourcis se déduisent. */
export interface LauncherInput {
  mealPlan?: MealPlan;
  recipes?: DashRecipe[];
  shoppingLists?: ShoppingList[];
  ingredientDB?: DbEntry[];
  date?: Date;
}

/** Repas à venir et l'accroche qui le situe dans le temps (« Ce soir », « Demain midi »). */
export interface NextMeal {
  meal: TodayMeal;
  when: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Prochain repas planifié : le premier créneau d'aujourd'hui pas encore passé,
 * sinon le premier de demain.
 *
 * @param input - Planning, recettes et instant de référence.
 * @returns Le repas et son accroche, ou `null` si rien n'est prévu d'ici demain.
 */
export function nextMeal({ mealPlan, recipes, date = new Date() }: LauncherInput): NextMeal | null {
  const from = slotOrder(upcomingSlot(date));
  const today = getTodayMeals(mealPlan, recipes, todayKey(date)).find(m => slotOrder(m.slot) >= from);
  if (today) return { meal: today, when: SLOT_BY_ID[today.slot ?? ""]?.today ?? "Aujourd'hui" };
  const [tomorrow] = getTodayMeals(mealPlan, recipes, todayKey(new Date(date.getTime() + DAY_MS)));
  if (!tomorrow) return null;
  const slot = SLOT_BY_ID[tomorrow.slot ?? ""];
  return { meal: tomorrow, when: slot ? `Demain ${slot.label.toLowerCase()}` : "Demain" };
}

/**
 * Les quatre raccourcis de l'icône, du plus contextuel au plus générique.
 *
 * @param input - État du foyer (planning, recettes, listes, base d'ingrédients, instant).
 * @returns Les raccourcis dans l'ordre d'affichage.
 */
export function buildShortcuts(input: LauncherInput): LauncherShortcut[] {
  const next = nextMeal(input);
  const todo = countShoppingTodo(input.shoppingLists, input.ingredientDB);
  const meal: LauncherShortcut = next
    ? { id: "next-meal", shortLabel: next.when, longLabel: `${next.when} : ${next.meal.recipe?.name || "la recette"}`, path: `/recipes/${next.meal.recipeId}`, icon: "meal" }
    : { id: "plan-week", shortLabel: "Planifier", longLabel: "Planifier la semaine", path: "/meal-plan", icon: "calendar" };
  return [
    meal,
    { id: "shopping", shortLabel: "Courses", longLabel: todo ? `Courses · ${todo} à acheter` : "Liste de courses", path: "/shopping-lists", icon: "cart" },
    { id: "import-photo", shortLabel: "En photo", longLabel: "Ajouter une recette en photo", path: "/recipes/import-from-picture", icon: "camera" },
    next
      ? { id: "meal-plan", shortLabel: "Planning", longLabel: "Planning de la semaine", path: "/meal-plan", icon: "calendar" }
      : { id: "recipes", shortLabel: "Recettes", longLabel: "Mes recettes", path: "/recipes", icon: "book" },
  ];
}
