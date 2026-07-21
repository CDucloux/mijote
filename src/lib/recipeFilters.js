// ─── FILTRES DE RECETTES (état partagé, pur) ──────────────────────────────────
// Forme de l'état de filtrage avancé partagé par /recipes et « Découvrir », et
// prédicat unique appliqué des deux côtés (uniformisation des filtres).
import { isRecipeInSeason } from "./seasonality.js";
import { isRecipeVegan } from "./dietary.js";
import { matchesCooking, COOKING_METHODS } from "./cooking.js";
import { computeDifficulty, DIFFICULTY_LABEL } from "./difficulty.js";
import { RECIPE_CATEGORIES } from "../constants/recipeCategories.js";

export const DEFAULT_FILTERS = { season: false, vegan: false, type: "all", categories: [], timeMax: null, cuisines: [], cooking: [], nutriMax: null, diffMax: null, ingredients: [] };

const NUTRI_ORDER = { A: 1, B: 2, C: 3, D: 4, E: 5 };
const CAT_LABEL = new Map(RECIPE_CATEGORIES.map(c => [c.id, c.label]));
const COOK_LABEL = new Map(COOKING_METHODS.map(m => [m.id, m.label]));

// Résumé lisible d'une vue de filtres (pour l'affichage d'un carnet intelligent).
// Renvoie une liste de courtes étiquettes.
export function summarizeFilters(f = {}, search = "") {
  const out = [];
  const s = (search || "").trim();
  if (s) out.push(`« ${s} »`);
  (f.categories || []).forEach(id => out.push(CAT_LABEL.get(id) || id));
  if (f.type === "dish") out.push("Plats");
  else if (f.type === "base") out.push("Préparations de base");
  (f.cuisines || []).forEach(c => out.push(c));
  (f.cooking || []).forEach(id => out.push(id === "mixte" ? "Cuisson mixte" : (COOK_LABEL.get(id) || id)));
  if (f.timeMax) out.push(`≤ ${f.timeMax} min`);
  if (f.vegan) out.push("Vegan");
  if (f.season) out.push("De saison");
  if (f.nutriMax) out.push(`Nutri ${f.nutriMax} ou mieux`);
  if (f.diffMax) out.push(`Jusqu'à ${DIFFICULTY_LABEL[f.diffMax]}`);
  if (f.ingredients?.length) out.push(`${f.ingredients.length} ingrédient${f.ingredients.length > 1 ? "s" : ""}`);
  return out;
}

export function activeFilterCount(f) {
  return (f.season ? 1 : 0) + (f.vegan ? 1 : 0) + (f.type !== "all" ? 1 : 0)
    + (f.categories?.length ? 1 : 0)
    + (f.timeMax ? 1 : 0) + (f.cuisines.length ? 1 : 0) + (f.cooking.length ? 1 : 0) + (f.nutriMax ? 1 : 0)
    + (f.diffMax ? 1 : 0) + (f.ingredients.length ? 1 : 0);
}

// Deux états de filtres décrivent-ils la même vue ? (comparaison indépendante de
// l'ordre pour les tableaux). Sert à repérer quel carnet intelligent est actif.
export function filtersEqual(a = {}, b = {}) {
  const A = { ...DEFAULT_FILTERS, ...a }, B = { ...DEFAULT_FILTERS, ...b };
  const sameSet = (x = [], y = []) => x.length === y.length && [...x].sort().join("|") === [...y].sort().join("|");
  return A.season === B.season && A.vegan === B.vegan && A.type === B.type
    && A.timeMax === B.timeMax && A.nutriMax === B.nutriMax && A.diffMax === B.diffMax
    && sameSet(A.categories, B.categories) && sameSet(A.cuisines, B.cuisines)
    && sameSet(A.cooking, B.cooking) && sameSet(A.ingredients, B.ingredients);
}

// Une recette passe-t-elle l'état de filtrage `f` ? `ctx` fournit les dépendances
// facultatives (résolveur d'ingrédients, techniques + index, liste de recettes
// pour l'héritage des bases). Utilisé tel quel par /recipes et « Découvrir ».
export function matchesFilters(r, f, ctx = {}) {
  const { resolver, techniques, techIndex, recipes } = ctx;
  if (f.type === "base" && !r.isComponent) return false;
  if (f.type === "dish" && r.isComponent) return false;
  if (f.categories?.length && !f.categories.includes(r.category)) return false;
  if (f.cuisines?.length && !f.cuisines.includes(r.cuisine)) return false;
  if (f.timeMax && ((r.prepTime || 0) + (r.cookTime || 0)) > f.timeMax) return false;
  if (f.cooking?.length && !matchesCooking(r, f.cooking)) return false;
  if (f.season && !(resolver && isRecipeInSeason(r, resolver))) return false;
  if (f.vegan && !(resolver && isRecipeVegan(r, resolver, { recipes }))) return false;
  if (f.nutriMax && !(r.nutriLetter && NUTRI_ORDER[r.nutriLetter] <= NUTRI_ORDER[f.nutriMax])) return false;
  if (f.diffMax) {
    const s = computeDifficulty(r, techniques || [], { index: techIndex, recipes }).score;
    if (!(s != null && s <= f.diffMax)) return false;
  }
  if (f.ingredients?.length) {
    if (!resolver) return false;
    const ids = new Set();
    for (const ri of r.ingredients || []) { const m = resolver(ri.name); if (m) ids.add(m.id); }
    if (!f.ingredients.every(id => ids.has(id))) return false;
  }
  return true;
}
