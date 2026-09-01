// ─── SOURCES RECOMMANDÉES PAR DÉFAUT ────────────────────────────────────────
// Repli affiché tant que la collection `master/sources` n'a pas été configurée
// dans la console admin. Des créatrices et créateurs aux recettes soignées, dont
// les pages s'importent proprement. L'admin peut tout remplacer / compléter.

/** @type {import("@/lib/sources/recommendedSources.js").RecommendedSource[]} */
export const DEFAULT_SOURCES = [
  { id: "src_cestmafournee", name: "C'est ma fournée", url: "https://www.cestmafournee.com/", category: "Pâtisserie", mono: "C", tint: "spice", order: 0 },
  { id: "src_grecque", name: "Cuisine à la grecque", url: "https://cuisine-a-la-grecque.fr/", category: "Grèce", mono: "Γ", tint: "accent", net: true, order: 1 },
  { id: "src_undejeuner", name: "Un déjeuner de soleil", url: "https://www.undejeunerdesoleil.com/", category: "Italie", mono: "U", tint: "coral", net: true, order: 2 },
];
