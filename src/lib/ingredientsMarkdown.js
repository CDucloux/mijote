// ─── EXPORT / IMPORT MARKDOWN DE LA BASE D'INGRÉDIENTS ──────────────────────
// Source unique des colonnes : l'export et l'import partagent cette spec, pour
// garantir un aller-retour fidèle. `nut: true` = champ rangé dans `nutrition`.
// `isVegetable` n'est pas une colonne : il est recalculé depuis la catégorie.
import { parseMonths } from "./seasonality.js";

export const ING_MD_COLUMNS = [
  { key: "name", label: "Nom" },
  { key: "aliases", label: "Aliases" },
  { key: "id", label: "dbid" },
  { key: "category", label: "Catégorie" },
  { key: "months", label: "Mois", months: true },
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

// Colonnes minimales attendues dans l'en-tête d'un export Mijoté valide. Sert de
// garde-fou : un Markdown qui ne contient pas ces colonnes n'est pas un export
// d'ingrédients et ne doit surtout pas écraser la base master.
export const ING_MD_REQUIRED_LABELS = ["nom", "dbid", "catégorie", "kcal"];

// Bornes de validation (valeurs nutritionnelles pour 100 g, sauf g/pièce).
// Toute valeur hors bornes fait échouer l'import entier, pour éviter d'écraser
// la base master avec des données aberrantes.
export const ING_MD_BOUNDS = {
  calories: [0, 1000], protein: [0, 100], carbs: [0, 100], sugar: [0, 100],
  fat: [0, 100], saturatedFat: [0, 100], omega3: [0, 100], fiber: [0, 100],
  salt: [0, 100], gramsPerPiece: [0, 10000],
};

// Découpe une ligne de tableau Markdown en cellules, en respectant les `\|` échappés.
export function splitMarkdownRow(line) {
  const inner = line.replace(/^\s*\|/, "").replace(/\|\s*$/, "");
  return inner.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, "|").trim());
}

// Parse un export Markdown d'ingrédients → liste d'objets partiels (clés présentes
// seulement). Robuste à l'ordre des colonnes : on s'aligne sur l'en-tête.
export function parseIngredientsMarkdown(text) {
  const lines = (text || "").split(/\r?\n/);
  // Repérer la ligne d'en-tête (contient "Nom" et "dbid") puis la ligne de séparation.
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
  const out = [];
  for (let i = headerIdx + 2; i < lines.length; i++) { // +2 : sauter la ligne |---|
    const line = lines[i];
    if (!/\|/.test(line)) continue;
    const cells = splitMarkdownRow(line);
    if (cells.every(c => c === "" || /^-+$/.test(c))) continue;
    const row = {}; const nutrition = {};
    cells.forEach((val, ci) => {
      const key = colKey[ci];
      if (!key || val === "") return;
      const col = ING_MD_COLUMNS.find(c => c.key === key);
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
