// ─── PRÉFÉRENCES ALIMENTAIRES ─────────────────────────────────────────────────
// Gérées par l'utilisateur dans l'espace avatar (Configuration › Préférences) et
// stockées dans users/{uid}/meta/preferences. En PR1 elles sont informatives ;
// elles alimenteront le filtre « selon mes préférences » de la découverte (PR2).
export const DEFAULT_PREFERENCES = {
  displayName: "",
  diet: "omnivore",
  allergens: [],
  excludedCategories: [],
  dislikes: [],
  // Journal de cuisine : jour `YYYY-MM-DD` → liste d'ids de recettes RÉELLEMENT
  // cuisinées (mode pas à pas mené jusqu'au bout). Alimente la heatmap du profil.
  cookLog: {},
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
    displayName: typeof src.displayName === "string" ? src.displayName.slice(0, 40) : "",
    diet: typeof src.diet === "string" ? src.diet : DEFAULT_PREFERENCES.diet,
    allergens: Array.isArray(src.allergens) ? src.allergens.filter(x => typeof x === "string") : [],
    excludedCategories: Array.isArray(src.excludedCategories) ? src.excludedCategories.filter(x => typeof x === "string") : [],
    dislikes: Array.isArray(src.dislikes) ? src.dislikes.filter(x => typeof x === "string") : [],
    cookLog: normalizeCookLog(src.cookLog),
  };
}

// Nettoie le journal de cuisine : ne garde que les clés `YYYY-MM-DD` dont la valeur
// est une liste d'ids (chaînes). Robuste aux données legacy / corrompues.
function normalizeCookLog(raw) {
  const out = {};
  if (raw && typeof raw === "object") {
    for (const [day, ids] of Object.entries(raw)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Array.isArray(ids)) {
        const clean = ids.filter(x => typeof x === "string");
        if (clean.length) out[day] = clean;
      }
    }
  }
  return out;
}
