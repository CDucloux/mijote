// ─── PRÉFÉRENCES ALIMENTAIRES ─────────────────────────────────────────────────
// Gérées par l'utilisateur dans l'espace avatar (Configuration › Préférences) et
// stockées dans users/{uid}/meta/preferences. En PR1 elles sont informatives ;
// elles alimenteront le filtre « selon mes préférences » de la découverte (PR2).
export const DEFAULT_PREFERENCES = {
  diet: "omnivore",
  allergens: [],
  excludedCategories: [],
  dislikes: [],
};

export const DIETS = [
  { id: "omnivore", label: "Omnivore", emoji: "🍽️" },
  { id: "flexitarien", label: "Flexitarien", emoji: "🥗" },
  { id: "pescatarien", label: "Pescatarien", emoji: "🐟" },
  { id: "vegetarien", label: "Végétarien", emoji: "🥦" },
  { id: "vegan", label: "Végan", emoji: "🌱" },
];

export const COMMON_ALLERGENS = [
  "Gluten", "Lactose", "Œuf", "Arachide", "Fruits à coque",
  "Soja", "Poisson", "Crustacés", "Sésame", "Moutarde", "Céleri", "Sulfites",
];

// Normalise un objet préférences potentiellement partiel/legacy vers le schéma courant.
export function normalizePreferences(p) {
  const src = p && typeof p === "object" ? p : {};
  return {
    diet: typeof src.diet === "string" ? src.diet : DEFAULT_PREFERENCES.diet,
    allergens: Array.isArray(src.allergens) ? src.allergens.filter(x => typeof x === "string") : [],
    excludedCategories: Array.isArray(src.excludedCategories) ? src.excludedCategories.filter(x => typeof x === "string") : [],
    dislikes: Array.isArray(src.dislikes) ? src.dislikes.filter(x => typeof x === "string") : [],
  };
}
