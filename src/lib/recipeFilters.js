// ─── FILTRES DE RECETTES (état partagé, pur) ──────────────────────────────────
// Forme de l'état de filtrage avancé de /recipes, et compteur de filtres actifs.
export const DEFAULT_FILTERS = { season: false, vegan: false, type: "all", cuisines: [], nutriMax: null, diffMax: null, ingredient: "" };

export function activeFilterCount(f) {
  return (f.season ? 1 : 0) + (f.vegan ? 1 : 0) + (f.type !== "all" ? 1 : 0)
    + (f.cuisines.length ? 1 : 0) + (f.nutriMax ? 1 : 0) + (f.diffMax ? 1 : 0)
    + (f.ingredient.trim() ? 1 : 0);
}
