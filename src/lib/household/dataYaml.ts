/**
 * Couche de données YAML (parsing + validation, pur). Source unique pour l'import
 * YAML (UI admin) ET le script de seed (Node). Aucune dépendance React/Firestore.
 * L'export reste en Markdown (lisible) ; l'import est en YAML (plus simple à écrire
 * et versionner que le Markdown).
 *
 * Chaque parseur renvoie `{ items, errors }` : si `errors` n'est pas vide,
 * l'appelant DOIT annuler l'import en entier (jamais d'écrasement partiel de la
 * base master), comme le faisait déjà l'import Markdown.
 *
 * @module dataYaml
 */
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { ING_MD_BOUNDS } from "@/lib/food/ingredientsMarkdown.js";
import { TIP_TYPES } from "@/constants/tipTypes.js";

/** Résultat d'un parseur : items validés (vide si `errors`) + liste d'erreurs. */
export interface ParseResult<T = Record<string, unknown>> {
  items: T[];
  errors: string[];
}

/** Clés nutritionnelles exportées (ordre stable), hors `isVegetable` qui est recalculé. */
const NUT_KEYS = ["calories", "protein", "carbs", "sugar", "fat", "saturatedFat", "omega3", "fiber", "salt"];

/**
 * Sérialise des lignes en YAML précédé d'un en-tête. `stringify` sans repli de
 * ligne : les définitions/tips restent sur une ligne, plus lisibles dans une revue
 * de diff Git. On aère ensuite le rendu (ligne vide après l'en-tête et entre chaque
 * entrée de 1er niveau) — sans incidence au ré-import, YAML ignorant les lignes vides.
 *
 * @param rows - Données à sérialiser (liste d'objets).
 * @param header - En-tête (commentaire `#`) placé en tête du document.
 * @returns Le document YAML complet (en-tête aéré + corps).
 */
const dumpYaml = (rows: unknown, header: string): string => {
  const body = stringifyYaml(rows, { lineWidth: 0 }).replace(/\n(- )/g, "\n\n$1");
  return header.replace(/\s*$/, "") + "\n\n" + body;
};

/** Catégories du glossaire des techniques (clé → libellé affiché). */
export const TECHNIQUE_CATEGORIES: Record<string, string> = {
  decoupe: "Découpe",
  cuisson: "Cuisson",
  liaison: "Liaison",
  preparation: "Préparation",
  dressage: "Dressage",
};

/**
 * Construit un identifiant stable à partir d'un nom (pour générer un id absent) :
 * translittère, minusculise et remplace tout caractère non alphanumérique par `_`.
 *
 * @param prefix - Préfixe collé devant le slug (ex. `"tech_"`).
 * @param name - Nom source à translittérer.
 * @returns Le slug préfixé ; repli sur un jeton temporel si le nom est vide.
 *
 * @example
 * slugifyId("tech_", "Découpe à cru"); // → "tech_decoupe_a_cru"
 */
