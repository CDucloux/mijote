// ─── Métadonnées de partage (Open Graph / Twitter) : logique PURE ────────────
// Colocalisée avec la fonction serverless (préfixe `_` = fichier utilitaire, non
// exposé comme endpoint par Vercel) et en JS simple, pour que la fonction se
// charge sans étape de bundling ni résolution de TypeScript à l'exécution.
// Aucune I/O : parsing du document Firestore REST, construction des valeurs, et
// réécriture du <head>. Testé dans api/__tests__/ogMeta.test.js.

/** Titre par défaut (aligné sur le <title> statique) quand la recette manque. */
export const DEFAULT_TITLE = "Cardamome, l'atelier de tes recettes";
/** Description par défaut, ton produit, sans placeholder. */
export const DEFAULT_DESCRIPTION = "Crée, affine et partage tes recettes sur Cardamome.";

/** Lit la valeur scalaire d'un noeud Firestore REST (stringValue, integerValue...). */
function scalar(node) {
  if (!node || typeof node !== "object") return null;
  if (typeof node.stringValue === "string") return node.stringValue;
  if (typeof node.integerValue === "string") return Number(node.integerValue);
  if (typeof node.integerValue === "number") return node.integerValue;
  if (typeof node.doubleValue === "number") return node.doubleValue;
  return null;
}

function asString(v) {
  return typeof v === "string" && v.trim() ? v : null;
}
function asNumber(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Extrait les champs de partage d'un document Firestore REST
 * (`publicRecipes/{pubId}`). L'image et les durées vivent dans la map imbriquée
 * `recipe` ; le nom et la cuisine sont dénormalisés à la racine du document.
 *
 * @param {unknown} doc - Corps JSON de l'API REST Firestore (`{ fields: {...} }`).
 * @returns {{name: string|null, image: string|null, cuisine: string|null, prepTime: number|null, cookTime: number|null}|null}
 */
export function parseFirestoreDoc(doc) {
  if (!doc || typeof doc !== "object") return null;
  const fields = doc.fields;
  if (!fields || typeof fields !== "object") return null;

  const recipeFields = (() => {
    const inner = fields.recipe?.mapValue?.fields;
    return inner && typeof inner === "object" ? inner : {};
  })();

  const name = asString(scalar(fields.name)) ?? asString(scalar(recipeFields.name));
  const cuisine = asString(scalar(fields.cuisine)) ?? asString(scalar(recipeFields.cuisine));
  const image = asString(scalar(recipeFields.image)) ?? asString(scalar(fields.image));
  const prepTime = asNumber(scalar(recipeFields.prepTime));
  const cookTime = asNumber(scalar(recipeFields.cookTime));

  if (!name && !image) return null; // rien d'exploitable → on laissera le HTML statique
  return { name, image, cuisine, prepTime, cookTime };
}

function capitalizeFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Construit les valeurs des balises de partage. Toujours renseignées (jamais de
 * trou) : à défaut de recette, on retombe sur les valeurs par défaut de l'app.
 *
 * @param {{name: string|null, image: string|null, cuisine: string|null, prepTime: number|null, cookTime: number|null}|null} fields
 * @param {{pageUrl: string, fallbackImage: string}} opts
 * @returns {{title: string, description: string, image: string, url: string}}
 */
export function buildShareMeta(fields, opts) {
  const name = fields?.name ?? null;
  const title = name ? `${name} · Cardamome` : DEFAULT_TITLE;

  const total = (fields?.prepTime ?? 0) + (fields?.cookTime ?? 0);
  const bits = [];
  if (fields?.cuisine) bits.push(`Cuisine ${fields.cuisine.toLowerCase()}`);
  if (total > 0) bits.push(`prêt en ${total} min`);
  const description = name
    ? `${[capitalizeFirst(bits.join(" · ")), "à découvrir sur Cardamome"].filter(Boolean).join(" · ")}.`
    : DEFAULT_DESCRIPTION;

  return {
    title,
    description,
    image: fields?.image ?? opts.fallbackImage,
    url: opts.pageUrl,
  };
}

/** Échappe une valeur destinée à un attribut HTML entre guillemets doubles. */
function escapeAttr(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Remplace le `content` d'une balise `<meta {attr}="{key}" content="...">` si présente. */
function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`);
  return html.replace(re, `$1${escapeAttr(value)}$2`);
}

/**
 * Réécrit le <head> d'un HTML (index.html buildé) avec les balises de partage
 * d'une recette : <title>, description, Open Graph et Twitter Card. Passe la carte
 * Twitter en `summary_large_image` et retire les hints de dimensions du logo carré
 * (l'image de recette n'a pas ce ratio ; les crawlers infèrent la taille). N'insère
 * rien : chaque balise absente est ignorée (le HTML statique les porte déjà).
 *
 * @param {string} html - Le HTML de base (contenant les balises statiques).
 * @param {{title: string, description: string, image: string, url: string}} meta
 * @returns {string}
 */
export function injectMetaTags(html, meta) {
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(meta.title)}</title>`);
  out = setMeta(out, "name", "description", meta.description);
  out = setMeta(out, "property", "og:title", meta.title);
  out = setMeta(out, "property", "og:description", meta.description);
  out = setMeta(out, "property", "og:url", meta.url);
  out = setMeta(out, "property", "og:image", meta.image);
  out = setMeta(out, "name", "twitter:title", meta.title);
  out = setMeta(out, "name", "twitter:description", meta.description);
  out = setMeta(out, "name", "twitter:image", meta.image);
  out = setMeta(out, "name", "twitter:card", "summary_large_image");
  // Les dimensions/type ci-dessous décrivaient le logo carré 512 : hors sujet pour
  // une image de recette, on les retire pour laisser le crawler mesurer.
  out = out.replace(/\s*<meta property="og:image:(?:width|height|type)"[^>]*>/g, "");
  return out;
}
