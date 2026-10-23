/**
 * Branche le mode mains libres sur le pas à pas : chaque page est lue à voix
 * haute en arrivant dessus, et les commandes vocales (« suivant », « précédent »,
 * « mise en place », « répète », « minuteur », « pause », « reprends », « stop ») pilotent la
 * navigation et les minuteurs.
 *
 * @module useCookVoice
 */
import { useEffect, useRef } from "react";
import { useVoiceControl, type UseVoiceControlResult } from "./useVoiceControl.js";
import type { StepDuration } from "@/lib/planning/stepTimers.js";
import type { CookTimer } from "@/lib/planning/cookTimers.js";
import type { TimerAction } from "@/lib/cookSession/voiceCommands.js";

const TIMER_DONE: Record<TimerAction, string> = { pause: "en pause", resume: "repris", stop: "arrêté" };
const NO_TIMER: Record<TimerAction, string> = { pause: "Aucun minuteur en marche.", resume: "Aucun minuteur en pause.", stop: "Aucun minuteur à arrêter." };

/** Options de {@link useCookVoice}. */
export interface UseCookVoiceOptions {
  /** Texte lu pour la page courante (cf. `cookPageSpeech`). */
  speech: string;
  /** Change à chaque page : déclenche la lecture de la nouvelle. */
  pageKey: string | number;
  onNext: () => void;
  onPrev: () => void;
  /** Retour à la mise en place ; rend `false` si la recette n'en a pas. */
  onOverview: () => boolean;
  /** Lance un minuteur (durée dite, sinon celle de l'étape) ; rend la durée lancée, ou `null`. */
  onTimer: (duration?: StepDuration) => StepDuration | null;
  /** Met en pause, reprend ou arrête un minuteur ; rend le minuteur visé, ou `null`. */
  onTimerAction: (action: TimerAction) => CookTimer | null;
  notify?: (message: string) => void;
  paused: boolean;
}

/**
 * Mode mains libres du pas à pas.
 * @param options - Page courante, actions de navigation et de minuteur, cf. {@link UseCookVoiceOptions}.
 * @returns L'état du mode et sa bascule, cf. {@link UseVoiceControlResult}.
 */
export function useCookVoice({ speech, pageKey, onNext, onPrev, onOverview, onTimer, onTimerAction, notify, paused }: UseCookVoiceOptions): UseVoiceControlResult {
  const speechRef = useRef(speech);
  useEffect(() => { speechRef.current = speech; });

  const voice = useVoiceControl({
    paused,
    onError: notify,
    onCommand: command => {
      if (command.kind === "next") onNext();
      else if (command.kind === "prev") onPrev();
      else if (command.kind === "repeat") voice.speak(speechRef.current);
      else if (command.kind === "overview") {
        if (!onOverview()) voice.speak("Pas de mise en place pour cette recette.");
      }
      else if (command.kind !== "timer") {
        const timer = onTimerAction(command.kind);
        voice.speak(timer ? `Minuteur de ${timer.label} ${TIMER_DONE[command.kind]}.` : NO_TIMER[command.kind]);
      } else {
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
    if (active && !wasActive.current) notify?.("Mains libres : « suivant », « répète », « minuteur », « pause », « stop »");
    wasActive.current = active;
  }, [active, notify]);

  return voice;
}
