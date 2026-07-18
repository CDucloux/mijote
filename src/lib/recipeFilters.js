// ─── FILTRES DE RECETTES (état partagé, pur) ──────────────────────────────────
// Forme de l'état de filtrage avancé de /recipes, et compteur de filtres actifs.
export const DEFAULT_FILTERS = { season: false, vegan: false, type: "all", timeMax: null, cuisines: [], cooking: [], nutriMax: null, diffMax: null, ingredients: [] };

export function activeFilterCount(f) {
  return (f.season ? 1 : 0) + (f.vegan ? 1 : 0) + (f.type !== "all" ? 1 : 0)
    + (f.timeMax ? 1 : 0) + (f.cuisines.length ? 1 : 0) + (f.cooking.length ? 1 : 0) + (f.nutriMax ? 1 : 0)
    + (f.diffMax ? 1 : 0) + (f.ingredients.length ? 1 : 0);
}
