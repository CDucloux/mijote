import { useCallback, useMemo } from "react";
import { useLS } from "./useLS.js";
import { buildBatchSession, weekEntries, buildMiseEnPlace } from "@/lib/planning/batchSession.js";
import { buildPostesDecoupe, FORME_LABEL } from "@/lib/recipes/decoupe.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { prepWorkOrder, planBatchCooking, planStorage, recipeHasFish, batchSettingsFor, withBatchSettings, type BatchMeal, type BatchSettings, type BatchCookInput } from "@/lib/planning/batchPlan.js";
import { dateAtClock } from "@/lib/planning/mealService.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import type { IngredientDbItem, IngredientLine, MealPlan, SavedRecipe } from "@/lib/types.js";
import type { UseRecipeDerivedResult } from "./useRecipeDerived.js";

// Catégories dont la découpe vaut d'être mutualisée (produits frais à travailler).
const PREP_CATEGORIES = new Set(["vegetable", "fruit", "herbs", "mushroom", "meat", "fish_seafood"]);

/** Dépendances de la vue session batch (données de la semaine visible). */
export interface MealBatchSessionDeps {
  mealPlan: MealPlan;
  weekDays: string[];
  recipes: SavedRecipe[];
  recipesById: UseRecipeDerivedResult["recipesById"];
  resolver: UseRecipeDerivedResult["resolver"];
  ingredientDB?: IngredientDbItem[] | null;
  stock?: string[] | null;
}

/**
 * Vue « session batch » dérivée du planning de la semaine visible : plats à
 * cuisiner, bases partagées, mise en place mutualisée (dans l'ordre de travail),
 * gestes de découpe par ingrédient, session placée à partir de son heure de début,
 * rangement frigo / congélateur de chaque repas, plus les compteurs du récapitulatif.
 * Les réglages et l'avancement (jour, heure, cuisiniers, cases cochées) sont gardés
 * par semaine sur l'appareil.
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
      weekEntries(mealPlan, weekDays),
      recipes,
    ),
    [mealPlan, weekDays, recipes],
  );
  const categoryOrder = useCallback((cat: string) => (DEFAULT_CATEGORIES as Record<string, { order?: number }>)[cat]?.order ?? 99, []);
  const miseEnPlace = useMemo(
    () => buildMiseEnPlace(batch.dishes, {
      recipesById, resolver, ingredientDB: (ingredientDB || []), stockSet: new Set(stock || []), categoryOrder, includeCategories: PREP_CATEGORIES,
    }),
    [batch, recipesById, resolver, ingredientDB, stock, categoryOrder],
  );
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
    return weekEntries(mealPlan, weekDays).some(e => !!e.recipeId && ids.has(e.recipeId));
  }, [mealPlan, weekDays, recipes]);
  // Repas couverts = occasions distinctes (date × créneau) occupées par un plat,
  // un repas composé (entrée + plat + dessert sur le même créneau) compte pour 1.
  const mealOccasions = useMemo(() => {
    const ids = new Set(recipes.filter(r => !r.isComponent).map(r => r.id));
    let n = 0;
    for (const date of weekDays) {
      const slots = new Set<string>();
      for (const it of (mealPlan[date] || [])) if (it.recipeId && ids.has(it.recipeId)) slots.add(it.slot || "midi");
      n += slots.size;
    }
    return n;
  }, [mealPlan, weekDays, recipes]);
  // Réglages et avancement de la session (jour, heure, cuisiniers, cases cochées),
  // gardés par semaine sur l'appareil.
  const weekStart = weekDays[0] ?? "";
  const [allSettings, setAllSettings] = useLS<Record<string, BatchSettings>>("rf_batchSessions", {});
  const settings = useMemo(() => batchSettingsFor(allSettings[weekStart], weekStart), [allSettings, weekStart]);
  const updateSettings = useCallback((patch: Partial<BatchSettings>) =>
    setAllSettings(prev => withBatchSettings(prev, weekStart, { ...batchSettingsFor(prev[weekStart], weekStart), ...patch })), [setAllSettings, weekStart]);
  const toggleChecked = useCallback((key: string) => setAllSettings(prev => {
    const current = batchSettingsFor(prev[weekStart], weekStart);
    const checked = current.checked.includes(key) ? current.checked.filter(k => k !== key) : [...current.checked, key];
    return withBatchSettings(prev, weekStart, { ...current, checked });
  }), [setAllSettings, weekStart]);

  const prepStages = useMemo(() => prepWorkOrder(miseEnPlace), [miseEnPlace]);
  // Session dans le temps : un passage par plat, puis les bases (avant les plats
  // qui les consomment).
  const cookInputs = useMemo<BatchCookInput[]>(() => {
    const full = (id: string) => recipesById.get(id);
    const dishInputs = batch.dishes.flatMap(d => { const r = full(d.recipe.id); return r ? [{ id: r.id, name: r.name || "Sans nom", recipe: r }] : []; });
    const baseInputs = batch.bases.flatMap(b => {
      const r = full(b.recipe.id);
      const feeds = batch.dishes.filter(d => (d.recipe.ingredients || []).some(l => l.recipeId === b.recipe.id)).map(d => d.recipe.id);
      return r ? [{ id: r.id, name: r.name || "Sans nom", recipe: r, feeds }] : [];
    });
    return [...dishInputs, ...baseInputs];
  }, [batch, recipesById]);
  // Le retard n'a pas de sens pour une session qu'on lance quand on veut : `now`
  // vaut le début, le plan ne dépend que des réglages.
  const startAt = dateAtClock(settings.day, settings.clock) ?? 0;
  const cookingPlan = useMemo(() => planBatchCooking(cookInputs, { startAt, cooks: settings.cooks, now: startAt }), [cookInputs, startAt, settings.cooks]);

  // Rangement : chaque repas de la semaine servi par un plat de la session.
  const meals = useMemo<BatchMeal[]>(() => {
    const ids = new Set(batch.dishes.map(d => d.recipe.id));
    return weekDays.flatMap(date => (mealPlan[date] || []).flatMap(it => it.recipeId && ids.has(it.recipeId) ? [{ recipeId: it.recipeId, date, slot: it.slot || "midi" }] : []));
  }, [batch, mealPlan, weekDays]);
  const storage = useMemo(() => {
    const categoryById = new Map((ingredientDB || []).map(i => [i.id, i.category]));
    return planStorage(settings.day, meals, id => { const r = recipesById.get(id); return !!r && recipeHasFish(r, dbId => categoryById.get(dbId)); });
  }, [settings.day, meals, recipesById, ingredientDB]);

  return {
    batch, decoupeByName, hasWeekDishes, mealOccasions,
    prepStages, cookingPlan, storage, meals, settings, updateSettings, toggleChecked,
  };
}
