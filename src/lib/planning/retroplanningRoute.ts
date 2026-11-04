/**
 * Route du rétro planning d'un repas : `/retroplanning/<jour>/<créneau>`, plus
 * `?meal=<groupId>` quand le créneau compte plusieurs repas. L'URL porte le repas
 * plutôt que ses plats : la page se reconstruit depuis le planning (lien direct,
 * retour arrière, rechargement). Comme toute URL de l'app, elle est en anglais :
 * le créneau (`soir`) y devient `dinner`.
 *
 * @module planning/retroplanningRoute
 */

/** Préfixe de la route. */
export const RETROPLANNING_PATH = "/retroplanning";

/** Créneau du planning → segment d'URL. */
const SLOT_SEGMENT: Record<string, string> = { matin: "breakfast", midi: "lunch", soir: "dinner" };
const SLOT_BY_SEGMENT: Record<string, string> = Object.fromEntries(Object.entries(SLOT_SEGMENT).map(([slot, segment]) => [segment, slot]));

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
 * @returns Par exemple `"/retroplanning/2026-11-04/dinner"`.
 */
export function retroplanningPath({ date, slot, groupId }: RetroplanningTarget): string {
  const base = `${RETROPLANNING_PATH}/${date}/${SLOT_SEGMENT[slot] ?? encodeURIComponent(slot)}`;
  return groupId ? `${base}?meal=${encodeURIComponent(groupId)}` : base;
}

/**
 * Lit le repas visé dans l'URL.
 *
 * @param pathname - Chemin courant.
 * @param search - Paramètres de requête (`?meal=…`), éventuellement vides.
 * @returns Le repas, ou `null` hors de la route, pour un jour malformé ou un
 *   créneau inconnu.
 */
export function parseRetroplanningPath(pathname: string, search = ""): RetroplanningTarget | null {
  const match = /^\/retroplanning\/(\d{4}-\d{2}-\d{2})\/([a-z]+)\/?$/.exec(pathname);
  const slot = match ? SLOT_BY_SEGMENT[match[2]] : undefined;
  if (!match || !slot) return null;
  return { date: match[1], slot, groupId: new URLSearchParams(search).get("meal") || null };
}
