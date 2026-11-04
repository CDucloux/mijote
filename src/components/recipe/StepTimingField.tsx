import { Icon } from "../ui/Icon.jsx";
import { stepTiming } from "@/lib/planning/stepTiming.js";
import type { Step } from "@/lib/types.js";

interface StepTimingFieldProps {
  step: Step;
  /** Minutes de découpe de l'étape (cf. `recipeCutMinutes`), s'il y en a. */
  cutMinutes?: number | null;
  onChange: (duration: number | null, activeTime: number | null) => void;
}

const parseMinutes = (raw: string): number | null => raw.trim() === "" ? null : Number(raw);

/**
 * Durée d'une étape dans l'éditeur : le temps total et la part « mains occupées »
 * qui nourrissent le rétro planning. Une durée estimée est montrée telle que le
 * planning la retient (découpe chiffrée, préchauffage réglé sur la température,
 * sinon l'estimation d'import) et signalée jusqu'à ce qu'on la confirme ou la
 * corrige ; sans durée, celle déduite du texte sert d'indication.
 */
export function StepTimingField({ step, cutMinutes, onChange }: StepTimingFieldProps) {
  const hasDuration = typeof step.duration === "number";
  const planned = !hasDuration || step.durationEstimated ? stepTiming(step, cutMinutes) : null;
  // Estimée : les champs portent la valeur du planning, et « confirmer » la fige.
  const shown = step.durationEstimated ? planned : null;
  const read = hasDuration ? null : planned;
  const duration = shown?.minutes ?? step.duration ?? null;
  const activeTime = shown?.active ?? step.activeTime ?? null;
  return (
    <div className="step-timing" data-estimated={step.durationEstimated ? "1" : undefined}>
      <Icon name="clock" size={14} color="var(--text3)" />
      <label className="step-timing__field">
        <input className="step-timing__input" type="number" inputMode="numeric" min={1} max={2880}
          aria-label="Durée de l'étape, en minutes" placeholder={read ? String(read.minutes) : "-"}
          value={duration ?? ""} onChange={e => onChange(parseMinutes(e.target.value), activeTime)} />
        min
      </label>
      <span className="step-timing__sep">dont</span>
      <label className="step-timing__field">
        <input className="step-timing__input" type="number" inputMode="numeric" min={0} max={duration ?? undefined}
          aria-label="Minutes les mains occupées" placeholder={read ? String(read.active) : "-"} disabled={!hasDuration}
          value={activeTime ?? ""} onChange={e => onChange(duration, parseMinutes(e.target.value))} />
        min les mains occupées
      </label>
      {step.durationEstimated
        ? <button type="button" className="step-timing__flag" onClick={() => onChange(duration, activeTime)}>Estimée · confirmer</button>
        : read && <span className="step-timing__hint">{read.source === "text" ? "lue dans le texte" : "estimée"}</span>}
    </div>
  );
}
