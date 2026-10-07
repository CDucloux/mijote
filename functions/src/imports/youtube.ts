/**
 * Import d'une recette depuis une vidéo YouTube, partie PURE (sans I/O).
 *
 * Beaucoup de créateurs écrivent la recette complète (ingrédients + étapes) dans la
 * description de leur vidéo. On la récupère via l'API YouTube Data (cf.
 * `youtubeApi`) puis on la confie au pipeline texte existant : aucun modèle vidéo,
 * donc ni coût de tokens vidéo ni recette « plausible » inventée d'après les images.
 * Ce module reconnaît les URLs YouTube, valide la réponse de l'API, nettoie la
 * description et décide si elle contient vraiment une recette.
 *
 * @module imports/youtube
 */

/** Métadonnées utiles d'une vidéo (sous-ensemble validé de `snippet`). */
export interface YoutubeSnippet {
  title: string;
  description: string;
  /** Meilleure miniature disponible (photo du plat par défaut), ou `""`. */
  thumbnail: string;
}

/** Plafond du texte transmis au LLM (une description YouTube fait au plus 5000 caractères). */
const MAX_RECIPE_TEXT = 8_000;

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// Hôtes servant une vidéo YouTube (le lecteur « nocookie » compris).
const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"]);

// Préfixes de chemin portant l'id en segment suivant (/shorts/ID, /live/ID…).
const ID_PATH_PREFIXES = new Set(["shorts", "live", "embed", "v"]);

// Ordre de préférence des miniatures, de la plus grande à la plus petite.
const THUMBNAIL_SIZES = ["maxres", "standard", "high", "medium", "default"];

/**
 * Extrait l'identifiant d'une vidéo depuis une URL YouTube, quelle que soit sa
 * forme (lien court de partage, page de lecture, Short, live, lecteur intégré).
 * Les paramètres annexes (`si`, `is`, `t`…) sont ignorés.
 *
 * @param url - URL saisie par l'utilisateur.
 * @returns L'id à 11 caractères, ou `null` si l'URL n'est pas une vidéo YouTube.
 */
export function parseYoutubeVideoId(url: string): string | null {
  let parsed: URL;
  try { parsed = new URL(url.trim()); } catch { return null; }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const segments = parsed.pathname.split("/").filter(Boolean);
  let id: string | null | undefined;
  if (host === "youtu.be") id = segments[0];
  else if (YOUTUBE_HOSTS.has(host)) {
    if (segments[0] === "watch") id = parsed.searchParams.get("v");
    else if (ID_PATH_PREFIXES.has(segments[0])) id = segments[1];
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

/** Lit un champ objet d'une valeur inconnue (ou `undefined`). */
function field(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)[key] : undefined;
}

/**
 * Valide la réponse de `videos.list?part=snippet` (payload externe non fiable).
 *
 * @param payload - Corps JSON brut de l'API YouTube Data.
 * @returns Le snippet exploitable, ou `null` si la vidéo est absente (privée,
 *   supprimée, id inconnu) ou la réponse malformée.
 */
export function parseYoutubeSnippet(payload: unknown): YoutubeSnippet | null {
  const items = field(payload, "items");
  if (!Array.isArray(items) || !items.length) return null;
  const snippet = field(items[0], "snippet");
  if (!snippet) return null;
  const title = field(snippet, "title");
  const description = field(snippet, "description");
  const thumbnails = field(snippet, "thumbnails");
  const thumbnail = THUMBNAIL_SIZES
    .map((size) => field(field(thumbnails, size), "url"))
    .find((url): url is string => typeof url === "string" && /^https:\/\//.test(url));
  return {
    title: typeof title === "string" ? title.trim() : "",
    description: typeof description === "string" ? description : "",
    thumbnail: thumbnail || "",
  };
}

/**
 * Retire de la description le bruit sans valeur pour l'extraction : liens,
 * chapitres horodatés (`0:00 Intro`), lignes de hashtags. Le reste (sponsor,
 * matériel…) est laissé au LLM, qui sait l'ignorer sans risque d'amputer la recette.
 *
 * @param description - Description brute de la vidéo.
 * @returns La description nettoyée, lignes vides fusionnées.
 */
export function cleanYoutubeDescription(description: string): string {
  return (description || "")
    .replace(/\r\n?/g, "\n")
    .replace(/https?:\/\/\S+/gi, "")
    .split("\n")
    .filter((line) => !/^\s*\(?\d{1,2}:\d{2}(?::\d{2})?\)?\s/.test(line))
    .filter((line) => !/^\s*(#\S+\s*)+$/.test(line))
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Ligne commençant par une quantité (« 200g … », « 12 … », « 1/2 … », « ½ … »),
// éventuellement précédée d'une puce : c'est la signature d'une liste d'ingrédients.
const QUANTITY_LINE = /^\s*[-•*–]?\s*(\d+(?:[.,/]\d+)?|[½¼¾⅓⅔])\s*[^\d\s:]/;
const INGREDIENTS_HEADER = /^\s*(ingr[ée]dients?|ingredientes|zutaten|ingredienti)\b/im;

/**
 * Indique si une description (déjà nettoyée) contient une recette exploitable :
 * au moins 3 lignes de quantités, ou un intertitre « Ingrédients » suivi d'au
 * moins une ligne de quantité. Évite un appel LLM payant sur une description qui
 * ne contient qu'un résumé, des liens ou un renvoi vers un blog.
 *
 * @param text - Description nettoyée par {@link cleanYoutubeDescription}.
 */
export function looksLikeRecipe(text: string): boolean {
  const quantityLines = (text || "").split("\n").filter((line) => QUANTITY_LINE.test(line)).length;
  return quantityLines >= 3 || (quantityLines >= 1 && INGREDIENTS_HEADER.test(text));
}

/**
 * Assemble le texte confié au pipeline d'extraction : le titre de la vidéo (souvent
 * le seul endroit où figure le nom du plat) puis la description nettoyée.
 *
 * @param snippet - Le snippet validé de la vidéo.
 * @returns Le texte de recette, borné à {@link MAX_RECIPE_TEXT} caractères.
 */
export function youtubeRecipeText(snippet: YoutubeSnippet): string {
  const body = cleanYoutubeDescription(snippet.description);
  return [snippet.title ? `Titre de la vidéo : ${snippet.title}` : "", body]
    .filter(Boolean).join("\n\n").slice(0, MAX_RECIPE_TEXT);
}
