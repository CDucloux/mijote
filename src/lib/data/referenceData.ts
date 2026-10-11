/**
 * Validation des données de référence versionnées dans `data/*.yaml` et
 * embarquées à la compilation (cuisines, types de recette, catégories
 * d'ingrédients, repères nutritionnels). Ces fichiers s'éditent à la main : une
 * entrée malformée est écartée plutôt que de casser l'app au démarrage, et les
 * tests vérifient que les fichiers livrés passent sans perte.
 *
 * @module data/referenceData
 */

/** Option d'une liste fermée affichée en pill (style de cuisine). */
export interface LabeledOption {
  label: string;
  emoji: string;
}

/** Type de recette (`recipe.category`). */
export interface RecipeCategory {
  id: string;
  label: string;
  emoji: string;
}

/** Catégorie de la base d'ingrédients. */
export interface IngredientCategory {
  label: string;
  color: string;
  icon: string;
  order: number;
}

/** Les deux familles de types de recette. */
export interface RecipeCategorySets {
  /** Rôle dans le repas, pour les recettes courantes. */
  meal: RecipeCategory[];
  /** Familles des préparations de base. */
  base: RecipeCategory[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const listOf = (raw: unknown, key: string): unknown[] => {
  const list = isRecord(raw) ? raw[key] : undefined;
  return Array.isArray(list) ? list : [];
};

/**
 * Styles de cuisine de `data/cuisines.yaml`. Le libellé est la valeur stockée
 * dans la recette : un doublon est écarté (le premier gagne).
 *
 * @param raw - Document parsé (`{ cuisines: [...] }`), non fiable.
 * @returns Les styles valides, dans l'ordre du fichier.
 */
export function parseCuisines(raw: unknown): LabeledOption[] {
  const seen = new Set<string>();
  const options: LabeledOption[] = [];
  for (const entry of listOf(raw, "cuisines")) {
    if (!isRecord(entry)) continue;
    const label = text(entry.label);
    const emoji = text(entry.emoji);
    if (!label || !emoji || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    options.push({ label, emoji });
  }
  return options;
}

/**
 * Types de recette de `data/recipe-categories.yaml`. Un `id` est unique sur les
 * deux familles : une recette ne porte qu'un id, sans dire de quelle liste il
 * vient, un doublon rendrait son libellé ambigu (le premier gagne).
 *
 * @param raw - Document parsé (`{ meal: [...], base: [...] }`), non fiable.
 * @returns Les deux familles, dans l'ordre du fichier.
 */
export function parseRecipeCategories(raw: unknown): RecipeCategorySets {
  const seen = new Set<string>();
  const pick = (key: "meal" | "base"): RecipeCategory[] => {
    const out: RecipeCategory[] = [];
    for (const entry of listOf(raw, key)) {
      if (!isRecord(entry)) continue;
      const id = text(entry.id);
      const label = text(entry.label);
      const emoji = text(entry.emoji);
      if (!id || !label || !emoji || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, label, emoji });
    }
    return out;
  };
  const meal = pick("meal");
  return { meal, base: pick("base") };
}

/**
 * Catégories d'ingrédients de `data/ingredient-categories.yaml`, indexées par clé
 * technique. Une catégorie sans libellé est écartée ; couleur, icône et rang
 * prennent un repli neutre plutôt que de faire perdre la catégorie.
 *
 * @param raw - Document parsé (`{ categories: { clé: {...} } }`), non fiable.
 * @returns Les catégories, dans l'ordre du fichier.
 */
export function parseIngredientCategories(raw: unknown): Record<string, IngredientCategory> {
  const source = isRecord(raw) && isRecord(raw.categories) ? raw.categories : {};
  const out: Record<string, IngredientCategory> = {};
  Object.entries(source).forEach(([key, entry], index) => {
    if (!isRecord(entry) || !/^[a-z][a-z0-9_]*$/.test(key)) return;
    const label = text(entry.label);
    if (!label) return;
    out[key] = {
      label,
      color: /^#[0-9a-f]{3,8}$/i.test(text(entry.color)) ? text(entry.color) : "#9a9490",
      icon: text(entry.icon) || "📦",
      order: typeof entry.order === "number" && Number.isFinite(entry.order) ? entry.order : index,
    };
  });
  return out;
}

/**
 * Repères nutritionnels journaliers de `data/nutrition-references.yaml`. Seules
 * les quantités strictement positives sont gardées : un repère nul ferait diviser
 * par zéro le calcul des pourcentages.
 *
 * @param raw - Document parsé (`{ daily: { nutriment: quantité } }`), non fiable.
 * @returns Nutriment vers quantité par jour.
 */
export function parseNutritionReferences(raw: unknown): Record<string, number> {
  const source = isRecord(raw) && isRecord(raw.daily) ? raw.daily : {};
  const out: Record<string, number> = {};
  for (const [nutrient, amount] of Object.entries(source)) {
    if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) out[nutrient] = amount;
  }
  return out;
}
