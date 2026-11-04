import { useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { durationLabel, stepTimerMinutes, TIMER_PRESETS, type StepDuration } from "@/lib/planning/stepTimers.js";

interface StepTimerButtonsProps {
  /** Durées repérées pour l'étape (texte et réglages d'appareils). */
  durations: StepDuration[];
  onStart: (duration: StepDuration) => void;
  /** z-index de la feuille (au-dessus du mode cuisine, imbriqué ou non). */
  sheetZIndex: number;
}

/**
 * Minuteurs d'une étape : un bouton par durée repérée, plus un minuteur libre
 * lancé à n'importe quelle étape, même sans durée dans la consigne.
 */
export function StepTimerButtons({ durations, onStart, sheetZIndex }: StepTimerButtonsProps) {
  const [picking, setPicking] = useState(false);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
      {durations.map(d => (
        <button key={d.minutes} onClick={() => onStart(d)} className="pressable cook-timer-btn">
          <Icon name="clock" size={14} color="var(--spice)" /> Minuteur {d.label}
        </button>
      ))}
      <button onClick={() => setPicking(true)} className="pressable cook-timer-btn cook-timer-btn--free">
        <Icon name="plus" size={13} /> {durations.length ? "Autre durée" : "Ajouter un minuteur"}
      </button>
      {picking && (
        <TimerPickerSheet zIndex={sheetZIndex} onClose={() => setPicking(false)}
          onStart={minutes => { setPicking(false); onStart({ minutes, label: durationLabel(minutes) }); }} />
      )}
    </div>
  );
}

interface TimerPickerSheetProps {
  zIndex: number;
  onClose: () => void;
  onStart: (minutes: number) => void;
}

/** Choix d'une durée libre : un tap sur un préréglage, ou au pas près avec −/+. */
function TimerPickerSheet({ zIndex, onClose, onStart }: TimerPickerSheetProps) {
  const [minutes, setMinutes] = useState(10);
  return (
    <SwipeableSheet onClose={onClose} zIndex={zIndex}>
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Minuteur</h3>
      <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Il tourne même si tu changes d'étape.</p>
      <div className="timer-picker__dial">
        <button className="pressable timer-picker__step" aria-label="Moins" onClick={() => setMinutes(m => stepTimerMinutes(m, -1))} disabled={minutes <= 1}>
          <Icon name="minus" size={18} />
        </button>
        <output className="timer-picker__value" aria-live="polite">{durationLabel(minutes)}</output>
        <button className="pressable timer-picker__step" aria-label="Plus" onClick={() => setMinutes(m => stepTimerMinutes(m, 1))}>
          <Icon name="plus" size={18} />
        </button>
      </div>
      <div className="timer-picker__presets">
        {TIMER_PRESETS.map(preset => (
          <button key={preset} className={`pressable timer-picker__preset${preset === minutes ? " is-active" : ""}`} onClick={() => setMinutes(preset)}>
            {durationLabel(preset)}
          </button>
        ))}
      </div>
      <button className="btn btn-primary btn-pill" style={{ width: "100%" }} onClick={() => onStart(minutes)}>
        <Icon name="clock" size={15} /> Lancer {durationLabel(minutes)}
      </button>
    </SwipeableSheet>
  );
}
