// ─── EXTRACTION DE RECETTE (pur, sans I/O) ───────────────────────────────────
// Helpers purs (testables, sans réseau) pour l'import depuis une URL : nettoyage
// HTML → texte (avec marqueurs d'images), rapprochement du style de cuisine,
// filtrage des ustensiles à la base master, et assemblage final du brouillon
// (ids stables + liaisons ingrédients/ustensiles ↔ étapes). L'extraction elle-même
// est faite par le LLM (voir index.js) ; ce module met en forme son résultat.

// Styles de cuisine reconnus (miroir de src/constants/cuisines.js — garder aligné).
const CUISINE_LABELS = ["Française", "Italienne", "Espagnole", "Portugaise", "Grecque",
  "Marocaine", "Tunisienne", "Libanaise", "Turque", "Indienne", "Chinoise", "Japonaise",
  "Coréenne", "Thaïlandaise", "Vietnamienne", "Mexicaine", "Américaine", "Fusion"];

// Catégories (rôle dans le repas) reconnues (miroir de src/constants/recipeCategories.js).
const CATEGORY_IDS = ["aperitif", "entree", "soupe", "salade", "plat", "gratin", "pasta", "pizza",
  "accompagnement", "dessert", "tarte", "petit-dej", "boisson", "sauce", "boulangerie"];

