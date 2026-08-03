/**
 * Session batch (vue dérivée du graphe, logique pure). Le batch cooking n'est PAS
 * un module : c'est une VUE dérivée du planning de la semaine et du graphe de
 * sous-recettes. On agrège :
 *   1. les plats à cuisiner (regroupés ; les portions réutilisées = une seule
 *      cuisson pour plusieurs repas — d'où le nombre de « cuissons ») ;
 *   2. les préparations de base partagées entre plusieurs recettes de la semaine,
 *      avec la quantité totale à préparer d'avance (le vrai différenciateur : rien
 *      dans une app de contenu ne connaît le rendement ni le partage des bases).
 *
 * @module batchSession
 */
import type { IngredientLine, RecipeYield } from "@/lib/types.js";

/** Item du mealPlan (forme minimale). */
export interface BatchEntry {
  recipeId?: string;
  portions?: number | string;
}

/** Ligne d'ingrédient (alias de domaine : une base est référencée par `recipeId`). */
export type BatchIngredient = IngredientLine;

/** Recette de la bibliothèque (forme minimale utilisée par le batch). */
export interface BatchRecipe {
  id: string;
  name?: string;
  isComponent?: boolean;
  servings?: number | string;
  ingredients?: BatchIngredient[];
  yield?: RecipeYield;
}

/** Plat à cuisiner, avec nombre de cuissons déduit du partage de portions. */
export interface BatchDish {
  recipe: BatchRecipe;
  meals: number;
  cookings: number;
  servings: number;
}

/** Préparation de base à cuisiner d'avance (quantité totale, dans l'unité du rendement). */
export interface BatchBase {
  recipe: BatchRecipe;
  amount: number;
  unit: string;
  usedBy: string[];
  shared: boolean;
}

/** Session batch : plats + préparations de base. */
export interface BatchSession {
  dishes: BatchDish[];
  bases: BatchBase[];
}

const num = (x: unknown): number => {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Agrège la session batch de la semaine : plats à cuisiner (regroupés, avec nombre
 * de cuissons déduit du partage de portions) et préparations de base partagées.
 *
 * @param entries - Items du mealPlan de la semaine (aplatis, tous jours/créneaux).
 * @param recipes - Bibliothèque de recettes.
 * @returns `{ dishes, bases }` : plats triés par fréquence, bases triées par partage.
 */
export function buildBatchSession(entries: BatchEntry[] = [], recipes: BatchRecipe[] = []): BatchSession {
  const byId = new Map(recipes.map(r => [r.id, r]));

  // 1. Regroupe les items par recette. Le champ `portions` (= repas couverts par
  //    une cuisson) sert à déduire le nombre de cuissons réelles.
  const groups = new Map<string, { recipe: BatchRecipe; meals: number; batch: number }>();
  for (const e of entries) {
    const r = e.recipeId != null ? byId.get(e.recipeId) : undefined;
    if (!r || r.isComponent) continue;
    let g = groups.get(r.id);
    if (!g) { g = { recipe: r, meals: 0, batch: Math.max(1, num(e.portions) || 1) }; groups.set(r.id, g); }
    g.meals++;
    g.batch = Math.max(g.batch, Math.max(1, num(e.portions) || 1));
  }

  const dishes: BatchDish[] = [...groups.values()].map(g => {
    const cookings = Math.max(1, Math.ceil(g.meals / g.batch));
    return { recipe: g.recipe, meals: g.meals, cookings, servings: cookings * (num(g.recipe.servings) || 2) };
  }).sort((a, b) => b.meals - a.meals || (a.recipe.name || "").localeCompare(b.recipe.name || ""));

  // 2. Préparations de base : pour chaque cuisson d'un plat, on somme les lignes
  //    référençant une base (× nb de cuissons), dans l'unité du rendement de la base.
  const basesMap = new Map<string, { recipe: BatchRecipe; amount: number; unit: string; usedBy: Set<string> }>();
  for (const d of dishes) {
    for (const line of d.recipe.ingredients || []) {
      if (!line.recipeId) continue;
      const base = byId.get(line.recipeId);
      if (!base || !(base.yield && num(base.yield.amount) > 0)) continue;
      let b = basesMap.get(base.id);
      if (!b) { b = { recipe: base, amount: 0, unit: base.yield.unit || "", usedBy: new Set() }; basesMap.set(base.id, b); }
      b.amount += d.cookings * num(line.amount);
      b.usedBy.add(d.recipe.name || "");
    }
  }

  const bases: BatchBase[] = [...basesMap.values()]
    .map(b => ({ recipe: b.recipe, amount: +b.amount.toFixed(2), unit: b.unit, usedBy: [...b.usedBy], shared: b.usedBy.size > 1 }))
    .sort((a, b) => Number(b.shared) - Number(a.shared) || b.usedBy.length - a.usedBy.length || (a.recipe.name || "").localeCompare(b.recipe.name || ""));

  return { dishes, bases };
}

/**
 * Aplatit le mealPlan (objet `{date: [items]}`) sur une liste de dates.
 *
 * @param mealPlan - Planning indexé par date.
 * @param dates - Dates à retenir (ISO `YYYY-MM-DD`).
 * @returns La liste d'items de tous les créneaux des dates données.
 */
export function weekEntries(mealPlan: Record<string, BatchEntry[]> = {}, dates: string[] = []): BatchEntry[] {
  const out: BatchEntry[] = [];
  for (const d of dates) for (const it of mealPlan[d] || []) out.push(it);
  return out;
}
