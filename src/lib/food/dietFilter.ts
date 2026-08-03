/**
 * Éligibilité d'une recette selon les contraintes DURES (logique pure). Prédicat
 * binaire partagé par le générateur de planning et le « selon mes préférences » de
 * Découvrir : régime, catégories d'ingrédients exclues, allergènes filtrent le
 * vivier — jamais un score. Les préférences douces (aversions, saison, variété…)
 * relèvent du scoring (voir mealPlanner), pas d'ici.
 *
 * Limite assumée : la base ingrédients ne porte pas (encore) de tags allergènes.
 * Le filtre allergènes est donc HEURISTIQUE (catégorie + mots-clés sur le nom) ;
 * à durcir le jour où les ingrédients porteront un champ `allergens` explicite.
 *
 * @module dietFilter
 */
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { isRecipeVegan } from "@/lib/food/dietary.js";

/** Ingrédient résolu depuis la base (seule la catégorie sert ici). */
export interface ResolvedItem { id: string; category?: string }
export type IngredientResolver = ((name: string | undefined) => ResolvedItem | null) | null | undefined;

/** Recette inspectée (descend dans les préparations de base via `recipeId`). */
export interface EligibleRecipe {
  id?: string;
  ingredients?: { name?: string; recipeId?: string }[];
}

/** Contexte de résolution : résolveur + liste de recettes (pour les bases). */
export interface EligibilityContext {
  resolver?: IngredientResolver;
  recipes?: EligibleRecipe[];
  byId?: Map<string, EligibleRecipe>;
}

/** Préférences alimentaires (contraintes dures uniquement). */
export interface DietPreferences {
  diet?: string;
  excludedCategories?: string[];
  allergens?: string[];
}

/** Signaux agrégés des ingrédients d'une recette. */
export interface IngredientSignals {
  categories: Set<string>;
  names: string[];
  resolved: number;
}

/** Catégories d'ingrédient d'origine animale (miroir de `dietary.js`). */
const MEAT = "meat";
const FISH = "fish_seafood";

/**
 * Signaux heuristiques par allergène : catégorie(s) d'ingrédient et/ou mots-clés
 * (normalisés, sans accents) recherchés dans le nom de l'ingrédient.
 */
export const ALLERGEN_SIGNALS: Record<string, { categories: string[]; keywords: string[] }> = {
  "Gluten": { categories: [], keywords: ["ble", "farine", "gluten", "seigle", "orge", "epeautre", "pain", "pate", "pates", "semoule", "boulgour", "chapelure", "biscuit"] },
  "Lactose": { categories: ["dairy"], keywords: ["lait", "creme", "beurre", "fromage", "yaourt", "mozzarella", "parmesan", "ricotta", "mascarpone"] },
  "Œuf": { categories: [], keywords: ["oeuf", "jaune d", "blanc d", "meringue"] },
  "Arachide": { categories: [], keywords: ["arachide", "cacahu"] },
  "Fruits à coque": { categories: ["nuts_seeds"], keywords: ["amande", "noisette", "noix", "cajou", "pistache", "pecan", "macadamia", "praline"] },
  "Soja": { categories: [], keywords: ["soja", "tofu", "edamame", "tamari", "miso"] },
  "Poisson": { categories: [FISH], keywords: ["poisson", "saumon", "thon", "cabillaud", "morue", "sardine", "maquereau", "anchois", "truite", "bar", "dorade", "colin", "lieu", "hareng"] },
  "Crustacés": { categories: [], keywords: ["crevette", "crabe", "homard", "langoustine", "gamba", "ecrevisse", "langouste", "tourteau"] },
  "Sésame": { categories: [], keywords: ["sesame", "tahin"] },
  "Moutarde": { categories: [], keywords: ["moutarde"] },
  "Céleri": { categories: [], keywords: ["celeri"] },
  "Sulfites": { categories: ["alcohol"], keywords: ["vin", "vinaigre", "sulfite", "fruits secs"] },
};

/**
 * Collecte récursive des signaux des ingrédients d'une recette : catégories
 * rencontrées, noms (normalisés) et nombre d'ingrédients réellement identifiés.
 * Descend dans les préparations de base (`recipeId`).
 *
 * @param recipe - La recette à analyser.
 * @param ctx - Contexte de résolution.
 * @param ctx.resolver - Résolveur nom → ingrédient de la base.
 * @param ctx.byId - Index des recettes (descente dans les composants).
 * @param ctx.seen - Ids déjà visités (garde-fou anti-cycle).
 * @returns `{ categories, names, resolved }` agrégés sur la recette et ses bases.
 */
export function collectIngredientSignals(
  recipe: EligibleRecipe | null | undefined,
  { resolver, byId = new Map(), seen = new Set<string>() }: { resolver?: IngredientResolver; byId?: Map<string, EligibleRecipe>; seen?: Set<string> } = {},
): IngredientSignals {
  const categories = new Set<string>();
  const names: string[] = [];
  let resolved = 0;
  const walk = (r: EligibleRecipe | null | undefined): void => {
    for (const ing of r?.ingredients || []) {
      if (ing.recipeId) {
        const base = byId.get(ing.recipeId);
        if (base && base.id && !seen.has(base.id)) { seen.add(base.id); walk(base); }
        continue;
      }
      if (ing.name) names.push(normalizeStr(ing.name));
      const item = resolver ? resolver(ing.name) : null;
      if (item) { resolved++; if (item.category) categories.add(item.category); }
    }
  };
  walk(recipe);
  return { categories, names, resolved };
}

const dietOk = (diet: string, sig: IngredientSignals, recipe: EligibleRecipe | null | undefined, ctx: EligibilityContext): boolean => {
  switch (diet) {
    case "vegan": return isRecipeVegan(recipe, ctx.resolver, { recipes: ctx.recipes });
    case "vegetarien": return !sig.categories.has(MEAT) && !sig.categories.has(FISH);
    case "pescatarien": return !sig.categories.has(MEAT);
    default: return true; // omnivore, flexitarien → pas de contrainte dure
  }
};

const hasAllergen = (allergen: string, sig: IngredientSignals): boolean => {
  const s = ALLERGEN_SIGNALS[allergen];
  if (!s) return false;
  if (s.categories?.some(c => sig.categories.has(c))) return true;
  return (s.keywords || []).some(kw => sig.names.some(n => n.includes(kw)));
};

/**
 * Une recette est-elle éligible au regard des préférences (contraintes dures :
 * régime, catégories exclues, allergènes) ?
 *
 * @param recipe - La recette à tester.
 * @param preferences - Préférences alimentaires (régime, catégories exclues, allergènes).
 * @param ctx - Résolveur d'ingrédients + liste/index des recettes (pour les bases).
 * @returns `true` si la recette respecte toutes les contraintes dures.
 */
export function isEligible(
  recipe: EligibleRecipe | null | undefined,
  preferences: DietPreferences = {},
  ctx: EligibilityContext = {},
): boolean {
  if (!recipe) return false;
  const byId = ctx.byId || new Map((ctx.recipes || []).map(r => [r.id as string, r]));
  const sig = collectIngredientSignals(recipe, { resolver: ctx.resolver, byId });

  const diet = preferences.diet || "omnivore";
  if (!dietOk(diet, sig, recipe, { ...ctx, byId })) return false;

  const excluded = preferences.excludedCategories || [];
  if (excluded.some(c => sig.categories.has(c))) return false;

  const allergens = preferences.allergens || [];
  if (allergens.some(a => hasAllergen(a, sig))) return false;

  return true;
}
