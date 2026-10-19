import { parse as parseYaml } from "yaml";
import { parseCuisines } from "@/lib/data/referenceData.js";
import raw from "../../data/cuisines.yaml?raw";

// ─── STYLES DE CUISINE ────────────────────────────────────────────────────────
// Liste prédéfinie (data/cuisines.yaml) proposée à la création/édition d'une
// recette. Une recette porte au plus un style (`recipe.cuisine`, la chaîne
// `label`). Remplace les anciens tags libres qui mélangeaient des informations
// hétérogènes.

export const CUISINES = parseCuisines(parseYaml(raw));

// Accès rapide à l'emoji depuis le label (affichage des badges).
const BY_LABEL = new Map(CUISINES.map(c => [c.label, c]));
export function cuisineEmoji(label: string | null | undefined): string {
  return (label ? BY_LABEL.get(label)?.emoji : undefined) || "🍽️";
}

// Ramène un libellé de cuisine à sa forme canonique, insensible à la casse
// (« française » → « Française »). Laisse tel quel (juste trimmé) si inconnu.
const BY_NORM = new Map(CUISINES.map(c => [c.label.toLowerCase(), c.label]));
export function normalizeCuisine(label: unknown): string {
  if (!label || typeof label !== "string") return "";
  const t = label.trim();
  return BY_NORM.get(t.toLowerCase()) || t;
}
