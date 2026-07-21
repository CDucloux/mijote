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

// Ne garde que les ustensiles présents dans la base master (liste de noms connus).
// Rapprochement tolérant (accents/casse, singulier grossier). Si la liste connue
// est vide (client ne l'a pas fournie), on ne filtre pas.
function filterUtensilsToKnown(utensils, knownNames) {
  if (!knownNames || !knownNames.length) return utensils || [];
  const known = knownNames.map(norm);
  const sing = (s) => s.replace(/s\b/g, "");
  return (utensils || []).filter(u => {
    const n = norm(u.name || u);
    return n && known.some(k => k === n || sing(k) === sing(n) || k.includes(n) || n.includes(k));
  });
}

// Assemble le brouillon FINAL au schéma Mijoté : ids stables sur ingrédients/
// ustensiles, et liaison ingrédients↔étapes + ustensiles↔étapes (par nom explicite
// fourni par le LLM, complété par détection dans le texte de l'étape).
function assignIdsAndLink(d) {
  const ingredients = (d.ingredients || []).map((i, k) => {
    // _raw reconstruit à partir des champs normalisés (texte propre et éditable).
    const raw = [i.amount, i.unit, i.name].filter(v => v != null && v !== "").join(" ").trim() || i.name || "";
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
  filterUtensilsToKnown, assignIdsAndLink, htmlToText, imageUrlsInText,
};
