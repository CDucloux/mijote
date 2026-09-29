/**
 * Saisonnalité (pure). La donnée vit au niveau de l'ingrédient : chaque
 * fruit/légume porte `months` (entiers 1–12). La saison d'une recette est
 * CALCULÉE depuis ses ingrédients ; un produit disponible toute l'année n'apporte
 * aucun signal et est ignoré.
 *
 * @module food/seasonality
 */

/** Item de base minimal exploité ici (issu du résolveur de noms). */
interface SeasonItem { id: string; months?: unknown }
/** Résolveur nom → item (ou null). */
type SeasonResolver = ((name: string | undefined) => SeasonItem | null) | null | undefined;
interface SeasonRecipe { ingredients?: { name?: string }[] }

/** Score de saisonnalité d'une recette. */
export interface SeasonScore { score: number; total: number; inSeason: number }

/** Catégories où la saisonnalité a un sens (produits frais). */
export const SEASONAL_CATEGORIES = new Set(["vegetable", "fruit", "herbs", "mushroom"]);

/** Score (%) au-delà duquel une recette est « de saison ». */
export const SEASON_THRESHOLD = 50;

export const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
export const MONTHS_SHORT_FR = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** Mois courant (1–12), horloge locale. */
export function currentMonth(): number { return new Date().getMonth() + 1; }

/**
 * Champ `months` normalisé → tableau trié d'entiers 1–12, ou `null` si absent,
 * vide, ou couvrant les 12 mois (disponible toute l'année → aucun signal saison).
 *
 * @param ing - Item portant un champ `months` de forme quelconque (validé ici).
 * @returns Les mois valides triés et dédupliqués, ou `null` si aucun signal exploitable.
 */
export function ingredientMonths(ing: { months?: unknown } | null | undefined): number[] | null {
  const m = ing?.months;
  if (!Array.isArray(m)) return null;
  const clean = [...new Set(m.filter((x): x is number => Number.isInteger(x) && x >= 1 && x <= 12))].sort((a, b) => a - b);
  if (!clean.length || clean.length >= 12) return null;
  return clean;
}

/**
 * L'ingrédient est-il de saison ce mois ?
 *
 * @param ing - Item portant un champ `months`.
 * @param month - Mois testé (1–12) ; défaut = mois courant.
 * @returns `true`/`false`, ou `null` quand l'ingrédient n'a pas de donnée de saison (ignoré).
 */
export function isIngredientInSeason(ing: { months?: unknown } | null | undefined, month: number = currentMonth()): boolean | null {
  const m = ingredientMonths(ing);
  if (!m) return null;
  return m.includes(month);
}

/**
 * Score de saisonnalité d'une recette (0–100) d'après ses produits saisonniers.
 * `null` si la recette ne contient aucun produit saisonnier identifiable.
 *
 * @param resolver - Résolveur `(name) => item | null`.
 */
export function recipeSeasonScore(recipe: SeasonRecipe | null | undefined, resolver: SeasonResolver, month: number = currentMonth()): SeasonScore | null {
  const ings = recipe?.ingredients || [];
  let total = 0, inSeason = 0;
  const seen = new Set<string>();
  for (const ing of ings) {
    const item = resolver ? resolver(ing.name) : null;
    if (!item || seen.has(item.id)) continue;
    const months = ingredientMonths(item);
    if (!months) continue;
    seen.add(item.id);
    total++;
    if (months.includes(month)) inSeason++;
  }
  if (total === 0) return null;
  return { score: Math.round((inSeason / total) * 100), total, inSeason };
}

/**
 * La recette est-elle « de saison » ce mois ? Sert de prédicat au filtre : le score
 * doit atteindre {@link SEASON_THRESHOLD}. Une recette sans produit saisonnier
 * identifiable (score `null`) est considérée hors saison.
 *
 * @param recipe - La recette et ses ingrédients.
 * @param resolver - Résolveur `(name) => item | null`.
 * @param month - Mois testé (1–12) ; défaut = mois courant.
 * @returns `true` si la recette franchit le seuil de saisonnalité.
 */
export function isRecipeInSeason(recipe: SeasonRecipe | null | undefined, resolver: SeasonResolver, month: number = currentMonth()): boolean {
  const s = recipeSeasonScore(recipe, resolver, month);
  return s != null && s.score >= SEASON_THRESHOLD;
}

/**
 * Désérialise une plage de mois Markdown (« 4-6 », « 1,7-12 ») → `[1,2,3,…]`.
 * Robuste aux espaces et au désordre ; les valeurs hors 1–12 sont écartées.
 *
 * @param str - Expression de mois (tokens séparés par virgules, plages `a-b`).
 * @returns Les mois valides, triés et dédupliqués (`[]` si l'entrée est vide/invalide).
 */
export function parseMonths(str: string | null | undefined): number[] {
  if (!str || typeof str !== "string") return [];
  const out = new Set<number>();
  for (const tok of str.split(",")) {
    const t = tok.trim();
    if (!t) continue;
    const range = t.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    if (range) {
      const a = +range[1], b = +range[2];
      for (let n = a; n <= b; n++) if (n >= 1 && n <= 12) out.add(n);
    } else {
      const n = +t;
      if (Number.isInteger(n) && n >= 1 && n <= 12) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Sérialise `[1,2,3,11,12]` → « 1-3,11-12 » (suites consécutives compressées).
 * Opération inverse de {@link parseMonths}.
 *
 * @param arr - Entrée de forme quelconque ; seuls les entiers 1–12 sont retenus.
 * @returns L'expression compacte des mois (`""` si rien d'exploitable).
 */
export function formatMonths(arr: unknown): string {
  if (!Array.isArray(arr)) return "";
  const m = [...new Set(arr.filter((x): x is number => Number.isInteger(x) && x >= 1 && x <= 12))].sort((a, b) => a - b);
  if (!m.length) return "";
  const parts: string[] = [];
  let start = m[0], prev = m[0];
  const flush = () => parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  for (let i = 1; i < m.length; i++) {
    if (m[i] === prev + 1) { prev = m[i]; continue; }
    flush(); start = prev = m[i];
  }
  flush();
  return parts.join(",");
}
