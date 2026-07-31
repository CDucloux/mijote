/**
 * Tri des recettes de la bibliothèque : options de tri (critère + sens lisible)
 * et fabrique de comparateurs.
 *
 * @module recipeSort
 */
import { computeDifficulty } from "./difficulty.js";

/** Sens de tri. */
export type SortDir = "asc" | "desc";
/** Critère de tri disponible. */
export type SortKey = "date" | "name" | "health" | "time" | "difficulty";

/** Un des deux sens de lecture d'un critère, avec son libellé parlant. */
export interface SortDirOption {
  dir: SortDir;
  label: string;
}

/** Un critère de tri et ses deux sens (`dirs[0]` = sens par défaut). */
export interface SortOption {
  key: SortKey;
  label: string;
  /** Nom d'icône (cf. composant Icon). */
  icon: string;
  dirs: SortDirOption[];
}

/**
 * Recette minimale exploitée par le tri. Le signataire index autorise à passer
 * l'objet recette complet sans le décrire ici.
 */
export interface SortRecipe {
  id: string;
  name: string;
  createdAt?: string | number | null;
  healthScore?: number | null;
  prepTime?: number | null;
  cookTime?: number | null;
  [k: string]: unknown;
}

/** Libellés parlants côté UI plutôt qu'un « croissant / décroissant » abstrait. */
export const SORT_OPTIONS: SortOption[] = [
  { key: "date", label: "Récent", icon: "history", dirs: [
    { dir: "desc", label: "Plus récent" }, { dir: "asc", label: "Plus ancien" },
  ] },
  { key: "name", label: "A → Z", icon: "az", dirs: [
    { dir: "asc", label: "A → Z" }, { dir: "desc", label: "Z → A" },
  ] },
  { key: "health", label: "Nutri-Score", icon: "heart", dirs: [
    { dir: "desc", label: "Meilleur d'abord" }, { dir: "asc", label: "Moins bon d'abord" },
  ] },
  { key: "time", label: "Temps", icon: "clock", dirs: [
    { dir: "asc", label: "Plus rapide" }, { dir: "desc", label: "Plus long" },
  ] },
  { key: "difficulty", label: "Difficulté", icon: "fire", dirs: [
    { dir: "asc", label: "Plus facile" }, { dir: "desc", label: "Plus difficile" },
  ] },
];

export const DEFAULT_SORT_KEY: SortKey = "date";

/** L'option d'un critère (retombe sur la première si `key` est inconnu). */
export const sortOption = (key: SortKey): SortOption => SORT_OPTIONS.find(o => o.key === key) || SORT_OPTIONS[0];

/** Sens par défaut d'un critère. */
export const defaultDirFor = (key: SortKey): SortDir => sortOption(key).dirs[0].dir;

/** Libellé d'un sens donné pour un critère. */
export const dirLabel = (key: SortKey, dir: SortDir): string =>
  (sortOption(key).dirs.find(d => d.dir === dir) || sortOption(key).dirs[0]).label;

// L'horodatage ms encodé dans l'id ("r"+Date.now()…) départage les recettes du même
// jour (createdAt est au jour près, et parfois absent).
const idTimestamp = (id: string | undefined): number => { const m = /^r(\d{10,})/.exec(id || ""); return m ? Number(m[1]) : 0; };

/**
 * Comparateur de récence décroissante (plus récent d'abord) : `createdAt` puis,
 * à égalité ou en son absence, l'horodatage encodé dans l'id. Sert aussi de
 * départage stable pour les autres tris.
 */
export const byRecent = (a: SortRecipe, b: SortRecipe): number => {
  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  const da = Number.isNaN(ta) ? 0 : ta, db = Number.isNaN(tb) ? 0 : tb;
  return db !== da ? db - da : idTimestamp(b.id) - idTimestamp(a.id);
};

const timeOf = (r: SortRecipe): number | null => { const t = (r.prepTime || 0) + (r.cookTime || 0); return t > 0 ? t : null; };

/** Paramètres de {@link makeComparator}. */
export interface ComparatorParams {
  sortBy: SortKey;
  sortDir: SortDir;
  /** Glossaire des techniques (pour la difficulté calculée). */
  techniques?: unknown;
  /** Index pré-construit du glossaire. */
  techIndex?: unknown;
  /** Toutes les recettes (résolution des préparations de base). */
  recipes?: unknown;
}

/**
 * Fabrique le comparateur pour le critère et le sens demandés.
 *
 * Les recettes sans valeur pour le critère (temps, nutri ou difficulté inconnus)
 * sont toujours reléguées en fin de liste, quel que soit le sens.
 *
 * @returns Un comparateur `(a, b) => number` utilisable avec `Array.prototype.sort`.
 */
export function makeComparator({ sortBy, sortDir, techniques, techIndex, recipes }: ComparatorParams): (a: SortRecipe, b: SortRecipe) => number {
  if (sortBy === "name") {
    return (a, b) => (sortDir === "asc" ? 1 : -1) * a.name.localeCompare(b.name, "fr");
  }
  if (sortBy === "date") {
    return (a, b) => (sortDir === "desc" ? 1 : -1) * byRecent(a, b);
  }
  // Mémoïse la difficulté : sinon computeDifficulty tournerait à chaque comparaison.
  const diffCache = new Map<string, number | null>();
  const valueOf = (r: SortRecipe): number | null => {
    if (sortBy === "health") return typeof r.healthScore === "number" ? r.healthScore : null;
    if (sortBy === "time") return timeOf(r);
    if (sortBy === "difficulty") {
      if (!diffCache.has(r.id)) diffCache.set(r.id, computeDifficulty(r, techniques, { index: techIndex, recipes }).score);
      return diffCache.get(r.id) ?? null;
    }
    return null;
  };
  return (a, b) => {
    const va = valueOf(a), vb = valueOf(b);
    if (va == null || Number.isNaN(va)) return (vb == null || Number.isNaN(vb)) ? byRecent(a, b) : 1;
    if (vb == null || Number.isNaN(vb)) return -1;
    if (va === vb) return byRecent(a, b);
    return (sortDir === "asc" ? 1 : -1) * (va - vb);
  };
}
