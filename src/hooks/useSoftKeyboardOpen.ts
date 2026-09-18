import { useState, useEffect } from "react";
import { opensSoftKeyboard } from "@/lib/ui/softKeyboard.js";

/**
 * Vrai tant qu'un champ ouvrant le clavier logiciel a le focus (saisie en cours).
 * Sert à masquer la tab bar mobile pendant la frappe : voir {@link opensSoftKeyboard}.
 * Le passage d'un champ texte à un autre ne referme pas l'état (vérification différée
 * de l'élément réellement actif), pour éviter un clignotement de la barre.
 *
 * À la fermeture (validation / perte de focus), on ne repasse PAS à `false` tout de
 * suite : sur la coquille native, le webview se redimensionne pendant que le clavier
 * se referme, et réafficher la tab bar aussitôt la ferait « pop » en milieu d'écran
 * (elle se cale sur le bas du viewport encore rétréci) avant de sauter en bas une
 * fois le viewport revenu. On attend donc que la mise en page se STABILISE (plus
 * aucun redimensionnement pendant un court délai) avant de réafficher, avec un filet
 * temporel si aucun `resize` n'arrive (cas web, sans clavier logiciel).
 *
 * @returns `true` pendant qu'un champ texte / zone de texte / `contenteditable` est actif.
 */
export function useSoftKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let maxTimer: ReturnType<typeof setTimeout> | undefined;

    const disarm = (): void => {
      if (settleTimer) clearTimeout(settleTimer);
      if (maxTimer) clearTimeout(maxTimer);
      settleTimer = maxTimer = undefined;
      window.removeEventListener("resize", bump);
      vv?.removeEventListener("resize", bump);
    };
    // Le viewport a bougé (clavier en train de se refermer) : on repousse le moment
    // du réaffichage tant que ça bouge encore.
    const bump = (): void => {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(reveal, 140);
    };
    const reveal = (): void => {
      disarm();
      if (!opensSoftKeyboard(document.activeElement)) setOpen(false);
    };

    const onIn = (e: FocusEvent): void => {
      if (opensSoftKeyboard(e.target as Element | null)) { disarm(); setOpen(true); }
    };
    const onOut = (): void => {
      // Le focus peut sauter d'un champ à l'autre : on relit l'élément actif au tour
      // suivant plutôt que de refermer aveuglément à chaque `focusout`.
      setTimeout(() => {
        if (opensSoftKeyboard(document.activeElement)) return;
        disarm();
        window.addEventListener("resize", bump);
        vv?.addEventListener("resize", bump);
        maxTimer = setTimeout(reveal, 700); // filet si aucun resize (web / clavier déjà fermé)
        bump();
      }, 0);
    };

    document.addEventListener("focusin", onIn, true);
    document.addEventListener("focusout", onOut, true);
    return () => {
      document.removeEventListener("focusin", onIn, true);
      document.removeEventListener("focusout", onOut, true);
      disarm();
    };
  }, []);
  return open;
}
