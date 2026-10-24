import { Icon } from "../ui/Icon.jsx";
import { stepTiming } from "@/lib/planning/stepTiming.js";
import type { Step } from "@/lib/types.js";

interface StepTimingFieldProps {
  step: Step;
  onChange: (duration: number | null, activeTime: number | null) => void;
}

const parseMinutes = (raw: string): number | null => raw.trim() === "" ? null : Number(raw);

/**
 * Durée d'une étape dans l'éditeur : le temps total et la part « mains occupées »
 * qui nourrissent le rétro planning. Une durée estimée à l'import est signalée
 * jusqu'à ce qu'on la confirme ou la corrige ; sans durée, celle lue dans le texte
 * sert d'indication.
 */
export function StepTimingField({ step, onChange }: StepTimingFieldProps) {
  const hasDuration = typeof step.duration === "number";
  const read = hasDuration ? null : stepTiming(step);
  return (
    <div className="step-timing" data-estimated={step.durationEstimated ? "1" : undefined}>
      <Icon name="clock" size={14} color="var(--text3)" />
      <label className="step-timing__field">
        <input className="step-timing__input" type="number" inputMode="numeric" min={1} max={2880}
          aria-label="Durée de l'étape, en minutes" placeholder={read ? String(read.minutes) : "-"}
          value={step.duration ?? ""} onChange={e => onChange(parseMinutes(e.target.value), step.activeTime ?? null)} />
        min
      </label>
      <span className="step-timing__sep">dont</span>
      <label className="step-timing__field">
        <input className="step-timing__input" type="number" inputMode="numeric" min={0} max={step.duration}
          aria-label="Minutes les mains occupées" placeholder={read ? String(read.active) : "-"} disabled={!hasDuration}
          value={step.activeTime ?? ""} onChange={e => onChange(step.duration ?? null, parseMinutes(e.target.value))} />
        min les mains occupées
      </label>
      {step.durationEstimated
        ? <button type="button" className="step-timing__flag" onClick={() => onChange(step.duration ?? null, step.activeTime ?? null)}>Estimée · confirmer</button>
        : read && <span className="step-timing__hint">lue dans le texte</span>}
    </div>
  );
}
