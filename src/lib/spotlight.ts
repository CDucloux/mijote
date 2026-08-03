/**
 * Ingrédient du moment (logique pure) : choisit un fruit/légume de saison à mettre
 * en vedette dans l'Accueil, et retrouve les recettes publiques qui l'utilisent.
 *
 * @module spotlight
 */
import { ingredientMonths } from "./seasonality.js";

/** Ingrédient de la base (forme minimale utilisée ici). */
export interface SpotlightIngredient {
  id: string;
  name?: string;
  category?: string;
  months?: unknown;
}

/** Recette publique candidate (feed Découvrir). */
export interface PublicEntry {
  isComponent?: boolean;
  recipe?: { ingredients?: { name?: string }[] };
}

type IngredientResolver = (name: string | undefined) => { id?: string } | null;

const SPOTLIGHT_CATEGORIES = new Set(["fruit", "vegetable"]);

/**
 * Index de semaine déterministe (rotation hebdomadaire de la vedette).
 *
 * @param date - Date de référence (défaut : aujourd'hui).
 * @returns Le numéro de semaine depuis le 1er janvier.
 */
export function weekIndex(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return Math.floor((days + start.getDay()) / 7);
}

/**
 * Fruit/légume de saison ce mois, choisi de façon déterministe et tournant chaque
 * semaine sur TOUS les candidats de saison. `null` si aucun candidat.
 *
 * La description ne fait qu'enrichir la carte : la préférer figeait la rotation
 * quand un seul ingrédient en avait une.
 *
 * @param ingredientDB - Base d'ingrédients (fruits/légumes candidats).
 * @param date - Date de référence (mois + rotation hebdomadaire).
 * @returns L'ingrédient vedette de la semaine, ou `null` si aucun candidat de saison.
 */
export function pickSpotlightIngredient(
  ingredientDB: SpotlightIngredient[] | null | undefined,
  date: Date = new Date(),
): SpotlightIngredient | null {
  const month = date.getMonth() + 1;
  const candidates = (ingredientDB || []).filter(i => {
    if (!SPOTLIGHT_CATEGORIES.has(i.category || "")) return false;
    const m = ingredientMonths(i);
    return m && m.includes(month);
  });
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  return sorted[weekIndex(date) % sorted.length];
}

/**
 * Recettes publiques (hors préparations de base) utilisant l'ingrédient vedette.
 * `resolver` (createIngredientResolver) gère pluriels, qualificatifs et distingue
 * les proches (« poire » ≠ « poireau »).
 *
 * @param ingredient - L'ingrédient vedette.
 * @param pubs - Les recettes publiques candidates.
 * @param resolver - Résolveur nom → ingrédient (pluriels, qualificatifs).
 * @param max - Nombre maximum de recettes retournées (défaut 10).
 * @returns Les recettes publiques (hors bases) qui utilisent l'ingrédient.
 */
export function publicRecipesWithIngredient(
  ingredient: SpotlightIngredient | null | undefined,
  pubs: PublicEntry[] | null | undefined,
  resolver: IngredientResolver | null | undefined,
  max = 10,
): PublicEntry[] {
  if (!ingredient || !resolver) return [];
  const uses = (recipe: PublicEntry["recipe"]): boolean =>
    (recipe?.ingredients || []).some(ing => resolver(ing?.name)?.id === ingredient.id);
  return (pubs || []).filter(p => !p.isComponent && uses(p.recipe)).slice(0, max);
}
