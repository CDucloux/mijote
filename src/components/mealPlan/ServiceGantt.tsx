import { useState, type CSSProperties } from "react";
import { stepSummary, clockLabel } from "@/lib/planning/serveSchedule.js";
import { roleLabel } from "@/lib/planning/composedMeal.js";
import { ServiceStepModal, type StepReferences } from "./ServiceStepModal.jsx";
import { useIsDesktop } from "../../hooks/useIsDesktop.js";
import { Icon } from "../ui/Icon.jsx";
import { techniqueVisual } from "@/lib/recipes/techniqueDisplay.js";
import type { StepPhase } from "@/lib/planning/stepEstimate.js";
import type { ServiceDish, ServicePlan, ServiceTask } from "@/lib/planning/mealService.js";
import type { Recipe } from "@/lib/types.js";

/** Largeur maximale de la frise : au-delà, le début (préparations d'avance) est rogné. */
const MAX_WINDOW_MS = 6 * 60 * 60_000;
const MINUTE = 60_000;

interface ServiceGanttProps {
  plan: ServicePlan;
  recipeOf: (dishId: string) => Pick<Recipe, "steps" | "ingredients" | "utensils"> | undefined;
  /** Sous-titre d'un plat (défaut : « prêt à … »). */
  dishCaption?: (dish: ServicePlan["dishes"][number]) => string;
  /** Instant présent (ms) : repère « maintenant » quand il tombe dans la frise. */
  now?: number;
  /** Bases de référence de l'étape ouverte (vignettes, réglages d'appareils). */
  references?: StepReferences;
  /** Étapes cochables (session batch) : état et bascule. */
  isChecked?: (task: ServiceTask) => boolean;
  onToggle?: (task: ServiceTask) => void;
}

/** Libellé de chaque nature d'étape ; icône et couleur sont celles de la catégorie de geste du même nom. */
const PHASES: readonly { phase: StepPhase; label: string }[] = [
  { phase: "decoupe", label: "Découpe" },
  { phase: "cuisson", label: "Cuisson, four ou feu" },
  { phase: "preparation", label: "Préparation" },
];
const CUT_COLOR = techniqueVisual("decoupe").color;

/** Hauteur d'une minute dans la frise pivotée (téléphone) : 2 h tiennent sur ~290 px. */
const PX_PER_MINUTE = 2.4;
/** En dessous, une barre pivotée n'a pas la place d'un libellé lisible. */
const MIN_LABEL_PX = 20;

/**
 * Frise du service : une piste par plat, alignée sur l'heure de service. À
 * l'horizontale sur grand écran (une ligne par plat), pivotée sur téléphone (une
 * colonne par plat, le temps qui descend) pour garder des barres lisibles sans
 * défilement latéral. Chaque barre dit la nature de l'étape (découpe, cuisson au
 * four ou au feu, autre), la découpe en tête quand l'étape enchaîne taille et
 * cuisson ; un tap ouvre l'étape comme dans le mode cuisine (et la coche, dans la
 * session batch : une étape faite s'efface). Les créneaux qu'un plat a dû céder au
 * four sont hachurés à leur place d'origine.
 */
