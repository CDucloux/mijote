/**
 * Durée plancher d'un état « en cours » (spinner d'un dialogue de confirmation).
 * Une suppression optimiste répond instantanément : sans plancher, le spinner
 * clignote une frame et l'action semble ne rien avoir fait.
 *
 * @module ui/busyFloor
 */

/** Durée minimale d'affichage du spinner d'une action destructive, en ms. */
export const BUSY_FLOOR_MS = 650;

/**
 * Promesse résolue après `ms` millisecondes, pour tenir le plancher d'un spinner
 * (seule ou dans un `Promise.all` avec l'action réelle).
 *
 * @param ms - Délai en millisecondes (défaut : {@link BUSY_FLOOR_MS}).
 * @returns Une promesse résolue sans valeur une fois le délai écoulé.
 */
export function busyFloor(ms: number = BUSY_FLOOR_MS): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}
