// ─── EXTRACTION DE RECETTE (pur, sans I/O) ───────────────────────────────────
// Helpers purs (testables, sans réseau) pour l'import depuis une URL : nettoyage
// HTML → texte (avec marqueurs d'images), rapprochement du style de cuisine,
// filtrage des ustensiles à la base master, et assemblage final du brouillon
// (ids stables + liaisons ingrédients/ustensiles ↔ étapes). L'extraction elle-même
// est faite par le LLM (voir index.ts) ; ce module met en forme son résultat.

// ── Types (les payloads LLM sont volontairement lâches : JSON externe non fiable)

/** Ingrédient au fil de l'assemblage (nom + quantité/unité optionnelles). */
export interface DraftIngredient {
  name?: string;
  amount?: number | string;
  unit?: string;
  raw?: string;
  _raw?: string;
  /** Section/sous-préparation (« La pâte »…). Vide/absent = pas de groupement. */
  group?: string;
}

/** Ustensile (nom seul), parfois une simple chaîne côté LLM. */
export interface DraftUtensil {
  name?: string;
}

/** Étape au fil de l'assemblage. */
export interface DraftStep {
  text?: string;
  tip?: string;
  image?: string;
  ingredients?: string[];
  utensils?: (string | DraftUtensil)[];
  /** Section/sous-préparation (« La pâte »…). Vide/absent = pas de groupement. */
  group?: string;
}

/** Brouillon INTERMÉDIAIRE (sortie de `llmToIntermediate`, entrée d'`assignIdsAndLink`). */
export interface Intermediate {
  name: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  cuisine: string;
  category: string;
  source: string;
  image?: string;
  ingredients: DraftIngredient[];
  utensils: DraftUtensil[];
  steps: DraftStep[];
}

/** Ingrédient au schéma final Mijoté (id stable + texte éditable `_raw`). */
export interface RecipeIngredient {
  id: string;
  dbId: string;
  name: string;
  _raw: string;
  amount?: number | string;
  unit?: string;
  group?: string;
}

/** Ustensile au schéma final. */
export interface RecipeUtensil {
  id: string;
  dbId: string;
  name: string;
}

/** Étape au schéma final (avec liaisons ingrédients/ustensiles par id). */
export interface RecipeStep {
  id: string;
  title: string;
  text: string;
  tip: string;
  image: string;
  ingredients: string[];
  utensils: string[];
  group?: string;
}

/** Recette finale assemblée. */
export interface Recipe {
  name: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  cuisine: string;
  category: string;
  source: string;
  image: string;
  ingredients: RecipeIngredient[];
  utensils: RecipeUtensil[];
  steps: RecipeStep[];
}

// Styles de cuisine reconnus (miroir de src/constants/cuisines.js, garder aligné).
export const CUISINE_LABELS: string[] = ["Française", "Italienne", "Espagnole", "Portugaise", "Grecque",
  "Marocaine", "Tunisienne", "Libanaise", "Turque", "Indienne", "Chinoise", "Japonaise",
  "Coréenne", "Thaïlandaise", "Vietnamienne", "Mexicaine", "Américaine", "Fusion"];

// Catégories (rôle dans le repas) reconnues (miroir de src/constants/recipeCategories.js).
const CATEGORY_IDS: string[] = ["aperitif", "entree", "soupe", "salade", "plat", "gratin", "pasta", "pizza",
  "accompagnement", "dessert", "tarte", "petit-dej", "boisson", "sauce", "boulangerie"];

