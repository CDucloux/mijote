// ─── GÉNÉRATEUR DE PLANNING (logique pure, testable) ─────────────────────────
// Deux étages, conformes au design : le VIVIER est filtré par les contraintes
// DURES (isEligible, voir dietFilter.js) ; ici on ne fait que du SCORING DOUX.
//   scoreRecipe : note intrinsèque d'une recette (saison, santé, stock, effort,
//                 aversions) — indépendante de la semaine.
//   generateWeek : remplit la semaine créneau par créneau en argmax(score − pénalités
//                 de niveau semaine), pour éviter « 7× la recette la mieux notée » :
//                 variété (recette/catégorie/cuisine), effort étalé sur les jours,
//                 et bonus d'affinité batch (recettes partageant une préparation de base).

import { recipeSeasonScore, currentMonth } from "./seasonality.js";
import { collectIngredientSignals, isEligible } from "./dietFilter.js";
import { normalizeStr } from "./parseIngredient.js";
import { roleForCategory, newGroupId } from "./composedMeal.js";

// Types de recette recevables selon le créneau. Le matin ne prend que du
// petit-déjeuner ; midi/soir prennent les « plats » (et les recettes non typées,
// pour ne pas ignorer une bibliothèque pas encore catégorisée).
const BREAKFAST_TYPES = new Set(["petit-dej", "boulangerie", "boisson"]);
const NON_MAIN_TYPES = new Set(["dessert", "aperitif", "boisson", "sauce", "accompagnement", "entree", "petit-dej", "gouter", "boulangerie"]);

export function eligibleForSlot(recipe, slot) {
  if (!recipe || recipe.isComponent) return false;
  const cat = recipe.category || "";
  if (slot === "matin") return BREAKFAST_TYPES.has(cat);
  return !NON_MAIN_TYPES.has(cat); // midi/soir : plats typés + non typés
}

export const DEFAULT_WEIGHTS = { season: 0.9, health: 0.5, stock: 0.6, effort: 0.4, dislike: 2 };

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Effort ∈ [0,1] : 1 = rapide (≤ ~15 min), 0 = long (≥ ~90 min).
export function effortScore(recipe) {
  const min = (Number(recipe.prepTime) || 0) + (Number(recipe.cookTime) || 0);
  return clamp01(1 - Math.max(0, min - 15) / 75);
}

// Fraction des ingrédients résolus déjà en stock (composants inclus).
export function stockAffinity(recipe, ctx) {
  const { resolver, stockSet } = ctx;
  if (!stockSet || !stockSet.size) return 0;
  let total = 0, have = 0;
  for (const ing of recipe.ingredients || []) {
    if (ing.recipeId) { total++; if (stockSet.has(ing.recipeId)) have++; continue; }
    const item = resolver ? resolver(ing.name) : null;
    if (!item) continue;
    total++; if (stockSet.has(item.id)) have++;
  }
  return total ? have / total : 0;
}

// La recette contient-elle un ingrédient non aimé (aversion douce, pas un filtre) ?
function hasDislike(recipe, ctx) {
  const dislikes = (ctx.preferences?.dislikes || []).map(normalizeStr).filter(Boolean);
  if (!dislikes.length) return false;
  const { names } = collectIngredientSignals(recipe, { resolver: ctx.resolver, byId: ctx.byId });
  return dislikes.some(d => names.some(n => n.includes(d)));
}

// Note intrinsèque d'une recette (indépendante de la semaine). ctx :
// { resolver, byId, month, stockSet, preferences, weights }.
export function scoreRecipe(recipe, ctx = {}) {
  const w = ctx.weights || DEFAULT_WEIGHTS;
  const s = recipeSeasonScore(recipe, ctx.resolver, ctx.month ?? currentMonth());
  const season = s ? s.score / 100 : 0.5;             // inconnu → neutre
  const health = Number.isFinite(recipe.healthScore) ? recipe.healthScore / 100 : 0.5;
  const stock = stockAffinity(recipe, ctx);
  const effort = effortScore(recipe);
  const dislike = hasDislike(recipe, ctx) ? 1 : 0;
  return w.season * season + w.health * health + w.stock * stock + w.effort * effort - w.dislike * dislike;
}

