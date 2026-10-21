import { parse as parseYaml } from "yaml";
import { parseIngredientCategories } from "@/lib/data/referenceData.js";
import type { Notebook, SavedRecipe } from "@/lib/types.js";
import raw from "../../data/ingredient-categories.yaml?raw";

// ─── NUTRITION CATEGORIES ──────────────────────────────────────────────────────
// Default nutrition categories (data/ingredient-categories.yaml), seed for the
// Master `categories` doc. Health scoring is computed from ingredient nutrition
// data (Nutri-Score algorithm), not from a per-category value. Keys are in
// English; labels are displayed in French in the UI.
export const DEFAULT_CATEGORIES = parseIngredientCategories(parseYaml(raw));

// Return [key, cat] entries sorted by their `order` field (stable fallback to insertion).
export function sortedCategoryEntries<T extends { order?: number }>(categories: Record<string, T>): [string, T][] {
  return Object.entries(categories).sort((a, b) => {
    const oa = a[1].order ?? 999, ob = b[1].order ?? 999;
    return oa === ob ? a[0].localeCompare(b[0]) : oa - ob;
  });
}

// Catégories non-périssables stockables en placard (clés techniques). Les produits
// frais (légumes, fruits, laitiers, œufs, herbes, champignons, viandes, poissons,
// pâtes à étaler réfrigérées) sont volontairement exclus : ils ne « tombent » pas dans le stock à l'achat.
export const STOCK_CATEGORIES: ReadonlySet<string> = new Set([
  "legume", "grain", "oil", "acid", "sauce", "condiment",
  "nuts_seeds", "sugar", "baking", "alcohol", "other",
]);

// Basiques de placard, quasi toujours disponibles (condiments/épices, et le
// fourre-tout « Autres ») : ils ne signalent RIEN sur « ai-je de quoi cuisiner ce
// plat ». Exclus du calcul d'affinité stock du planning, pour que la priorité au
// stock reflète les vrais ingrédients (frais, bases, féculents…) et ne soit pas
// gonflée par le sel, l'huile ou une épice qu'on a de toute façon.
export const PANTRY_STAPLE_CATEGORIES: ReadonlySet<string> = new Set(["condiment", "other"]);

// Catégories comptées comme « fruits & légumes » dans la composante POSITIVE du
// Nutri-Score (fruits, légumes, légumineuses, fruits à coque, auxquels s'ajoutent
// herbes et champignons). Inclure les FRUITS est essentiel : sans eux, un plat à
// base d'avocat/tomate/agrumes (guacamole…) perd ses points positifs à tort.
export const FRUIT_VEG_CATEGORIES: ReadonlySet<string> = new Set([
  "vegetable", "fruit", "legume", "herbs", "mushroom", "nuts_seeds",
]);
export const isFruitVeg = (category: unknown): boolean => typeof category === "string" && FRUIT_VEG_CATEGORIES.has(category);

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
// New users start completely empty. Ingredient/utensil reference data now comes
// from the shared read-only Master DB in Firestore (master/ingredients,
// master/utensils), merged with each user's own additions (meta/userDB).
export const SAMPLE_RECIPES: SavedRecipe[] = [];
export const SAMPLE_COLLECTIONS: Notebook[] = [];
