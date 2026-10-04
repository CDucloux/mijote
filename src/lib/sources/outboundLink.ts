/**
 * Liens sortants vers les sources d'origine des recettes (créatrices, blogs).
 * Logique PURE (sans I/O ni React).
 *
 * Deux objectifs, au service du gagnant-gagnant avec les créatrices :
 *   - chaque lien sortant porte `ref=cardamome`, pour que la créatrice voie le
 *     trafic que Cardamome lui renvoie dans ses propres statistiques ;
 *   - chaque clic est compté par domaine et par mois (clé {@link sourceClickKey}),
 *     pour pouvoir lui présenter un bilan chiffré.
 *
 * @module sources/outboundLink
 */

/** Valeur du paramètre `ref` ajouté aux liens sortants. */
export const OUTBOUND_REF = "cardamome";

/**
 * Normalise une source saisie librement (« www.site.fr/x », « https://… ») en URL
 * http(s) absolue, ou `null` si elle n'est pas exploitable comme lien web.
 *
 * @param source - La source brute (champ `recipe.source`).
 * @returns L'URL absolue, ou `null`.
 */
export function normalizeSourceUrl(source: string | null | undefined): string | null {
  const raw = (source || "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Lien sortant vers une source, marqué `ref=cardamome` (sans écraser un `ref`
 * déjà présent, ni toucher au reste de la query ou à l'ancre).
 *
 * @param source - La source brute.
 * @returns L'URL à ouvrir, ou `null` si la source n'est pas un lien web.
 */
export function outboundSourceHref(source: string | null | undefined): string | null {
  const normalized = normalizeSourceUrl(source);
  if (!normalized) return null;
  const url = new URL(normalized);
  if (!url.searchParams.has("ref")) url.searchParams.set("ref", OUTBOUND_REF);
  return url.toString();
}

/**
 * Domaine lisible d'une source (« cestmafournee.com »), sans `www.`. Repli sur le
 * premier segment du texte brut quand ce n'est pas une URL valide.
 *
 * @param source - La source brute.
 * @returns Le domaine affichable, ou une chaîne vide.
 */
export function sourceHost(source: string | null | undefined): string {
  const normalized = normalizeSourceUrl(source);
  if (normalized) return new URL(normalized).hostname.replace(/^www\./i, "").toLowerCase();
  return (source || "").trim().replace(/^https?:\/\/(?:www\.)?/i, "").split("/")[0];
}

/**
 * Mois de comptage au format `YYYY-MM` (UTC), pour des bilans mensuels stables
 * quel que soit le fuseau du visiteur.
 *
 * @param date - L'instant du clic.
 * @returns Le mois, ex. « 2026-10 ».
 */
export function clickMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Clé du compteur de clics d'un domaine pour un mois (`{domaine}__{YYYY-MM}`),
 * utilisée comme id de document. `null` quand la source n'est pas un lien web.
 *
 * @param source - La source brute (ou l'URL d'une source recommandée).
 * @param date - L'instant du clic.
 * @returns La clé, ou `null`.
 */
export function sourceClickKey(source: string | null | undefined, date: Date): string | null {
  if (!normalizeSourceUrl(source)) return null;
  return `${sourceHost(source)}__${clickMonth(date)}`;
}

/**
 * Clics comptés pour une source donnée (somme des compteurs de son domaine), pour
 * l'afficher en regard de la créatrice dans la console admin.
 *
 * @param counts - Les compteurs d'un mois (domaine + nombre).
 * @param sourceUrl - L'URL de la source recommandée.
 * @returns Le nombre de clics (0 si aucun, ou si l'URL n'est pas un lien web).
 */
export function clicksForSource(counts: readonly { host: string; count: number }[], sourceUrl: string): number {
  if (!normalizeSourceUrl(sourceUrl)) return 0;
  const host = sourceHost(sourceUrl);
  return counts.reduce((sum, entry) => (entry.host === host ? sum + entry.count : sum), 0);
}
