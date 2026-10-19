// ─── PRÉFÉRENCES ALIMENTAIRES ─────────────────────────────────────────────────
// Gérées par l'utilisateur dans l'espace avatar (Configuration › Préférences) et
// stockées dans users/{uid}/meta/preferences. En PR1 elles sont informatives ;
// elles alimenteront le filtre « selon mes préférences » de la découverte (PR2).
/** Préférences alimentaires et journal de l'utilisateur (schéma courant). */
export interface Preferences {
  displayName: string;
  diet: string;
  allergens: string[];
  excludedCategories: string[];
  dislikes: string[];
  /** Jour `YYYY-MM-DD` → ids des recettes cuisinées ce jour-là. */
  cookLog: Record<string, string[]>;
  giftImportUsed: boolean;
}

/** Un régime alimentaire proposé. */
export interface Diet {
  id: string;
  label: string;
  emoji: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  displayName: "",
  diet: "omnivore",
  allergens: [],
  excludedCategories: [],
  dislikes: [],
  // Journal de cuisine : jour `YYYY-MM-DD` → liste d'ids de recettes RÉELLEMENT
  // cuisinées (mode pas à pas mené jusqu'au bout). Alimente la heatmap du profil.
  cookLog: {},
  // Recette découverte offerte (non-abonné, 1er import) déjà consommée : garde-fou
  // « une seule fois », synchronisé multi-appareils via meta/preferences.
  giftImportUsed: false,
};

export const DIETS: Diet[] = [
  { id: "omnivore", label: "Omnivore", emoji: "🍽️" },
  { id: "flexitarien", label: "Flexitarien", emoji: "🥗" },
  { id: "pescatarien", label: "Pescatarien", emoji: "🐟" },
  { id: "vegetarien", label: "Végétarien", emoji: "🥦" },
  { id: "vegan", label: "Végan", emoji: "🌱" },
];

export const COMMON_ALLERGENS: string[] = [
  "Gluten", "Lactose", "Œuf", "Arachide", "Fruits à coque",
  "Soja", "Poisson", "Crustacés", "Sésame", "Moutarde", "Céleri", "Sulfites",
];

// Normalise un objet préférences potentiellement partiel/legacy vers le schéma courant.
export function normalizePreferences(raw: unknown): Preferences {
  const src: Record<string, unknown> = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    displayName: typeof src.displayName === "string" ? src.displayName.slice(0, 40) : "",
    diet: typeof src.diet === "string" ? src.diet : DEFAULT_PREFERENCES.diet,
    allergens: stringList(src.allergens),
    excludedCategories: stringList(src.excludedCategories),
    dislikes: stringList(src.dislikes),
    cookLog: normalizeCookLog(src.cookLog),
    giftImportUsed: src.giftImportUsed === true,
  };
}

// Nettoie le journal de cuisine : ne garde que les clés `YYYY-MM-DD` dont la valeur
// est une liste d'ids (chaînes). Robuste aux données legacy / corrompues.
function normalizeCookLog(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (raw && typeof raw === "object") {
    for (const [day, ids] of Object.entries(raw)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Array.isArray(ids)) {
        const clean = stringList(ids);
        if (clean.length) out[day] = clean;
      }
    }
  }
  return out;
}

// Ne garde que les chaînes d'une liste ; tout autre type donne une liste vide.
function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}
