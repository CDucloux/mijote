import { useCallback, useMemo } from "react";
import { buildBatchSession, weekEntries, buildMiseEnPlace, groupCookings } from "@/lib/planning/batchSession.js";
import { buildPostesDecoupe, FORME_LABEL } from "@/lib/recipes/decoupe.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import type { IngredientLine, MealPlan, Recipe } from "@/lib/types.js";
import type { UseRecipeDerivedResult } from "./useRecipeDerived.js";

// Catégories dont la découpe vaut d'être mutualisée (produits frais à travailler).
const PREP_CATEGORIES = new Set(["vegetable", "herbs"]);

/** Dépendances de la vue session batch (données de la semaine visible). */
export interface MealBatchSessionDeps {
  mealPlan: MealPlan;
  weekDays: string[];
  recipes: Recipe[];
  recipesById: UseRecipeDerivedResult["recipesById"];
  resolver: UseRecipeDerivedResult["resolver"];
  ingredientDB?: unknown[] | null;
  stock?: string[] | null;
}

/**
 * Vue « session batch » dérivée du planning de la semaine visible : plats à
 * cuisiner, bases partagées, mise en place mutualisée, cuissons regroupées et
 * gestes de découpe par ingrédient, plus les compteurs du récapitulatif.
 *
 * Vue LIVE et peu coûteuse (une semaine de repas), recalculée quand le planning ou
 * la base bougent. La logique métier vit dans lib/planning/batchSession et
 * lib/recipes/decoupe ; ce hook ne fait qu'assembler et mémoïser.
 *
 * @param deps - Planning, semaine visible, recettes et données dérivées (voir {@link MealBatchSessionDeps}).
 */
export function useMealBatchSession({ mealPlan, weekDays, recipes, recipesById, resolver, ingredientDB, stock }: MealBatchSessionDeps) {
  const batch = useMemo(
    () => buildBatchSession(
      weekEntries(mealPlan as Parameters<typeof weekEntries>[0], weekDays),
      recipes as Parameters<typeof buildBatchSession>[1],
    ),
    [mealPlan, weekDays, recipes],
  );
  const categoryOrder = useCallback((cat: string) => (DEFAULT_CATEGORIES as Record<string, { order?: number }>)[cat]?.order ?? 99, []);
  const miseEnPlace = useMemo(
    () => buildMiseEnPlace(batch.dishes, {
      recipesById, resolver, ingredientDB: (ingredientDB || []), stockSet: new Set(stock || []), categoryOrder, includeCategories: PREP_CATEGORIES,
    } as Parameters<typeof buildMiseEnPlace>[1]),
    [batch, recipesById, resolver, ingredientDB, stock, categoryOrder],
  );
  const cookingGroups = useMemo(() => groupCookings(batch.dishes), [batch]);
  // Découpe mutualisée : on exploite la découpe individuelle notée sur chaque recette
  // (champ `cut` des lignes d'ingrédients) pour proposer, par ingrédient, le(s)
  // geste(s) concret(s) à faire d'un coup. Indexé par nom d'ingrédient normalisé.
  const decoupeByName = useMemo(() => {
    const lines: IngredientLine[] = [];
    for (const d of batch.dishes) for (const l of (d.recipe.ingredients || [])) lines.push(l);
    const map = new Map<string, Set<string>>();
    for (const p of buildPostesDecoupe(lines)) {
      const key = normalizeStr(p.name);
      const label = FORME_LABEL[p.forme] + (p.calibre ? ` (${p.calibre})` : "");
      const set = map.get(key) ?? new Set<string>();
      set.add(label);
      map.set(key, set);
    }
    return map;
  }, [batch]);
  // La semaine visible contient-elle au moins un plat (≠ base) ? Conditionne l'accès
  // à la session batch depuis le header (ré-ouvrable à tout moment).
  const hasWeekDishes = useMemo(() => {
    const ids = new Set(recipes.filter(r => !r.isComponent).map(r => r.id));
    return weekEntries(mealPlan, weekDays).some(e => ids.has(e.recipeId));
  }, [mealPlan, weekDays, recipes]);
  // Repas couverts = occasions distinctes (date × créneau) occupées par un plat,
  // un repas composé (entrée + plat + dessert sur le même créneau) compte pour 1.
  const mealOccasions = useMemo(() => {
    const ids = new Set(recipes.filter(r => !r.isComponent).map(r => r.id));
    let n = 0;
    for (const date of weekDays) {
      const slots = new Set<string>();
      for (const it of (mealPlan[date] || [])) if (ids.has(it.recipeId)) slots.add(it.slot || "midi");
      n += slots.size;
    }
    return n;
  }, [mealPlan, weekDays, recipes]);
  // Cuissons réelles : seuls les plats qui cuisent (cookTime > 0), pondérés par leur
  // nombre de cuissons (une cuisson batch couvre plusieurs repas).
  const cookCount = useMemo(() => batch.dishes.reduce((s, d) => s + (Number((d.recipe as { cookTime?: number | string }).cookTime) > 0 ? d.cookings : 0), 0), [batch]);
  const prepCount = useMemo(() => miseEnPlace.reduce((n, g) => n + g.items.length, 0), [miseEnPlace]);

  return { batch, miseEnPlace, cookingGroups, decoupeByName, hasWeekDishes, mealOccasions, cookCount, prepCount };
}
