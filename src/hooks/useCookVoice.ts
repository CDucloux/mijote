/**
 * Branche le mode mains libres sur le pas à pas : chaque page est lue à voix
 * haute en arrivant dessus, et les commandes « suivant », « précédent »,
 * « répète » et « minuteur » pilotent la navigation et les minuteurs.
 *
 * @module useCookVoice
 */
import { useEffect, useRef } from "react";
import { useVoiceControl, type UseVoiceControlResult } from "./useVoiceControl.js";
import type { StepDuration } from "@/lib/planning/stepTimers.js";

/** Options de {@link useCookVoice}. */
export interface UseCookVoiceOptions {
  /** Texte lu pour la page courante (cf. `cookPageSpeech`). */
  speech: string;
  /** Change à chaque page : déclenche la lecture de la nouvelle. */
  pageKey: string | number;
  onNext: () => void;
  onPrev: () => void;
  /** Lance un minuteur (durée dite, sinon celle de l'étape) ; rend la durée lancée, ou `null`. */
  onTimer: (duration?: StepDuration) => StepDuration | null;
  notify?: (message: string) => void;
  paused: boolean;
}

/**
 * Mode mains libres du pas à pas.
 * @param options - Page courante, actions de navigation et de minuteur, cf. {@link UseCookVoiceOptions}.
 * @returns L'état du mode et sa bascule, cf. {@link UseVoiceControlResult}.
 */
export function useCookVoice({ speech, pageKey, onNext, onPrev, onTimer, notify, paused }: UseCookVoiceOptions): UseVoiceControlResult {
  const speechRef = useRef(speech);
  useEffect(() => { speechRef.current = speech; });

  const voice = useVoiceControl({
    paused,
    onError: notify,
    onCommand: command => {
      if (command.kind === "next") onNext();
      else if (command.kind === "prev") onPrev();
      else if (command.kind === "repeat") voice.speak(speechRef.current);
      else {
        const started = onTimer(command.duration);
        voice.speak(started ? `Minuteur de ${started.label} lancé.` : "Pas de durée dans cette étape. Dis par exemple : minuteur 5 minutes.");
      }
    },
  });

  const { active, speak } = voice;
  useEffect(() => {
    if (active && !paused) speak(speechRef.current);
  }, [active, paused, pageKey, speak]);

  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) notify?.("Mains libres : dis « suivant », « répète » ou « minuteur »");
    wasActive.current = active;
  }, [active, notify]);

  return voice;
}