const norm = (s: unknown): string => (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Pluriel des unités comptables pour le texte éditable `_raw` (miroir de
// src/lib/format.ts). Les abréviations (g, ml, c. à s.…) sont invariables.
const PLURAL_UNITS: Record<string, string> = {
  "cuillère à soupe": "cuillères à soupe", "cuillère à café": "cuillères à café",
  "pincée": "pincées", "gousse": "gousses", "sachet": "sachets", "tranche": "tranches",
  "botte": "bottes", "feuille": "feuilles", "branche": "branches", "poignée": "poignées",
  "verre": "verres", "bol": "bols", "tasse": "tasses", "boîte": "boîtes", "pot": "pots", "pièce": "pièces",
};

// Unités implicites : « 1 pièce oignon » se dit « 1 oignon ». On ne les stocke pas
// et on ne les écrit pas dans `_raw`.
const SILENT_UNITS = new Set(["piece", "pieces", "unite", "unites"]);

/** Unité accordée au pluriel selon la quantité (règle française : ≥ 2). */
function pluralUnit(amount: number | string | undefined, unit: string | undefined): string {
  const u = (unit || "").toString().trim();
  if (!u) return "";
  const n = Number(amount);
  return (Number.isFinite(n) && Math.abs(n) >= 2) ? (PLURAL_UNITS[u.toLowerCase()] || u) : u;
}

// Retire un mot de mesure en tête de nom quand le LLM l'y a laissé (« gousse
// d'ail » → « ail », « tranche de pain » → « pain »). Renvoie l'unité canonique
// (singulier) détectée pour la promouvoir si le champ `unit` est vide, évite le
// doublon « 2 gousses gousse d'ail » et rétablit le rapprochement à la base.
function stripMeasurePrefix(name: string | undefined): { name: string; measure: string } | null {
  const s = (name || "").toString().trim();
  if (!s) return null;
  // Orthographes acceptées (singulier + pluriel) → singulier canonique ; on teste
  // les plus longues d'abord (« cuillère à soupe » avant « cuillère »). « pièce »
  // est exclu (unité implicite : « pièce d'oignon » n'existe pas).
  const forms: [string, string][] = [];
  for (const sing of Object.keys(PLURAL_UNITS)) {
    if (sing === "pièce") continue;
    forms.push([sing, sing], [PLURAL_UNITS[sing], sing]);
  }
  forms.sort((a, b) => b[0].length - a[0].length);
  for (const [spelling, sing] of forms) {
    const esc = spelling.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^${esc}\\s+(?:de\\s+la\\s+|de\\s+l['’]|des\\s+|du\\s+|de\\s+|d['’]\\s*)`, "i");
    const m = s.match(re);
    if (m) return { name: s.slice(m[0].length).trim(), measure: sing };
  }
  return null;
}

// Noms en -ou prenant un « x » au pluriel (miroir de src/lib/format.ts).
const OU_PLURAL_X = new Set(["bijou", "caillou", "chou", "genou", "hibou", "joujou", "pou"]);

// Pluriel français du mot de tête d'un nom d'ingrédient COMPTABLE (sans unité) :
// « 2 oignon » → « 2 oignons », « 4 œuf » → « 4 œufs ». Le champ `name` stocké
// reste au singulier canonique ; seul le texte `_raw` est accordé.
function pluralName(amount: number | string | undefined, name: string | undefined): string {
  const s = (name || "").toString();
  const n = Number(amount);
  if (!s || !Number.isFinite(n) || Math.abs(n) < 2) return s;
  return s.replace(/^\S+/, (w) => {
    const lo = w.toLowerCase();
    if (/[sxz]$/.test(lo)) return w;
    if (/(au|eau|eu)$/.test(lo)) return w + "x";
    if (/al$/.test(lo)) return w.slice(0, -2) + "aux";
    if (/ou$/.test(lo)) return OU_PLURAL_X.has(lo) ? w + "x" : w + "s";
    return w + "s";
  });
}

/** Valide un id de catégorie renvoyé par le LLM (ou ""). */
export function matchCategory(v: unknown): string {
  const n = norm(Array.isArray(v) ? v[0] : v);
  return CATEGORY_IDS.includes(n) ? n : "";
}

/** Rapproche une valeur libre du label de cuisine canonique le plus proche (ou ""). */
export function matchCuisine(v: unknown): string {
  const n = norm(Array.isArray(v) ? v[0] : v);
  if (!n) return "";
  const hit = CUISINE_LABELS.find((l) => norm(l) === n) || CUISINE_LABELS.find((l) => n.includes(norm(l)) || norm(l).includes(n));
  return hit || "";
}

/** og:image (ou twitter:image) depuis le <head>, image principale de la recette. */
export function extractOgImage(html: string): string {
  const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::url)?["'][^>]*>/i);
  if (!m) return "";
  const c = m[0].match(/content=["']([^"']+)["']/i);
  return c ? c[1] : "";
}

/**
 * Détecte le nom `name` (normalisé) comme mot/segment dans un texte (évite les
 * faux positifs type « sel » dans « persil »).
 */
export function mentions(text: string, name: string): boolean {
  const n = norm(name);
  if (n.length < 3) return false;
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(text);
}

// Union des ustensiles cités PARTOUT par le LLM : le tableau de tête `utensils`
// ET ceux référencés au fil des étapes. Certains modèles ne remplissent que les
// étapes (ou renvoient un tableau de tête vide) : sans ça, la recette ressortait
// sans aucun ustensile. Dédupliqué par nom normalisé.
export function collectUtensils(d: Pick<Intermediate, "utensils" | "steps">): DraftUtensil[] {
  const byNorm = new Map<string, DraftUtensil>();
  const add = (name: unknown): void => {
    const nm = (typeof name === "string" ? name : (name as DraftUtensil)?.name || "").toString().trim();
    const key = norm(nm);
    if (key && !byNorm.has(key)) byNorm.set(key, { name: nm });
  };
  (d.utensils || []).forEach((u) => add((u as DraftUtensil).name || u));
  (d.steps || []).forEach((s) => (s.utensils || []).forEach(add));
  return [...byNorm.values()];
}

// Ne garde que les ustensiles présents dans la base master (liste de noms connus).
// Rapprochement tolérant (accents/casse, singulier grossier, mot commun ≥ 4). Si la
// liste connue est vide (client ne l'a pas fournie), on ne filtre pas.
export function filterUtensilsToKnown(utensils: DraftUtensil[], knownNames: string[]): DraftUtensil[] {
  if (!knownNames || !knownNames.length) return utensils || [];
  const known = knownNames.map(norm);
  const sing = (s: string): string => s.replace(/s\b/g, "");
  const words = (s: string): string[] => s.split(" ").filter((w) => w.length >= 4);
  return (utensils || []).filter((u) => {
    const n = norm(u.name || u);
    if (!n) return false;
    return known.some((k) => {
      if (k === n || sing(k) === sing(n) || k.includes(n) || n.includes(k)) return true;
      // mot significatif commun (« batteur électrique » ↔ « batteur », « moule à cake » ↔ « moule à manqué »)
      const kw = words(k), nw = words(n);
      return kw.some((w) => nw.includes(w));
    });
  });
}

// Assemble le brouillon FINAL au schéma Mijoté : ids stables sur ingrédients/
// ustensiles, et liaison ingrédients↔étapes + ustensiles↔étapes (par nom explicite
// fourni par le LLM, complété par détection dans le texte de l'étape).
export function assignIdsAndLink(d: Partial<Intermediate>): Recipe {
  const ingredients: RecipeIngredient[] = (d.ingredients || []).map((i, k) => {
    // Unité implicite (pièce) : on la retire ; sinon on conserve le singulier
    // canonique dans `unit` mais on écrit le pluriel accordé dans `_raw`.
    // Le LLM laisse parfois le mot de mesure dans le nom : on le retire et, si
    // l'unité est absente, on la promeut depuis ce mot.
    const stripped = stripMeasurePrefix(i.name);
    const name = stripped ? stripped.name : (i.name || "");
    const unitRaw = (i.unit || "") || (stripped ? stripped.measure : "");
    const unit = SILENT_UNITS.has(norm(unitRaw)) ? "" : unitRaw;
    // _raw reconstruit à partir des champs normalisés (texte propre et éditable).
    // Sans unité, l'ingrédient est comptable : on accorde le nom au pluriel.
    const rawName = unit ? name : pluralName(i.amount, name);
    const raw = [i.amount, pluralUnit(i.amount, unit), rawName].filter((v) => v != null && v !== "").join(" ").trim() || name || "";
    const ing: RecipeIngredient = { id: `i${k}`, dbId: "", name, _raw: raw };
    if (i.amount != null && i.amount !== "") ing.amount = i.amount;
    if (unit) ing.unit = unit;
    const group = (i.group || "").toString().trim();
    if (group) ing.group = group;
    return ing;
  });
  const utensils: RecipeUtensil[] = (d.utensils || []).map((u, k) => ({ id: `u${k}`, dbId: "", name: ((u as DraftUtensil).name || u).toString() }));

  const steps: RecipeStep[] = (d.steps || []).map((s, k) => {
    const text = norm(s.text);
    const stepGroup = (s.group || "").toString().trim();
    const explicitIng = new Set((s.ingredients || []).map(norm));
    const explicitUt = new Set((s.utensils || []).map((x) => norm(typeof x === "string" ? x : x?.name)));
    // Cloisonnement des sections : une étape appartenant à une sous-préparation ne
    // peut se lier qu'aux ingrédients du MÊME groupe (ou hors-section), jamais à un
    // ingrédient homonyme d'un AUTRE groupe (sinon l'« huile d'olive » de la
    // vinaigrette se relie à tort à une étape du groupe « Croûtons »). Une étape
    // hors-section (montage/dressage) reste libre de tout lier (comportement inchangé).
    const inScope = (g: string | undefined): boolean => { if (!stepGroup) return true; const ig = (g || "").trim(); return ig === "" || ig === stepGroup; };
    const ingIds = ingredients.filter((i) => i.name && inScope(i.group) && (explicitIng.has(norm(i.name)) || mentions(text, i.name))).map((i) => i.id);
    const utIds = utensils.filter((u) => u.name && (explicitUt.has(norm(u.name)) || mentions(text, u.name))).map((u) => u.id);
    const rs: RecipeStep = { id: `s${k}`, title: "", text: (s.text || "").toString(), tip: (s.tip || "").toString(), image: (s.image || "").toString(), ingredients: [...new Set(ingIds)], utensils: [...new Set(utIds)] };
    if (stepGroup) rs.group = stepGroup;
    return rs;
  });

  return {
    name: (d.name || "").slice(0, 200),
    prepTime: Math.max(0, Math.round(d.prepTime || 0)),
    cookTime: Math.max(0, Math.round(d.cookTime || 0)),
    servings: Math.max(1, Math.round(d.servings || 2)),
    cuisine: matchCuisine(d.cuisine),
    category: matchCategory(d.category),
    source: d.source || "",
    image: d.image || "",
    ingredients, utensils, steps,
  };
}

// Images décoratives / techniques à ignorer (logo, avatar, icône, pixel, svg…).
const JUNK_IMG = /(^data:|\.svg(\?|$)|sprite|logo|avatar|icon|emoji|pixel|1x1|placeholder|badge|banner|widget|gravatar|share|social|ads?[-_/])/i;

/** URL d'image « de contenu » depuis une balise <img> (préfère les attributs lazy). */
function imgUrlFromTag(tag: string): string {
  const m = tag.match(/(?:data-src|data-lazy-src|data-original|src)\s*=\s*["']([^"']+)["']/i);
  const url = m ? m[1].trim() : "";
  if (!url || JUNK_IMG.test(url)) return "";
  return url;
}

// HTML → texte lisible (pour le LLM). Retire scripts/styles, et convertit les <img>
// de contenu en marqueurs ⟦IMG:url⟧ (plafonnés) pour que le LLM puisse rattacher
// une photo pertinente à une étape.
export function htmlToText(html: string, { maxImages = 15 }: { maxImages?: number } = {}): string {
  let count = 0;
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<img\b[^>]*>/gi, (tag) => {
      if (count >= maxImages) return " ";
      const url = imgUrlFromTag(tag);
      if (!url) return " ";
      count++;
      return `\n⟦IMG:${url}⟧\n`;
    })
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"').replace(/&eacute;/gi, "é").replace(/&egrave;/gi, "è")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

/** Ensemble des URLs d'images présentes dans le texte (marqueurs ⟦IMG:…⟧). */
export function imageUrlsInText(text: string): Set<string> {
  const set = new Set<string>();
  for (const m of (text || "").matchAll(/⟦IMG:([^⟧]+)⟧/g)) set.add(m[1]);
  return set;
}
