import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { decideBackAction } from "@/lib/ui/backButton.js";

/**
 * Câble le bouton retour matériel (et le geste de retour) d'Android sur la
 * navigation interne, au lieu de la sortie brutale par défaut de Capacitor.
 * Faute d'écouteur, le WebView remonte l'évènement au système qui ferme l'app ;
 * ici on redescend d'un cran dans l'historique, on rejoint l'accueil quand la
 * pile est vide hors accueil, et on ne quitte que depuis l'accueil (cf.
 * `decideBackAction`, où vit la logique testée).
 *
 * L'écran d'édition court-circuite la navigation : le retour ouvre la
 * confirmation d'abandon (garde partagée avec la TabBar) plutôt que de perdre
 * les modifications en cours.
 *
 * Inerte hors plateforme native (web / PWA) : le geste y est déjà géré par le
 * navigateur. À monter une seule fois, sous le routeur.
 *
 * @param {object} opts
 * @param {boolean} opts.isEditing - Un éditeur est-il ouvert avec des modifications en cours.
 * @param {() => void} opts.onLeaveEditor - Ouvre la confirmation d'abandon (au lieu de naviguer).
 * @param {(doNavigate: () => void) => void} [opts.onBackDismiss] - Enrobe le recul
 *   d'un cran : quand une fiche recette est ouverte, joue sa sortie animée puis
 *   navigue ; sinon navigue immédiatement (cf. `AppInner`). Optionnel.
 */
export function useAndroidBackButton({ isEditing, onLeaveEditor, onBackDismiss }) {
  const navigate = useNavigate();
  // Motif « latest ref » : l'écouteur natif est posé une seule fois, mais lit
  // toujours l'état d'édition et les callbacks les plus récents sans se re-câbler.
  const latest = useRef({ isEditing, onLeaveEditor, onBackDismiss });
  useEffect(() => { latest.current = { isEditing, onLeaveEditor, onBackDismiss }; });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle;
    let cancelled = false;
    CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      const { isEditing, onLeaveEditor, onBackDismiss } = latest.current;
      if (isEditing) { onLeaveEditor?.(); return; }
      const action = decideBackAction(window.location.pathname, canGoBack);
      if (action === "back") {
        const goBack = () => navigate(-1);
        // `onBackDismiss` décide seul s'il y a une sortie à animer ; sinon il
        // rappelle `goBack` sans délai. On l'appelle donc inconditionnellement.
        if (onBackDismiss) onBackDismiss(goBack); else goBack();
      }
      else if (action === "home") navigate("/home", { replace: true });
      else CapacitorApp.exitApp();
    }).then((h) => { if (cancelled) h.remove(); else handle = h; });
    return () => { cancelled = true; handle?.remove(); };
  }, [navigate]);
}
