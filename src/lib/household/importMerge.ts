/**
 * Fusion d'un import YAML de la console dans une base master (pur, sans I/O).
 *
 * L'import est un upsert : chaque ligne met à jour l'entrée existante (même id,
 * ou à défaut même nom normalisé) ou en crée une. Réimporter un export quasi
 * identique touche pourtant toutes les lignes : le bilan doit donc distinguer
 * ce qui a VRAIMENT changé de ce qui était déjà à jour, sans quoi l'admin lit
 * « 69 mis à jour » quand une seule précaution a bougé.
 *
 * @module household/importMerge
 */
import { normalizeStr } from "@/lib/food/parseIngredient.js";

/** Entrée de base master : seuls l'id et le nom servent à l'appariement. */
export interface MasterEntry {
  id?: string;
  name?: string;
}

/** Règles de fusion propres à chaque base. */
export interface MergeOptions<T extends MasterEntry> {
  /** Apparier aussi par nom normalisé quand l'id est absent ou inconnu. */
  matchByName: boolean;
  /** Entrée résultante pour une ligne qui en retrouve une existante. */
  combine: (current: T, row: T) => T;
  /** Id d'une entrée créée (la ligne n'en porte pas, ou un id inconnu). */
  newId: (row: T, index: number) => string;
}

/** Bilan d'un import : noms créés et réellement modifiés, nombre d'inchangés. */
export interface ImportReport {
  read: number;
  created: string[];
  updated: string[];
  unchanged: number;
}

/**
 * Libellés d'une base, au singulier et au pluriel, nus et précédés de « nouveau »
 * (l'élision « nouvel ustensile » / « nouveau geste » ne se devine pas sans risque).
 */
export interface ImportNoun {
  one: string;
  many: string;
  newOne: string;
  newMany: string;
}

function isAbsent(value: unknown): boolean {
  return value === undefined || value === null;
}

/**
 * Égalité profonde de données Firestore-like, insensible à l'ordre des clés ; une
 * clé `undefined` ou `null` vaut une clé absente (Firestore ne distingue pas).
 *
 * @param a - Première valeur.
 * @param b - Seconde valeur.
 * @returns `true` si les deux valeurs portent les mêmes données.
 */
export function sameData(a: unknown, b: unknown): boolean {
  if (isAbsent(a) && isAbsent(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameData(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object" && a && b) {
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(ra), ...Object.keys(rb)]);
    for (const key of keys) if (!sameData(ra[key], rb[key])) return false;
    return true;
  }
  return Object.is(a, b);
}

/**
 * Fusionne les lignes importées dans la base courante, sans jamais rien supprimer.
 *
 * @param current - La base telle qu'en mémoire (non modifiée).
 * @param rows - Les lignes validées du fichier.
 * @param options - Appariement et fusion propres à la base.
 * @returns La base fusionnée et le bilan (créés, réellement modifiés, inchangés).
 */
export function mergeImport<T extends MasterEntry>(current: T[], rows: T[], options: MergeOptions<T>): { next: T[]; report: ImportReport } {
  const next = [...current];
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();
  const index = (entry: T, i: number): void => {
    if (entry.id != null) byId.set(entry.id, i);
    if (options.matchByName && entry.name) byName.set(normalizeStr(entry.name), i);
  };
  next.forEach(index);

  const report: ImportReport = { read: rows.length, created: [], updated: [], unchanged: 0 };
  rows.forEach((row, n) => {
    const idx = row.id != null && byId.has(row.id) ? byId.get(row.id)
      : options.matchByName && row.name ? byName.get(normalizeStr(row.name)) : undefined;
    if (idx != null) {
      const merged = options.combine(next[idx], row);
      if (sameData(merged, next[idx])) report.unchanged++;
      else { next[idx] = merged; report.updated.push(merged.name || merged.id || ""); }
    } else {
      const entry = { ...row, id: row.id || options.newId(row, n) };
      next.push(entry);
      index(entry, next.length - 1);
      report.created.push(entry.name || entry.id || "");
    }
  });
  return { next, report };
}

/**
 * Titre du bilan, ce qui a changé en premier (« 3 ustensiles mis à jour »,
 * « 2 nouveaux ustensiles, 1 mis à jour »), ou « Tout était déjà à jour ».
 *
 * @param report - Le bilan de {@link mergeImport}.
 * @param noun - Les libellés de la base.
 * @returns Le titre à afficher.
 */
export function importHeadline(report: ImportReport, noun: ImportNoun): string {
  const created = report.created.length;
  const updated = report.updated.length;
  const word = (n: number): string => (n > 1 ? noun.many : noun.one);
  const createdText = `${created} ${created > 1 ? noun.newMany : noun.newOne}`;
  if (created && updated) return `${createdText}, ${updated} mis à jour`;
  if (created) return createdText;
  if (updated) return `${updated} ${word(updated)} mis à jour`;
  return "Tout était déjà à jour";
}

/**
 * Ligne de contexte sous le titre : volume lu, inchangés, rappel que rien n'est supprimé.
 *
 * @param report - Le bilan de {@link mergeImport}.
 * @param noun - Les libellés de la base.
 * @returns La phrase à afficher.
 */
export function importContext(report: ImportReport, noun: ImportNoun): string {
  const read = `${report.read} ${report.read > 1 ? noun.many : noun.one} lu${report.read > 1 ? "s" : ""}`;
  if (report.unchanged === report.read) return `${read}, tous identiques à la base. Rien n'a été modifié.`;
  const same = report.unchanged ? `, ${report.unchanged} déjà à jour` : "";
  return `${read}${same}. Rien n'a été supprimé.`;
}
