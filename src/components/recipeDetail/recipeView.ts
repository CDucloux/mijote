import type { NavigateFunction } from "react-router-dom";
import type { IngredientLine, Recipe, Step, UsagePrecaution, Utensil } from "@/lib/types.js";
import type { DbEntry, Resolver } from "@/lib/food/nameMatcher.js";
import type { ResolvedRecommendation } from "@/lib/food/qualityRecommendation.js";

/** Ligne « préparation de base » résolue : recette source (absente si supprimée). */
export interface ResolvedComponent {
  comp: Recipe | undefined;
  missing: boolean;
}

/**
 * Contexte de rendu de la fiche, construit par RecipeDetail et partagé par les
 * contenus mobile et desktop : multiplicateur de quantités et résolveurs d'affichage.
 */
export interface RecipeView {
  /** Facteur appliqué aux quantités (portions × moule). */
  mult: number;
  recipesById: ReadonlyMap<string | undefined, Recipe>;
  getIngImage: (dbId: string | undefined, name: string | undefined) => string;
  getIngId: (ing: IngredientLine) => string;
  getUtImage: (dbId: string | undefined, name: string | undefined) => string;
  getUtDetail: (utensil: Utensil, step: Step) => string;
  getIngReco?: (ing: IngredientLine) => ResolvedRecommendation | null;
  getUtPrecaution?: (utensil: Utensil) => UsagePrecaution | null;
  /** `null` pour une ligne d'ingrédient brut (pas une préparation de base). */
  resolveComp: (ing: IngredientLine) => ResolvedComponent | null;
  isInStock: (ing: IngredientLine) => boolean;
  seasonResolver: Resolver;
  ingredientDB: DbEntry[];
  navigate: NavigateFunction;
}

/** Ustensile dont la feuille de précautions est ouverte. */
export interface PrecautionSheetTarget {
  name: string | undefined;
  prec: UsagePrecaution;
}
