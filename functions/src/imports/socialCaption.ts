/**
 * Import depuis un réseau social (reel Instagram, vidéo TikTok).
 *
 * Ces pages ne servent pas la recette aux serveurs : elles se construisent en
 * JavaScript, souvent derrière un mur de connexion. En revanche, elles exposent aux
 * robots d'aperçu de liens (messageries, réseaux) des balises `og:` dont la
 * description porte la légende du post, là où les créateurs écrivent souvent la
 * recette. On lit donc cette légende, best-effort : elle peut être tronquée, absente
 * ou bloquée du jour au lendemain, d'où un repli explicite vers l'import par texte.
 *
 * @module imports/socialCaption
 */

/** Réseau social reconnu dans un lien d'import. */
export type SocialPlatform = "instagram" | "tiktok";

/** Domaines (et leurs sous-domaines) rattachés à chaque réseau. */
const PLATFORM_HOSTS: Record<SocialPlatform, string[]> = {
  instagram: ["instagram.com", "instagr.am"],
  tiktok: ["tiktok.com"],
};

/**
 * User-Agent du robot d'aperçu de liens de Facebook : c'est à lui que ces réseaux
 * servent les balises `og:` (titre, légende, miniature) sans mur de connexion.
 */
export const LINK_PREVIEW_USER_AGENT = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

/**
 * Longueur minimale d'une légende pour valoir la peine d'une extraction : en deçà,
 * c'est un titre ou un slogan, jamais une liste d'ingrédients.
 */
export const MIN_CAPTION_LENGTH = 80;

/**
 * Réseau social désigné par un lien, ou `null` pour un site ordinaire.
 *
 * @param url - Le lien saisi (forme quelconque, éventuellement invalide).
 * @returns Le réseau reconnu, ou `null`.
 */
export function socialPlatform(url: string): SocialPlatform | null {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  for (const [platform, domains] of Object.entries(PLATFORM_HOSTS) as [SocialPlatform, string[]][]) {
    if (domains.some(domain => host === domain || host.endsWith(`.${domain}`))) return platform;
  }
  return null;
}

/** Décode les entités HTML d'un attribut (`&quot;`, `&#x27;`, `&#10;`…). */
function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) return safeCodePoint(parseInt(lower.slice(2), 16), match);
    if (lower.startsWith("#")) return safeCodePoint(parseInt(lower.slice(1), 10), match);
    return named[lower] ?? match;
  });
}

function safeCodePoint(code: number, fallback: string): string {
  try { return String.fromCodePoint(code); } catch { return fallback; }
}

/** Contenu de la balise `<meta>` désignée (`property` ou `name`), décodé. */
function metaContent(html: string, key: string): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (name?.toLowerCase() !== key) continue;
    const content = tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1];
    if (content) return decodeEntities(content).trim();
  }
  return "";
}

/**
 * Retire l'en-tête qu'Instagram place avant la légende (« 1 234 likes, 56 comments
 * - auteur on July 27, 2020: "… ») et les guillemets qui l'entourent.
 */
function stripCaptionFrame(text: string): string {
  const framed = text.match(/^[^"\n]{0,200}?:\s*["“](.*)["”]\s*\.?$/s);
  return (framed ? framed[1] : text).trim();
}

/**
 * Légende d'un post social lue dans ses balises d'aperçu. Parmi `og:description`,
 * `twitter:description` et `description`, on garde la plus longue une fois
 * l'en-tête retiré (certaines sont tronquées plus tôt que d'autres).
 *
 * @param html - Le HTML servi au robot d'aperçu.
 * @returns La légende nettoyée, ou `""` si aucune balise n'en porte.
 */
export function extractSocialCaption(html: string): string {
  const candidates = ["og:description", "twitter:description", "description"]
    .map(key => stripCaptionFrame(metaContent(html || "", key)));
  return candidates.reduce((best, caption) => caption.length > best.length ? caption : best, "");
}
