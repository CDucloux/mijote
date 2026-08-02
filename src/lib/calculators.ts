/**
 * Calculatrices de recette (pures) :
 * 1. Moule / plat — facteur d'adaptation des quantités entre deux moules (ratio de
 *    surface, ou de volume si les deux hauteurs sont fournies).
 * 2. Conversions d'unités — masse ↔ volume via la densité de l'ingrédient.
 *
 * @module calculators
 */
import { normalizeStr } from "./parseIngredient.js";

/** Forme d'un moule. */
export type PanShape = "round" | "rect" | string;

/** Dimensions d'un moule (rond : `diameter` ; rectangulaire : `length` × `width`). */
export interface PanDims {
  shape?: PanShape;
  diameter?: number | string;
  length?: number | string;
  width?: number | string;
  height?: number | string;
}

// ── MOULE ─────────────────────────────────────────────────────────────────────

/** Surface (cm²) d'un moule d'après sa forme et ses dimensions. */
export function panArea(shape: PanShape, d: PanDims = {}): number {
  if (shape === "round") { const r = (Number(d.diameter) || 0) / 2; return Math.PI * r * r; }
  if (shape === "rect") { return (Number(d.length) || 0) * (Number(d.width) || 0); }
  return 0;
}

/**
 * Facteur multiplicateur pour passer du moule `orig` au moule `target`. Ratio de
 * volume si les DEUX hauteurs sont renseignées (> 0), sinon de surface. `null` si
 * un moule est incomplet.
 */
export function panFactor(orig: PanDims, target: PanDims): number | null {
  const a1 = panArea(orig.shape || "", orig);
  const a2 = panArea(target.shape || "", target);
  if (!a1 || !a2) return null;
  const h1 = Number(orig.height) || 0, h2 = Number(target.height) || 0;
  return (h1 > 0 && h2 > 0) ? (a2 * h2) / (a1 * h1) : a2 / a1;
}

/** Arrondi « cuisine » : plus la valeur est grande, moins on garde de décimales. */
export function roundNice(x: number): number {
  if (!Number.isFinite(x)) return 0;
  const a = Math.abs(x);
  if (a >= 100) return Math.round(x / 5) * 5;
  if (a >= 10) return Math.round(x);
  if (a >= 1) return Math.round(x * 10) / 10;
  return Math.round(x * 100) / 100;
}

// ── CONVERSIONS ────────────────────────────────────────────────────────────────

export const VOLUME_ML: Record<string, number> = {
  "ml": 1, "cl": 10, "dl": 100, "l": 1000,
  "cuillère à soupe": 15, "cuillère à café": 5, "cup": 240, "tasse": 250, "verre": 200,
};
export const MASS_G: Record<string, number> = { "mg": 0.001, "g": 1, "kg": 1000 };

/** Densités (g/ml) des ingrédients courants (poudre/liquide « tassé cuisine »). */
export const DENSITIES: Record<string, number> = {
  "eau": 1, "lait": 1.03, "crème": 1.0, "crème liquide": 1.0, "huile": 0.92, "beurre": 0.96,
  "farine": 0.53, "maïzena": 0.6, "fécule": 0.6, "sucre glace": 0.56, "sucre": 0.85,
  "cassonade": 0.8, "miel": 1.42, "sirop": 1.3, "cacao": 0.41, "poudre d'amande": 0.42,
  "riz": 0.85, "semoule": 0.67, "sel": 1.2, "levure chimique": 0.9, "flocons d'avoine": 0.4,
  "yaourt": 1.03, "eau de fleur d'oranger": 1.0,
};

/** Devine la densité (g/ml) d'un ingrédient d'après son nom (`null` si inconnu). */
export function densityFor(name: string | null | undefined): number | null {
  const n = normalizeStr(name);
  if (!n) return null;
  // clé la plus spécifique (la plus longue) contenue dans le nom
  let best: number | null = null, bestLen = 0;
  for (const [key, d] of Object.entries(DENSITIES)) {
    const k = normalizeStr(key);
    if ((n === k || n.includes(k)) && k.length > bestLen) { best = d; bestLen = k.length; }
  }
  return best;
}

const unitKind = (u: string): "mass" | "volume" | null => (u in MASS_G ? "mass" : u in VOLUME_ML ? "volume" : null);

/**
 * Convertit `value` de l'unité `from` vers `to`. `density` (g/ml) requis seulement
 * pour une conversion masse ↔ volume. `null` si la conversion est impossible.
 */
export function convertQuantity(value: number | string, from: string, to: string, density?: number): number | null {
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  const kf = unitKind(from), kt = unitKind(to);
  if (!kf || !kt) return null;
  if (kf === kt) {
    const table = kf === "mass" ? MASS_G : VOLUME_ML;
    return v * table[from] / table[to];
  }
  // Croisement masse ↔ volume : besoin de la densité.
  if (!density || density <= 0) return null;
  if (kf === "mass") { const ml = (v * MASS_G[from]) / density; return ml / VOLUME_ML[to]; }
  const g = (v * VOLUME_ML[from]) * density; return g / MASS_G[to]; // volume → mass
}

/** Unités proposées au convertisseur (ordre d'affichage). */
export const CONVERT_UNITS = ["g", "kg", "ml", "cl", "l", "cuillère à soupe", "cuillère à café", "cup", "tasse"];
