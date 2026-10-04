// ─── Métadonnées de partage (Open Graph / Twitter) : logique PURE ────────────
// Colocalisée avec la fonction serverless (préfixe `_` = fichier utilitaire, non
// exposé comme endpoint par Vercel) et en JS simple, pour que la fonction se
// charge sans étape de bundling ni résolution de TypeScript à l'exécution.
// Aucune I/O : parsing du document Firestore REST, construction des valeurs, et
// réécriture du <head>. Testé dans api/__tests__/ogMeta.test.js.

/** Titre par défaut (aligné sur le <title> statique) quand la recette manque. */
export const DEFAULT_TITLE = "Cardamome, donne du caractère à tes recettes";
/** Description par défaut, ton produit, sans placeholder. */
export const DEFAULT_DESCRIPTION = "Crée, affine et partage tes recettes sur Cardamome.";

/**
 * Vignette d'aperçu servie par /api/og-image : format paysage 1,91:1 attendu par
 * WhatsApp, iMessage ou Facebook, et JPEG léger. La photo d'origine (souvent un
 * portrait de plusieurs Mo) est ignorée par WhatsApp au-delà de quelques centaines
 * de Ko.
 */
export const PREVIEW_IMAGE = { width: 1200, height: 630, type: "image/jpeg" };

/**
 * URL de la vignette d'aperçu d'une recette publique.
 *
 * @param {string} origin - Origine du site (`https://www.cardamome.studio`).
 * @param {string} id - Identifiant public de la recette.
 * @returns {string}
 */
export function previewImageUrl(origin, id) {
  return `${origin}/api/og-image?id=${encodeURIComponent(id)}`;
}

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
 * @returns {{name: string|null, image: string|null, cuisine: string|null, prepTime: number|null, cookTime: number|null, authorName: string|null}|null}
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
  const authorName = asString(scalar(fields.authorName));

  if (!name && !image) return null; // rien d'exploitable → on laissera le HTML statique
  return { name, image, cuisine, prepTime, cookTime, authorName };
}

function capitalizeFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Construit les valeurs des balises de partage. Toujours renseignées (jamais de
 * trou) : à défaut de recette, on retombe sur les valeurs par défaut de l'app.
 * Quand la recette a une photo, l'aperçu pointe vers la vignette dédiée
 * (`previewImage`) et en déclare les dimensions ; sinon, logo de repli sans
 * dimensions (le crawler mesure).
 *
 * @param {{name: string|null, image: string|null, cuisine: string|null, prepTime: number|null, cookTime: number|null, authorName?: string|null}|null} fields
 * @param {{pageUrl: string, fallbackImage: string, previewImage?: string}} opts
 * @returns {{title: string, description: string, image: string, url: string, imageSize: {width: number, height: number, type: string}|null}}
 */
export function buildShareMeta(fields, opts) {
  const name = fields?.name ?? null;
  const title = name ? `${name} · Cardamome` : DEFAULT_TITLE;

  const total = (fields?.prepTime ?? 0) + (fields?.cookTime ?? 0);
  const bits = [];
  if (fields?.authorName) bits.push(`Une recette de ${fields.authorName}`);
  if (fields?.cuisine) bits.push(`cuisine ${fields.cuisine.toLowerCase()}`);
  if (total > 0) bits.push(`prête en ${total} min`);
  const description = name
    ? `${[capitalizeFirst(bits.join(" · ")), "à découvrir sur Cardamome"].filter(Boolean).join(" · ")}.`
    : DEFAULT_DESCRIPTION;

  const hasPhoto = Boolean(fields?.image);
  return {
    title,
    description,
    image: hasPhoto ? (opts.previewImage ?? fields.image) : opts.fallbackImage,
    url: opts.pageUrl,
    imageSize: hasPhoto && opts.previewImage ? PREVIEW_IMAGE : null,
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
 * Twitter en `summary_large_image`. Les dimensions/type statiques décrivent le logo
 * carré : elles sont remplacées par celles de la vignette quand `imageSize` est
 * fourni, retirées sinon (le crawler mesure). N'insère rien : chaque balise absente
 * est ignorée (le HTML statique les porte déjà).
 *
 * @param {string} html - Le HTML de base (contenant les balises statiques).
 * @param {{title: string, description: string, image: string, url: string, imageSize?: {width: number, height: number, type: string}|null}} meta
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
  if (meta.imageSize) {
    out = setMeta(out, "property", "og:image:width", String(meta.imageSize.width));
    out = setMeta(out, "property", "og:image:height", String(meta.imageSize.height));
    out = setMeta(out, "property", "og:image:type", meta.imageSize.type);
  } else {
    out = out.replace(/\s*<meta property="og:image:(?:width|height|type)"[^>]*>/g, "");
  }
  return out;
}

/** Poids maximal accepté pour la photo source avant redimensionnement (octets). */
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

/**
 * Vrai si l'URL de photo peut être récupérée côté serveur : http(s) absolu
 * uniquement (jamais data:, file: ni chemin relatif).
 *
 * @param {unknown} url
 * @returns {boolean}
 */
export function isFetchableImageUrl(url) {
  if (typeof url !== "string" || !url.trim()) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
