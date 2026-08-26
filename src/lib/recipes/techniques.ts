/**
 * Glossaire en contexte : repère les gestes culinaires (suer, déglacer, monter au
 * beurre…) dans le texte d'une étape pour les surligner et afficher leur
 * définition. Logique pure : le composant fournit le texte et le glossaire.
 *
 * @module techniques
 */

/** Préfixe d'id des techniques GÉNÉRIQUES (parents de la hiérarchie v2) : elles
 *  servent de métadonnée de regroupement, mais ne sont jamais surlignées dans le
 *  texte des recettes (cf. {@link buildTechniqueIndex}). */
export const GENERIC_TECHNIQUE_PREFIX = "tech_grp_";

/** Une relation « ne pas confondre avec » (schema v2). */
export interface TechniqueConfusion { technique_id: string; distinction?: string }

/** Une entrée de glossaire (geste technique). */
export interface TechniqueEntry {
  id: string;
  name?: string;
  category?: string;
  aliases?: string[];
  difficulty?: number;
  definition?: string;
  source?: string;
  /** Hiérarchie v2 : parent (id ou null) et profondeur. */
  hierarchy?: { parent: string | null; level?: number };
  /** Résultat attendu v2 : état observable après bonne exécution. */
  expected_result?: { summary?: string; observable_indicators?: string[] };
  /** Erreurs fréquentes v2. */
  common_errors?: string[];
  /** Confusions plausibles v2 (« ne pas confondre avec »). */
  not_to_be_confused_with?: TechniqueConfusion[];
  [k: string]: unknown;
}

/** Index de recherche : phrase normalisée → technique, + longueur max en mots. */
export interface TechniqueIndex {
  phrases: Map<string, TechniqueEntry>;
  maxWords: number;
}

/** Un segment de texte annoté : `tech` non nul = portion à surligner. */
export interface Segment {
  text: string;
  tech: TechniqueEntry | null;
}

interface Token { norm: string; start: number; end: number }

/**
 * Normalisation SENSIBLE aux accents (contrairement aux ingrédients) : « grillé »
 * ≠ « grille » (grille de cuisson), « glacé » ≠ « glace » (sucre glace). Casse et
 * ponctuation restent ignorées.
 */
function normTech(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^0-9a-zà-ÿœ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Construit l'index de recherche à partir du glossaire (nom + alias indexés à
 * l'identique).
 *
 * @param techniques - Le glossaire des techniques.
 * @returns L'index `{ phrases, maxWords }` consommé par {@link annotateText}.
 */
export function buildTechniqueIndex(techniques: TechniqueEntry[] | null | undefined): TechniqueIndex {
  const phrases = new Map<string, TechniqueEntry>();
  let maxWords = 1;
  for (const t of techniques || []) {
    if (!t?.id) continue;
    // Les parents génériques (hiérarchie seule) ne sont jamais surlignés.
    if (t.id.startsWith(GENERIC_TECHNIQUE_PREFIX)) continue;
    for (const form of [t.name, ...(Array.isArray(t.aliases) ? t.aliases : [])]) {
      const norm = normTech(form);
      if (!norm) continue;
      if (!phrases.has(norm)) phrases.set(norm, t);
      maxWords = Math.max(maxWords, norm.split(" ").length);
    }
  }
  return { phrases, maxWords };
}

/** Tokens « mots » (lettres accentuées + chiffres) avec leurs offsets. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /[A-Za-zÀ-ÿ0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    tokens.push({ norm: normTech(m[0]), start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

/**
 * Découpe `text` en segments dont `tech` marque les portions à surligner.
 *
 * Le texte original (casse, ponctuation, espaces) est intégralement préservé :
 * concaténer les `.text` redonne l'entrée. Correspondance gloutonne, la phrase la
 * plus longue d'abord.
 *
 * @param text - Le texte à annoter (ex. une étape de recette).
 * @param index - L'index de techniques (voir {@link buildTechniqueIndex}).
 * @returns Les segments : concaténer les `.text` redonne l'entrée ; `tech` marque
 *   les portions à surligner.
 */
export function annotateText(text: string | null | undefined, index: TechniqueIndex | null | undefined): Segment[] {
  if (!text) return [{ text: "", tech: null }];
  if (!index || !index.phrases || index.phrases.size === 0) return [{ text, tech: null }];

  const tokens = tokenize(text);
  const segments: Segment[] = [];
  let cursor = 0; // dernière position émise
  let i = 0;
  while (i < tokens.length) {
    let tech: TechniqueEntry | null = null, len = 0;
    const maxL = Math.min(index.maxWords, tokens.length - i);
    for (let L = maxL; L >= 1; L--) {
      const phrase = tokens.slice(i, i + L).map(t => t.norm).filter(Boolean).join(" ");
      const hit = phrase ? index.phrases.get(phrase) : undefined;
      if (hit) { tech = hit; len = L; break; }
    }
    if (tech) {
      const startTok = tokens[i], endTok = tokens[i + len - 1];
      if (startTok.start > cursor) segments.push({ text: text.slice(cursor, startTok.start), tech: null });
      segments.push({ text: text.slice(startTok.start, endTok.end), tech });
      cursor = endTok.end;
      i += len;
    } else {
      i += 1;
    }
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), tech: null });
  return segments;
}

/**
 * Au moins une technique est-elle repérée dans le texte ?
 *
 * @param text - Le texte à examiner.
 * @param index - L'index de techniques.
 * @returns `true` si au moins un geste est détecté.
 */
export function hasTechnique(text: string | null | undefined, index: TechniqueIndex | null | undefined): boolean {
  return annotateText(text, index).some(s => s.tech);
}
