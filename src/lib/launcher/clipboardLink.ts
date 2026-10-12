/**
 * Lien copié dans le presse-papiers, pour l'import par lien (lecture côté
 * `readClipboardLink`, façade `launcher/plugin`).
 *
 * @module launcher/clipboardLink
 */

/** Ponctuation qui colle à un lien en fin de phrase sans en faire partie. */
const TRAILING = /[).,;:!?»"'\]]+$/;

/**
 * Premier lien http(s) d'un texte copié : un partage d'app arrive souvent sous
 * la forme « Regarde cette recette https://… », pas comme un lien nu.
 *
 * @param text - Le contenu brut du presse-papiers.
 * @returns Le lien, sans la ponctuation finale qui le suit, ou `null`.
 */
export function firstHttpUrl(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const match = text.match(/https?:\/\/[^\s<>"]+/i);
  if (!match) return null;
  const url = match[0].replace(TRAILING, "");
  return /^https?:\/\/[^/\s]+\.[^/\s]+/i.test(url) ? url : null;
}
