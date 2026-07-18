import { normalizeStr } from "./parseIngredient.js";

// ─── MODES DE CUISSON (déduits des ustensiles d'une recette) ──────────────────
// Les ustensiles n'ont pas de champ « type de cuisson » : on le déduit du nom.
// Chaque mode a une liste de mots-clés (normalisés, sans accents). Une recette
// peut relever de plusieurs modes ; on parle alors de cuisson « mixte ».
export const COOKING_METHODS = [
  { id: "four", label: "Four", keywords: ["four", "plat a gratin", "plat a four", "moule a cake", "moule a gateau", "moule a tarte", "cocotte en fonte", "ramequin", "lechefrite", "plaque de cuisson"] },
  { id: "airfryer", label: "Air fryer", keywords: ["air fryer", "airfryer", "friteuse a air", "ninja"] },
  { id: "plaques", label: "Plaques", keywords: ["poele", "casserole", "sauteuse", "wok", "marmite", "faitout", "cocotte", "poelon", "russe", "crepiere", "bouilloire", "cuiseur"] },
  { id: "vapeur", label: "Vapeur", keywords: ["vapeur", "cuit-vapeur", "couscoussier", "panier vapeur"] },
  { id: "grill", label: "Grill / plancha", keywords: ["barbecue", "plancha", "grill", "gril", "pierrade"] },
  { id: "micro-ondes", label: "Micro-ondes", keywords: ["micro-onde", "micro onde"] },
];

const RULES = COOKING_METHODS.map(m => ({ id: m.id, keys: m.keywords.map(normalizeStr) }));

// Modes de cuisson d'une recette, d'après les noms de ses ustensiles.
export function recipeCookingMethods(recipe) {
  const found = new Set();
  for (const u of recipe?.utensils || []) {
    const n = normalizeStr(u?.name);
    if (!n) continue;
    for (const r of RULES) if (r.keys.some(k => n.includes(k))) found.add(r.id);
  }
  return found;
}

// La recette passe-t-elle le filtre de cuisson ? `selected` = liste d'ids de
// modes, plus le pseudo-mode "mixte" (≥ 2 modes). Sémantique OU (comme cuisine).
export function matchesCooking(recipe, selected) {
  if (!selected?.length) return true;
  const methods = recipeCookingMethods(recipe);
  return selected.some(s => s === "mixte" ? methods.size >= 2 : methods.has(s));
}
