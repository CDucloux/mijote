/**
 * Validation des lignes d'ingrédients de l'éditeur de recette, avant enregistrement.
 * Logique pure, sans I/O ni React.
 *
 * @module recipes/editorIngredients
 */

/** Ligne d'ingrédient telle que l'éditeur la manipule (brute ou préparation de base). */
export interface EditorIngredientLine {
  name?: string;
  dbId?: string;
  recipeId?: string;
  amount?: number | string;
}

/** Résultat du nettoyage : lignes conservées et lignes nommées sans quantité. */
export interface CleanedIngredients<T> {
  /** Lignes non vides, dans l'ordre d'origine. */
  cleaned: T[];
  /** Lignes nommées (ou liées) dont la quantité n'est pas un nombre > 0. */
  missingQty: T[];
}

const hasQuantity = (line: EditorIngredientLine): boolean => Number(line.amount) > 0;
const isNamed = (line: EditorIngredientLine): boolean => !!(line.name || line.dbId || line.recipeId);

/**
 * Prépare l'enregistrement : une ligne totalement vide (ni nom, ni lien, ni
 * quantité) est retirée en silence, c'est un reste de saisie ; une ligne nommée
 * doit porter une quantité > 0, sinon elle est signalée pour que l'utilisateur la
 * complète ou la supprime.
 *
 * @param lines - Lignes d'ingrédients du formulaire.
 * @returns Les lignes conservées et celles qui manquent de quantité.
 */
export function cleanEditorIngredients<T extends EditorIngredientLine>(lines: readonly T[]): CleanedIngredients<T> {
  const cleaned = lines.filter(line => isNamed(line) || hasQuantity(line));
  return { cleaned, missingQty: cleaned.filter(line => isNamed(line) && !hasQuantity(line)) };
}
