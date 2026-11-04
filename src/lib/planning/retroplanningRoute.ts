/**
 * Route du rétro planning d'un repas : `/retroplanning/<jour>/<créneau>`, plus
 * `?repas=<groupId>` quand le créneau compte plusieurs repas. L'URL porte le repas
 * plutôt que ses plats : la page se reconstruit depuis le planning (lien direct,
 * retour arrière, rechargement).
 *
 * @module planning/retroplanningRoute
 */

/** Préfixe de la route. */
export const RETROPLANNING_PATH = "/retroplanning";

/** Le repas visé par la route. */
export interface RetroplanningTarget {
  /** Jour, `YYYY-MM-DD`. */
  date: string;
  /** Créneau du planning (`midi`, `soir`…). */
  slot: string;
  /** Repas du créneau quand il y en a plusieurs, sinon `null`. */
  groupId: string | null;
}

/**
 * Chemin du rétro planning d'un repas.
 *
 * @param target - Le repas (jour, créneau, groupe éventuel).
 * @returns Par exemple `"/retroplanning/2026-11-04/soir"`.
 */
export function retroplanningPath({ date, slot, groupId }: RetroplanningTarget): string {
  const base = `${RETROPLANNING_PATH}/${date}/${encodeURIComponent(slot)}`;
  return groupId ? `${base}?repas=${encodeURIComponent(groupId)}` : base;
}

/**
 * Lit le repas visé dans l'URL.
 *
 * @param pathname - Chemin courant.
 * @param search - Paramètres de requête (`?repas=…`), éventuellement vides.
 * @returns Le repas, ou `null` hors de la route ou pour un jour malformé.
 */
export function parseRetroplanningPath(pathname: string, search = ""): RetroplanningTarget | null {
  const match = /^\/retroplanning\/(\d{4}-\d{2}-\d{2})\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  let slot: string;
  try { slot = decodeURIComponent(match[2]); } catch { return null; }
  return { date: match[1], slot, groupId: new URLSearchParams(search).get("repas") || null };
}
