import type { IngredientLine, Recipe, Step, Utensil } from "@/lib/types.js";

/** Ligne d'ingrédient de l'éditeur : `_raw` garde la saisie libre (« 200 g de farine »). */
export type EditorIngredient = IngredientLine & { _raw?: string };

/** Rendement en cours de saisie (`""` = champ vidé). */
export interface EditorYield {
  amount: number | "";
  unit: string;
}

/** Formulaire de l'éditeur : la recette avec ses listes et champs de classement toujours définis. */
export interface EditorForm extends Recipe {
  name: string;
  ingredients: EditorIngredient[];
  utensils: Utensil[];
  steps: Step[];
  cuisine: string;
  category: string;
  collections: string[];
  isComponent: boolean;
  yield: EditorYield;
}

/** Mise à jour d'un champ du formulaire, typée par champ. */
export type EditorFormUpdate = <K extends keyof EditorForm>(field: K, value: EditorForm[K]) => void;
