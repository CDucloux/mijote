/**
 * Détection des champs qui ouvrent le clavier logiciel. Sert à masquer la tab bar
 * pendant la saisie sur mobile : en flux flex, une fois le webview redimensionné
 * par le clavier, la barre d'onglets se retrouve collée juste au-dessus du clavier,
 * ce qu'aucune app native ne fait. On la retire tant qu'un tel champ a le focus.
 *
 * @module softKeyboard
 */

// Types d'`<input>` qui n'ouvrent PAS de clavier texte (boutons, cases, curseurs,
// sélecteurs natifs) : leur focus ne doit pas masquer la tab bar.
const NON_TEXT_INPUT_TYPES = new Set([
  "button", "submit", "reset", "checkbox", "radio",
  "range", "color", "file", "image", "hidden",
]);

/**
 * Indique si le focus sur cet élément ouvre le clavier logiciel (champ texte,
 * zone de texte, ou élément `contenteditable`).
 *
 * @param el - Élément visé (typiquement la cible d'un `focusin`), ou null.
 * @returns `true` si un clavier texte s'ouvrirait pour cet élément.
 */
export function opensSoftKeyboard(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type);
  }
  return (el as HTMLElement).isContentEditable === true;
}
