interface ClockPickerProps {
  /** Heure `HH:MM` (24 h). */
  value: string;
  onChange: (clock: string) => void;
  /** Libellé accessible du réglage (« Heure de début »). */
  label: string;
  /** Pas des minutes proposées (5 par défaut). */
  minuteStep?: number;
}

const pad = (n: number): string => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * Heure à la française (« 20 h 15 ») en deux listes, heures puis minutes : le champ
 * natif `type="time"` suit la langue du navigateur et affiche « 08:30 PM » sur un
 * navigateur anglais. Hérite de la typo et de la couleur de la pilule qui l'accueille.
 */
export function ClockPicker({ value, onChange, label, minuteStep = 5 }: ClockPickerProps) {
  const [hour = 20, minute = 0] = value.split(":").map(Number);
  const grid = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, index) => index * minuteStep);
  // Une heure saisie hors du pas (« 20:07 ») reste choisie plutôt que d'être arrondie en silence.
  const minutes = grid.includes(minute) ? grid : [...grid, minute].sort((a, b) => a - b);
  return (
    <span className="clock-pick" role="group" aria-label={label}>
      <select value={hour} aria-label={`${label}, heures`} onChange={e => onChange(`${pad(Number(e.target.value))}:${pad(minute)}`)}>
        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span aria-hidden="true">h</span>
      <select value={minute} aria-label={`${label}, minutes`} onChange={e => onChange(`${pad(hour)}:${pad(Number(e.target.value))}`)}>
        {minutes.map(m => <option key={m} value={m}>{pad(m)}</option>)}
      </select>
    </span>
  );
}
