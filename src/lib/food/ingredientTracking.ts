import type { IngredientDbItem } from "@/lib/types.js";

/** Filtres de suivi de la base d'ingrédients côté admin (`null` = tous). */
export type IngredientTrackingFilter = "draft" | "validated" | "no-image" | "no-nutrition";

type TrackedIngredient = Partial<Pick<IngredientDbItem, "status" | "image" | "nutrition">>;

/**
 * Indique si un ingrédient relève d'un filtre de suivi. Une fiche sans valeur
 * `calories` compte comme « sans nutrition » : c'est le champ minimal exigé
 * pour les calculs nutritionnels des recettes.
 * @param ingredient - Fiche de la base master.
 * @param filter - Filtre actif, `null` pour tout accepter.
 */
export function matchesTrackingFilter(ingredient: TrackedIngredient, filter: IngredientTrackingFilter | null): boolean {
  switch (filter) {
    case null: return true;
    case "validated": return ingredient.status === "validated";
    case "draft": return ingredient.status !== "validated";
    case "no-image": return !ingredient.image;
    case "no-nutrition": return ingredient.nutrition?.calories == null;
  }
}

/** Effectif de chaque filtre de suivi, `all` compris. */
export type TrackingCounts = Record<IngredientTrackingFilter | "all", number>;

/**
 * Compte en une passe les ingrédients de chaque filtre de suivi, pour les
 * compteurs du tableau de bord et des onglets de filtre.
 * @param ingredients - Base master complète.
 */
export function countTrackingFilters(ingredients: readonly TrackedIngredient[]): TrackingCounts {
  const counts: TrackingCounts = { all: ingredients.length, draft: 0, validated: 0, "no-image": 0, "no-nutrition": 0 };
  const filters: IngredientTrackingFilter[] = ["draft", "validated", "no-image", "no-nutrition"];
  for (const ingredient of ingredients) {
    for (const filter of filters) if (matchesTrackingFilter(ingredient, filter)) counts[filter]++;
  }
  return counts;
}
