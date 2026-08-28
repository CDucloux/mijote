import { useState, useEffect } from "react";
import { opensSoftKeyboard } from "@/lib/ui/softKeyboard.js";

/**
 * Vrai tant qu'un champ ouvrant le clavier logiciel a le focus (saisie en cours).
 * Sert à masquer la tab bar mobile pendant la frappe : voir {@link opensSoftKeyboard}.
 * Le passage d'un champ texte à un autre ne referme pas l'état (vérification différée
 * de l'élément réellement actif), pour éviter un clignotement de la barre.
 *
 * @returns `true` pendant qu'un champ texte / zone de texte / `contenteditable` est actif.
 */
export function useSoftKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onIn = (e: FocusEvent): void => { if (opensSoftKeyboard(e.target as Element | null)) setOpen(true); };
    const onOut = (): void => {
      // Le focus peut sauter d'un champ à l'autre : on relit l'élément actif au tour
      // suivant plutôt que de refermer aveuglément à chaque `focusout`.
      setTimeout(() => setOpen(opensSoftKeyboard(document.activeElement)), 0);
    };
    document.addEventListener("focusin", onIn, true);
    document.addEventListener("focusout", onOut, true);
    return () => {
      document.removeEventListener("focusin", onIn, true);
      document.removeEventListener("focusout", onOut, true);
    };
  }, []);
  return open;
}
