/**
 * Export / import Markdown de la base d'ingrédients. Source unique des colonnes :
 * l'export et l'import partagent cette spec, pour garantir un aller-retour fidèle.
 * `nut: true` = champ rangé dans `nutrition` ; `isVegetable` n'est pas une colonne
 * (recalculé depuis la catégorie).
 *
 * @module ingredientsMarkdown
 */
import { parseMonths } from "./seasonality.js";
import { TIP_TYPES } from "../constants/tipTypes.js";

/** Conseil attaché à un ingrédient. */
export interface IngredientTip { type: string; text: string }

/** Colonne de la spec Markdown (le drapeau indique le traitement de la cellule). */
export interface MdColumn {
  key: string;
  label: string;
  months?: boolean;
  tips?: boolean;
  num?: boolean;
  nut?: boolean;
}

// ─── TIPS (conseils) ↔ MARKDOWN ─────────────────────────────────────────────
// Sérialisation dans une cellule unique : chaque conseil = « type: texte »,
// conseils séparés par « ;; ». Le pipe est échappé en amont par l'export.
const TIP_TYPE_KEYS = new Set(Object.keys(TIP_TYPES));

/**
 * Sérialise une liste de conseils en une cellule Markdown.
 *
 * @param tips - Les conseils (type + texte).
 * @returns La cellule sérialisée (`""` si aucun conseil valide).
 */
export function formatTips(tips: { type?: string; text?: string }[] | null | undefined): string {
  if (!Array.isArray(tips)) return "";
  return tips
    .filter(t => t && t.type && (t.text || "").trim())
    .map(t => `${t.type}: ${(t.text || "").trim().replace(/\s*;;\s*/g, ", ")}`)
    .join(" ;; ");
}

/**
 * Parse une cellule de conseils sérialisés (ignore les types inconnus).
 *
 * @param str - La cellule sérialisée.
 * @returns Les conseils reconnus (type valide + texte non vide).
 */
export function parseTips(str: string | null | undefined): IngredientTip[] {
  if (!str) return [];
  return str
    .split(/\s*;;\s*/)
    .map((seg): IngredientTip | null => {
      const i = seg.indexOf(":");
      if (i < 0) return null;
      const type = seg.slice(0, i).trim().toLowerCase();
      const text = seg.slice(i + 1).trim();
      if (!text || !TIP_TYPE_KEYS.has(type)) return null;
      return { type, text };
    })
    .filter((t): t is IngredientTip => t !== null);
}

export const ING_MD_COLUMNS: MdColumn[] = [
  { key: "name", label: "Nom" },
  { key: "aliases", label: "Aliases" },
  { key: "id", label: "dbid" },
  { key: "category", label: "Catégorie" },
  { key: "months", label: "Mois", months: true },
  { key: "tips", label: "Tips", tips: true },
  { key: "gramsPerPiece", label: "g/pièce", num: true },
  { key: "image", label: "Image" },
  { key: "calories", label: "kcal", nut: true },
  { key: "protein", label: "Protéines", nut: true },
  { key: "carbs", label: "Glucides", nut: true },
  { key: "sugar", label: "Sucres", nut: true },
  { key: "fat", label: "Lipides", nut: true },
  { key: "saturatedFat", label: "AG saturés", nut: true },
  { key: "omega3", label: "Oméga-3", nut: true },
  { key: "fiber", label: "Fibres", nut: true },
  { key: "salt", label: "Sel", nut: true },
];

/**
 * Colonnes minimales attendues dans l'en-tête d'un export Mijoté valide. Garde-fou :
 * un Markdown sans ces colonnes n'est pas un export d'ingrédients et ne doit surtout
 * pas écraser la base master.
 */
export const ING_MD_REQUIRED_LABELS = ["nom", "dbid", "catégorie", "kcal"];

/**
 * Bornes de validation (valeurs nutritionnelles pour 100 g, sauf g/pièce). Toute
 * valeur hors bornes fait échouer l'import entier, pour éviter d'écraser la base
 * master avec des données aberrantes.
 */
export const ING_MD_BOUNDS: Record<string, [number, number]> = {
  calories: [0, 1000], protein: [0, 100], carbs: [0, 100], sugar: [0, 100],
  fat: [0, 100], saturatedFat: [0, 100], omega3: [0, 100], fiber: [0, 100],
  salt: [0, 100], gramsPerPiece: [0, 10000],
};

/**
 * Découpe une ligne de tableau Markdown en cellules, en respectant les `\|` échappés.
 *
 * @param line - La ligne de tableau (avec ou sans pipes de bord).
 * @returns Les cellules, déséchappées et rognées.
 */
export function splitMarkdownRow(line: string): string[] {
  const inner = line.replace(/^\s*\|/, "").replace(/\|\s*$/, "");
  return inner.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, "|").trim());
}

/**
 * Parse un export Markdown d'ingrédients → liste d'objets partiels (clés présentes
 * seulement). Robuste à l'ordre des colonnes : on s'aligne sur l'en-tête.
 *
 * @param text - Le Markdown d'export.
 * @returns Une ligne par ingrédient (objets partiels), vide si l'en-tête est absent.
 */
export function parseIngredientsMarkdown(text: string | null | undefined): Record<string, unknown>[] {
  const lines = (text || "").split(/\r?\n/);
  // Repérer la ligne d'en-tête (contient « Nom » et « dbid ») puis la séparation.
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/\|/.test(lines[i]) && /\bNom\b/i.test(lines[i]) && /\bdbid\b/i.test(lines[i])) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return [];
  const headers = splitMarkdownRow(lines[headerIdx]).map(h => h.toLowerCase());
  // Index colonne → clé interne, via le label de la spec.
  const colKey = headers.map(h => {
    const col = ING_MD_COLUMNS.find(c => c.label.toLowerCase() === h);
    return col ? col.key : null;
  });
  const out: Record<string, unknown>[] = [];
  for (let i = headerIdx + 2; i < lines.length; i++) { // +2 : sauter la ligne |---|
    const line = lines[i];
    if (!/\|/.test(line)) continue;
    const cells = splitMarkdownRow(line);
    if (cells.every(c => c === "" || /^-+$/.test(c))) continue;
    const row: Record<string, unknown> = {}; const nutrition: Record<string, unknown> = {};
    cells.forEach((val, ci) => {
      const key = colKey[ci];
      if (!key || val === "") return;
      const col = ING_MD_COLUMNS.find(c => c.key === key);
      if (!col) return;
      if (col.nut) {
        const num = parseFloat(val.replace(",", "."));
        if (!Number.isNaN(num)) nutrition[key] = num;
      } else if (col.num) {
        const num = parseFloat(val.replace(",", "."));
        if (!Number.isNaN(num)) row[key] = num;
      } else if (key === "aliases") {
        const arr = val.split(",").map(a => a.trim()).filter(Boolean);
        if (arr.length) row.aliases = arr;
      } else if (col.months) {
        const arr = parseMonths(val);
        if (arr.length) row.months = arr;
      } else if (col.tips) {
        const arr = parseTips(val);
        if (arr.length) row.tips = arr;
      } else {
        row[key] = val;
      }
    });
    if (!row.name) continue;
    if (Object.keys(nutrition).length) {
      nutrition.isVegetable = row.category === "vegetable" || row.category === "legume";
      row.nutrition = nutrition;
    }
    out.push(row);
  }
  return out;
}
