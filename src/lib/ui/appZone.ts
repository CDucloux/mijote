/**
 * Découpage du site en deux zones d'URL : la vitrine PUBLIQUE (landing, documents
 * légaux, partage de recette) servie à la RACINE, et l'APPLICATION servie sous le
 * préfixe `/app`. La décision est PURE (fonction des seuls signaux pathname +
 * contexte app), pour rester testable et pilotée d'un seul endroit (`main.jsx` lit
 * les signaux réels et choisit le `basename` du routeur). Cf. docs/routing.
 *
 * @module ui/appZone
 */

/** Préfixe d'URL de la zone application. SOURCE UNIQUE : à ne changer qu'ici. */
export const APP_BASE = "/app";

/**
 * L'URL relève-t-elle de la zone application ? Vrai en contexte « app » (PWA
 * installée / coquille Capacitor, qui n'ouvrent jamais la vitrine), ou dès que le
 * chemin est déjà sous `/app`. Sinon (navigateur sur `/`, `/legal…`, `/discover…`,
 * ou une ancienne URL plate `/home…`), c'est la zone publique.
 *
 * @param pathname - Le `window.location.pathname` courant.
 * @param appContext - Exécution en PWA installée ou coquille Capacitor.
 * @returns `true` pour la zone app, `false` pour la zone publique.
 */
export function isAppZone(pathname: string, appContext: boolean): boolean {
  if (appContext) return true;
  return pathname === APP_BASE || pathname.startsWith(APP_BASE + "/");
}

/**
 * Chemin normalisé sous `/app`. Garantit le préfixe et mappe la racine sur
 * l'accueil. Sert au boot à recaler un contexte app ouvert hors `/app` (Capacitor
 * à la racine, PWA déjà installée avec un ancien `start_url` `/home`) et à rediriger
 * les anciennes URL plates, SANS casser les installs existantes.
 *
 * @param pathname - Le chemin à normaliser (déjà sous `/app` ou non).
 * @returns Un chemin garanti sous `/app` (la racine devient `/app/home`).
 */
export function toAppPath(pathname: string): string {
  if (pathname === APP_BASE || pathname.startsWith(APP_BASE + "/")) return pathname;
  return APP_BASE + (pathname === "/" ? "/home" : pathname);
}

/**
 * Inverse de {@link toAppPath} : retire le préfixe `/app` d'un chemin brut
 * (`window.location.pathname`) pour retrouver le chemin interne vu par le routeur
 * (que React Router expose déjà via `useLocation`, mais pas `window.location`).
 * Utile aux rares lecteurs du pathname brut (bouton retour natif).
 *
 * @param pathname - Un chemin brut, éventuellement préfixé par `/app`.
 * @returns Le chemin interne (sans `/app`) ; `/app` seul devient `/`.
 */
export function stripAppBase(pathname: string): string {
  if (pathname === APP_BASE) return "/";
  if (pathname.startsWith(APP_BASE + "/")) return pathname.slice(APP_BASE.length);
  return pathname;
}
