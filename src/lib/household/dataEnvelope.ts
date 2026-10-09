/**
 * Enveloppe des fichiers de données YAML (hygiène de données) : chaque export
 * porte la version du schéma de ses entrées, sa date d'export et le nombre
 * d'entrées, au-dessus de la liste elle-même :
 *
 * ```yaml
 * schema_version: 1
 * exported_at: 2026-10-09T06:26:00.000Z
 * count: 326
 * ingredients:
 * - id: …
 * ```
 *
 * La version permet de refuser un fichier écrit par une app plus récente (champs
 * inconnus perdus en silence sinon) ; `count` détecte un fichier tronqué. Les
 * anciens exports (simple liste, sans enveloppe) restent lisibles. Pur, sans I/O.
 *
 * @module household/dataEnvelope
 */

/** Version du schéma des techniques (v2 : hiérarchie, résultat attendu, erreurs, confusions). */
export const TECHNIQUES_SCHEMA_VERSION = 2;
/** Version du schéma des entrées d'ingrédients écrite à l'export. */
export const INGREDIENTS_SCHEMA_VERSION = 1;
/** Version du schéma des entrées d'ustensiles écrite à l'export. */
export const UTENSILS_SCHEMA_VERSION = 1;

/** Métadonnées lues dans l'enveloppe (absentes pour un ancien export en liste nue). */
export interface EnvelopeMeta {
  schemaVersion: number;
  exportedAt?: string;
  count?: number;
}

/** Résultat de lecture : la liste d'entrées, ou une erreur bloquante. */
export interface EnvelopeRead {
  list: unknown[] | null;
  meta: EnvelopeMeta | null;
  error: string | null;
}

/**
 * Construit l'objet racine d'un export : métadonnées puis entrées sous `key`.
 *
 * @param key - Nom de la liste (`ingredients`, `utensils`).
 * @param rows - Entrées déjà sérialisables.
 * @param schemaVersion - Version du schéma des entrées.
 * @param now - Instant de l'export (injecté pour rester pur et testable).
 * @returns L'objet à passer au sérialiseur YAML.
 */
export function buildEnvelope(key: string, rows: readonly unknown[], schemaVersion: number, now: Date): Record<string, unknown> {
  return { schema_version: schemaVersion, exported_at: now.toISOString(), count: rows.length, [key]: rows };
}

/**
 * Lit le document YAML déjà parsé : enveloppe versionnée, ou ancienne liste nue.
 * Une version plus récente que celle supportée, une date illisible ou un `count`
 * qui ne correspond pas à la liste sont des erreurs bloquantes (import annulé).
 *
 * @param doc - Le document YAML parsé (forme inconnue).
 * @param key - Nom attendu de la liste dans l'enveloppe.
 * @param supportedVersion - Plus haute version de schéma que l'app sait lire.
 * @returns La liste et les métadonnées, ou l'erreur.
 */
export function readEnvelope(doc: unknown, key: string, supportedVersion: number): EnvelopeRead {
  if (doc == null) return { list: null, meta: null, error: "Fichier vide." };
  if (Array.isArray(doc)) return { list: doc, meta: null, error: null };
  const fail = (error: string): EnvelopeRead => ({ list: null, meta: null, error });
  if (typeof doc !== "object") return fail(`Le document doit être une liste d'entrées, ou un objet { schema_version, ${key}: [...] }.`);
  const root = doc as Record<string, unknown>;
  const list = root[key];
  if (!Array.isArray(list)) return fail(`Liste « ${key} » absente du fichier.`);

  const version = root.schema_version;
  if (!Number.isInteger(version) || (version as number) < 1) return fail("« schema_version » manquant ou invalide (entier ≥ 1 attendu).");
  if ((version as number) > supportedVersion)
    return fail(`Fichier au schéma v${version}, plus récent que cette version de l'app (v${supportedVersion} au plus). Mets l'app à jour avant d'importer.`);
  const meta: EnvelopeMeta = { schemaVersion: version as number };

  const exportedAt = root.exported_at instanceof Date ? root.exported_at.toISOString() : root.exported_at;
  if (exportedAt != null) {
    if (typeof exportedAt !== "string" || Number.isNaN(Date.parse(exportedAt))) return fail("« exported_at » n'est pas une date valide.");
    meta.exportedAt = exportedAt;
  }
  if (root.count != null) {
    if (root.count !== list.length) return fail(`« count » annonce ${String(root.count)} entrées mais le fichier en contient ${list.length} : fichier tronqué ou modifié à la main ?`);
    meta.count = list.length;
  }
  return { list, meta, error: null };
}
