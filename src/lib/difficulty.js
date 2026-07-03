// ─── MOTEUR DE DIFFICULTÉ (pur) ───────────────────────────────────────────────
// Estime la difficulté d'une recette (1–5) à partir des gestes techniques repérés
// dans ses étapes (via le glossaire), plus quelques modificateurs. Transparent et
// corrigeable : `recipe.difficultyOverride` force la valeur.
//
//   base  = max(difficulté des gestes détectés)              // signal dominant
//   mods  = +1 si ≥4 gestes distincts
//           +1 si ≥1 préparation de base (sous-recette)
//           +1 si ≥12 étapes
//   score = clamp(base + min(mods, 2), 1, 5)

import { buildTechniqueIndex, annotateText } from "./techniques.js";

export const DIFFICULTY_LABEL = { 1: "Très facile", 2: "Facile", 3: "Intermédiaire", 4: "Difficile", 5: "Expert" };
export const difficultyColor = (lvl) => lvl <= 2 ? "var(--green)" : lvl === 3 ? "#e8920a" : "var(--red)";

// Gestes (avec difficulté) repérés dans les étapes de la recette, dédoublonnés.
function techniquesInRecipe(recipe, index) {
  const found = new Map();
  for (const step of recipe?.steps || []) {
    for (const seg of annotateText(step.text || "", index)) {
      if (seg.tech?.id && seg.tech.difficulty) found.set(seg.tech.id, seg.tech);
    }
  }
  return [...found.values()];
}

// Nombre de préparations de base (sous-recettes) référencées par la recette.
function componentCount(recipe) {
  const ids = new Set();
  for (const ing of recipe?.ingredients || []) if (ing.recipeId) ids.add(ing.recipeId);
  return ids.size;
}

// Renvoie { score, drivers, overridden } ; score = null si aucun geste noté (on
// n'affiche alors pas d'indice plutôt que d'inventer une valeur).
export function computeDifficulty(recipe, techniques, opts = {}) {
  const ov = recipe?.difficultyOverride;
  if (Number.isInteger(ov) && ov >= 1 && ov <= 5) return { score: ov, drivers: [], overridden: true };

  const index = opts.index || buildTechniqueIndex(techniques);
  const used = techniquesInRecipe(recipe, index);
  if (!used.length) return { score: null, drivers: [], overridden: false };

  const base = Math.max(...used.map(t => t.difficulty));
  let mods = 0;
  if (used.length >= 4) mods += 1;
  if (componentCount(recipe) >= 1) mods += 1;
  if ((recipe?.steps || []).length >= 12) mods += 1;

  const score = Math.min(5, Math.max(1, base + Math.min(mods, 2)));
  const drivers = used.filter(t => t.difficulty === base).map(t => t.name);
  return { score, drivers, overridden: false };
}

// Décompose le calcul pour l'expliquer à l'utilisateur : geste dominant, gestes
// détectés et modificateurs appliqués (avec le plafond de +2). Renvoie `null`
// quand il n'y a rien à expliquer (score non calculé faute de geste noté).
export function explainDifficulty(recipe, techniques, opts = {}) {
  const ov = recipe?.difficultyOverride;
  if (Number.isInteger(ov) && ov >= 1 && ov <= 5) {
    return { score: ov, overridden: true, base: null, techniques: [], drivers: [], mods: [], modsApplied: 0, modsCapped: false };
  }

  const index = opts.index || buildTechniqueIndex(techniques);
  const used = techniquesInRecipe(recipe, index);
  if (!used.length) return null;

  const base = Math.max(...used.map(t => t.difficulty));
  const distinct = used.length;
  const nbComponents = componentCount(recipe);
  const nbSteps = (recipe?.steps || []).length;

  const mods = [
    { label: "4 gestes techniques ou plus", detail: `${distinct} geste${distinct > 1 ? "s" : ""} détecté${distinct > 1 ? "s" : ""}`, applied: distinct >= 4 },
    { label: "Au moins une préparation de base", detail: nbComponents ? `${nbComponents} sous-recette${nbComponents > 1 ? "s" : ""}` : "aucune sous-recette", applied: nbComponents >= 1 },
    { label: "12 étapes ou plus", detail: `${nbSteps} étape${nbSteps > 1 ? "s" : ""}`, applied: nbSteps >= 12 },
  ];
  const rawMods = mods.filter(m => m.applied).length;
  const modsApplied = Math.min(rawMods, 2);
  const score = Math.min(5, Math.max(1, base + modsApplied));
  const drivers = used.filter(t => t.difficulty === base).map(t => t.name);
  const techList = [...used].sort((a, b) => b.difficulty - a.difficulty);

  return { score, overridden: false, base, techniques: techList, drivers, mods, modsApplied, modsCapped: rawMods > 2 };
}
