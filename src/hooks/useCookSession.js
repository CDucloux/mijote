import { useEffect, useRef } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { startCookBar, updateCookBar, stopCookBar, onCookAction } from "@/lib/cookSession/plugin.ts";

/**
 * Câble la barre de notification native du cook mode (plugin `CookSession`) sur
 * l'état du pas à pas. Poste la barre quand la session est active, la met à jour
 * à chaque changement d'étape ou de minuteur, la retire à la fermeture, et relaie
 * les taps de ses boutons (Précédent / Suivant / minuteur / Terminer) vers les
 * handlers du composant.
 *
 * Inerte hors plateforme native (web / PWA) : la façade `cookSession/plugin` y
 * est déjà no-op. À monter une seule fois par session (recette principale ; les
 * bases imbriquées n'ouvrent pas de barre).
 *
 * @param {object} opts
 * @param {boolean} opts.active - La barre doit-elle être affichée (session en cours, non terminée).
 * @param {import("@/lib/cookSession/snapshot").CookSessionSnapshot} opts.snapshot - État courant à refléter.
 * @param {() => void} opts.onNext - Passe à l'étape suivante.
 * @param {() => void} opts.onPrev - Revient à l'étape précédente.
 * @param {() => void} opts.onToggleTimer - Met en pause / relance le minuteur pilote.
 * @param {() => void} opts.onStop - Ferme le cook mode.
 */
export function useCookSession({ active, snapshot, onNext, onPrev, onToggleTimer, onStop }) {
  // Motif « latest ref » : l'écouteur natif est posé une seule fois mais lit
  // toujours les callbacks les plus récents sans se re-câbler.
  const latest = useRef({ onNext, onPrev, onToggleTimer, onStop });
  useEffect(() => { latest.current = { onNext, onPrev, onToggleTimer, onStop }; });

  useEffect(() => {
    const dispose = onCookAction((action) => {
      const { onNext, onPrev, onToggleTimer, onStop } = latest.current;
      if (action === "next") onNext?.();
      else if (action === "prev") onPrev?.();
      else if (action === "toggleTimer") onToggleTimer?.();
      else if (action === "stop") onStop?.();
    });
    return dispose;
  }, []);

  // Poste / retire la barre au fil de l'activation. Le snapshot au démarrage est
  // lu via une ref pour ne pas re-poster à chaque changement d'état (la mise à
  // jour est prise en charge par l'effet suivant).
  const snapRef = useRef(snapshot);
  useEffect(() => { snapRef.current = snapshot; });
  useEffect(() => {
    if (!active) return;
    startCookBar(snapRef.current);
    return () => { stopCookBar(); };
  }, [active]);

  // Met à jour la barre à chaque changement d'état pertinent (étape, minuteur).
  const key = serializeSnapshot(snapshot);
  useEffect(() => {
    if (active) updateCookBar(snapshot);
    // `snapshot` est reconstruit à chaque rendu ; `key` capture son contenu utile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);

  // Retour au premier plan : recale la barre sur l'état courant (les libellés de
  // minuteur peuvent avoir changé pendant l'absence).
  useEffect(() => {
    if (!active) return;
    let handle;
    let cancelled = false;
    CapacitorApp.addListener("resume", () => { updateCookBar(snapRef.current); })
      .then((h) => { if (cancelled) h.remove(); else handle = h; });
    return () => { cancelled = true; handle?.remove(); };
  }, [active]);
}

/** Clé de contenu du snapshot pour piloter les dépendances d'effet. */
function serializeSnapshot(s) {
  return [
    s.recipeTitle, s.stepLabel, s.stepText, s.canPrev, s.canNext,
    s.timer ? `${s.timer.endAt}|${s.timer.running}|${s.timer.label}` : "",
  ].join("");
}
