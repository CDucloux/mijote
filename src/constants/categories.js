// ─── NUTRITION CATEGORIES ──────────────────────────────────────────────────────
// Default nutrition categories — seed for the Master `categories` doc.
// `score` is on a 0-10 scale internally (displayed/edited as 0-100 in the UI).
export const DEFAULT_CATEGORIES = {
  vegetable: { label: "Légumes", score: 10, color: "#4caf7d", icon: "🥦", order: 0 },
  fruit: { label: "Fruits", score: 8, color: "#80c080", icon: "🍎", order: 1 },
  legume: { label: "Légumineuses", score: 9, color: "#4caf7d", icon: "🫘", order: 2 },
  meat: { label: "Viande", score: 6, color: "#c87050", icon: "🥩", order: 5 },
  fish_seafood: { label: "Poissons/Fruits de mer", score: 9, color: "#5b9cf6", icon: "🐟", order: 5 },
  dairy: { label: "Produits laitiers", score: 6, color: "#f0e060", icon: "🧀", order: 6 },
  grain: { label: "Céréales", score: 6, color: "#c8a870", icon: "🌾", order: 7 },
  fat_good: { label: "Matières grasses saines", score: 6, color: "#80c080", icon: "🫒", order: 9 },
  nuts_seeds: { label: "Noix et graines", score: 8, color: "#c8a870", icon: "🥜", order: 10 },
  mushroom: { label: "Champignons", score: 8, color: "#9a9490", icon: "🍄", order: 12 },
  herbs: { label: "Herbes aromatiques fraîches", score: 9, color: "#4caf7d", icon: "🌿", order: 13 },
  condiment: { label: "Condiments/Épices", score: 7, color: "#9a9490", icon: "🧂", order: 14 },
  canned: { label: "Conserves", score: 5, color: "#b08060", icon: "🥫", order: 15 },
  sugar: { label: "Sucres/Sucrants", score: 1, color: "#e05252", icon: "🍬", order: 16 },
  alcohol: { label: "Alcools", score: 0, color: "#e05252", icon: "🍷", order: 17 },
  other: { label: "Autres", score: 5, color: "#9a9490", icon: "📦", order: 18 },
};

// Return [key, cat] entries sorted by their `order` field (stable fallback to insertion).
export function sortedCategoryEntries(categories) {
  return Object.entries(categories).sort((a, b) => {
    const oa = a[1].order ?? 999, ob = b[1].order ?? 999;
    return oa === ob ? a[0].localeCompare(b[0]) : oa - ob;
  });
}

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
// New users start completely empty. Ingredient/utensil reference data now comes
// from the shared read-only Master DB in Firestore (master/ingredients,
// master/utensils), merged with each user's own additions (meta/userDB).
export const DEFAULT_INGREDIENT_DB = [];
export const DEFAULT_UTENSIL_DB = [];
export const SAMPLE_RECIPES = [];
export const SAMPLE_COLLECTIONS = [];
