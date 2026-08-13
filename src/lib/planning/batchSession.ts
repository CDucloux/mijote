/**
 * Session batch (vue dérivée du graphe, logique pure). Le batch cooking n'est PAS
 * un module : c'est une VUE dérivée du planning de la semaine et du graphe de
 * sous-recettes. On agrège :
 *   1. les plats à cuisiner (regroupés ; les portions réutilisées = une seule
 *      cuisson pour plusieurs repas, d'où le nombre de « cuissons ») ;
 *   2. les préparations de base partagées entre plusieurs recettes de la semaine,
 *      avec la quantité totale à préparer d'avance (le vrai différenciateur : rien
 *      dans une app de contenu ne connaît le rendement ni le partage des bases).
 *
 * @module batchSession
 */
import type { IngredientLine, RecipeYield } from "@/lib/types.js";
import { flattenForShopping, type ComponentRecipe } from "@/lib/recipes/recipeComponents.js";
import { recipeCookingMethods, COOKING_METHODS } from "@/lib/recipes/cooking.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";

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

// ─── MISE EN PLACE MUTUALISÉE (par ingrédient) ────────────────────────────────
// Le cœur du batch cooking : au lieu de préparer chaque recette isolément, on
// prépare une seule fois TOUS les oignons de la semaine, TOUTES les tomates, etc.
// On agrège les ingrédients bruts de tous les plats (bases éclatées incluses),
// sommés par ingrédient et par unité, groupés par catégorie dans l'ordre de mise
// en place, avec le geste de préparation et la conversion en pièces.

/** Élément de base d'ingrédient (résolveur nom → id). */
export interface PrepResolver { (name: string | null | undefined): { id: string } | null }

/** Ingrédient de la base enrichi (catégorie, poids/pièce, image, conseils). */
export interface PrepDbItem {
  id: string;
  name?: string;
  category?: string;
  image?: string;
  gramsPerPiece?: number;
  tips?: { type?: string; text?: string }[];
}

/** Un ingrédient à préparer, sommé sur toute la semaine. */
export interface PrepItem {
  key: string;
  dbId?: string;
  name: string;
  image?: string;
  category: string;
  amount: number;
  unit: string;
  /** Nombre de pièces estimé (si `gramsPerPiece` connu et unité en masse), pour la mise en place. */
  pieces?: number;
  /** Geste de préparation (conseil `prep` de l'ingrédient), ex. « émincer finement ». */
  prepTip?: string;
  /** Recettes qui utilisent cet ingrédient cette semaine. */
  usedBy: string[];
}

/** Un groupe d'ingrédients d'une même catégorie (ex. Légumes), dans l'ordre de mise en place. */
export interface PrepGroup {
  category: string;
  items: PrepItem[];
}

/** Contexte d'enrichissement de la mise en place. */
export interface MiseEnPlaceContext {
  recipesById: Map<string, ComponentRecipe>;
  resolver?: PrepResolver;
  ingredientDB?: PrepDbItem[];
  stockSet?: Set<string>;
  /** Ordre + libellé des catégories (clé → order). Sert au tri des groupes. */
  categoryOrder?: (cat: string) => number;
  /**
   * Catégories retenues pour la mutualisation. La découpe/préparation ne se
   * mutualise vraiment que pour les produits frais à travailler (légumes, herbes) ;
   * pour les autres (épices, huiles…) l'intérêt est faible. `undefined` = toutes.
   */
  includeCategories?: Set<string>;
}

const G_PER_UNIT: Record<string, number> = { g: 1, kg: 1000, mg: 0.001 };
const isCountable = (cat: string | undefined): boolean => cat === "vegetable" || cat === "fruit";

// Clé de sommation d'une unité : sans accent, singularisée, pour que « pièces » et
// « pièce » fusionnent (l'orthographe d'origine reste conservée pour l'affichage).
const canonUnit = (u: string | null | undefined): string => {
  const c = normalizeStr(u);
  return c.length > 2 && c.endsWith("s") ? c.slice(0, -1) : c;
};

/**
 * Construit la mise en place mutualisée : tous les ingrédients bruts des plats de la
 * semaine, sommés par ingrédient (bases éclatées × nombre de cuissons), groupés par
 * catégorie dans l'ordre de mise en place. Enrichit chaque ingrédient de son geste
 * de préparation et d'une estimation en pièces.
 *
 * @param dishes - Les plats de la session (voir {@link buildBatchSession}).
 * @param ctx - Résolveur d'ingrédients, base d'ingrédients, index des recettes, stock.
 * @returns Les groupes d'ingrédients à préparer, ordonnés par catégorie.
 */
