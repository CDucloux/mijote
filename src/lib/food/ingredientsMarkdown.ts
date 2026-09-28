/**
 * Spec des colonnes Markdown de la base d'ingrédients et sérialisation des conseils.
 * Sert l'export Cardamome (`ConfigPage`) et la validation des bornes (`dataYaml`).
 * `nut: true` = champ rangé dans `nutrition` ; `isVegetable` n'est pas une colonne
 * (recalculé depuis la catégorie).
 *
 * @module food/ingredientsMarkdown
 */

/** Colonne de la spec Markdown (le drapeau indique le traitement de la cellule). */
export interface MdColumn {
  key: string;
  label: string;
  months?: boolean;
  tips?: boolean;
  num?: boolean;
  nut?: boolean;
}

/**
 * Sérialise une liste de conseils en une cellule Markdown. Chaque conseil =
 * « type: texte », conseils séparés par « ;; ».
 *
 * @param tips - Les conseils (type + texte).
 * @returns La cellule sérialisée (`""` si aucun conseil valide).
 */
export function formatTips(tips: { type?: string; text?: string }[] | null | undefined): string {
  if (!Array.isArray(tips)) return "";
  return tips
    .filter(t => t && t.type && (t.text || "").trim())
    .map(t => `${t.type}: ${(t.text || "").trim().replace(/\s*;;\s*/g, ", ")}`)
    .join(" ;; ");
}

export const ING_MD_COLUMNS: MdColumn[] = [
  { key: "name", label: "Nom" },
  { key: "aliases", label: "Aliases" },
  { key: "id", label: "dbid" },
  { key: "category", label: "Catégorie" },
  { key: "months", label: "Mois", months: true },
  { key: "tips", label: "Tips", tips: true },
  { key: "gramsPerPiece", label: "g/pièce", num: true },
  { key: "image", label: "Image" },
  { key: "calories", label: "kcal", nut: true },
  { key: "protein", label: "Protéines", nut: true },
  { key: "carbs", label: "Glucides", nut: true },
  { key: "sugar", label: "Sucres", nut: true },
  { key: "fat", label: "Lipides", nut: true },
  { key: "saturatedFat", label: "AG saturés", nut: true },
  { key: "omega3", label: "Oméga-3", nut: true },
  { key: "fiber", label: "Fibres", nut: true },
  { key: "salt", label: "Sel", nut: true },
];

/**
 * Bornes de validation (valeurs nutritionnelles pour 100 g, sauf g/pièce). Toute
 * valeur hors bornes fait échouer l'import entier, pour éviter d'écraser la base
 * master avec des données aberrantes.
 */
export const ING_MD_BOUNDS: Record<string, [number, number]> = {
  calories: [0, 1000], protein: [0, 100], carbs: [0, 100], sugar: [0, 100],
  fat: [0, 100], saturatedFat: [0, 100], omega3: [0, 100], fiber: [0, 100],
  salt: [0, 100], gramsPerPiece: [0, 10000],
};
