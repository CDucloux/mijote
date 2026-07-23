// ─── ÉLIGIBILITÉ D'UNE RECETTE (contraintes DURES, logique pure) ──────────────
// Prédicat binaire partagé par le générateur de planning ET le « selon mes
// préférences » de Découvrir. Les contraintes DURES (sécurité + choix ferme)
// filtrent le vivier ; elles ne sont JAMAIS un score : régime, catégories
// d'ingrédients exclues, allergènes. Les préférences douces (aversions/`dislikes`,
// saison, variété…) relèvent du scoring (voir mealPlanner), pas d'ici.
//
// Limite assumée : la base ingrédients ne porte pas (encore) de tags allergènes.
// Le filtre allergènes est donc HEURISTIQUE (catégorie + mots-clés sur le nom) ;
// à durcir le jour où les ingrédients porteront un champ `allergens` explicite.

import { normalizeStr } from "./parseIngredient.js";
import { isRecipeVegan } from "./dietary.js";

// Catégories d'ingrédient d'origine animale (miroir de dietary.js).
const MEAT = "meat";
const FISH = "fish_seafood";

// Signaux heuristiques par allergène : catégorie(s) d'ingrédient et/ou mots-clés
// (normalisés, sans accents) recherchés dans le nom de l'ingrédient.
export const ALLERGEN_SIGNALS = {
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

// Collecte récursive des signaux des ingrédients d'une recette : ensemble des
// catégories rencontrées, liste des noms (normalisés) et compte d'ingrédients
// réellement identifiés. Descend dans les préparations de base (`recipeId`).
export function collectIngredientSignals(recipe, { resolver, byId = new Map(), seen = new Set() } = {}) {
  const categories = new Set();
  const names = [];
  let resolved = 0;
  const walk = (r) => {
    for (const ing of r?.ingredients || []) {
      if (ing.recipeId) {
        const base = byId.get(ing.recipeId);
        if (base && !seen.has(base.id)) { seen.add(base.id); walk(base); }
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

const dietOk = (diet, sig, recipe, ctx) => {
  switch (diet) {
    case "vegan": return isRecipeVegan(recipe, ctx.resolver, { recipes: ctx.recipes });
    case "vegetarien": return !sig.categories.has(MEAT) && !sig.categories.has(FISH);
    case "pescatarien": return !sig.categories.has(MEAT);
    default: return true; // omnivore, flexitarien → pas de contrainte dure
  }
};

const hasAllergen = (allergen, sig) => {
  const s = ALLERGEN_SIGNALS[allergen];
  if (!s) return false;
  if (s.categories?.some(c => sig.categories.has(c))) return true;
  return (s.keywords || []).some(kw => sig.names.some(n => n.includes(kw)));
};

// Une recette est-elle éligible au regard des préférences (contraintes dures) ?
// `ctx` : { resolver, recipes } (résolveur d'ingrédients + liste pour les bases).
export function isEligible(recipe, preferences = {}, ctx = {}) {
  if (!recipe) return false;
  const byId = ctx.byId || new Map((ctx.recipes || []).map(r => [r.id, r]));
  const sig = collectIngredientSignals(recipe, { resolver: ctx.resolver, byId });

  const diet = preferences.diet || "omnivore";
  if (!dietOk(diet, sig, recipe, { ...ctx, byId })) return false;

  const excluded = preferences.excludedCategories || [];
  if (excluded.some(c => sig.categories.has(c))) return false;

  const allergens = preferences.allergens || [];
  if (allergens.some(a => hasAllergen(a, sig))) return false;

  return true;
}
