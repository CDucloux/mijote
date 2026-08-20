/**
 * Métadonnées de partage (Open Graph / Twitter Card) d'une recette publique,
 * destinées à un rendu CÔTÉ SERVEUR (fonction Vercel `api/og`) : les crawlers de
 * liens (WhatsApp, iMessage, Discord...) n'exécutent pas de JS et ne sont pas
 * connectés, ils ne lisent que le `<head>` HTML. Sans ce rendu, ils ne voient que
 * les balises statiques de `index.html` (logo générique). Ici on construit, à
 * partir du document Firestore d'une recette, un titre, une description et surtout
 * une `og:image` = l'image de la recette, puis on les injecte dans le HTML.
 *
 * Logique PURE (aucune I/O) : le parsing du document REST, la fabrication des
 * valeurs et la réécriture du HTML sont testables isolément ; la fonction Vercel
 * ne fait que le fetch et l'assemblage.
 *
 * @module ogMeta
 */

/** Champs utiles d'une recette pour la carte de partage (déjà dénormalisés). */
export interface ShareRecipeFields {
  name: string | null;
  image: string | null;
  cuisine: string | null;
  prepTime: number | null;
  cookTime: number | null;
}

/** Valeurs finales injectées dans les balises méta. */
export interface ShareMeta {
  title: string;
  description: string;
  image: string;
  url: string;
}

/** Titre par défaut (aligné sur le `<title>` statique) quand la recette manque. */
export const DEFAULT_TITLE = "Cardamome, l'atelier de tes recettes";
/** Description par défaut, ton produit, sans placeholder. */
export const DEFAULT_DESCRIPTION =
  "Crée, affine et partage tes recettes sur Cardamome.";

/** Lit la valeur scalaire d'un noeud Firestore REST (`stringValue`, `integerValue`...). */
function scalar(node: unknown): string | number | null {
  if (!node || typeof node !== "object") return null;
  const n = node as Record<string, unknown>;
  if (typeof n.stringValue === "string") return n.stringValue;
  if (typeof n.integerValue === "string") return Number(n.integerValue);
  if (typeof n.integerValue === "number") return n.integerValue;
  if (typeof n.doubleValue === "number") return n.doubleValue;
  return null;
}

function asString(v: string | number | null): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}
function asNumber(v: string | number | null): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Extrait les champs de partage d'un document Firestore REST
 * (`publicRecipes/{pubId}`). L'image et les durées vivent dans la map imbriquée
 * `recipe` ; le nom et la cuisine sont dénormalisés à la racine du document.
 *
 * @param doc - Le corps JSON renvoyé par l'API REST Firestore (`{ fields: {...} }`).
 * @returns Les champs normalisés, ou `null` si le document est inexploitable.
 */
export function parseFirestoreDoc(doc: unknown): ShareRecipeFields | null {
  if (!doc || typeof doc !== "object") return null;
  const fields = (doc as Record<string, unknown>).fields;
  if (!fields || typeof fields !== "object") return null;
  const f = fields as Record<string, unknown>;

  const recipeFields = (() => {
    const r = f.recipe as Record<string, unknown> | undefined;
    const mv = r?.mapValue as Record<string, unknown> | undefined;
    const inner = mv?.fields;
    return inner && typeof inner === "object" ? (inner as Record<string, unknown>) : {};
  })();

  const name = asString(scalar(f.name)) ?? asString(scalar(recipeFields.name));
  const cuisine = asString(scalar(f.cuisine)) ?? asString(scalar(recipeFields.cuisine));
  const image = asString(scalar(recipeFields.image)) ?? asString(scalar(f.image));
  const prepTime = asNumber(scalar(recipeFields.prepTime));
  const cookTime = asNumber(scalar(recipeFields.cookTime));

  if (!name && !image) return null; // rien d'exploitable → on laissera le HTML statique
  return { name, image, cuisine, prepTime, cookTime };
}

/**
 * Construit les valeurs des balises de partage à partir des champs de la recette.
 * Toujours renseignées (jamais de trou) : à défaut de recette, on retombe sur les
 * valeurs par défaut de l'app.
 *
 * @param fields - Champs de la recette (peuvent être partiellement nuls).
 * @param opts.pageUrl - URL canonique de la page partagée (`og:url`).
 * @param opts.fallbackImage - Image de repli (logo) si la recette n'en a pas.
 */
export function buildShareMeta(
  fields: ShareRecipeFields | null,
  opts: { pageUrl: string; fallbackImage: string },
): ShareMeta {
  const name = fields?.name ?? null;
  const title = name ? `${name} · Cardamome` : DEFAULT_TITLE;

  const total = (fields?.prepTime ?? 0) + (fields?.cookTime ?? 0);
  const bits: string[] = [];
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

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Échappe une valeur destinée à un attribut HTML entre guillemets doubles. */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Remplace le `content` d'une balise `<meta {attr}="{key}" content="...">` si présente. */
function setMeta(html: string, attr: "property" | "name", key: string, value: string): string {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`);
  return html.replace(re, `$1${escapeAttr(value)}$2`);
}

/**
 * Réécrit le `<head>` d'un HTML (index.html buildé) avec les balises de partage
 * d'une recette : `<title>`, `description`, Open Graph et Twitter Card. Passe la
 * carte Twitter en `summary_large_image` et retire les hints de dimensions du logo
 * carré (l'image de recette n'a pas ce ratio ; les crawlers infèrent la taille).
 * N'insère rien : chaque balise absente est simplement ignorée (le HTML statique
 * les porte déjà). Idempotent sur la valeur.
 *
 * @param html - Le HTML de base (contenant les balises statiques).
 * @param meta - Les valeurs de partage à injecter.
 * @returns Le HTML réécrit.
 */
export function injectMetaTags(html: string, meta: ShareMeta): string {
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