// Accompagnements candidats pour un plat : recettes de rôle « accompagnement »
// éligibles, classées par note (saison…), en excluant le plat lui-même.
export function suggestSides(main, pool, ctx, { role = "accompagnement", max = 8 } = {}) {
  return pool
    .filter(r => r.id !== main?.id && roleForCategory(r.category || "") === role)
    .map(r => ({ r, s: scoreRecipe(r, ctx) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map(x => x.r);
}

// Ensemble des préparations de base (recipeId) utilisées par une recette.
function componentsOf(recipe) {
  return new Set((recipe.ingredients || []).filter(i => i.recipeId).map(i => i.recipeId));
}

// Pénalités de niveau semaine (variété + étalement de l'effort + bonus batch).
const WEEK = { repeat: 0.6, category: 0.09, cuisine: 0.05, dayEffort: 0.12, batchBonus: 0.12 };

// Remplit les créneaux vides de la semaine. `dates` (YYYY-MM-DD), `slots`
// (["midi","soir"]…), `recipes` (bibliothèque), `existing` (mealPlan actuel).
// Renvoie [{ date, slot, recipeId }] pour les cellules effectivement remplies.
export function generateWeek({ dates = [], slots = [], recipes = [], ctx = {}, existing = {}, replace = false, compose = false }) {
  const byId = ctx.byId || new Map(recipes.map(r => [r.id, r]));
  const c = { ...ctx, byId };
  const pool = recipes.filter(r => !r.isComponent && isEligible(r, ctx.preferences || {}, c));
  const sidePool = compose ? suggestSides(null, pool, c) : []; // accompagnements classés
  const baseScore = new Map(pool.map(r => [r.id, scoreRecipe(r, c)]));
  const comps = new Map(pool.map(r => [r.id, componentsOf(r)]));

  const used = new Map();       // recipeId → nb d'emplois cette semaine
  const catCount = new Map();   // catégorie → nb
  const cuiCount = new Map();   // cuisine → nb
  const dayEffort = new Map();  // date → effort cumulé (heures ~)
  const usedComps = new Set();  // préparations de base déjà mobilisées
  const out = [];

  const filled = (date, slot) => (existing[date] || []).some(m => m.slot === slot);

  for (const date of dates) {
    for (const slot of slots) {
      if (!replace && filled(date, slot)) continue;
      const cands = pool.filter(r => eligibleForSlot(r, slot));
      if (!cands.length) continue;

      let best = null, bestVal = -Infinity;
      for (const r of cands) {
        let v = baseScore.get(r.id) ?? 0;
        v -= WEEK.repeat * (used.get(r.id) || 0);
        v -= WEEK.category * (catCount.get(r.category || "?") || 0);
        v -= WEEK.cuisine * (cuiCount.get(r.cuisine || "?") || 0);
        v -= WEEK.dayEffort * (dayEffort.get(date) || 0);
        const rc = comps.get(r.id);
        if (rc && [...rc].some(id => usedComps.has(id))) v += WEEK.batchBonus;
        if (v > bestVal) { bestVal = v; best = r; }
      }
      if (!best) continue;

      // Composition : on rattache un accompagnement de saison peu utilisé, sous un
      // même groupId (le repas). Le plat prend le rôle « plat », le côté « accompagnement ».
      let groupId;
      if (compose && slot !== "matin") {
        const side = sidePool.find(s => (used.get(s.id) || 0) < 2 && s.id !== best.id);
        if (side) {
          groupId = newGroupId();
          out.push({ date, slot, recipeId: side.id, role: "accompagnement", groupId });
          used.set(side.id, (used.get(side.id) || 0) + 1);
          catCount.set(side.category || "?", (catCount.get(side.category || "?") || 0) + 1);
          for (const id of comps.get(side.id) || []) usedComps.add(id);
        }
      }

      out.push({ date, slot, recipeId: best.id, role: "plat", groupId });
      used.set(best.id, (used.get(best.id) || 0) + 1);
      catCount.set(best.category || "?", (catCount.get(best.category || "?") || 0) + 1);
      cuiCount.set(best.cuisine || "?", (cuiCount.get(best.cuisine || "?") || 0) + 1);
      dayEffort.set(date, (dayEffort.get(date) || 0) + (1 - effortScore(best))); // long = charge
      for (const id of comps.get(best.id) || []) usedComps.add(id);
    }
  }
  return out;
}
