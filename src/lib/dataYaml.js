// ─── COUCHE DE DONNÉES YAML (parsing + validation, pur) ───────────────────────
// Source unique pour l'import YAML (UI admin) ET le script de seed (Node).
// Aucune dépendance React/Firestore. L'export reste en Markdown (lisible) ;
// l'import est en YAML (plus simple à écrire et versionner que le Markdown).
//
// Chaque parseur renvoie { items, errors } : si `errors` n'est pas vide,
// l'appelant DOIT annuler l'import en entier (jamais d'écrasement partiel de la
// base master), comme le faisait déjà l'import Markdown.

import { parse as parseYaml } from "yaml";
import { ING_MD_BOUNDS } from "./ingredientsMarkdown.js";

// Catégories du glossaire des techniques (clé → libellé affiché).
export const TECHNIQUE_CATEGORIES = {
  decoupe: "Découpe",
  cuisson: "Cuisson",
  liaison: "Liaison",
  preparation: "Préparation",
  dressage: "Dressage",
};

// Slug stable à partir d'un nom (pour générer un id absent).
export function slugifyId(prefix, name) {
  const base = String(name || "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return prefix + (base || Date.now().toString(36));
}

// Charge un document YAML attendu comme une LISTE d'objets. Renvoie
// { list, error } : `error` non nul si le YAML est invalide ou n'est pas une liste.
function loadYamlList(text) {
  let doc;
  try {
    doc = parseYaml(text);
  } catch (e) {
    return { list: null, error: `YAML invalide : ${e.message || e}.` };
  }
  if (doc == null) return { list: null, error: "Fichier vide." };
  if (!Array.isArray(doc)) return { list: null, error: "Le document doit être une liste d'entrées (« - … »)." };
  return { list: doc, error: null };
}

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" ? v.trim() : "");

// ─── TECHNIQUES ───────────────────────────────────────────────────────────────
export function parseTechniquesYaml(text) {
  const { list, error } = loadYamlList(text);
  if (error) return { items: [], errors: [error] };

  const errors = [];
  const items = [];
  const seenIds = new Set();
  list.forEach((raw, i) => {
    const where = `Entrée #${i + 1}${raw && raw.name ? ` « ${raw.name} »` : ""}`;
    if (!isObj(raw)) { errors.push(`${where} : ce n'est pas un objet.`); return; }
    const name = str(raw.name);
    const definition = str(raw.definition);
    const category = str(raw.category);
    if (!name || name.length > 120) errors.push(`${where} : « name » manquant ou trop long.`);
    if (!definition) errors.push(`${where} : « definition » manquante.`);
    if (!category || !(category in TECHNIQUE_CATEGORIES))
      errors.push(`${where} : catégorie « ${category || "?"} » inconnue (${Object.keys(TECHNIQUE_CATEGORIES).join(", ")}).`);
    if (raw.aliases != null && (!Array.isArray(raw.aliases) || raw.aliases.some(a => typeof a !== "string")))
      errors.push(`${where} : « aliases » doit être une liste de chaînes.`);

    const id = str(raw.id) || slugifyId("tech_", name);
    if (seenIds.has(id)) errors.push(`${where} : id en double « ${id} ».`);
    seenIds.add(id);

    const aliases = Array.isArray(raw.aliases)
      ? [...new Set(raw.aliases.map(a => str(a).toLowerCase()).filter(Boolean))]
      : [];
    items.push({
      id, name, category, definition,
      aliases: aliases.length ? aliases : undefined,
      source: str(raw.source) || undefined,
    });
  });
  return { items: errors.length ? [] : items, errors };
}

// Export Markdown lisible du glossaire (revue / partage). Trié par catégorie puis nom.
export function formatTechniquesMarkdown(list) {
  const esc = s => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
  const cats = Object.keys(TECHNIQUE_CATEGORIES);
  const rows = [...(list || [])].sort((a, b) => {
    const ca = cats.indexOf(a.category), cb = cats.indexOf(b.category);
    return ca !== cb ? ca - cb : (a.name || "").localeCompare(b.name || "", "fr");
  });
  const header = "| Technique | Catégorie | Définition | Aliases | Source |\n|---|---|---|---|---|";
  const body = rows.map(r =>
    `| ${esc(r.name)} | ${esc(TECHNIQUE_CATEGORIES[r.category] || r.category)} | ${esc(r.definition)} | ${esc((r.aliases || []).join(", "))} | ${esc(r.source)} |`
  ).join("\n");
  return `# Glossaire des techniques Mijoté (${rows.length})\n\n${header}\n${body}\n`;
}

// ─── INGRÉDIENTS ──────────────────────────────────────────────────────────────
// `validCategories` : Set ou tableau des clés de catégories acceptées.
export function parseIngredientsYaml(text, { validCategories } = {}) {
  const { list, error } = loadYamlList(text);
  if (error) return { items: [], errors: [error] };

  const valid = validCategories instanceof Set ? validCategories : new Set(validCategories || []);
  const errors = [];
  const items = [];
  list.forEach((raw, i) => {
    const where = `Entrée #${i + 1}${raw && raw.name ? ` « ${raw.name} »` : ""}`;
    if (!isObj(raw)) { errors.push(`${where} : ce n'est pas un objet.`); return; }
    const name = str(raw.name);
    if (!name || name.length > 120) { errors.push(`${where} : « name » manquant ou trop long.`); return; }
    if (raw.category != null && valid.size && !valid.has(str(raw.category)))
      errors.push(`${where} : catégorie inconnue « ${raw.category} ».`);

    const row = { name };
    if (raw.id != null) row.id = str(raw.id);
    if (raw.category != null) row.category = str(raw.category);
    if (raw.image != null) row.image = str(raw.image);
    if (Array.isArray(raw.aliases)) {
      const a = raw.aliases.map(x => str(x)).filter(Boolean);
      if (a.length) row.aliases = a;
    }
    if (Array.isArray(raw.months)) {
      const m = raw.months.filter(x => Number.isInteger(x) && x >= 1 && x <= 12);
      if (m.length !== raw.months.length) errors.push(`${where} : « months » doit contenir des entiers 1–12.`);
      if (m.length) row.months = [...new Set(m)].sort((x, y) => x - y);
    }
    if (raw.gramsPerPiece != null) {
      const v = Number(raw.gramsPerPiece);
      const [min, max] = ING_MD_BOUNDS.gramsPerPiece;
      if (!Number.isFinite(v) || v < min || v > max) errors.push(`${where} : gramsPerPiece = ${raw.gramsPerPiece} hors bornes (${min}–${max}).`);
      else row.gramsPerPiece = v;
    }
    if (raw.nutrition != null) {
      if (!isObj(raw.nutrition)) errors.push(`${where} : « nutrition » doit être un objet.`);
      else {
        const nut = {};
        Object.entries(raw.nutrition).forEach(([k, val]) => {
          const bounds = ING_MD_BOUNDS[k];
          if (!bounds) return; // champ nutrition inconnu : ignoré
          const v = Number(val);
          const [min, max] = bounds;
          if (!Number.isFinite(v) || v < min || v > max) errors.push(`${where} : ${k} = ${val} hors bornes (${min}–${max}).`);
          else nut[k] = v;
        });
        if (Object.keys(nut).length) {
          nut.isVegetable = row.category === "vegetable" || row.category === "legume";
          row.nutrition = nut;
        }
      }
    }
    items.push(row);
  });
  return { items: errors.length ? [] : items, errors };
}

// ─── USTENSILES ───────────────────────────────────────────────────────────────
export function parseUtensilsYaml(text) {
  const { list, error } = loadYamlList(text);
  if (error) return { items: [], errors: [error] };

  const errors = [];
  const items = [];
  list.forEach((raw, i) => {
    const where = `Entrée #${i + 1}${raw && raw.name ? ` « ${raw.name} »` : ""}`;
    if (!isObj(raw)) { errors.push(`${where} : ce n'est pas un objet.`); return; }
    const name = str(raw.name);
    if (!name || name.length > 120) { errors.push(`${where} : « name » manquant ou trop long.`); return; }
    const row = { name };
    if (raw.id != null) row.id = str(raw.id);
    if (raw.image != null) row.image = str(raw.image);
    items.push(row);
  });
  return { items: errors.length ? [] : items, errors };
}