export function slugifyId(prefix: string, name: string): string {
  const base = String(name || "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return prefix + (base || Date.now().toString(36));
}

/**
 * Charge un document YAML attendu comme une LISTE d'objets.
 *
 * @param text - Source YAML brute.
 * @returns `{ list, error }` : `error` non nul si le YAML est invalide ou n'est pas une liste.
 */
function loadYamlList(text: string): { list: unknown[] | null; error: string | null } {
  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch (e) {
    return { list: null, error: `YAML invalide : ${(e as Error)?.message || e}.` };
  }
  if (doc == null) return { list: null, error: "Fichier vide." };
  if (!Array.isArray(doc)) return { list: null, error: "Le document doit être une liste d'entrées (« - … »)." };
  return { list: doc, error: null };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

// ─── TECHNIQUES ───────────────────────────────────────────────────────────────

/**
 * Parse et valide un export YAML du glossaire des techniques.
 *
 * @param text - Source YAML brute.
 * @returns `{ items, errors }` : `items` est vide si `errors` n'est pas vide
 *   (import à annuler en entier — jamais d'écrasement partiel).
 */
export function parseTechniquesYaml(text: string): ParseResult {
  const { list, error } = loadYamlList(text);
  if (error) return { items: [], errors: [error] };

  const errors: string[] = [];
  const items: Record<string, unknown>[] = [];
  const seenIds = new Set<string>();
  (list || []).forEach((rawEntry, i) => {
    const raw = rawEntry as Record<string, unknown>;
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
    const difficulty = raw.difficulty;
    if (difficulty != null && (!Number.isInteger(difficulty) || (difficulty as number) < 1 || (difficulty as number) > 5))
      errors.push(`${where} : « difficulty » doit être un entier de 1 à 5.`);

    const id = str(raw.id) || slugifyId("tech_", name);
    if (seenIds.has(id)) errors.push(`${where} : id en double « ${id} ».`);
    seenIds.add(id);

    const aliases = Array.isArray(raw.aliases)
      ? [...new Set(raw.aliases.map(a => str(a).toLowerCase()).filter(Boolean))]
      : [];
    // N'inclure que des clés définies : Firestore rejette les valeurs `undefined`.
    const item: Record<string, unknown> = { id, name, category, definition };
    if (aliases.length) item.aliases = aliases;
    if (Number.isInteger(difficulty) && (difficulty as number) >= 1 && (difficulty as number) <= 5) item.difficulty = difficulty;
    const source = str(raw.source);
    if (source) item.source = source;
    items.push(item);
  });
  return { items: errors.length ? [] : items, errors };
}

/** Technique (forme minimale utilisée par les exports). */
interface TechniqueRow {
  id?: string;
  name?: string;
  category?: string;
  definition?: string;
  aliases?: string[];
  difficulty?: number;
  source?: string;
}

/**
 * Rend le glossaire des techniques en tableau Markdown lisible (revue / partage),
 * trié par catégorie puis par nom.
 *
 * @param list - Techniques à exporter.
 * @returns Le document Markdown (titre + tableau).
 */
export function formatTechniquesMarkdown(list: TechniqueRow[]): string {
  const esc = (s: unknown): string => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
  const cats = Object.keys(TECHNIQUE_CATEGORIES);
  const rows = [...(list || [])].sort((a, b) => {
    const ca = cats.indexOf(a.category || ""), cb = cats.indexOf(b.category || "");
    return ca !== cb ? ca - cb : (a.name || "").localeCompare(b.name || "", "fr");
  });
  const header = "| Technique | Catégorie | Difficulté | Définition | Aliases | Source |\n|---|---|---|---|---|---|";
  const body = rows.map(r =>
    `| ${esc(r.name)} | ${esc(TECHNIQUE_CATEGORIES[r.category || ""] || r.category)} | ${r.difficulty ? `${r.difficulty}/5` : "–"} | ${esc(r.definition)} | ${esc((r.aliases || []).join(", "))} | ${esc(r.source)} |`
  ).join("\n");
  return `# Glossaire des techniques Mijoté (${rows.length})\n\n${header}\n${body}\n`;
}

/**
 * Rend le glossaire des techniques en YAML réimportable (round-trip fidèle avec
 * {@link parseTechniquesYaml}), trié par catégorie puis par nom.
 *
 * @param list - Techniques à exporter.
 * @returns Le document YAML réimportable.
 */
export function formatTechniquesYaml(list: TechniqueRow[]): string {
  const cats = Object.keys(TECHNIQUE_CATEGORIES);
  const rows = [...(list || [])]
    .sort((a, b) => { const ca = cats.indexOf(a.category || ""), cb = cats.indexOf(b.category || ""); return ca !== cb ? ca - cb : (a.name || "").localeCompare(b.name || "", "fr"); })
    .map(t => {
      const o: Record<string, unknown> = { id: t.id, name: t.name, category: t.category };
      if (t.aliases?.length) o.aliases = t.aliases;
      if (t.difficulty) o.difficulty = t.difficulty;
      o.definition = t.definition;
      if (t.source) o.source = t.source;
      return o;
    });
  return dumpYaml(rows, `# Glossaire des techniques Mijoté (${rows.length}) – généré, réimportable.\n`);
}

/** Ingrédient (forme minimale utilisée par l'export). */
interface IngredientRow {
  id?: string;
  name?: string;
  aliases?: string[];
  category?: string;
  description?: string;
  months?: number[];
  gramsPerPiece?: number;
  image?: string;
  tips?: { type: string; text: string }[];
  nutrition?: Record<string, number>;
}

// ─── EXPORTS YAML (réimportables, pour versionner dans data/) ──────────────────

/**
 * Rend la base d'ingrédients en YAML réimportable. Inverse de
 * {@link parseIngredientsYaml} : retire les champs dérivés/internes (`_ro`,
 * `isVegetable`) pour que `parse(format(x))` redonne `x`.
 *
 * @param list - Ingrédients à exporter.
 * @param options - Options de tri.
 * @param options.categoryOrder - Ordre des catégories (sinon tri alphabétique seul).
 * @returns Le document YAML réimportable.
 */
export function formatIngredientsYaml(list: IngredientRow[], { categoryOrder = [] }: { categoryOrder?: string[] } = {}): string {
  const order = categoryOrder.length ? categoryOrder : null;
  const rows = [...(list || [])]
    .sort((a, b) => {
      if (order) { const ca = order.indexOf(a.category || "other"), cb = order.indexOf(b.category || "other"); if (ca !== cb) return ca - cb; }
      return (a.name || "").localeCompare(b.name || "", "fr");
    })
    .map(d => {
      const o: Record<string, unknown> = {};
      if (d.id) o.id = d.id;
      o.name = d.name;
      if (d.aliases?.length) o.aliases = d.aliases;
      if (d.category) o.category = d.category;
      if (d.description) o.description = d.description;
      if (d.months?.length) o.months = d.months;
      if (d.gramsPerPiece != null) o.gramsPerPiece = d.gramsPerPiece;
      if (d.image) o.image = d.image;
      if (d.tips?.length) o.tips = d.tips.map(t => ({ type: t.type, text: t.text }));
      if (d.nutrition) {
        const n: Record<string, number> = {};
        for (const k of NUT_KEYS) if (d.nutrition[k] != null) n[k] = d.nutrition[k];
        if (Object.keys(n).length) o.nutrition = n;
      }
      return o;
    });
  return dumpYaml(rows, `# Base d'ingrédients Mijoté (${rows.length}) – généré, réimportable. Valeurs pour 100 g.\n`);
}

/** Ustensile (forme minimale utilisée par l'export). */
interface UtensilRow { id?: string; name?: string; image?: string }

/**
 * Rend la base d'ustensiles en YAML réimportable, trié par nom.
 *
 * @param list - Ustensiles à exporter.
 * @returns Le document YAML réimportable.
 */
export function formatUtensilsYaml(list: UtensilRow[]): string {
  const rows = [...(list || [])]
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"))
    .map(d => { const o: Record<string, unknown> = {}; if (d.id) o.id = d.id; o.name = d.name; if (d.image) o.image = d.image; return o; });
  return dumpYaml(rows, `# Base d'ustensiles Mijoté (${rows.length}) – généré, réimportable.\n`);
}

// ─── INGRÉDIENTS ──────────────────────────────────────────────────────────────

/**
 * Parse et valide un export YAML de la base d'ingrédients (bornes nutritionnelles,
 * conseils, mois de saison…).
 *
 * @param text - Source YAML brute.
 * @param options - Options de validation.
 * @param options.validCategories - Set ou tableau des clés de catégories acceptées.
 * @returns `{ items, errors }` : `items` est vide si `errors` n'est pas vide.
 */
export function parseIngredientsYaml(text: string, { validCategories }: { validCategories?: Set<string> | string[] } = {}): ParseResult {
  const { list, error } = loadYamlList(text);
  if (error) return { items: [], errors: [error] };

  const valid = validCategories instanceof Set ? validCategories : new Set(validCategories || []);
  const errors: string[] = [];
  const items: Record<string, unknown>[] = [];
  (list || []).forEach((rawEntry, i) => {
    const raw = rawEntry as Record<string, unknown>;
    const where = `Entrée #${i + 1}${raw && raw.name ? ` « ${raw.name} »` : ""}`;
    if (!isObj(raw)) { errors.push(`${where} : ce n'est pas un objet.`); return; }
    const name = str(raw.name);
    if (!name || name.length > 120) { errors.push(`${where} : « name » manquant ou trop long.`); return; }
    if (raw.category != null && valid.size && !valid.has(str(raw.category)))
      errors.push(`${where} : catégorie inconnue « ${raw.category} ».`);

    const row: Record<string, unknown> = { name };
    if (raw.id != null) row.id = str(raw.id);
    if (raw.category != null) row.category = str(raw.category);
    if (raw.image != null) row.image = str(raw.image);
    if (raw.description != null) {
      const d = str(raw.description);
      if (d.length > 280) errors.push(`${where} : « description » trop longue (max 280).`);
      else if (d) row.description = d;
    }
    if (Array.isArray(raw.aliases)) {
      const a = raw.aliases.map(x => str(x)).filter(Boolean);
      if (a.length) row.aliases = a;
    }
    if (Array.isArray(raw.tips)) {
      const tips: { type: string; text: string }[] = [];
      raw.tips.forEach(t => {
        if (!isObj(t)) { errors.push(`${where} : tip invalide.`); return; }
        const type = str(t.type).toLowerCase();
        const text = str(t.text);
        if (!type || !(type in TIP_TYPES)) errors.push(`${where} : type de conseil inconnu « ${type || "?"} » (${Object.keys(TIP_TYPES).join(", ")}).`);
        else if (!text) errors.push(`${where} : conseil « ${type} » sans texte.`);
        else tips.push({ type, text });
      });
      if (tips.length) row.tips = tips;
    }
    if (Array.isArray(raw.months)) {
      const m = raw.months.filter((x): x is number => Number.isInteger(x) && x >= 1 && x <= 12);
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
        const nut: Record<string, unknown> = {};
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

/**
 * Parse et valide un export YAML de la base d'ustensiles. Génère un id stable
 * depuis le nom quand il est absent (comme les techniques).
 *
 * @param text - Source YAML brute.
 * @returns `{ items, errors }` : `items` est vide si `errors` n'est pas vide.
 */
export function parseUtensilsYaml(text: string): ParseResult {
  const { list, error } = loadYamlList(text);
  if (error) return { items: [], errors: [error] };

  const errors: string[] = [];
  const items: Record<string, unknown>[] = [];
  const seenIds = new Set<string>();
  (list || []).forEach((rawEntry, i) => {
    const raw = rawEntry as Record<string, unknown>;
    const where = `Entrée #${i + 1}${raw && raw.name ? ` « ${raw.name} »` : ""}`;
    if (!isObj(raw)) { errors.push(`${where} : ce n'est pas un objet.`); return; }
    const name = str(raw.name);
    if (!name || name.length > 120) { errors.push(`${where} : « name » manquant ou trop long.`); return; }
    // Id stable généré depuis le nom quand il est absent (comme les techniques) :
    // un ustensile ajouté sans `id` reste ainsi sûr côté seed (le seed pousse tel
    // quel). Les ustensiles existants conservent leur id → les liens dans les
    // recettes (référencées par id) ne bougent pas.
    const id = str(raw.id) || slugifyId("db_u_", name);
    if (seenIds.has(id)) { errors.push(`${where} : id en double « ${id} ».`); return; }
    seenIds.add(id);
    const row: Record<string, unknown> = { id, name };
    if (raw.image != null) row.image = str(raw.image);
    items.push(row);
  });
  return { items: errors.length ? [] : items, errors };
}
