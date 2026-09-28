import { useCallback, useMemo } from "react";
import { buildBatchSession, weekEntries, buildMiseEnPlace, groupCookings } from "@/lib/planning/batchSession.js";
import { buildPostesDecoupe, FORME_LABEL } from "@/lib/recipes/decoupe.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";

// Catégories dont la découpe vaut d'être mutualisée (produits frais à travailler).
const PREP_CATEGORIES = new Set(["vegetable", "herbs"]);

/**
 * Vue « session batch » dérivée du planning de la semaine visible : plats à
 * cuisiner, bases partagées, mise en place mutualisée, cuissons regroupées et
 * gestes de découpe par ingrédient, plus les compteurs du récapitulatif.
 *
 * Vue LIVE et peu coûteuse (une semaine de repas), recalculée quand le planning ou
 * la base bougent. La logique métier vit dans lib/planning/batchSession et
 * lib/recipes/decoupe ; ce hook ne fait qu'assembler et mémoïser.
 */
export function useMealBatchSession({ mealPlan, weekDays, recipes, recipesById, resolver, ingredientDB, stock }) {
  const batch = useMemo(
    () => buildBatchSession(weekEntries(mealPlan, weekDays), recipes),
    [mealPlan, weekDays, recipes],
  );
  const categoryOrder = useCallback(cat => DEFAULT_CATEGORIES[cat]?.order ?? 99, []);
  const miseEnPlace = useMemo(
    () => buildMiseEnPlace(batch.dishes, { recipesById, resolver, ingredientDB: ingredientDB || [], stockSet: new Set(stock || []), categoryOrder, includeCategories: PREP_CATEGORIES }),
    [batch, recipesById, resolver, ingredientDB, stock, categoryOrder],
  );
  const cookingGroups = useMemo(() => groupCookings(batch.dishes), [batch]);
  // Découpe mutualisée : on exploite la découpe individuelle notée sur chaque recette
  // (champ `cut` des lignes d'ingrédients) pour proposer, par ingrédient, le(s)
  // geste(s) concret(s) à faire d'un coup. Indexé par nom d'ingrédient normalisé.
  const decoupeByName = useMemo(() => {
    const lines = [];
    for (const d of batch.dishes) for (const l of (d.recipe.ingredients || [])) lines.push(l);
    const map = new Map();
    for (const p of buildPostesDecoupe(lines)) {
      const key = normalizeStr(p.name);
      const label = FORME_LABEL[p.forme] + (p.calibre ? ` (${p.calibre})` : "");
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(label);
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
      const slots = new Set();
      for (const it of (mealPlan[date] || [])) if (ids.has(it.recipeId)) slots.add(it.slot || "midi");
      n += slots.size;
    }
    return n;
  }, [mealPlan, weekDays, recipes]);
  // Cuissons réelles : seuls les plats qui cuisent (cookTime > 0), pondérés par leur
  // nombre de cuissons (une cuisson batch couvre plusieurs repas).
  const cookCount = useMemo(() => batch.dishes.reduce((s, d) => s + (Number(d.recipe.cookTime) > 0 ? d.cookings : 0), 0), [batch]);
  const prepCount = useMemo(() => miseEnPlace.reduce((n, g) => n + g.items.length, 0), [miseEnPlace]);

  return { batch, miseEnPlace, cookingGroups, decoupeByName, hasWeekDishes, mealOccasions, cookCount, prepCount };
}
