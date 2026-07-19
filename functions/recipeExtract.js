// ─── EXTRACTION DE RECETTE (pur, sans I/O) ───────────────────────────────────
// Deux chemins :
//   1. JSON-LD schema.org/Recipe présent dans la page → mapping direct (gratuit).
//   2. Sinon, texte de la page → LLM (voir index.js).
// Ce module ne fait que du parsing pur (testable, sans réseau).

// Durée ISO 8601 (PT1H30M, PT45M…) → minutes entières.
function isoDurationToMinutes(v) {
  if (typeof v !== "string") return null;
  const m = v.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const [, d, h, min] = m;
  const total = (Number(d || 0) * 1440) + (Number(h || 0) * 60) + Number(min || 0);
  return total > 0 ? total : null;
}

// "4 personnes", "Pour 6", "6-8 servings" → premier entier trouvé.
function parseYield(v) {
  const s = Array.isArray(v) ? v.join(" ") : String(v ?? "");
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : undefined;
}

// Unités reconnues (mêmes familles que le parseur client), pour découper
// "200 g de farine" → { amount: 200, unit: "g", name: "farine" }.
const UNITS = ["kg", "g", "mg", "l", "cl", "ml", "dl", "cuillère à soupe", "cuillères à soupe",
  "cuillère à café", "cuillères à café", "c. à s.", "c. à c.", "càs", "càc", "cs", "cc",
  "pincée", "pincées", "gousse", "gousses", "tranche", "tranches", "sachet", "sachets",
  "verre", "verres", "tasse", "tasses", "boîte", "boîtes", "botte", "bottes", "brin", "brins"];

// "1/2" → 0.5 ; "1,5" → 1.5 ; "1 1/2" → 1.5 ; "2-3" → 2.
function parseQuantity(str) {
  const s = str.trim().replace(",", ".");
  let m = s.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)/); // entier + fraction
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = s.match(/^(\d+)\/(\d+)/); // fraction seule
  if (m) return Number(m[1]) / Number(m[2]);
  m = s.match(/^(\d+(?:\.\d+)?)/); // décimal / entier (ignore la borne haute d'une plage)
  if (m) return Number(m[1]);
  return null;
}

function parseIngredientLine(raw) {
  const line = String(raw || "").replace(/\s+/g, " ").trim();
  if (!line) return null;
  const qtyMatch = line.match(/^([\d.,/\s]+?)(?=\s*[a-zA-Zà-ÿ(])/);
  let rest = line, amount, unit = "";
  if (qtyMatch) {
    const q = parseQuantity(qtyMatch[1]);
    if (q != null) { amount = q; rest = line.slice(qtyMatch[0].length).trim(); }
  }
  // Unité en tête du reste (la plus longue d'abord).
  const lower = rest.toLowerCase();
  for (const u of [...UNITS].sort((a, b) => b.length - a.length)) {
    if (lower === u || lower.startsWith(u + " ") || lower.startsWith(u + ".")) {
      unit = u;
      rest = rest.slice(u.length).replace(/^\.\s*/, "").trim();
      break;
    }
  }
  rest = rest.replace(/^(de |d'|d’|des |du )/i, "").trim();
  const name = (rest || line).slice(0, 120);
  const ing = { name, _raw: line.slice(0, 160) };
  if (amount != null) ing.amount = amount;
  if (unit) ing.unit = unit;
  return ing;
}

// recipeInstructions : chaîne, tableau de chaînes, de HowToStep, ou HowToSection.
function flattenInstructions(instr) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (typeof node === "string") {
      node.split(/\r?\n+/).map(s => s.trim()).filter(Boolean).forEach(t => out.push({ text: t }));
    } else if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (typeof node === "object") {
      if (node["@type"] === "HowToSection" && node.itemListElement) walk(node.itemListElement);
      else if (node.text) out.push({ text: String(node.text).trim() });
      else if (node.name) out.push({ text: String(node.name).trim() });
    }
  };
  walk(instr);
  return out.filter(s => s.text).slice(0, 60);
}

function firstImageUrl(image) {
  if (!image) return "";
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return firstImageUrl(image[0]);
  if (typeof image === "object") return image.url || firstImageUrl(image.contentUrl) || "";
  return "";
}

// Extrait le premier objet Recipe d'un bloc JSON-LD (gère @graph et tableaux).
function findRecipeNode(json) {
  const nodes = [];
  const collect = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(collect); return; }
    if (n["@graph"]) collect(n["@graph"]);
    const t = n["@type"];
    const isRecipe = t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
    if (isRecipe) nodes.push(n);
  };
  collect(json);
  return nodes[0] || null;
}

