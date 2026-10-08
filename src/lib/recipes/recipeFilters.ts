/**
 * Filtres de recettes (état partagé, pur). Forme de l'état de filtrage avancé
 * partagé par /recipes et « Découvrir », et prédicat unique appliqué des deux côtés.
 *
 * @module recipes/recipeFilters
 */
import { isRecipeInSeason } from "@/lib/food/seasonality.js";
import { isRecipeVegan } from "@/lib/food/dietary.js";
import { matchesCooking, COOKING_METHODS } from "@/lib/recipes/cooking.js";
import { computeDifficulty, DIFFICULTY_LABEL } from "@/lib/recipes/difficulty.js";
import { RECIPE_CATEGORIES } from "@/constants/recipeCategories.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import type { Recipe } from "@/lib/types.js";

/** État de filtrage avancé (une « vue » de la bibliothèque). */
export interface RecipeFilters {
  season: boolean;
  vegan: boolean;
  type: string;
  categories: string[];
  timeMax: number | null;
  cuisines: string[];
  /** Chefs retenus (noms tels que saisis) ; comparés sans casse ni accents. */
  chefs: string[];
  cooking: string[];
  nutriMax: string | null;
  diffMax: number | null;
  ingredients: string[];
}

/** Recette filtrable (alias du type de domaine). */
export type FilterableRecipe = Recipe;

/** Dépendances facultatives pour le prédicat (résolveur, techniques, recettes). */
export interface FilterContext {
  resolver?: (name: string | undefined) => { id: string; category?: string; months?: unknown } | null;
  techniques?: unknown;
  techIndex?: unknown;
  recipes?: FilterableRecipe[];
}

export const DEFAULT_FILTERS: RecipeFilters = { season: false, vegan: false, type: "all", categories: [], timeMax: null, cuisines: [], chefs: [], cooking: [], nutriMax: null, diffMax: null, ingredients: [] };

const NUTRI_ORDER: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
const CAT_LABEL = new Map<string, string>(RECIPE_CATEGORIES.map((c: { id: string; label: string }) => [c.id, c.label]));
const COOK_LABEL = new Map<string, string>(COOKING_METHODS.map((m: { id: string; label: string }) => [m.id, m.label]));

/**
 * Résumé lisible d'une vue de filtres (pour l'affichage d'un carnet intelligent) :
 * une liste de courtes étiquettes.
 *
 * @param filters - L'état de filtrage (partiel).
 * @param search - Le texte de recherche associé.
 * @returns Les étiquettes lisibles décrivant la vue.
 */
export function summarizeFilters(filters: Partial<RecipeFilters> = {}, search = ""): string[] {
  const out: string[] = [];
  const s = (search || "").trim();
  if (s) out.push(`« ${s} »`);
  (filters.categories || []).forEach(id => out.push(CAT_LABEL.get(id) || id));
  if (filters.type === "dish") out.push("Plats");
  else if (filters.type === "base") out.push("Préparations de base");
  (filters.cuisines || []).forEach(c => out.push(c));
  (filters.chefs || []).forEach(c => out.push(c));
  (filters.cooking || []).forEach(id => out.push(id === "mixte" ? "Cuisson mixte" : (COOK_LABEL.get(id) || id)));
  if (filters.timeMax) out.push(`≤ ${filters.timeMax} min`);
  if (filters.vegan) out.push("Vegan");
  if (filters.season) out.push("De saison");
  if (filters.nutriMax) out.push(`Nutri ${filters.nutriMax} ou mieux`);
  if (filters.diffMax) out.push(`Jusqu'à ${DIFFICULTY_LABEL[filters.diffMax]}`);
  if (filters.ingredients?.length) out.push(`${filters.ingredients.length} ingrédient${filters.ingredients.length > 1 ? "s" : ""}`);
  return out;
}

/**
 * Nombre de critères actifs dans une vue de filtres.
 *
 * @param filters - L'état de filtrage.
 * @returns Le nombre de critères non neutres.
 */
export function activeFilterCount(filters: RecipeFilters): number {
  return (filters.season ? 1 : 0) + (filters.vegan ? 1 : 0) + (filters.type !== "all" ? 1 : 0)
    + (filters.categories?.length ? 1 : 0)
    + (filters.timeMax ? 1 : 0) + (filters.cuisines.length ? 1 : 0) + (filters.chefs?.length ? 1 : 0) + (filters.cooking.length ? 1 : 0) + (filters.nutriMax ? 1 : 0)
    + (filters.diffMax ? 1 : 0) + (filters.ingredients.length ? 1 : 0);
}

/**
 * Deux états de filtres décrivent-ils la même vue ? Comparaison indépendante de
 * l'ordre pour les tableaux. Sert à repérer quel carnet intelligent est actif.
 *
 * @param a - Premier état de filtrage.
 * @param b - Second état de filtrage.
 * @returns `true` si les deux vues sont équivalentes.
 */
