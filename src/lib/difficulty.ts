/**
 * Moteur de difficulté (pur) : estime la difficulté d'une recette (1–5) à partir
 * des gestes techniques repérés dans ses étapes, plus quelques modificateurs.
 * Transparent et corrigeable — `recipe.difficultyOverride` force la valeur.
 *
 * ```text
 * base  = max(difficulté des gestes détectés)              // signal dominant
 * mods  = +1 si ≥ 4 gestes distincts
 *         +1 si ≥ 1 préparation de base (sous-recette)
 *         +1 si ≥ 12 étapes
 * score = clamp(base + min(mods, 2), 1, 5)
 * ```
 *
 * @module difficulty
 */
import { buildTechniqueIndex, annotateText, type TechniqueIndex, type TechniqueEntry } from "./techniques.js";

/** Un geste technique noté (issu du glossaire). */
export interface Technique {
  id: string;
  name?: string;
  difficulty?: number;
}
interface DiffStep { text?: string }
interface DiffRecipe {
  id?: string;
  name?: string;
  difficultyOverride?: number;
  ingredients?: { recipeId?: string | null }[];
  steps?: DiffStep[];
}
/** Options communes : index de glossaire pré-construit et base de recettes
 * (typée souplement — les appelants passent des recettes de formes variées). */
export interface DiffOpts {
  index?: unknown;
  recipes?: unknown;
}

/** Résultat compact du calcul de difficulté. */
export interface DifficultyResult {
  /** 1–5, ou `null` si aucun geste noté (on n'invente pas de valeur). */
  score: number | null;
  /** Gestes dominants (ceux qui portent la difficulté de base). */
  drivers: string[];
  overridden: boolean;
}

export const DIFFICULTY_LABEL: Record<number, string> = { 1: "Très facile", 2: "Facile", 3: "Intermédiaire", 4: "Difficile", 5: "Expert" };
/**
 * Couleur associée à un niveau de difficulté (vert ≤ 2, orange = 3, rouge ≥ 4).
 *
 * @param lvl - Le niveau de difficulté (1–5).
 * @returns La variable/valeur CSS de couleur.
 */
export const difficultyColor = (lvl: number): string => lvl <= 2 ? "var(--green)" : lvl === 3 ? "#e8920a" : "var(--red)";

/** Gestes (avec difficulté) repérés dans une liste d'étapes, dédoublonnés. */
function techniquesInSteps(steps: DiffStep[] | undefined, index: TechniqueIndex): Technique[] {
  const found = new Map<string, Technique>();
  for (const step of steps || []) {
    for (const seg of annotateText(step.text || "", index)) {
      if (seg.tech?.id && seg.tech.difficulty) found.set(seg.tech.id, seg.tech);
    }
  }
  return [...found.values()];
}

function componentCount(recipe: DiffRecipe): number {
  const ids = new Set<string>();
  for (const ing of recipe?.ingredients || []) if (ing.recipeId) ids.add(ing.recipeId);
  return ids.size;
}

/** Préparations de base résolues (héritage simple, non récursif). */
function baseRecipesOf(recipe: DiffRecipe, recipes: DiffRecipe[] | undefined): DiffRecipe[] {
  const ids = new Set<string>();
  for (const ing of recipe?.ingredients || []) if (ing.recipeId) ids.add(ing.recipeId);
  if (!ids.size) return [];
  const byId = new Map((recipes || []).map(r => [r.id, r]));
  return [...ids].map(id => byId.get(id)).filter((r): r is DiffRecipe => !!r);
}

interface BaseTechniques { name?: string; techs: Technique[] }
interface CollectedTechniques { own: Technique[]; ownIds: Set<string>; bases: BaseTechniques[]; all: Technique[] }

/**
 * Gestes de la recette ET de ses bases (héritage simple d'un niveau). `all` =
 * union dédoublonnée où les gestes propres priment.
 */
function collectTechniques(recipe: DiffRecipe, index: TechniqueIndex, recipes: DiffRecipe[] | undefined): CollectedTechniques {
  const own = techniquesInSteps(recipe?.steps, index);
  const ownIds = new Set(own.map(t => t.id));
  const bases: BaseTechniques[] = [];
  for (const base of baseRecipesOf(recipe, recipes)) {
    const techs = techniquesInSteps(base?.steps, index);
    if (techs.length) bases.push({ name: base.name, techs });
  }
  const allMap = new Map(own.map(t => [t.id, t]));
  for (const b of bases) for (const t of b.techs) if (!allMap.has(t.id)) allMap.set(t.id, t);
  return { own, ownIds, bases, all: [...allMap.values()] };
}

