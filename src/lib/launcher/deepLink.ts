/**
 * Liens d'ouverture de l'app native depuis le lanceur Android (raccourcis d'icône,
 * widgets). Le natif ne connaît que des chemins d'app : il les enveloppe dans
 * `cardamome://open/<chemin>` et l'app les rejoue dans son routeur. Le décodage
 * est volontairement strict, car toute app installée peut forger un tel lien.
 *
 * @module launcher/deepLink
 */

/** Préfixe des liens de lanceur. Miroir de `LaunchLinks.PREFIX` côté Java. */
export const LAUNCH_PREFIX = "cardamome://open";

const SAFE_PATH = /^\/[A-Za-z0-9_\-/]*$/;

/**
 * Chemin d'app porté par un lien de lanceur, ou `null` s'il n'en vient pas.
 *
 * @param url - L'URL reçue (`App.getLaunchUrl`, évènement `appUrlOpen`).
 * @returns Le chemin relatif au routeur (`/shopping-lists`), ou `null` pour un
 *   lien étranger, mal formé ou qui tenterait de sortir de l'app.
 */
export function launchPath(url: string | null | undefined): string | null {
  if (!url || !url.startsWith(LAUNCH_PREFIX)) return null;
  const path = url.slice(LAUNCH_PREFIX.length).split(/[?#]/)[0] || "/home";
  if (!SAFE_PATH.test(path) || path.includes("//")) return null;
  return path;
}
