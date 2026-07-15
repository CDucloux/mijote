// ─── RÉGIME ALIMENTAIRE (logique pure) ────────────────────────────────────────
// Détection « vegan » d'une recette à partir des catégories de ses ingrédients.
// Catégories d'origine animale à exclure : viande, poissons/fruits de mer, et
// produits laitiers (un fromage n'est pas vegan). Les préparations de base
// (sous-recettes) sont inspectées récursivement : une béchamel rend non-vegan.
//
// Limite assumée (comme la saisonnalité) : un ingrédient introuvable dans la base
// n'apporte pas de signal. On exige au moins un ingrédient identifié pour affirmer
// « vegan » (sinon on préfère ne pas afficher le badge plutôt que se tromper).

const ANIMAL_CATEGORIES = new Set(["meat", "fish_seafood", "dairy"]);

function scan(recipe, resolver, byId, seen, acc) {
  for (const ing of recipe?.ingredients || []) {
    if (ing.recipeId) {
      const base = byId.get(ing.recipeId);
      if (base && !seen.has(base.id)) { seen.add(base.id); scan(base, resolver, byId, seen, acc); }
      continue;
    }
    const item = resolver ? resolver(ing.name) : null;
    if (!item) continue;
    acc.resolved++;
    if (ANIMAL_CATEGORIES.has(item.category)) acc.animal = true;
  }
}

// `resolver` : (name) => item de la base (avec `category`). `opts.recipes` : liste
// pour résoudre les préparations de base référencées par `recipeId`.
export function isRecipeVegan(recipe, resolver, opts = {}) {
  const byId = new Map((opts.recipes || []).map(r => [r.id, r]));
  const acc = { resolved: 0, animal: false };
  scan(recipe, resolver, byId, new Set(), acc);
  return acc.resolved > 0 && !acc.animal;
}
