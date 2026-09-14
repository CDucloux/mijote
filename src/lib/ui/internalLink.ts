// ─── LIENS INTERNES DANS LA PROSE MARKDOWN ───────────────────────────────────
// Les pages Guide et Informations légales rendent du Markdown de confiance en HTML
// (dangerouslySetInnerHTML). Les liens internes qu'il contient (ex. /guide/recettes,
// /legal/privacy) déclencheraient une navigation plein écran (rechargement) au lieu
// d'une transition routeur. On intercepte donc les clics d'ancres et on route
// nous-mêmes : ce module décide, à partir d'un clic, s'il faut le prendre en charge
// et vers quel chemin, sans toucher au DOM (pur, testable).

/**
 * Décrit un clic sur une ancre, réduit à ce qui décide de l'interception.
 */
export interface AnchorClick {
  /** Valeur brute de l'attribut href (getAttribute, non résolu). */
  href: string | null;
  /** Attribut target de l'ancre (ex. "_blank"). */
  target?: string | null;
  /** Clic modifié (Cmd/Ctrl/Maj/Alt) ou bouton non principal : laisser au navigateur. */
  modified?: boolean;
}

/**
 * Résout le chemin de navigation interne d'un clic d'ancre, ou null si le clic doit
 * garder son comportement natif (lien externe, nouvel onglet, clic modifié, ancre
 * de page #, protocole mailto/tel, etc.).
 *
 * @returns le chemin interne (commençant par "/") à passer au routeur, sinon null.
 */
export function internalNavPath({ href, target, modified }: AnchorClick): string | null {
  if (!href) return null;
  if (modified) return null;
  if (target && target !== "_self") return null;
  // Interne = chemin absolu de l'app ("/guide/...") ; on exclut le protocole-relatif "//".
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  return null;
}