export function ServiceGantt({ plan, recipeOf, dishCaption, now, references, isChecked, onToggle }: ServiceGanttProps) {
  const vertical = !useIsDesktop();
  const [open, setOpen] = useState<{ dishId: string; stepIndex: number } | null>(null);
  const windowStart = Math.max(plan.start, plan.end - MAX_WINDOW_MS);
  const span = Math.max(1, plan.end - windowStart);
  // Position et longueur en % de la fenêtre, portées par `--at` / `--len` : le CSS
  // les pose en left/width ou en top/height selon l'orientation.
  const at = (time: number): string => `${Math.max(0, (time - windowStart) / span * 100)}%`;
  const len = (start: number, end: number): string => `${(Math.min(end, plan.end) - Math.max(start, windowStart)) / span * 100}%`;
  const major = span > 4 * 60 * MINUTE ? 60 * MINUTE : 30 * MINUTE;
  const minor = span > 3 * 60 * MINUTE ? major : 15 * MINUTE;
  const ticks: number[] = [];
  for (let tick = Math.ceil(windowStart / minor) * minor; tick <= plan.end; tick += minor) ticks.push(tick);
  const grid = ticks.map(tick => <span key={tick} className={`svc-g__grid${tick % major ? " is-minor" : ""}`} style={{ "--at": at(tick) } as CSSProperties} />);
  const moved = new Map(plan.ovenConflicts.map(conflict => [`${conflict.dishId}:${conflict.stepIndex}`, conflict.shift]));
  const showNow = now != null && now > windowStart && now < plan.end;
  const openDish = open ? plan.dishes.find(dish => dish.id === open.dishId) : undefined;
  const openTask = openDish?.tasks.find(task => task.stepIndex === open?.stepIndex);
  const trackHeight = Math.max(280, span / MINUTE * PX_PER_MINUTE);

  const axis = (
    <span className="svc-g__axis">
      {ticks.filter(tick => tick % major === 0).map(tick => <span key={tick} style={{ "--at": at(tick) } as CSSProperties}>{clockLabel(tick)}</span>)}
      {showNow && <span className="svc-g__now-k" style={{ "--at": at(now) } as CSSProperties}>maintenant</span>}
    </span>
  );
  const label = (dish: ServiceDish) => (
    <span key={dish.id} className="svc-g__label">
      {!dishCaption && <span className="svc-g__role">{roleLabel(dish.role)}</span>}
      <span className="svc-g__name" title={dish.name}>{dish.name}</span>
      <span className="svc-g__serve">{dish.start < windowStart ? `dès ${clockLabel(dish.start)} · ` : ""}{dishCaption ? dishCaption(dish) : `prêt à ${clockLabel(dish.end)}`}</span>
    </span>
  );
  const track = (dish: ServiceDish) => (
    <span key={dish.id} className="svc-g__track">
      {grid}
      {dish.tasks.map(task => {
        const shift = moved.get(`${dish.id}:${task.stepIndex}`);
        return shift ? <span key={`m${task.stepIndex}`} className="svc-g__moved" title="Créneau d'origine, four occupé"
          style={{ "--at": at(task.start + shift * MINUTE), "--len": len(task.start + shift * MINUTE, task.end + shift * MINUTE) } as CSSProperties} /> : null;
      })}
      {dish.tasks.filter(task => task.end > windowStart).map(task => {
        const summary = stepSummary(recipeOf(dish.id)?.steps?.[task.stepIndex]?.text);
        const text = task.oven && task.temperature != null ? `${task.temperature} °C · ${summary}` : summary;
        const cut = task.minutes > 0 ? Math.min(100, task.cut / task.minutes * 100) : 0;
        const visual = techniqueVisual(task.phase);
        const tiny = vertical && (Math.min(task.end, plan.end) - Math.max(task.start, windowStart)) / MINUTE * PX_PER_MINUTE < MIN_LABEL_PX;
        return (
          <button key={task.stepIndex} type="button" className={`svc-g__bar is-${task.phase}${isChecked?.(task) ? " is-done" : ""}${tiny ? " is-tiny" : ""}`}
            style={{ "--at": at(task.start), "--len": len(task.start, task.end), "--cut": `${cut}%`, "--phase-fill": visual.color, "--cut-fill": CUT_COLOR } as CSSProperties}
            title={`${clockLabel(task.start)} à ${clockLabel(task.end)} · ${summary}`} aria-label={`Étape ${task.stepIndex + 1} de ${dish.name} : ${summary}`}
            onClick={() => setOpen({ dishId: dish.id, stepIndex: task.stepIndex })}>
            <span className="svc-g__lbl"><Icon name={visual.icon} size={12} color="currentColor" /><span>{text}</span></span>
          </button>
        );
      })}
      <span className="svc-g__serveline" style={{ "--at": at(dish.serveAt) } as CSSProperties} />
      {showNow && <span className="svc-g__now" style={{ "--at": at(now) } as CSSProperties} />}
    </span>
  );

  return (
    <div className={`svc-g${vertical ? " is-vertical" : ""}`}>
      {vertical ? (
        <div className="svc-g__inner" style={{ "--cols": plan.dishes.length } as CSSProperties}>
          <div className="svc-g__head"><span />{plan.dishes.map(label)}</div>
          <div className="svc-g__body" style={{ height: trackHeight }}>{axis}{plan.dishes.map(track)}</div>
        </div>
      ) : (
        <div className="svc-g__inner">
          <div className="svc-g__row svc-g__row--axis"><span />{axis}</div>
          {plan.dishes.map(dish => <div key={dish.id} className="svc-g__row">{label(dish)}{track(dish)}</div>)}
        </div>
      )}
      <div className="svc-g__legend">
        {PHASES.map(entry => (
          <span key={entry.phase} className="svc-g__key" style={{ "--c": techniqueVisual(entry.phase).color } as CSSProperties}>
            <i><Icon name={techniqueVisual(entry.phase).icon} size={11} color="currentColor" /></i>{entry.label}
          </span>
        ))}
        {plan.ovenConflicts.length > 0 && <span><i className="is-moved" />Créneau cédé au four</span>}
        <span className="svc-g__hint">Touche une étape pour l'ouvrir</span>
      </div>
      {open && openDish && openTask && (
        <ServiceStepModal dishName={openDish.name} recipe={recipeOf(openDish.id)} tasks={openDish.tasks} stepIndex={open.stepIndex} references={references}
          onNavigate={stepIndex => setOpen({ dishId: openDish.id, stepIndex })} onClose={() => setOpen(null)}
          checked={isChecked?.(openTask)} onToggle={onToggle && (() => onToggle(openTask))} />
      )}
    </div>
  );
}
