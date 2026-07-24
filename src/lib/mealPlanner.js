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

export const DEFAULT_WEIGHTS = { season: 0.9, health: 0.5, stock: 0.6, effort: 0.4, dislike: 2, difficulty: 0, simple: 0 };

// Styles de génération choisis par l'utilisateur (sous-menu « Générer »).
//  - facile     : privilégie le rapide et le peu d'ingrédients, évite le difficile.
//  - equilibre  : comportement par défaut (aucun biais).
//  - aventureux : privilégie les recettes plus longues et plus difficiles.
export const GEN_STYLES = {
  facile: { ...DEFAULT_WEIGHTS, effort: 1.4, simple: 0.7, difficulty: -0.6 },
  equilibre: { ...DEFAULT_WEIGHTS },
  aventureux: { ...DEFAULT_WEIGHTS, effort: -0.5, difficulty: 1.1 },
};

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Effort ∈ [0,1] : 1 = rapide (≤ ~15 min), 0 = long (≥ ~90 min).
export function effortScore(recipe) {
  const min = (Number(recipe.prepTime) || 0) + (Number(recipe.cookTime) || 0);
  return clamp01(1 - Math.max(0, min - 15) / 75);
}

// Simplicité ∈ [0,1] : 1 = peu d'ingrédients (≤ ~6), décroît ensuite.
export function simplicityScore(recipe) {
  const n = (recipe.ingredients || []).length;
  return clamp01(1 - Math.max(0, n - 6) / 10);
}

// Difficulté ∈ [0,1] : recipe.difficulty (1..5) normalisée ; inconnue → neutre.
function difficultyScore(recipe) {
  return Number.isFinite(recipe.difficulty) ? clamp01((recipe.difficulty - 1) / 4) : 0.4;
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
  const simple = simplicityScore(recipe);
  const difficulty = difficultyScore(recipe);
  const dislike = hasDislike(recipe, ctx) ? 1 : 0;
  return w.season * season + w.health * health + w.stock * stock
    + w.effort * effort + (w.simple || 0) * simple + (w.difficulty || 0) * difficulty
    - w.dislike * dislike;
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
// Rôles d'un repas composé complet, dans l'ordre de service.
const COMPOSE_ROLES = ["entree", "plat", "accompagnement", "dessert"];

// Combien de repas une cuisson couvre-t-elle ? servings / portions par repas.
// Une recette pour 4 avec 2 portions/repas = 2 repas → 1 « reste » à replacer.
export function batchMeals(recipe, portionsPerMeal = 2) {
  const s = Number(recipe.servings) || 2;
  return Math.max(1, Math.min(7, Math.round(s / Math.max(1, portionsPerMeal))));
}

// Remplit les créneaux vides de la semaine. `dates` (YYYY-MM-DD), `slots`,
// `recipes`, `existing` (mealPlan actuel). Avec `compose`, chaque repas midi/soir
// devient entrée + plat + accompagnement + dessert (selon le vivier disponible).
// Avec `portionsPerMeal`, les portions cuisinées en trop sont RÉUTILISÉES plus tard
// dans la semaine (files de « restes » par rôle) au lieu de cuisiner du neuf.
// Renvoie [{ date, slot, recipeId, role?, groupId?, portions }] par cellule remplie.
export function generateWeek({ dates = [], slots = [], recipes = [], ctx = {}, existing = {}, replace = false, compose = false, portionsPerMeal = 2 }) {
  const byId = ctx.byId || new Map(recipes.map(r => [r.id, r]));
  const c = { ...ctx, byId };
  const pool = recipes.filter(r => !r.isComponent && isEligible(r, ctx.preferences || {}, c));
  const baseScore = new Map(pool.map(r => [r.id, scoreRecipe(r, c)]));
  const comps = new Map(pool.map(r => [r.id, componentsOf(r)]));
  const byRole = { entree: [], plat: [], accompagnement: [], dessert: [] };
  for (const r of pool) { const role = roleForCategory(r.category || ""); if (byRole[role]) byRole[role].push(r); }

  const used = new Map();       // recipeId → nb d'emplois cette semaine
  const catCount = new Map();   // catégorie → nb
  const cuiCount = new Map();   // cuisine → nb
  const dayEffort = new Map();  // date → effort cuisiné cumulé (les restes ne comptent pas)
  const usedComps = new Set();  // préparations de base déjà mobilisées
  const leftovers = { entree: [], plat: [], accompagnement: [], dessert: [] }; // { id, portions }
  const out = [];

  const filled = (date, slot) => (existing[date] || []).some(m => m.slot === slot);
  const mark = (r, date, cooked) => {
    used.set(r.id, (used.get(r.id) || 0) + 1);
    catCount.set(r.category || "?", (catCount.get(r.category || "?") || 0) + 1);
    cuiCount.set(r.cuisine || "?", (cuiCount.get(r.cuisine || "?") || 0) + 1);
    for (const id of comps.get(r.id) || []) usedComps.add(id);
    if (cooked) dayEffort.set(date, (dayEffort.get(date) || 0) + (1 - effortScore(r)));
  };

  // Choisit une recette d'un rôle : d'abord un RESTE (portion déjà cuisinée), sinon
  // la meilleure fraîche (score + pénalités variété), qu'on cuisine — ses portions
  // en trop rejoignent la file de restes du rôle.
  const takeForRole = (role, cands, date) => {
    if (leftovers[role].length) { const lo = leftovers[role].shift(); const r = byId.get(lo.id); if (r) { mark(r, date, false); return { recipe: r, portions: lo.portions, leftover: true }; } }
    let best = null, bestVal = -Infinity;
    for (const r of cands) {
      let v = baseScore.get(r.id) ?? 0;
      v -= WEEK.repeat * (used.get(r.id) || 0);
      v -= WEEK.category * (catCount.get(r.category || "?") || 0);
      v -= WEEK.cuisine * (cuiCount.get(r.cuisine || "?") || 0);
      if (role === "plat") v -= WEEK.dayEffort * (dayEffort.get(date) || 0);
      const rc = comps.get(r.id);
      if (rc && [...rc].some(id => usedComps.has(id))) v += WEEK.batchBonus;
      if (v > bestVal) { bestVal = v; best = r; }
    }
    if (!best) return null;
    const b = batchMeals(best, portionsPerMeal);
    for (let k = 1; k < b; k++) leftovers[role].push({ id: best.id, portions: b });
    mark(best, date, true);
    return { recipe: best, portions: b, leftover: false };
  };

  for (const date of dates) {
    for (const slot of slots) {
      if (!replace && filled(date, slot)) continue;
      const mainCands = pool.filter(r => eligibleForSlot(r, slot));
      if (!mainCands.length) continue;
      const plat = takeForRole("plat", mainCands, date);
      if (!plat) continue;

      // Repas composé (midi/soir) : entrée + plat + accompagnement + dessert.
      if (compose && slot !== "matin") {
        const groupId = newGroupId();
        for (const role of COMPOSE_ROLES) {
          const pick = role === "plat" ? plat : takeForRole(role, byRole[role], date);
          if (pick) out.push({ date, slot, recipeId: pick.recipe.id, role, groupId, portions: pick.portions });
        }
      } else {
        out.push({ date, slot, recipeId: plat.recipe.id, role: "plat", portions: plat.portions });
      }
    }
  }
  return out;
}
