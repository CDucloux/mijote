/**
 * Apports journaliers d'une journée de planning, pour situer une journée face aux
 * repères recommandés (à ce stade : le SEL, proxy du sodium, sodium x 2,5). Le
 * planning porte des repas par date ; chaque item vaut UNE portion mangée ce
 * jour-là (une part d'un plat cuisiné pour plusieurs). On somme donc l'apport
 * PAR PORTION de chaque recette du jour.
 *
 * Logique pure (aucun I/O, aucun React), adossée à {@link computeNutritionDetail}
 * déjà testé pour le calcul par recette.
 *
 * @module planning/dayIntake
 */
import { computeNutritionDetail } from "@/lib/recipes/nutriscore.js";
import type { IngredientLine } from "@/lib/types.js";
import { NUTRI_RI } from "@/constants/nutritionDisplay.js";

/** Recette exploitée par le calcul (forme minimale). */
interface IntakeRecipe { id?: string; servings?: number | string; ingredients?: IngredientLine[]; yield?: { amount?: number; unit?: string } }
/** Base d'ingrédients (valeurs nutritionnelles pour 100 g). */
type IngredientDB = Parameters<typeof computeNutritionDetail>[1];
/** Un repas planifié (seul le `recipeId` est requis ici). */
interface DayItem { recipeId?: string }

/** Niveau d'apport d'une journée face au repère (sel, un PLAFOND à ne pas dépasser). */
export type IntakeLevel = "ok" | "warn" | "over";
/** Niveau des protéines (un PLANCHER : on veut en avoir assez, pas éviter le surplus). */
export type ProteinLevel = "low" | "ok";

/** Apport journalier consolidé (par personne) d'une journée de planning. */
export interface DayIntake {
  /** Sel cumulé sur la journée, en grammes (par portion mangée). */
  salt: number;
  /** Calories cumulées sur la journée (kcal), sous-produit réutilisable. */
  calories: number;
  /** Repère journalier de sel utilisé (g), pour l'affichage du dénominateur. */
  saltTarget: number;
  /** Part du repère de sel atteinte (1 = pile au repère, > 1 = dépassement). */
  saltRatio: number;
  /** Niveau du sel : `ok` < 75 %, `warn` 75-100 %, `over` >= 100 %. */
  level: IntakeLevel;
  /** Protéines cumulées sur la journée, en grammes (par portion mangée). */
  protein: number;
  /** Repère journalier de protéines (g), pour l'affichage du dénominateur. */
  proteinTarget: number;
  /** Part du repère de protéines atteinte. */
  proteinRatio: number;
  /** Niveau protéines : `low` sous 50 % du repère (plancher), sinon `ok`. */
  proteinLevel: ProteinLevel;
  /** Fibres cumulées sur la journée, en grammes (par portion mangée). */
  fiber: number;
  /** Repère journalier de fibres (g), pour l'affichage du dénominateur. */
  fiberTarget: number;
  /** Part du repère de fibres atteinte. */
  fiberRatio: number;
  /** Niveau fibres : `low` sous 50 % du repère (plancher), sinon `ok`. */
  fiberLevel: ProteinLevel;
  /** Part de la masse du jour couverte par des données nutritionnelles (0-1). */
  coverage: number;
  /**
   * L'estimation est-elle exploitable ? Faux si trop peu d'ingrédients ont des
   * données (< 50 % de couverture) ou si la journée est vide : afficher une alerte
   * dans ce cas serait trompeur (cf. seuil identique à la fiche recette).
   */
  reliable: boolean;
  /** Nombre de repas (items résolus) pris en compte. */
  meals: number;
}

/** Seuils de bascule du niveau, en part du repère journalier de sel. */
const WARN_RATIO = 0.75;
/** Sous ce taux d'un repère PLANCHER (protéines, fibres), la journée est jugée un peu juste. */
const PROTEIN_LOW_RATIO = 0.5;
/** Sous ce taux de couverture, l'estimation n'est pas assez fiable pour alerter. */
const RELIABLE_COVERAGE = 0.5;

/**
 * Agrège l'apport nutritionnel (sel, protéines, calories) d'une journée de planning.
 *
 * @param items - Les repas planifiés du jour (`mealPlan[date]`).
 * @param recipesById - Index des recettes (résout les items ET les composants).
 * @param ingredientDB - La base d'ingrédients (valeurs nutritionnelles).
 * @returns L'apport consolidé du jour ({@link DayIntake}).
 */
export function computeDayIntake(
  items: DayItem[] | null | undefined,
  recipesById: Map<string, IntakeRecipe>,
  ingredientDB: IngredientDB,
): DayIntake {
  const saltTarget = NUTRI_RI.salt;
  const proteinTarget = NUTRI_RI.protein;
  const fiberTarget = NUTRI_RI.fiber;
  let salt = 0, protein = 0, fiber = 0, calories = 0, covMass = 0, totMass = 0, meals = 0;
  for (const item of items || []) {
    const recipe = item?.recipeId ? recipesById.get(item.recipeId) : undefined;
    if (!recipe) continue;
    const servings = Math.max(1, Number(recipe.servings) || 1);
    const detail = computeNutritionDetail(recipe.ingredients, ingredientDB, servings, recipesById);
    salt += detail.perServing.salt || 0;
    protein += detail.perServing.protein || 0;
    fiber += detail.perServing.fiber || 0;
    calories += detail.perServing.calories || 0;
    // Couverture consolidée : pondérée par la masse d'UNE portion, pour qu'un gros
    // plat mal renseigné pèse plus qu'une petite garniture bien renseignée.
    const perServingMass = detail.mass / servings;
    totMass += perServingMass;
    covMass += perServingMass * detail.coverage;
    meals++;
  }
  const coverage = totMass ? covMass / totMass : 0;
  const saltRatio = saltTarget > 0 ? salt / saltTarget : 0;
  const proteinRatio = proteinTarget > 0 ? protein / proteinTarget : 0;
  const fiberRatio = fiberTarget > 0 ? fiber / fiberTarget : 0;
  const reliable = meals > 0 && coverage >= RELIABLE_COVERAGE;
  const level: IntakeLevel = saltRatio >= 1 ? "over" : saltRatio >= WARN_RATIO ? "warn" : "ok";
  const proteinLevel: ProteinLevel = proteinRatio < PROTEIN_LOW_RATIO ? "low" : "ok";
  const fiberLevel: ProteinLevel = fiberRatio < PROTEIN_LOW_RATIO ? "low" : "ok";
  return { salt, calories, saltTarget, saltRatio, level, protein, proteinTarget, proteinRatio, proteinLevel, fiber, fiberTarget, fiberRatio, fiberLevel, coverage, reliable, meals };
}
