// ─── STYLES DE CUISINE ────────────────────────────────────────────────────────
// Liste prédéfinie proposée à la création/édition d'une recette. Une recette
// porte au plus un style (`recipe.cuisine`, la chaîne `label`). Remplace les
// anciens tags libres qui mélangeaient des informations hétérogènes.

export const CUISINES = [
  { label: "Française", emoji: "🇫🇷" },
  { label: "Italienne", emoji: "🇮🇹" },
  { label: "Espagnole", emoji: "🇪🇸" },
  { label: "Portugaise", emoji: "🇵🇹" },
  { label: "Grecque", emoji: "🇬🇷" },
  { label: "Méditerranéenne", emoji: "🫒" },
  { label: "Marocaine", emoji: "🇲🇦" },
  { label: "Tunisienne", emoji: "🇹🇳" },
  { label: "Libanaise", emoji: "🇱🇧" },
  { label: "Turque", emoji: "🇹🇷" },
  { label: "Indienne", emoji: "🇮🇳" },
  { label: "Chinoise", emoji: "🇨🇳" },
  { label: "Japonaise", emoji: "🇯🇵" },
  { label: "Coréenne", emoji: "🇰🇷" },
  { label: "Thaïlandaise", emoji: "🇹🇭" },
  { label: "Vietnamienne", emoji: "🇻🇳" },
  { label: "Mexicaine", emoji: "🇲🇽" },
  { label: "Américaine", emoji: "🇺🇸" },
  { label: "Antillaise", emoji: "🏝️" },
  { label: "Africaine", emoji: "🌍" },
  { label: "Fusion", emoji: "🍴" },
  { label: "Autre", emoji: "🍽️" },
];

// Accès rapide à l'emoji depuis le label (affichage des badges).
const BY_LABEL = new Map(CUISINES.map(c => [c.label, c]));
export function cuisineEmoji(label) {
  return BY_LABEL.get(label)?.emoji || "🍽️";
}

// Ramène un libellé de cuisine à sa forme canonique, insensible à la casse
// (« française » → « Française »). Laisse tel quel (juste trimmé) si inconnu.
const BY_NORM = new Map(CUISINES.map(c => [c.label.toLowerCase(), c.label]));
export function normalizeCuisine(label) {
  if (!label || typeof label !== "string") return "";
  const t = label.trim();
  return BY_NORM.get(t.toLowerCase()) || t;
}
