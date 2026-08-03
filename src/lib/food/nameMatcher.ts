/**
 * Rapprochement d'un nom saisi vers une entrée de base (ingrédient ou ustensile).
 * Source unique partagée par l'éditeur et l'import.
 *
 * Quatre paliers de confiance, on renvoie le premier qui répond :
 * - **A. exact** : noms identiques une fois normalisés ;
 * - **B. singulier** : identiques au pluriel près ;
 * - **C. canonique** : identiques après retrait du bruit (préparation/état +
 *   connecteurs), comparaison ensembliste (ordre des mots indifférent) ;
 * - **D. sous-ensemble** : tous les mots d'une entrée DB de ≥ 2 mots ⊆ nom cherché.
 *
 * Les alias d'une entrée sont indexés comme son nom à chaque palier. Les mots de
 * VARIÉTÉ/TYPE (blanc, doux, nouveau…) ne sont jamais retirés : ils distinguent
 * des ingrédients différents — ces équivalences relèvent des alias.
 *
 * @module nameMatcher
 */

/** Entrée de base (ingrédient/ustensile). Champs libres tolérés via l'index. */
export interface DbEntry {
  id: string;
  name: string;
  aliases?: string[];
  image?: string;
  category?: string;
  [k: string]: unknown;
}

/** Fonction de résolution : nom → entrée de base (ou `null`). */
export type Resolver = (name: string | null | undefined) => DbEntry | null;

/** Minuscules, sans accents ni ponctuation, espaces compactés. « Huile d'olive »
 * → « huile d olive ». */