export function buildMiseEnPlace(dishes: BatchDish[], ctx: MiseEnPlaceContext): PrepGroup[] {
  const { recipesById, resolver, ingredientDB = [], stockSet, categoryOrder, includeCategories } = ctx;
  const dbById = new Map(ingredientDB.map(i => [i.id, i]));

  interface Acc { dbId?: string; name: string; image?: string; category: string; amount: number; unit: string; usedBy: Set<string> }
  const acc = new Map<string, Acc>();

  for (const d of dishes) {
    // Éclate les bases en ingrédients bruts, puis multiplie par le nombre de cuissons.
    const raw = flattenForShopping(d.recipe.ingredients as ComponentRecipe["ingredients"], recipesById, stockSet);
    for (const line of raw) {
      if (line.recipeId && !line.dbId) continue; // base orpheline/en stock → ignorée
      const info = line.dbId ? dbById.get(line.dbId) : (resolver ? (() => { const m = resolver(line.name); return m ? dbById.get(m.id) : undefined; })() : undefined);
      const name = info?.name || line.name || "Ingrédient";
      const idKey = info?.id || line.dbId || "n:" + normalizeStr(name);
      const unit = (line.unit || "").trim();
      const key = idKey + "|" + canonUnit(unit);
      let a = acc.get(key);
      if (!a) { a = { dbId: info?.id || line.dbId, name, image: info?.image, category: info?.category || "other", amount: 0, unit, usedBy: new Set() }; acc.set(key, a); }
      a.amount += num(line.amount) * d.cookings;
      a.usedBy.add(d.recipe.name || "");
    }
  }

  const items: PrepItem[] = [...acc.entries()].map(([key, a]) => {
    const info = a.dbId ? dbById.get(a.dbId) : undefined;
    const grams = (G_PER_UNIT[normalizeStr(a.unit)] || 0) * a.amount;
    const gpp = num(info?.gramsPerPiece);
    const pieces = grams > 0 && gpp > 0 && isCountable(a.category) ? Math.max(1, Math.round(grams / gpp)) : undefined;
    const prepTip = info?.tips?.find(t => t.type === "prep")?.text;
    return { key, dbId: a.dbId, name: a.name, image: a.image, category: a.category, amount: +a.amount.toFixed(2), unit: a.unit, pieces, prepTip, usedBy: [...a.usedBy] };
  });

  const order = categoryOrder || (() => 99);
  const groups = new Map<string, PrepItem[]>();
  for (const it of items) {
    if (includeCategories && !includeCategories.has(it.category)) continue; // catégorie non mutualisée
    const g = groups.get(it.category) || []; g.push(it); groups.set(it.category, g);
  }
  return [...groups.entries()]
    .map(([category, its]) => ({ category, items: its.sort((a, b) => b.usedBy.length - a.usedBy.length || a.name.localeCompare(b.name, "fr")) }))
    .sort((a, b) => order(a.category) - order(b.category));
}

// ─── CUISSONS REGROUPÉES (mutualiser le four / les feux) ──────────────────────

/** Un groupe de plats partageant le même mode de cuisson (ex. tous au four). */
export interface CookingGroup {
  method: string;
  label: string;
  dishes: BatchDish[];
}

/**
 * Regroupe les plats par mode de cuisson (four, plaques, air-fryer…), déduit des
 * ustensiles. Permet de mutualiser l'appareil : « au four : Gratin + Légumes rôtis »
 * → on l'allume une seule fois. Un plat peut apparaître sous plusieurs modes.
 *
 * @param dishes - Les plats de la session.
 * @returns Les groupes de cuisson, triés du plus fourni au moins fourni.
 */
export function groupCookings(dishes: BatchDish[]): CookingGroup[] {
  const labelOf = new Map(COOKING_METHODS.map(m => [m.id, m.label]));
  const groups = new Map<string, BatchDish[]>();
  for (const d of dishes) {
    const methods = recipeCookingMethods(d.recipe as { utensils?: { name?: string }[] });
    const keys = methods.size ? [...methods] : ["autre"];
    for (const k of keys) { const g = groups.get(k) || []; g.push(d); groups.set(k, g); }
  }
  return [...groups.entries()]
    .map(([method, ds]) => ({ method, label: labelOf.get(method) || method, dishes: ds }))
    // « autre » = aucune méthode de cuisson détectée → ce n'est PAS une cuisson à
    // mutualiser (souvent : plat sans cuisson). On ne montre que les vrais appareils
    // partagés (≥ 2 plats).
    .filter(g => g.method !== "autre" && g.dishes.length > 1)
    .sort((a, b) => b.dishes.length - a.dishes.length);
}
