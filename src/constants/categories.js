// ─── NUTRITION CATEGORIES ──────────────────────────────────────────────────────
// Default nutrition categories – seed for the Master `categories` doc.
// `score` has been removed: health scoring is now computed from ingredient
// nutrition data (Nutri-Score algorithm), not from a hand-tuned per-category value.
// Keys are in English. Labels are displayed in French in the UI.
export const DEFAULT_CATEGORIES = {
  vegetable:    { label: "Légumes",                color: "#4caf7d", icon: "🥦", order: 0  },
  fruit:        { label: "Fruits",                 color: "#80c080", icon: "🍎", order: 1  },
  dairy:        { label: "Produits laitiers",      color: "#f0e060", icon: "🧀", order: 2  },
  herbs:        { label: "Herbes aromatiques",     color: "#4caf7d", icon: "🌿", order: 3  },
  mushroom:     { label: "Champignons",            color: "#9a9490", icon: "🍄", order: 4  },
  meat:         { label: "Viande",                 color: "#c87050", icon: "🥩", order: 5  },
  fish_seafood: { label: "Poissons/Fruits de mer", color: "#5b9cf6", icon: "🐟", order: 6  },
  legume:       { label: "Légumineuses",           color: "#4caf7d", icon: "🫘", order: 7  },
  grain:        { label: "Céréales",               color: "#c8a870", icon: "🌾", order: 8  },
  oil:          { label: "Huiles",                 color: "#f0c060", icon: "🫙", order: 9  },
  acid:         { label: "Acides & vinaigres",     color: "#c8e060", icon: "🍋", order: 10 },
  sauce:        { label: "Sauces",                 color: "#c87050", icon: "🥫", order: 11 },
  condiment:    { label: "Condiments/Épices",      color: "#9a9490", icon: "🧂", order: 12 },
  nuts_seeds:   { label: "Noix et graines",        color: "#c8a870", icon: "🥜", order: 13 },
  sugar:        { label: "Sucres/Sucrants",        color: "#e05252", icon: "🍬", order: 14 },
  baking:       { label: "Pâtisserie",             color: "#c8a870", icon: "🧁", order: 15 },
  alcohol:      { label: "Alcools",                color: "#e05252", icon: "🍷", order: 16 },
  other:        { label: "Autres",                 color: "#9a9490", icon: "📦", order: 17 },
};

// Return [key, cat] entries sorted by their `order` field (stable fallback to insertion).
export function sortedCategoryEntries(categories) {
  return Object.entries(categories).sort((a, b) => {
    const oa = a[1].order ?? 999, ob = b[1].order ?? 999;
    return oa === ob ? a[0].localeCompare(b[0]) : oa - ob;
  });
}

// Catégories non-périssables stockables en placard (clés techniques). Les produits
// frais (légumes, fruits, laitiers, herbes, champignons, viandes, poissons) sont
// volontairement exclus : ils ne « tombent » pas dans le stock à l'achat.
export const STOCK_CATEGORIES = new Set([
  "legume", "grain", "oil", "acid", "sauce", "condiment",
  "nuts_seeds", "sugar", "baking", "alcohol", "other",
]);

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
// New users start completely empty. Ingredient/utensil reference data now comes
// from the shared read-only Master DB in Firestore (master/ingredients,
// master/utensils), merged with each user's own additions (meta/userDB).
export const DEFAULT_INGREDIENT_DB = [];
export const DEFAULT_UTENSIL_DB = [];
export const SAMPLE_RECIPES = [];
export const SAMPLE_COLLECTIONS = [];