const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Pluriel des unités comptables pour le texte éditable `_raw` (miroir de
// src/lib/format.ts). Les abréviations (g, ml, c. à s.…) sont invariables.
const PLURAL_UNITS = {
  "cuillère à soupe": "cuillères à soupe", "cuillère à café": "cuillères à café",
  "pincée": "pincées", "gousse": "gousses", "sachet": "sachets", "tranche": "tranches",
  "botte": "bottes", "feuille": "feuilles", "branche": "branches", "poignée": "poignées",
  "verre": "verres", "bol": "bols", "tasse": "tasses", "boîte": "boîtes", "pot": "pots", "pièce": "pièces",
};

// Unités implicites : « 1 pièce oignon » se dit « 1 oignon ». On ne les stocke pas
// et on ne les écrit pas dans `_raw`.
const SILENT_UNITS = new Set(["piece", "pieces", "unite", "unites"]);

// Unité accordée au pluriel selon la quantité (règle française : ≥ 2).
function pluralUnit(amount, unit) {
  const u = (unit || "").toString().trim();
  if (!u) return "";
  const n = Number(amount);
  return (Number.isFinite(n) && Math.abs(n) >= 2) ? (PLURAL_UNITS[u.toLowerCase()] || u) : u;
}

// Retire un mot de mesure en tête de nom quand le LLM l'y a laissé (« gousse
// d'ail » → « ail », « tranche de pain » → « pain »). Renvoie l'unité canonique
// (singulier) détectée pour la promouvoir si le champ `unit` est vide — évite le
// doublon « 2 gousses gousse d'ail » et rétablit le rapprochement à la base.
function stripMeasurePrefix(name) {
  const s = (name || "").toString().trim();
  if (!s) return null;
  // Orthographes acceptées (singulier + pluriel) → singulier canonique ; on teste
  // les plus longues d'abord (« cuillère à soupe » avant « cuillère »). « pièce »
  // est exclu (unité implicite : « pièce d'oignon » n'existe pas).
  const forms = [];
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
function pluralName(amount, name) {
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

// Valide un id de catégorie renvoyé par le LLM (ou "").
function matchCategory(v) {
  const n = norm(Array.isArray(v) ? v[0] : v);
  return CATEGORY_IDS.includes(n) ? n : "";
}

// Rapproche une valeur libre du label canonique le plus proche (ou "").
function matchCuisine(v) {
  const n = norm(Array.isArray(v) ? v[0] : v);
  if (!n) return "";
  const hit = CUISINE_LABELS.find(l => norm(l) === n) || CUISINE_LABELS.find(l => n.includes(norm(l)) || norm(l).includes(n));
  return hit || "";
}

// og:image (ou twitter:image) depuis le <head> — image principale de la recette.
function extractOgImage(html) {
  const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::url)?["'][^>]*>/i);
  if (!m) return "";
  const c = m[0].match(/content=["']([^"']+)["']/i);
  return c ? c[1] : "";
}

// Détecte le nom `name` (normalisé) comme mot/segment dans un texte (évite les
// faux positifs type « sel » dans « persil »).
function mentions(text, name) {
  const n = norm(name);
  if (n.length < 3) return false;
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(text);
}

// Union des ustensiles cités PARTOUT par le LLM : le tableau de tête `utensils`
// ET ceux référencés au fil des étapes. Certains modèles ne remplissent que les
// étapes (ou renvoient un tableau de tête vide) : sans ça, la recette ressortait
// sans aucun ustensile. Dédupliqué par nom normalisé.
function collectUtensils(d) {
  const byNorm = new Map();
  const add = (name) => {
    const nm = (name || "").toString().trim();
    const key = norm(nm);
    if (key && !byNorm.has(key)) byNorm.set(key, { name: nm });
  };
  (d.utensils || []).forEach(u => add(u.name || u));
  (d.steps || []).forEach(s => (s.utensils || []).forEach(add));
  return [...byNorm.values()];
}

// Ne garde que les ustensiles présents dans la base master (liste de noms connus).
// Rapprochement tolérant (accents/casse, singulier grossier, mot commun ≥ 4). Si la
// liste connue est vide (client ne l'a pas fournie), on ne filtre pas.
function filterUtensilsToKnown(utensils, knownNames) {
  if (!knownNames || !knownNames.length) return utensils || [];
  const known = knownNames.map(norm);
  const sing = (s) => s.replace(/s\b/g, "");
  const words = (s) => s.split(" ").filter(w => w.length >= 4);
  return (utensils || []).filter(u => {
    const n = norm(u.name || u);
    if (!n) return false;
    return known.some(k => {
      if (k === n || sing(k) === sing(n) || k.includes(n) || n.includes(k)) return true;
      // mot significatif commun (« batteur électrique » ↔ « batteur », « moule à cake » ↔ « moule à manqué »)
      const kw = words(k), nw = words(n);
      return kw.some(w => nw.includes(w));
    });
  });
}

// Assemble le brouillon FINAL au schéma Mijoté : ids stables sur ingrédients/
// ustensiles, et liaison ingrédients↔étapes + ustensiles↔étapes (par nom explicite
// fourni par le LLM, complété par détection dans le texte de l'étape).
function assignIdsAndLink(d) {
  const ingredients = (d.ingredients || []).map((i, k) => {
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
    const raw = [i.amount, pluralUnit(i.amount, unit), rawName].filter(v => v != null && v !== "").join(" ").trim() || name || "";
    const ing = { id: `i${k}`, dbId: "", name, _raw: raw };
    if (i.amount != null && i.amount !== "") ing.amount = i.amount;
    if (unit) ing.unit = unit;
    return ing;
  });
  const utensils = (d.utensils || []).map((u, k) => ({ id: `u${k}`, dbId: "", name: (u.name || u).toString() }));

  const steps = (d.steps || []).map((s, k) => {
    const text = norm(s.text);
    const explicitIng = new Set((s.ingredients || []).map(norm));
    const explicitUt = new Set((s.utensils || []).map(norm));
    const ingIds = ingredients.filter(i => i.name && (explicitIng.has(norm(i.name)) || mentions(text, i.name))).map(i => i.id);
    const utIds = utensils.filter(u => u.name && (explicitUt.has(norm(u.name)) || mentions(text, u.name))).map(u => u.id);
    return { id: `s${k}`, title: "", text: (s.text || "").toString(), tip: (s.tip || "").toString(), image: (s.image || "").toString(), ingredients: [...new Set(ingIds)], utensils: [...new Set(utIds)] };
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

// URL d'image « de contenu » depuis une balise <img> (préfère les attributs lazy).
function imgUrlFromTag(tag) {
  const m = tag.match(/(?:data-src|data-lazy-src|data-original|src)\s*=\s*["']([^"']+)["']/i);
  const url = m ? m[1].trim() : "";
  if (!url || JUNK_IMG.test(url)) return "";
  return url;
}

// HTML → texte lisible (pour le LLM). Retire scripts/styles, et convertit les <img>
// de contenu en marqueurs ⟦IMG:url⟧ (plafonnés) pour que le LLM puisse rattacher
// une photo pertinente à une étape.
function htmlToText(html, { maxImages = 15 } = {}) {
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

// Ensemble des URLs d'images présentes dans le texte (marqueurs ⟦IMG:…⟧).
function imageUrlsInText(text) {
  const set = new Set();
  for (const m of (text || "").matchAll(/⟦IMG:([^⟧]+)⟧/g)) set.add(m[1]);
  return set;
}

module.exports = {
  CUISINE_LABELS, matchCuisine, matchCategory, extractOgImage, mentions,
  collectUtensils, filterUtensilsToKnown, assignIdsAndLink, htmlToText, imageUrlsInText,
};
