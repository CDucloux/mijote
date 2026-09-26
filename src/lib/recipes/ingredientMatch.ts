/**
 * Statut d'appariement d'une ligne d'ingrédient saisie : dérive, à partir des seuls
 * champs analysés (nom, quantité, unité, `dbId`), l'état de reconnaissance vis-à-vis
 * de la base d'ingrédients et l'éventuel manque bloquant. Sert à alimenter un unique
 * indicateur compact (pastille sur la ligne) plutôt qu'une rangée de pilules : la
 * dérivation vit ici, l'UI ne fait que peindre {@link IngredientMatch}.
 *
 * Pur, sans I/O, sans React.
 *
 * @module recipes/ingredientMatch
 */

import type { IngredientLine } from "@/lib/types.js";

/** Tonalité de l'indicateur : vert (tout bon), ambre (à préciser), neutre (rien saisi). */
export type MatchTone = "ok" | "warn" | "neutral";

/** État d'appariement dérivé d'une ligne d'ingrédient. */
export interface IngredientMatch {
  /** Couleur/registre de l'indicateur. */
  tone: MatchTone;
  /** Résumé d'une ligne, prêt à afficher (titre de la feuille, `aria-label`). Vide si rien à montrer. */
  summary: string;
  /** L'ingrédient est apparié à la base (présence d'un `dbId`). */
  recognized: boolean;
  /** Un nom a été analysé. */
  named: boolean;
  /** Une quantité numérique strictement positive est renseignée. */
  hasQuantity: boolean;
  /** Une unité est renseignée (absente pour les ingrédients « à la pièce »). */
  hasUnit: boolean;
  /** Rien de significatif n'a été saisi : aucun indicateur à afficher. */
  empty: boolean;
}

/** Convertit une saisie (« 1,5 », nombre) en nombre fini, sinon `null`. */
function num(v: number | string | undefined): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Calcule le statut d'appariement d'une ligne d'ingrédient brut.
 *
 * La priorité des messages suit le geste de l'utilisateur : d'abord nommer, ensuite
 * relier à la base, enfin compléter la quantité. Un ingrédient reconnu ET quantifié
 * est le seul cas « ok » ; l'unité reste optionnelle (ingrédients à la pièce).
 *
 * @param ing - La ligne saisie (champs analysés). Les lignes « base/composant » (`recipeId`) ne sont pas concernées.
 * @returns L'état d'appariement dérivé.
 */
export function ingredientMatch(ing: IngredientLine | null | undefined): IngredientMatch {
  const named = !!(ing?.name || "").trim();
  const hasUnit = !!(ing?.unit || "").trim();
  const qty = num(ing?.amount);
  const hasQuantity = qty != null && qty > 0;
  const recognized = !!(ing?.dbId || "").trim();
  const empty = !named && !hasQuantity && !hasUnit;

  let tone: MatchTone;
  let summary: string;
  if (empty) {
    tone = "neutral";
    summary = "";
  } else if (!named) {
    tone = "warn";
    summary = "Ingrédient à nommer";
  } else if (!recognized) {
    tone = "warn";
    summary = "Ingrédient non référencé";
  } else if (!hasQuantity) {
    tone = "warn";
    summary = "Quantité manquante";
  } else {
    tone = "ok";
    summary = "Ingrédient reconnu";
  }

  return { tone, summary, recognized, named, hasQuantity, hasUnit, empty };
}