export function filtersEqual(a: Partial<RecipeFilters> = {}, b: Partial<RecipeFilters> = {}): boolean {
  const A = { ...DEFAULT_FILTERS, ...a }, B = { ...DEFAULT_FILTERS, ...b };
  const sameSet = (x: string[] = [], y: string[] = []): boolean => x.length === y.length && [...x].sort().join("|") === [...y].sort().join("|");
  return A.season === B.season && A.vegan === B.vegan && A.type === B.type
    && A.timeMax === B.timeMax && A.nutriMax === B.nutriMax && A.diffMax === B.diffMax
    && sameSet(A.categories, B.categories) && sameSet(A.cuisines, B.cuisines) && sameSet(A.chefs, B.chefs)
    && sameSet(A.cooking, B.cooking) && sameSet(A.ingredients, B.ingredients);
}

/**
 * Une recette passe-t-elle l'état de filtrage `f` ? `ctx` fournit les dépendances
 * facultatives (résolveur d'ingrédients, techniques + index, liste de recettes pour
 * l'héritage des bases). Utilisé tel quel par /recipes et « Découvrir ».
 *
 * @param recipe - La recette à tester.
 * @param filters - L'état de filtrage à appliquer.
 * @param ctx - Dépendances facultatives (résolveur, techniques + index, recettes).
 * @returns `true` si la recette passe tous les critères actifs.
 */
export function matchesFilters(recipe: FilterableRecipe, filters: RecipeFilters, ctx: FilterContext = {}): boolean {
  const { resolver, techniques, techIndex, recipes } = ctx;
  if (filters.type === "base" && !recipe.isComponent) return false;
  if (filters.type === "dish" && recipe.isComponent) return false;
  if (filters.categories?.length && !filters.categories.includes(recipe.category || "")) return false;
  if (filters.cuisines?.length && !filters.cuisines.includes(recipe.cuisine || "")) return false;
  if (filters.chefs?.length) {
    const chef = normalizeStr(recipe.chef);
    if (!chef || !filters.chefs.some(c => normalizeStr(c) === chef)) return false;
  }
  if (filters.timeMax && ((recipe.prepTime || 0) + (recipe.cookTime || 0)) > filters.timeMax) return false;
  if (filters.cooking?.length && !matchesCooking(recipe, filters.cooking)) return false;
  if (filters.season && !(resolver && isRecipeInSeason(recipe, resolver))) return false;
  if (filters.vegan && !(resolver && isRecipeVegan(recipe, resolver, { recipes }))) return false;
  if (filters.nutriMax && !(recipe.nutriLetter && NUTRI_ORDER[recipe.nutriLetter] <= NUTRI_ORDER[filters.nutriMax])) return false;
  if (filters.diffMax) {
    const s = computeDifficulty(recipe, techniques || [], { index: techIndex, recipes }).score;
    if (!(s != null && s <= filters.diffMax)) return false;
  }
  if (filters.ingredients?.length) {
    if (!resolver) return false;
    const ids = new Set<string>();
    for (const ri of recipe.ingredients || []) { const m = resolver(ri.name); if (m) ids.add(m.id); }
    if (!filters.ingredients.every(id => ids.has(id))) return false;
  }
  return true;
}

/**
 * Recherche plein texte de la bibliothèque : le texte saisi doit apparaître dans le
 * nom, la cuisine, le chef ou un ingrédient de la recette (casse et accents ignorés).
 * Une requête vide laisse tout passer. Partagé par la grille et les carnets
 * intelligents pour qu'une même recherche donne le même résultat partout.
 *
 * @param recipe - La recette à tester.
 * @param query - Le texte de recherche brut.
 */
export function matchesRecipeSearch(recipe: Pick<Recipe, "name" | "cuisine" | "chef" | "ingredients">, query: string | null | undefined): boolean {
  const q = normalizeStr(query);
  if (!q) return true;
  const has = (text: string | null | undefined): boolean => normalizeStr(text).includes(q);
  return has(recipe.name) || has(recipe.cuisine) || has(recipe.chef) || (recipe.ingredients || []).some((line) => has(line.name));
}

/**
 * Chefs présents dans une liste de recettes, pour proposer le filtre Chef : un nom
 * par chef (le premier libellé rencontré, doublons de casse ou d'accents fusionnés),
 * triés par nombre de recettes puis par ordre alphabétique.
 *
 * @param recipes - Les recettes (ou leur seul champ `chef`).
 * @returns Les noms de chefs, du plus représenté au moins représenté.
 */
export function collectChefs(recipes: readonly Pick<Recipe, "chef">[] | null | undefined): string[] {
  const byKey = new Map<string, { name: string; count: number }>();
  for (const recipe of recipes || []) {
    const name = (recipe.chef || "").trim();
    const key = normalizeStr(name);
    if (!key) continue;
    const hit = byKey.get(key);
    if (hit) hit.count++;
    else byKey.set(key, { name, count: 1 });
  }
  return [...byKey.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"))
    .map(entry => entry.name);
}
