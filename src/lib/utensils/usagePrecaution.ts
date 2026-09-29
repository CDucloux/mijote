/**
 * Précaution d'utilisation d'un ustensile : un conseil éditorial court (chaleur,
 * revêtement…) porté directement par l'ustensile. Logique pure, sans I/O ni React.
 * Pas de niveaux de danger ni de moteur de règles : la seule variabilité est la
 * TONALITÉ (conseil / cuisson / attention), qui pilote l'icône et la couleur pour
 * ne pas transformer chaque conseil en alerte.
 *
 * @module utensils/usagePrecaution
 */
import type { PrecautionTone, UsagePrecaution, UtensilDbItem } from "@/lib/types";

/** Présentation d'une tonalité : nom d'icône (bibliothèque, jamais un emoji), libellé de rubrique, couleur d'accent (token). */
export interface PrecautionVisual {
  icon: string;
  label: string;
  accent: string;
}

/**
 * Tonalités reconnues. `heat` est le défaut (le gros du cas d'usage porte sur la
 * gestion du feu). `icon` réfère un nom du set d'icônes maison (cf. `Icon.jsx`),
 * jamais un emoji. `accent` réfère un token de couleur existant.
 */
export const PRECAUTION_TONES: Record<PrecautionTone, PrecautionVisual> = {
  info: { icon: "info", label: "À savoir", accent: "var(--accent)" },
  heat: { icon: "fire", label: "Chaleur", accent: "#e0662f" },
  warning: { icon: "warning", label: "Attention", accent: "#d99a10" },
};

/** Garde de type : `x` est une tonalité de précaution connue. */
export function isPrecautionTone(x: unknown): x is PrecautionTone {
  return typeof x === "string" && x in PRECAUTION_TONES;
}

/**
 * Présentation d'une tonalité, avec repli sur `heat` pour toute valeur absente ou
 * inconnue.
 *
 * @param tone - Tonalité (potentiellement absente ou invalide).
 * @returns L'icône, le libellé et l'accent associés.
 */
export function precautionVisual(tone: unknown): PrecautionVisual {
  return isPrecautionTone(tone) ? PRECAUTION_TONES[tone] : PRECAUTION_TONES.heat;
}

/**
 * Extrait la précaution affichable d'un ustensile de la base. Retourne `null` quand
 * l'ustensile n'en a pas ou qu'elle est incomplète (titre ET description requis) :
 * l'appelant n'affiche alors aucune section.
 *
 * @param item - Ustensile de la base (ou une valeur nulle/indéfinie).
 * @returns La précaution normalisée, ou `null`.
 */
export function resolveUsagePrecaution(item: UtensilDbItem | null | undefined): UsagePrecaution | null {
  const p = item?.usagePrecaution;
  if (!p || typeof p !== "object") return null;
  const title = typeof p.title === "string" ? p.title.trim() : "";
  const description = typeof p.description === "string" ? p.description.trim() : "";
  if (!title || !description) return null;
  const tip = typeof p.tip === "string" && p.tip.trim() ? p.tip.trim() : undefined;
  const tone: PrecautionTone = isPrecautionTone(p.tone) ? p.tone : "heat";
  return { tone, title, description, tip };
}
