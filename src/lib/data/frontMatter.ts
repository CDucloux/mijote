import { parse as parseYaml } from "yaml";

/** Document Markdown séparé de son front-matter YAML. */
export interface FrontMatterDoc {
  /** Métadonnées du front-matter (objet vide si absent, invalide ou non-objet). */
  meta: Record<string, unknown>;
  /** Corps Markdown, sans le bloc `--- … ---`. */
  body: string;
}

const FRONT_MATTER = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

/**
 * Sépare un éventuel front-matter YAML (`--- … ---` en tête) du corps Markdown.
 * Source unique pour les contenus embarqués (guide, documents légaux) : sans
 * front-matter, le texte entier est le corps. Un YAML qui n'est pas un objet
 * (scalaire, liste) est ignoré plutôt que de propager une forme inattendue.
 *
 * @param raw - Contenu brut du fichier Markdown.
 * @returns Les métadonnées et le corps.
 */
export function parseFrontMatter(raw: string): FrontMatterDoc {
  const match = raw.match(FRONT_MATTER);
  if (!match) return { meta: {}, body: raw };
  const parsed: unknown = parseYaml(match[1]);
  const meta = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  return { meta, body: match[2] };
}

/**
 * Lit un champ texte non vide du front-matter, `undefined` sinon. Permet les
 * replis en chaîne (`metaString(meta, "short") || metaString(meta, "title") || id`).
 *
 * @param meta - Métadonnées issues de {@link parseFrontMatter}.
 * @param key - Nom du champ.
 */
export function metaString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Lit un champ numérique fini du front-matter, `undefined` sinon.
 *
 * @param meta - Métadonnées issues de {@link parseFrontMatter}.
 * @param key - Nom du champ.
 */
export function metaNumber(meta: Record<string, unknown>, key: string): number | undefined {
  const value = meta[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
