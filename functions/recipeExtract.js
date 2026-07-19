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
  const ing = { name };
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

// schema.org/Recipe → brouillon au schéma Mijoté (validé/complété côté client).
function mapJsonLdToMijote(r, sourceUrl) {
  const draft = {
    name: (Array.isArray(r.name) ? r.name[0] : r.name || "").toString().slice(0, 200),
    prepTime: isoDurationToMinutes(r.prepTime) || 0,
    cookTime: isoDurationToMinutes(r.cookTime) || 0,
    servings: parseYield(r.recipeYield) || 2,
    image: firstImageUrl(r.image),
    source: sourceUrl,
    cuisine: (Array.isArray(r.recipeCuisine) ? r.recipeCuisine[0] : r.recipeCuisine || "").toString().slice(0, 60),
    ingredients: (r.recipeIngredient || r.ingredients || []).map(parseIngredientLine).filter(Boolean),
    utensils: [],
    steps: flattenInstructions(r.recipeInstructions),
  };
  return draft;
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
};