// Parse tous les blocs <script type="application/ld+json"> et renvoie la 1re Recipe.
function extractJsonLdRecipe(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let raw = m[1].trim();
    try {
      const json = JSON.parse(raw);
      const recipe = findRecipeNode(json);
      if (recipe) return recipe;
    } catch { /* bloc invalide : on continue */ }
  }
  return null;
}

// Styles de cuisine reconnus (miroir de src/constants/cuisines.js — garder aligné).
const CUISINE_LABELS = ["Française", "Italienne", "Espagnole", "Portugaise", "Grecque",
  "Marocaine", "Tunisienne", "Libanaise", "Turque", "Indienne", "Chinoise", "Japonaise",
  "Coréenne", "Thaïlandaise", "Vietnamienne", "Mexicaine", "Américaine", "Fusion"];

const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

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

// schema.org/Recipe → brouillon INTERMÉDIAIRE (sans ids ; liaisons faites ensuite).
function mapJsonLdToMijote(r, sourceUrl) {
  return {
    name: (Array.isArray(r.name) ? r.name[0] : r.name || "").toString().slice(0, 200),
    prepTime: isoDurationToMinutes(r.prepTime) || 0,
    cookTime: isoDurationToMinutes(r.cookTime) || 0,
    servings: parseYield(r.recipeYield) || 2,
    image: firstImageUrl(r.image),
    source: sourceUrl,
    cuisine: matchCuisine(r.recipeCuisine),
    ingredients: (r.recipeIngredient || r.ingredients || []).map(parseIngredientLine).filter(Boolean),
    utensils: [],
    steps: flattenInstructions(r.recipeInstructions),
  };
}

// Détecte le nom `name` (normalisé) comme mot/segment dans un texte (évite les
// faux positifs type « sel » dans « persil »).
function mentions(text, name) {
  const n = norm(name);
  if (n.length < 3) return false;
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(text);
}

// Assemble le brouillon FINAL au schéma Mijoté : ids stables sur ingrédients/
// ustensiles, et liaison ingrédients↔étapes + ustensiles↔étapes (par nom explicite
// fourni par le LLM, complété par détection dans le texte de l'étape).
function assignIdsAndLink(d) {
  const ingredients = (d.ingredients || []).map((i, k) => {
    const raw = i._raw || [i.amount, i.unit, i.name].filter(v => v != null && v !== "").join(" ").trim() || i.name || "";
    const ing = { id: `i${k}`, dbId: "", name: i.name || "", _raw: raw };
    if (i.amount != null && i.amount !== "") ing.amount = i.amount;
    if (i.unit) ing.unit = i.unit;
    return ing;
  });
  const utensils = (d.utensils || []).map((u, k) => ({ id: `u${k}`, dbId: "", name: (u.name || u).toString() }));

  const steps = (d.steps || []).map((s, k) => {
    const text = norm(s.text);
    const explicitIng = new Set((s.ingredients || []).map(norm));
    const explicitUt = new Set((s.utensils || []).map(norm));
    const ingIds = ingredients.filter(i => i.name && (explicitIng.has(norm(i.name)) || mentions(text, i.name))).map(i => i.id);
    const utIds = utensils.filter(u => u.name && (explicitUt.has(norm(u.name)) || mentions(text, u.name))).map(u => u.id);
    return { id: `s${k}`, title: "", text: (s.text || "").toString(), tip: (s.tip || "").toString(), ingredients: [...new Set(ingIds)], utensils: [...new Set(utIds)] };
  });

  return {
    name: (d.name || "").slice(0, 200),
    prepTime: Math.max(0, Math.round(d.prepTime || 0)),
    cookTime: Math.max(0, Math.round(d.cookTime || 0)),
    servings: Math.max(1, Math.round(d.servings || 2)),
    cuisine: matchCuisine(d.cuisine),
    source: d.source || "",
    image: d.image || "",
    ingredients, utensils, steps,
  };
}

// HTML → texte lisible (pour le fallback LLM) : retire scripts/styles et balises.
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"').replace(/&eacute;/gi, "é").replace(/&egrave;/gi, "è")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

module.exports = {
  isoDurationToMinutes, parseYield, parseIngredientLine, flattenInstructions,
  firstImageUrl, findRecipeNode, extractJsonLdRecipe, mapJsonLdToMijote, htmlToText,
  CUISINE_LABELS, matchCuisine, extractOgImage, assignIdsAndLink, mentions,
};
