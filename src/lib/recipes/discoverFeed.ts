/**
 * Logique pure de la vue « Découvrir » (recettes publiques de la communauté) :
 *   1. les CATÉGORIES statiques de la barre collante ({@link STATIC_CATEGORIES}) ;
 *   2. le prédicat « recette rapide » ({@link isQuickRecipe}) ;
 *   3. l'appariement d'une recette à une catégorie active ({@link matchesDiscoverCategory}).
 *
 * Aucun I/O, aucun React : la section `DiscoverSection` calcule un jeu de drapeaux
 * par recette (favori, vegan, de saison, rapide, base, cuisine) et délègue ici la
 * décision d'affichage, pour que le filtrage reste testable et cohérent.
 *
 * @module discoverFeed
 */

import { normalizeStr } from "@/lib/food/parseIngredient.js";

/** Seuil (minutes) sous lequel une recette est « rapide » (prépa + cuisson). */
export const QUICK_MAX_MIN = 20;

/** Recette rapide : temps total (prépa + cuisson) renseigné et strictement sous le seuil. */
export function isQuickRecipe(recipe: { prepTime?: unknown; cookTime?: unknown } | null | undefined): boolean {
  const prep = Number(recipe?.prepTime) || 0;
  const cook = Number(recipe?.cookTime) || 0;
  const total = prep + cook;
  return total > 0 && total < QUICK_MAX_MIN;
}

/** Une catégorie de la barre collante (les cuisines sont ajoutées dynamiquement). */
export interface DiscoverCategory {
  key: string;
  label: string;
}

/** Catégories fixes, dans l'ordre d'affichage. Les cuisines présentes s'ajoutent après. */
export const STATIC_CATEGORIES: readonly DiscoverCategory[] = [
  { key: "tout", label: "Tout" },
  { key: "fav", label: "Favoris" },
  { key: "vegan", label: "Vegan" },
  { key: "saison", label: "De saison" },
  { key: "rapide", label: "Rapide" },
  { key: "bases", label: "Préparations de base" },
];

/** Clés de catégorie qui ne dépendent pas d'une cuisine (le reste = un label de cuisine). */
const STATIC_KEYS = new Set(STATIC_CATEGORIES.map(c => c.key));

/** Drapeaux d'une recette, calculés par la vue, sur lesquels l'appariement décide. */
export interface DiscoverFlags {
  isFavorite: boolean;
  isVegan: boolean;
  isInSeason: boolean;
  isQuick: boolean;
  isComponent: boolean;
  /** Style de cuisine de la recette (`""` si aucun). */
  cuisine: string;
}

/**
 * Décide si une recette appartient à la catégorie active de la barre collante.
 * Les clés statiques (`fav`, `vegan`, `saison`, `rapide`, `bases`) lisent le drapeau
 * correspondant ; toute autre clé est traitée comme un LABEL de cuisine et comparée
 * au style de la recette (insensible casse/accents). `tout` laisse tout passer.
 *
 * @param flags - Drapeaux pré-calculés de la recette.
 * @param cat - Clé de catégorie active (clé statique ou label de cuisine).
 * @returns `true` si la recette doit apparaître sous cette catégorie.
 */
export function matchesDiscoverCategory(flags: DiscoverFlags, cat: string): boolean {
  switch (cat) {
    case "tout": return true;
    case "fav": return flags.isFavorite;
    case "vegan": return flags.isVegan;
    case "saison": return flags.isInSeason;
    case "rapide": return flags.isQuick;
    case "bases": return flags.isComponent;
    default:
      if (STATIC_KEYS.has(cat)) return false; // clé statique non gérée : rien plutôt que tout
      return !!flags.cuisine && normalizeStr(flags.cuisine) === normalizeStr(cat);
  }
}