export function normalizeName(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Singulier FR approximatif : -aux→-al, -x→∅, -s→∅ (gardes de longueur pour
 * épargner ail, jus, riz…).
 */
function singularizeWord(w: string): string {
  if (w.length > 3 && w.endsWith("aux")) return w.slice(0, -3) + "al";
  if (w.length > 2 && w.endsWith("x")) return w.slice(0, -1);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}
function singularizeName(n: string): string {
  return n.split(" ").filter(Boolean).map(singularizeWord).join(" ");
}

/** Connecteurs (issus aussi des apostrophes : « d'olive » → « d olive »). */
const MATCH_CONNECTORS = new Set([
  "de", "d", "du", "des", "la", "le", "les", "l", "a", "au", "aux",
  "en", "et", "ou", "avec", "sans",
]);

/**
 * Qualificatifs de PRÉPARATION / d'ÉTAT, non discriminants → retirés au palier C.
 * Dérivés des formes accentuées via la même normalisation/singularisation, pour
 * éviter toute erreur de translittération. Liste curée et ajustable.
 */
const RAW_QUALIFIERS = [
  "émincé", "émincée", "ciselé", "ciselée", "haché", "hachée", "râpé", "râpée",
  "moulu", "moulue", "concassé", "concassée", "écrasé", "écrasée", "pressé", "pressée",
  "broyé", "broyée", "fondu", "fondue", "ramolli", "ramollie", "battu", "battue",
  "égoutté", "égouttée", "essoré", "essorée", "équeuté", "équeutée",
  "dénoyauté", "dénoyautée", "pelé", "pelée", "mondé", "mondée",
  "décortiqué", "décortiquée", "effeuillé", "effeuillée",
  "grillé", "grillée", "torréfié", "torréfiée", "blanchi", "blanchie",
  "revenu", "revenue", "cuit", "cuite", "précuit", "précuite",
  "surgelé", "surgelée", "congelé", "congelée", "décongelé", "décongelée",
  "frais", "fraîche", "mûr", "mûre", "bio", "extra",
  "tiède", "froid", "froide", "chaud", "chaude",
];
const MATCH_QUALIFIERS = new Set(RAW_QUALIFIERS.map(w => singularizeWord(normalizeName(w))));

function stripToCanonical(normName: string): string {
  const toks = singularizeName(normName).split(" ").filter(Boolean)
    .filter(t => !MATCH_CONNECTORS.has(t) && !MATCH_QUALIFIERS.has(t));
  return toks.sort().join(" "); // tri → comparaison ensembliste (ordre indifférent)
}

function itemNameForms(item: DbEntry): string[] {
  return [item?.name, ...(Array.isArray(item?.aliases) ? item.aliases : [])]
    .filter((s): s is string => typeof s === "string" && !!s.trim());
}

interface SubsetEntry { item: DbEntry; tokens: string[]; ntok: number; len: number; }

/**
 * Construit un résolveur `(name) => entrée | null` à partir d'une base.
 *
 * Recréé à chaque appel de {@link findIngredientMatch} (coût O(n), comme un
 * `db.find`). Si la base grossit beaucoup, mémoïser côté appelant :
 * `useMemo(() => createIngredientResolver(db), [db])`.
 *
 * @param db - La base d'ingrédients (ou d'ustensiles).
 * @returns Un résolveur `(name) => entrée | null` à 4 paliers (exact, singulier,
 *   canonique, sous-ensemble de tokens).
 */
export function createIngredientResolver(db: DbEntry[] | null | undefined): Resolver {
  const exact = new Map<string, DbEntry>(), singular = new Map<string, DbEntry>(), canonical = new Map<string, DbEntry>();
  const subset: SubsetEntry[] = [];
  // Indexé du plus générique au plus spécifique : à canonique égal, l'entrée la
  // plus courte (souvent l'ingrédient de base) l'emporte.
  const indexed = (db || []).filter(d => d?.id && d?.name).map(d => {
    const forms = itemNameForms(d).map(normalizeName);
    const ntok = Math.min(...forms.map(f => f.split(" ").filter(Boolean).length));
    return { d, forms, ntok };
  }).sort((a, b) => a.ntok - b.ntok);
  for (const { d, forms } of indexed) {
    for (const n of forms) {
      if (!n) continue;
      if (!exact.has(n)) exact.set(n, d);
      const sg = singularizeName(n);
      if (!singular.has(sg)) singular.set(sg, d);
      const can = stripToCanonical(n);
      if (can && !canonical.has(can)) canonical.set(can, d);
      const toks = sg.split(" ").filter(Boolean);
      if (toks.length >= 2) subset.push({ item: d, tokens: toks, ntok: toks.length, len: sg.length });
    }
  }
  subset.sort((a, b) => b.ntok - a.ntok || b.len - a.len); // plus spécifique d'abord
  return function resolve(name) {
    const n = normalizeName(name);
    if (!n) return null;
    const a = exact.get(n); if (a) return a;                                 // A
    const b = singular.get(singularizeName(n)); if (b) return b;             // B
    const can = stripToCanonical(n);
    const c = can ? canonical.get(can) : null; if (c) return c;             // C
    const recToks = new Set(singularizeName(n).split(" ").filter(Boolean));  // D
    for (const e of subset) if (e.tokens.every(t => recToks.has(t))) return e.item;
    return null;
  };
}

/**
 * Rapproche un nom et renvoie l'ENTRÉE de la base (pour l'éditeur et les listes).
 *
 * @param name - Le nom saisi.
 * @param db - La base à interroger.
 * @returns L'entrée correspondante, ou `null`.
 */
export function findIngredientMatch(name: string | null | undefined, db: DbEntry[] | null | undefined): DbEntry | null {
  if (!name || !db || !db.length) return null;
  return createIngredientResolver(db)(name);
}

/**
 * Construit un résolveur `(name) => id` (pour l'import).
 *
 * @param db - La base à interroger.
 * @returns Une fonction qui renvoie l'id de l'entrée rapprochée, ou `""` si aucune.
 */
export function buildNameMatcher(db: DbEntry[] | null | undefined): (name: string | null | undefined) => string {
  const resolve = createIngredientResolver(db);
  return (name) => { const m = resolve(name); return m ? m.id : ""; };
}
