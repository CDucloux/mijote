/**
 * Moteur de difficulté (pur) : estime la difficulté d'une recette (1–5) à partir
 * des gestes techniques repérés dans ses étapes, plus quelques modificateurs.
 * Transparent et corrigeable, `recipe.difficultyOverride` force la valeur.
 *
 * ```text
 * base  = max(difficulté des gestes détectés)              // signal dominant
 * mods  = +1 si ≥ 3 gestes distincts de niveau ≥ 2        // variété technique
 *         +1 si ≥ 1 préparation de base (sous-recette)    // coordination
 * score = clamp(base + min(mods, 1), 1, 5)
 * ```
 *
 * La difficulté mesure la TECHNIQUE, pas la longueur : les gestes de niveau 1
 * (émincer, faire revenir…) ne comptent pas dans la variété, le nombre d'étapes
 * n'entre plus dans le score (il nourrit l'indicateur séparé de charge de travail,
 * cf. {@link workloadOf}). Le bonus plafonné à +1 garantit qu'« Expert » (5) exige
 * un geste de niveau 4 ou plus : une base de niveau 3 s'arrête à 4.
 *
 * @module recipes/difficulty
 */
import { buildTechniqueIndex, annotateText, type TechniqueIndex, type TechniqueEntry } from "@/lib/recipes/techniques.js";

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
 * (typée souplement, les appelants passent des recettes de formes variées). */
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

/** Seuil de gestes de niveau ≥ 2 à partir duquel la variété technique compte. */
const VARIETY_MIN_TECHNIQUES = 3;
/** Niveau à partir duquel un geste compte dans la variété (les gestes de base, non). */
const VARIETY_MIN_LEVEL = 2;
/** Bonus maximal ajouté à la base, toutes règles confondues (et donc : 5 exige une base ≥ 4). */
const MAX_BONUS = 1;

/** Composantes du score, partagées par {@link computeDifficulty} et {@link explainDifficulty}. */
interface ScoreParts {
  base: number;
  mods: ModExplain[];
  modsApplied: number;
  modsCapped: boolean;
  score: number;
}

/** Applique les règles de difficulté aux gestes repérés (non vide) d'une recette. */
function scoreParts(all: Technique[], recipe: DiffRecipe): ScoreParts {
  const base = Math.max(...all.map(t => t.difficulty || 0));
  const advanced = all.filter(t => (t.difficulty || 0) >= VARIETY_MIN_LEVEL).length;
  const components = componentCount(recipe);
  const mods: ModExplain[] = [
    {
      label: `${VARIETY_MIN_TECHNIQUES} gestes de niveau ${VARIETY_MIN_LEVEL} ou plus`,
      detail: `${advanced} geste${advanced > 1 ? "s" : ""} de niveau ${VARIETY_MIN_LEVEL} ou plus`,
      applied: advanced >= VARIETY_MIN_TECHNIQUES,
    },
    {
      label: "Au moins une préparation de base",
      detail: components ? `${components} sous-recette${components > 1 ? "s" : ""}` : "aucune sous-recette",
      applied: components >= 1,
    },
  ];
  const raw = mods.filter(m => m.applied).length;
  const modsApplied = Math.min(raw, MAX_BONUS);
  return { base, mods, modsApplied, modsCapped: raw > MAX_BONUS, score: Math.min(5, Math.max(1, base + modsApplied)) };
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

  const { base, score } = scoreParts(all, recipe);
  const drivers = all.filter(t => t.difficulty === base).map(t => t.name || "");
  return { score, drivers, overridden: false };
}

/** Charge de travail d'une recette, indépendante de sa difficulté technique. */
export interface Workload {
  level: 1 | 2 | 3;
  label: string;
  steps: number;
}

/** Bornes (en nombre d'étapes) des niveaux de charge de travail. */
const WORKLOAD_LEVELS: { maxSteps: number; level: 1 | 2 | 3; label: string }[] = [
  { maxSteps: 6, level: 1, label: "Légère" },
  { maxSteps: 11, level: 2, label: "Moyenne" },
  { maxSteps: Number.POSITIVE_INFINITY, level: 3, label: "Soutenue" },
];

/**
 * Charge de travail d'une recette, d'après son nombre d'étapes. Indicateur SÉPARÉ
 * de la difficulté : une recette longue n'est pas plus technique, elle demande
 * seulement plus de temps et d'organisation.
 *
 * @param recipe - La recette (seules les étapes sont lues).
 * @returns Le niveau (1 à 3), son libellé et le nombre d'étapes, ou `null` sans étape.
 */
export function workloadOf(recipe: { steps?: readonly unknown[] | null } | null | undefined): Workload | null {
  const steps = (recipe?.steps || []).length;
  if (!steps) return null;
  const { level, label } = WORKLOAD_LEVELS.find(w => steps <= w.maxSteps) ?? WORKLOAD_LEVELS[WORKLOAD_LEVELS.length - 1];
  return { level, label, steps };
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
  /** Plusieurs bonus réunis, un seul retenu (plafond +1). */
  modsCapped: boolean;
  inheritedFromBases?: boolean;
}

/**
 * Décompose le calcul (geste dominant, gestes détectés, bonus retenus et
 * plafond). Renvoie `null` s'il n'y a rien à expliquer (score non calculé faute
 * de geste noté).
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

  const { base, mods, modsApplied, modsCapped, score } = scoreParts(all, recipe);
  const drivers = all.filter(t => t.difficulty === base).map(t => t.name || "");
  const techList: TechExplain[] = [...all].sort((a, b) => (b.difficulty || 0) - (a.difficulty || 0)).map(t => ({ ...t, inherited: !ownIds.has(t.id) }));

  return { score, overridden: false, base, techniques: techList, drivers, mods, modsApplied, modsCapped, inheritedFromBases: bases.length > 0 };
}
