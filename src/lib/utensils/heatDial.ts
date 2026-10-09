/**
 * Puissance de chauffe → crans d'un bouton de plaque (pur, sans I/O ni React).
 *
 * Les précautions d'ustensiles décrivent la puissance conseillée en fraction du
 * maximum (« 1/5 à 1/3 », « 2/3 à fond »). Lue en chiffres, une fraction ne parle
 * pas ; sur un bouton de cuisson à 6 crans, elle se comprend d'un coup d'œil. Ce
 * module traduit ces valeurs en plage de crans, et ne devine rien : une valeur
 * qu'il ne sait pas lire laisse le tableau en texte.
 *
 * @module utensils/heatDial
 */
import type { TableBlock } from "@/lib/utensils/precautionLayout.js";

/** Nombre de crans d'un bouton de plaque classique. */
export const HEAT_DIAL_NOTCHES = 6;

/** Plage de puissance, en fraction du maximum (0 à 1). */
export interface PowerRange {
  from: number;
  to: number;
}

/** Plage de crans allumés sur le bouton (1 à {@link HEAT_DIAL_NOTCHES}). */
export interface NotchRange {
  from: number;
  to: number;
}

/** Ligne de tableau de chauffe : libellé, valeur d'origine, crans à allumer. */
export interface HeatRow {
  label: string;
  value: string;
  notches: NotchRange;
}

const MAX_WORDS = /^(?:a\s+)?(?:fond|max|maxi|maximum|pleine puissance)$/;

/** Lit UNE puissance : fraction (« 2/3 »), pourcentage (« 50 % ») ou maximum (« fond »). */
function parsePower(raw: string): number | null {
  const s = raw.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (MAX_WORDS.test(s)) return 1;
  const fraction = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const den = Number(fraction[2]);
    const value = Number(fraction[1]) / den;
    return den > 0 && value >= 0 && value <= 1 ? value : null;
  }
  const percent = s.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (percent) {
    const value = Number(percent[1].replace(",", ".")) / 100;
    return value >= 0 && value <= 1 ? value : null;
  }
  return null;
}

/**
 * Lit une plage de puissance (« 1/5 à 1/3 », « 2/3 à fond », « 1/2 », « 50 % »).
 *
 * @param text - La valeur telle qu'écrite dans le tableau.
 * @returns La plage en fraction du maximum (bornes ordonnées), ou `null` si illisible.
 */
export function parsePowerRange(text: string | null | undefined): PowerRange | null {
  const s = (text || "").trim();
  if (!s) return null;
  const parts = s.split(/\s+(?:à|a|-|–)\s+/i);
  if (parts.length > 2) return null;
  const values = parts.map(parsePower);
  if (values.some(v => v == null)) return null;
  const [a, b = a] = values as number[];
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

/**
 * Convertit une plage de puissance en crans allumés : chaque borne est ramenée au
 * cran le plus proche (au moins le cran 1), la plage contient toujours un cran.
 *
 * @param range - La plage en fraction du maximum.
 * @param notches - Nombre de crans du bouton.
 * @returns La plage de crans (1 à `notches`).
 */
export function toNotches(range: PowerRange, notches = HEAT_DIAL_NOTCHES): NotchRange {
  const clamp = (n: number): number => Math.min(notches, Math.max(1, Math.round(n * notches)));
  const from = clamp(range.from);
  return { from, to: Math.max(from, clamp(range.to)) };
}

/**
 * Reconnaît un tableau de chauffe : deux colonnes dont CHAQUE valeur est une
 * puissance lisible. Un seul échec et le tableau reste un tableau de texte.
 *
 * @param block - Un tableau de description de précaution.
 * @returns Les lignes avec leurs crans, ou `null` si ce n'est pas un tableau de chauffe.
 */
export function heatRows(block: TableBlock): HeatRow[] | null {
  if (!block.rows.length) return null;
  const rows: HeatRow[] = [];
  for (const row of block.rows) {
    if (row.length !== 2) return null;
    const range = parsePowerRange(row[1]);
    if (!range) return null;
    rows.push({ label: row[0], value: row[1], notches: toNotches(range) });
  }
  return rows;
}

/** Course du bouton, en degrés : de -135° (cran 1, en bas à gauche) à +135° (dernier cran). */
const DIAL_SWEEP = 270;

/**
 * Angle d'un cran sur le bouton, mesuré depuis le haut dans le sens horaire, comme
 * sur une vraie plaque : la course de 270° laisse le bas du bouton libre.
 *
 * @param notch - Le cran (1 à `notches`).
 * @param notches - Nombre de crans du bouton.
 * @returns L'angle en degrés, de -135 à 135.
 */
export function notchAngle(notch: number, notches = HEAT_DIAL_NOTCHES): number {
  if (notches <= 1) return 0;
  return -DIAL_SWEEP / 2 + ((notch - 1) * DIAL_SWEEP) / (notches - 1);
}

/**
 * Libellé accessible d'une plage de crans (« Crans 2 à 3 sur 6 »).
 *
 * @param range - La plage de crans allumés.
 * @param notches - Nombre de crans du bouton.
 * @returns Le libellé à annoncer à la place du dessin.
 */
export function notchLabel(range: NotchRange, notches = HEAT_DIAL_NOTCHES): string {
  return range.from === range.to
    ? `Cran ${range.from} sur ${notches}`
    : `Crans ${range.from} à ${range.to} sur ${notches}`;
}
