import { Icon } from "./Icon.jsx";
import { ClockPicker } from "./ClockPicker.jsx";
import { shiftClock } from "@/lib/planning/serveSchedule.js";

interface TimeStepperProps {
  /** Heure `HH:MM` (24 h). */
  value: string;
  onChange: (clock: string) => void;
  /** Libellé accessible (« Heure de service »). */
  label: string;
  /** Pas des boutons, en minutes (15 par défaut). */
  step?: number;
  /** Ligne sous l'heure : la conséquence du réglage (« premier geste à 18 h 40 »). */
  hint?: string;
}

const pretty = (clock: string): string => {
  const [hours = "0", minutes = "00"] = clock.split(":");
  return minutes === "00" ? `${Number(hours)} h` : `${Number(hours)} h ${minutes}`;
};

/**
 * Réglage d'une heure en un geste : moins / plus d'un cran autour d'une heure en
 * grand, qu'un tap ouvre pour un saut direct (listes heures et minutes posées,
 * invisibles, sur le chiffre). Remplace une rangée de pilules figées qui ne
 * couvrait que quelques heures rondes.
 */
export function TimeStepper({ value, onChange, label, step = 15, hint }: TimeStepperProps) {
  return (
    <div className="time-stepper" role="group" aria-label={label}>
      <button type="button" className="time-stepper__btn" aria-label={`${step} minutes plus tôt`} onClick={() => onChange(shiftClock(value, -step))}>
        <Icon name="minus" size={16} color="currentColor" />
      </button>
      <label className="time-stepper__value">
        <span className="time-stepper__big" aria-hidden="true">{pretty(value)}</span>
        {hint && <span className="time-stepper__hint">{hint}</span>}
        <ClockPicker value={value} label={label} onChange={onChange} />
      </label>
      <button type="button" className="time-stepper__btn" aria-label={`${step} minutes plus tard`} onClick={() => onChange(shiftClock(value, step))}>
        <Icon name="plus" size={16} color="currentColor" />
      </button>
    </div>
  );
}
