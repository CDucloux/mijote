/**
 * Modes de cuisson, déduits des ustensiles d'une recette. Les ustensiles n'ont pas
 * de champ « type de cuisson » : on le déduit du nom via des listes de mots-clés
 * (normalisés, sans accents). Une recette peut relever de plusieurs modes — on
 * parle alors de cuisson « mixte ».
 *
 * @module cooking
 */
import { normalizeStr } from "./parseIngredient.js";

/** Mode de cuisson : id, libellé et mots-clés d'ustensiles associés. */
export interface CookingMethod {
  id: string;
  label: string;
  keywords: string[];
}

/** Recette dont on lit les ustensiles pour déduire les modes de cuisson. */
export interface CookableRecipe {
  utensils?: { name?: string }[];
}

export const COOKING_METHODS: CookingMethod[] = [
  { id: "four", label: "Four", keywords: ["four", "plat a gratin", "plat a four", "moule a cake", "moule a gateau", "moule a tarte", "cocotte en fonte", "ramequin", "lechefrite", "plaque de cuisson"] },
  { id: "airfryer", label: "Air fryer", keywords: ["air fryer", "airfryer", "friteuse a air", "ninja"] },
  { id: "plaques", label: "Plaques", keywords: ["poele", "casserole", "sauteuse", "wok", "marmite", "faitout", "cocotte", "poelon", "russe", "crepiere", "bouilloire", "cuiseur"] },
  { id: "vapeur", label: "Vapeur", keywords: ["vapeur", "cuit-vapeur", "couscoussier", "panier vapeur"] },
  { id: "grill", label: "Grill / plancha", keywords: ["barbecue", "plancha", "grill", "gril", "pierrade"] },
  { id: "micro-ondes", label: "Micro-ondes", keywords: ["micro-onde", "micro onde"] },
];

const RULES = COOKING_METHODS.map(m => ({ id: m.id, keys: m.keywords.map(normalizeStr) }));

/**
 * Modes de cuisson d'une recette, déduits des noms de ses ustensiles.
 *
 * @param recipe - La recette (ses ustensiles).
 * @returns L'ensemble des ids de modes de cuisson détectés.
 */
export function recipeCookingMethods(recipe: CookableRecipe | null | undefined): Set<string> {
  const found = new Set<string>();
  for (const u of recipe?.utensils || []) {
    const n = normalizeStr(u?.name);
    if (!n) continue;
    for (const r of RULES) if (r.keys.some(k => n.includes(k))) found.add(r.id);
  }
  return found;
}

/**
 * La recette passe-t-elle le filtre de cuisson ? Sémantique OU (comme cuisine).
 *
 * @param recipe - La recette à tester.
 * @param selected - Ids de modes sélectionnés, plus le pseudo-mode « mixte » (≥ 2 modes).
 * @returns `true` si aucun filtre, ou si la recette satisfait l'un des modes.
 */
export function matchesCooking(recipe: CookableRecipe | null | undefined, selected: string[] | null | undefined): boolean {
  if (!selected?.length) return true;
  const methods = recipeCookingMethods(recipe);
  return selected.some(s => s === "mixte" ? methods.size >= 2 : methods.has(s));
}
