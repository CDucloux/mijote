/**
 * Spec des colonnes Markdown de la base d'ingrédients, sérialisation des conseils
 * et exports Markdown (lecture) des bases master d'ingrédients et d'ustensiles.
 * Sert la console admin et la validation des bornes (`dataYaml`).
 * `nut: true` = champ rangé dans `nutrition` ; `isVegetable` n'est pas une colonne
 * (recalculé depuis la catégorie).
 *
 * @module food/ingredientsMarkdown
 */
import { formatMonths } from "@/lib/food/seasonality.js";

/** Colonne de la spec Markdown (le drapeau indique le traitement de la cellule). */
export interface MdColumn {
  key: string;
  label: string;
  months?: boolean;
  tips?: boolean;
  num?: boolean;
  nut?: boolean;
}

/**
 * Sérialise une liste de conseils en une cellule Markdown. Chaque conseil =
 * « type: texte », conseils séparés par « ;; ».
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
 * Neutralise une valeur pour une cellule de tableau Markdown : une barre verticale
 * ou un saut de ligne casserait la structure du tableau.
 *
 * @param value - Valeur brute (absente = cellule vide).
 * @returns Le texte de cellule, sur une ligne.
 */
export function escapeMdCell(value: unknown): string {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
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
 * Bornes de validation (valeurs nutritionnelles pour 100 g, sauf g/pièce). Toute
 * valeur hors bornes fait échouer l'import entier, pour éviter d'écraser la base
 * master avec des données aberrantes.
 */
export const ING_MD_BOUNDS: Record<string, [number, number]> = {
  calories: [0, 1000], protein: [0, 100], carbs: [0, 100], sugar: [0, 100],
  fat: [0, 100], saturatedFat: [0, 100], omega3: [0, 100], fiber: [0, 100],
  salt: [0, 100], gramsPerPiece: [0, 10000],
};

/** Ingrédient tel que l'export Markdown le lit (forme large de la base). */
export interface MarkdownIngredient {
  name?: string;
  category?: string;
  aliases?: string[];
  months?: number[];
  tips?: { type?: string; text?: string }[];
  nutrition?: Record<string, unknown> | null;
  [key: string]: unknown;
}

function ingredientCell(item: MarkdownIngredient, col: MdColumn): string {
  if (col.nut) {
    const v = item.nutrition?.[col.key];
    return v == null || v === "" ? "" : escapeMdCell(v);
  }
  if (col.key === "aliases") return escapeMdCell((item.aliases || []).join(", "));
  if (col.months) return escapeMdCell(formatMonths(item.months));
  if (col.tips) return escapeMdCell(formatTips(item.tips));
  if (col.key === "category") return escapeMdCell(item.category || "other");
  return escapeMdCell(item[col.key]);
}

/**
 * Rend toute la base d'ingrédients en tableau Markdown, toutes colonnes de
 * {@link ING_MD_COLUMNS} (identité et nutrition), pour une relecture humaine.
 * Trié selon l'ordre d'affichage des catégories puis par nom.
 *
 * @param list - Ingrédients à exporter.
 * @param categoryOrder - Clés de catégories dans l'ordre d'affichage ; une
 *   catégorie inconnue passe en tête (index -1), comme dans la console.
 * @returns Le document Markdown (titre, note, tableau).
 */
export function formatIngredientsMarkdown(list: readonly MarkdownIngredient[], categoryOrder: readonly string[]): string {
  const rows = [...list].sort((a, b) => {
    const ca = categoryOrder.indexOf(a.category || "other"), cb = categoryOrder.indexOf(b.category || "other");
    return ca !== cb ? ca - cb : (a.name || "").localeCompare(b.name || "", "fr");
  });
  const header = `| ${ING_MD_COLUMNS.map(c => c.label).join(" | ")} |\n|${ING_MD_COLUMNS.map(() => "---").join("|")}|`;
  const body = rows.map(r => `| ${ING_MD_COLUMNS.map(c => ingredientCell(r, c)).join(" | ")} |`).join("\n");
  return `# Base d'ingrédients Cardamome (${rows.length})\n\nValeurs nutritionnelles pour 100g. Oméga-3 inclus dans les lipides. \`Légume\` est recalculé depuis la catégorie à l'import.\n\n${header}\n${body}\n`;
}

/**
 * Rend la base d'ustensiles en tableau Markdown (nom, id, image), trié par nom.
 *
 * @param list - Ustensiles à exporter.
 * @returns Le document Markdown (titre et tableau).
 */
export function formatUtensilsMarkdown(list: readonly { id?: string; name?: string; image?: string }[]): string {
  const rows = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  const body = rows.map(r => `| ${escapeMdCell(r.name)} | ${escapeMdCell(r.id)} | ${escapeMdCell(r.image)} |`).join("\n");
  return `# Base d'ustensiles Cardamome (${rows.length})\n\n| Nom | dbid | Image |\n|---|---|---|\n${body}\n`;
}