/**
 * Calcule la difficulté (1–5) d'une recette. `score` vaut `null` si aucun geste
 * n'est repéré : on préfère ne pas afficher d'indice plutôt qu'inventer.
 *
 * @param recipe - La recette (forme souple ; on lit override/ingrédients/étapes).
 * @param techniques - Glossaire des techniques (sauf si `opts.index` est fourni).
 * @param opts - Options : `index` (index pré-construit), `recipes` (pour les bases).
 * @returns `{ score, drivers, overridden }` (`score` = `null` si aucun geste noté).
 */
export function computeDifficulty(recipe: DiffRecipe, techniques?: unknown, opts: DiffOpts = {}): DifficultyResult {
  const ov = recipe?.difficultyOverride;
  if (Number.isInteger(ov) && ov! >= 1 && ov! <= 5) return { score: ov!, drivers: [], overridden: true };

  const index = (opts.index as TechniqueIndex | undefined) || buildTechniqueIndex(techniques as TechniqueEntry[] | undefined);
  const { all } = collectTechniques(recipe, index, opts.recipes as DiffRecipe[] | undefined);
  if (!all.length) return { score: null, drivers: [], overridden: false };

  const base = Math.max(...all.map(t => t.difficulty || 0));
  let mods = 0;
  if (all.length >= 4) mods += 1;
  if (componentCount(recipe) >= 1) mods += 1;
  if ((recipe?.steps || []).length >= 12) mods += 1;

  const score = Math.min(5, Math.max(1, base + Math.min(mods, 2)));
  const drivers = all.filter(t => t.difficulty === base).map(t => t.name || "");
  return { score, drivers, overridden: false };
}

interface ModExplain { label: string; detail: string; applied: boolean }
interface TechExplain extends Technique { inherited: boolean }
/** Décomposition détaillée du calcul, pour l'expliquer dans l'UI. */
export interface DifficultyExplain {
  score: number;
  overridden: boolean;
  base: number | null;
  techniques: TechExplain[];
  drivers: string[];
  mods: ModExplain[];
  modsApplied: number;
  modsCapped: boolean;
  inheritedFromBases?: boolean;
}

/**
 * Décompose le calcul (geste dominant, gestes détectés, modificateurs appliqués
 * avec le plafond de +2). Renvoie `null` s'il n'y a rien à expliquer (score non
 * calculé faute de geste noté).
 *
 * @param recipe - La recette à expliquer.
 * @param techniques - Glossaire des techniques (sauf si `opts.index` est fourni).
 * @param opts - Options : `index` (index pré-construit), `recipes` (pour les bases).
 * @returns La décomposition détaillée, ou `null` s'il n'y a rien à expliquer.
 */
export function explainDifficulty(recipe: DiffRecipe, techniques?: unknown, opts: DiffOpts = {}): DifficultyExplain | null {
  const ov = recipe?.difficultyOverride;
  if (Number.isInteger(ov) && ov! >= 1 && ov! <= 5) {
    return { score: ov!, overridden: true, base: null, techniques: [], drivers: [], mods: [], modsApplied: 0, modsCapped: false };
  }

  const index = (opts.index as TechniqueIndex | undefined) || buildTechniqueIndex(techniques as TechniqueEntry[] | undefined);
  const { ownIds, bases, all } = collectTechniques(recipe, index, opts.recipes as DiffRecipe[] | undefined);
  if (!all.length) return null;

  const base = Math.max(...all.map(t => t.difficulty || 0));
  const distinct = all.length;
  const nbComponents = componentCount(recipe);
  const nbSteps = (recipe?.steps || []).length;

  const mods: ModExplain[] = [
    { label: "4 gestes techniques ou plus", detail: `${distinct} geste${distinct > 1 ? "s" : ""} détecté${distinct > 1 ? "s" : ""}`, applied: distinct >= 4 },
    { label: "Au moins une préparation de base", detail: nbComponents ? `${nbComponents} sous-recette${nbComponents > 1 ? "s" : ""}` : "aucune sous-recette", applied: nbComponents >= 1 },
    { label: "12 étapes ou plus", detail: `${nbSteps} étape${nbSteps > 1 ? "s" : ""}`, applied: nbSteps >= 12 },
  ];
  const rawMods = mods.filter(m => m.applied).length;
  const modsApplied = Math.min(rawMods, 2);
  const score = Math.min(5, Math.max(1, base + modsApplied));
  const drivers = all.filter(t => t.difficulty === base).map(t => t.name || "");
  const techList: TechExplain[] = [...all].sort((a, b) => (b.difficulty || 0) - (a.difficulty || 0)).map(t => ({ ...t, inherited: !ownIds.has(t.id) }));

  return { score, overridden: false, base, techniques: techList, drivers, mods, modsApplied, modsCapped: rawMods > 2, inheritedFromBases: bases.length > 0 };
}
