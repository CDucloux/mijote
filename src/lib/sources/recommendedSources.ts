/**
 * Sources recommandées (créatrices et créateurs de recettes mis en avant sur la
 * page d'import « depuis un lien »). Logique PURE (sans I/O ni React) : forme,
 * normalisation depuis une entrée non fiable (Firestore / admin), monogramme de
 * repli et palette de teintes. Les données vivent dans `master/sources` (admin en
 * écriture) ; un jeu par défaut sert de repli quand la collection est vide.
 *
 * @module sources/recommendedSources
 */

/** Une source recommandée telle que stockée et affichée. */
export interface RecommendedSource {
  /** Identifiant stable (généré à la création). */
  id: string;
  /** Nom affiché de la créatrice / du créateur ou du site. */
  name: string;
  /** URL d'accueil (ouverte dans un nouvel onglet). */
  url: string;
  /** Libellé court de spécialité (ex. « Pâtisserie », « Grèce »). */
  category: string;
  /** Logo uploadé (URL Storage). Repli sur un monogramme teinté si absent. */
  image?: string;
  /** Clé de teinte du monogramme de repli (cf. {@link SOURCE_TINTS}). */
  tint?: string;
  /** Monogramme explicite (1-2 caractères) ; sinon dérivé du nom. */
  mono?: string;
  /** « Import net » : extraction habituellement très propre sur cette source. */
  net?: boolean;
  /** Masquée sans être supprimée quand `false`. */
  enabled?: boolean;
  /** Rang de tri (croissant) ; à défaut, tri alphabétique. */
  order?: number;
}

/** Une teinte de la palette : fond (rgb pour rgba) + couleur du glyphe. */
export interface SourceTint {
  key: string;
  /** Triplet RGB pour composer un fond `rgba(…, .16)`. */
  rgb: string;
  /** Couleur du monogramme (token ou valeur). */
  color: string;
}

/**
 * Palette de teintes du monogramme de repli, tirée des tokens de design (une
 * dominante verte, des accents chauds mesurés). L'admin en choisit une par source.
 */
export const SOURCE_TINTS: readonly SourceTint[] = [
  { key: "accent", rgb: "var(--accent-rgb)", color: "var(--accent)" },
  { key: "spice", rgb: "var(--spice-rgb)", color: "var(--spice)" },
  { key: "green", rgb: "var(--green-rgb)", color: "var(--green)" },
  { key: "coral", rgb: "224,146,117", color: "var(--slot-soir-text)" },
  { key: "blue", rgb: "91,156,246", color: "var(--blue)" },
];

const DEFAULT_TINT = SOURCE_TINTS[0];

/**
 * Résout une clé de teinte en sa définition, avec repli sur la première (accent).
 *
 * @param key - Clé de teinte (ou undefined).
 * @returns La teinte correspondante, sinon la teinte par défaut.
 */
export function tintOf(key: string | undefined): SourceTint {
  return SOURCE_TINTS.find(t => t.key === key) || DEFAULT_TINT;
}

/**
 * Monogramme d'affichage : le champ `mono` explicite s'il est renseigné, sinon le
 * premier caractère significatif du nom (les articles courants sont ignorés pour
 * éviter que tout commence par « L » ou « U »).
 *
 * @param source - La source (au moins `name`, éventuellement `mono`).
 * @returns Un monogramme de 1 à 2 caractères, en capitales.
 */
export function monogramOf(source: Pick<RecommendedSource, "name" | "mono">): string {
  const explicit = (source.mono || "").trim();
  if (explicit) return explicit.slice(0, 2).toUpperCase();
  const words = (source.name || "").trim().split(/\s+/).filter(Boolean);
  const skip = new Set(["le", "la", "les", "un", "une", "des", "l'", "the", "a"]);
  const first = words.find(w => !skip.has(w.toLowerCase())) || words[0] || "?";
  return [...first][0].toUpperCase();
}

/** Retire le protocole et un éventuel `www.` d'une URL, pour un aperçu lisible. */
export function prettyHost(url: string): string {
  return (url || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

const URL_RE = /^https?:\/\/.+/i;

/**
 * Normalise une entrée brute (Firestore / formulaire admin) en {@link RecommendedSource}
 * bornée, ou `null` si le minimum (nom + URL http(s)) n'est pas réuni.
 *
 * @param raw - L'entrée à valider (typée `unknown` : origine non fiable).
 * @returns La source normalisée, ou `null` si invalide.
 */
export function normalizeSource(raw: unknown): RecommendedSource | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = String(r.name || "").trim().slice(0, 80);
  const url = String(r.url || "").trim();
  if (!name || !URL_RE.test(url)) return null;
  const s: RecommendedSource = {
    id: String(r.id || "").trim() || `src_${Math.random().toString(36).slice(2, 10)}`,
    name,
    url: url.slice(0, 400),
    category: String(r.category || "").trim().slice(0, 40),
  };
  const image = String(r.image || "").trim();
  if (image) s.image = image.slice(0, 600);
  const tint = String(r.tint || "").trim();
  if (tint && SOURCE_TINTS.some(t => t.key === tint)) s.tint = tint;
  const mono = String(r.mono || "").trim();
  if (mono) s.mono = mono.slice(0, 2);
  if (r.net === true) s.net = true;
  if (r.enabled === false) s.enabled = false;
  if (typeof r.order === "number" && Number.isFinite(r.order)) s.order = r.order;
  return s;
}

/**
 * Nettoie une liste brute : normalise chaque entrée, écarte les invalides, et trie
 * par `order` croissant puis par nom (locale française).
 *
 * @param items - Liste brute (typiquement `master/sources.items`).
 * @returns La liste normalisée et triée.
 */
export function sanitizeSources(items: unknown): RecommendedSource[] {
  const arr = Array.isArray(items) ? items : [];
  return arr
    .map(normalizeSource)
    .filter((s): s is RecommendedSource => s !== null)
    .sort((a, b) => {
      const oa = a.order ?? Number.MAX_SAFE_INTEGER;
      const ob = b.order ?? Number.MAX_SAFE_INTEGER;
      return oa !== ob ? oa - ob : a.name.localeCompare(b.name, "fr");
    });
}

/**
 * Sous-ensemble affiché côté utilisateur : sources non désactivées (`enabled !== false`).
 *
 * @param items - Liste brute ou déjà normalisée.
 * @returns Les sources visibles, triées.
 */
export function visibleSources(items: unknown): RecommendedSource[] {
  return sanitizeSources(items).filter(s => s.enabled !== false);
}
