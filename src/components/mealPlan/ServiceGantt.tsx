import { useState, type CSSProperties } from "react";
import { stepSummary, clockLabel } from "@/lib/planning/serveSchedule.js";
import { roleLabel } from "@/lib/planning/composedMeal.js";
import { ServiceStepSheet } from "./ServiceStepSheet.jsx";
import type { ServicePlan, ServiceTask } from "@/lib/planning/mealService.js";
import type { Recipe } from "@/lib/types.js";

/** Largeur maximale de la frise : au-delà, le début (préparations d'avance) est rogné. */
const MAX_WINDOW_MS = 6 * 60 * 60_000;
const MINUTE = 60_000;

interface ServiceGanttProps {
  plan: ServicePlan;
  recipeOf: (dishId: string) => Pick<Recipe, "steps" | "ingredients" | "utensils"> | undefined;
  /** Sous-titre d'un plat (défaut : « servi à … »). */
  dishCaption?: (dish: ServicePlan["dishes"][number]) => string;
  /** Instant présent (ms) : repère « maintenant » quand il tombe dans la frise. */
  now?: number;
  /** Étapes cochables (session batch) : état et bascule. */
  isChecked?: (task: ServiceTask) => boolean;
  onToggle?: (task: ServiceTask) => void;
}


/**
 * Frise du service : une ligne par plat, alignée sur l'heure de service. Chaque
 * barre montre en plein la part « mains occupées » (en tête d'étape) puis l'attente ;
 * un tap ouvre l'étape comme dans le mode cuisine (et la coche, dans la session
 * batch : une étape faite s'efface). Les créneaux qu'un plat a dû
 * céder au four sont hachurés à leur place d'origine.
 */
export function ServiceGantt({ plan, recipeOf, dishCaption, now, isChecked, onToggle }: ServiceGanttProps) {
  const [open, setOpen] = useState<{ dishId: string; stepIndex: number } | null>(null);
  const windowStart = Math.max(plan.start, plan.end - MAX_WINDOW_MS);
  const span = Math.max(1, plan.end - windowStart);
  const pct = (time: number): number => Math.max(0, (time - windowStart) / span * 100);
  const pos = (time: number): string => `${pct(time)}%`;
  // Un liseré de fond sépare deux étapes qui se touchent.
  const width = (start: number, end: number): string => `max(4px, calc(${(Math.min(end, plan.end) - Math.max(start, windowStart)) / span * 100}% - 2px))`;
  const major = span > 4 * 60 * MINUTE ? 60 * MINUTE : 30 * MINUTE;
  const minor = span > 3 * 60 * MINUTE ? major : 15 * MINUTE;
  const ticks: number[] = [];
  for (let tick = Math.ceil(windowStart / minor) * minor; tick <= plan.end; tick += minor) ticks.push(tick);
  const grid = ticks.map(tick => <span key={tick} className={`svc-g__grid${tick % major ? " is-minor" : ""}`} style={{ left: pos(tick) }} />);
  const moved = new Map(plan.ovenConflicts.map(conflict => [`${conflict.dishId}:${conflict.stepIndex}`, conflict.shift]));
  const showNow = now != null && now > windowStart && now < plan.end;
  const openDish = open ? plan.dishes.find(dish => dish.id === open.dishId) : undefined;
  const openTask = openDish?.tasks.find(task => task.stepIndex === open?.stepIndex);

  return (
    <div className="svc-g">
      <div className="svc-g__inner">
        <div className="svc-g__row svc-g__row--axis">
          <span />
          <span className="svc-g__axis">
            {ticks.filter(tick => tick % major === 0).map(tick => <span key={tick} style={{ left: pos(tick) }}>{clockLabel(tick)}</span>)}
            {showNow && <span className="svc-g__now-k" style={{ left: pos(now) }}>maintenant</span>}
          </span>
        </div>
        {plan.dishes.map(dish => (
          <div key={dish.id} className="svc-g__row">
            <span className="svc-g__label">
              {!dishCaption && <span className="svc-g__role">{roleLabel(dish.role)}</span>}
              <span className="svc-g__name" title={dish.name}>{dish.name}</span>
              <span className="svc-g__serve">{dish.start < windowStart ? `dès ${clockLabel(dish.start)} · ` : ""}{dishCaption ? dishCaption(dish) : `servi à ${clockLabel(dish.serveAt)}`}</span>
            </span>
            <span className="svc-g__track">
              {grid}
              {dish.tasks.map(task => {
                const shift = moved.get(`${dish.id}:${task.stepIndex}`);
                return shift ? <span key={`m${task.stepIndex}`} className="svc-g__moved" title="Créneau d'origine, four occupé"
                  style={{ left: pos(task.start + shift * MINUTE), width: width(task.start + shift * MINUTE, task.end + shift * MINUTE) }} /> : null;
              })}
              {dish.tasks.filter(task => task.end > windowStart).map(task => {
                const summary = stepSummary(recipeOf(dish.id)?.steps?.[task.stepIndex]?.text);
                const label = task.oven && task.temperature != null ? `${task.temperature} °C` : summary;
                const hands = task.minutes > 0 ? Math.min(100, task.active / task.minutes * 100) : 0;
                const style = { left: pos(task.start), width: width(task.start, task.end), "--hands": `${hands}%` } as CSSProperties;
                return (
                  <button key={task.stepIndex} type="button" className={`svc-g__bar${task.oven ? " is-oven" : ""}${isChecked?.(task) ? " is-done" : ""}`} style={style}
                    title={`${clockLabel(task.start)} à ${clockLabel(task.end)} · ${summary}`} aria-label={`Étape ${task.stepIndex + 1} de ${dish.name} : ${summary}`}
                    onClick={() => setOpen({ dishId: dish.id, stepIndex: task.stepIndex })}>
                    {/* Deux calques du même libellé, découpés à la frontière mains / attente :
                        blanc sur le plein, teinté sur l'attente, lisible des deux côtés. */}
                    <span className="svc-g__lbl"><span>{label}</span></span>
                    <span className="svc-g__lbl is-on" aria-hidden="true"><span>{label}</span></span>
                  </button>
                );
              })}
              <span className="svc-g__serveline" style={{ left: pos(dish.serveAt) }} />
              {showNow && <span className="svc-g__now" style={{ left: pos(now) }} />}
            </span>
          </div>
        ))}
      </div>
      <div className="svc-g__legend">
        <span><i className="is-hands" />Mains occupées</span>
        <span><i className="is-wait" />Attente, tu es libre</span>
        <span><i className="is-oven" />Au four</span>
        {plan.ovenConflicts.length > 0 && <span><i className="is-moved" />Créneau cédé au four</span>}
        <span className="svc-g__hint">Touche une étape pour l'ouvrir</span>
      </div>
      {open && openDish && openTask && (
        <ServiceStepSheet dishName={openDish.name} recipe={recipeOf(openDish.id)} tasks={openDish.tasks} stepIndex={open.stepIndex}
          onNavigate={stepIndex => setOpen({ dishId: openDish.id, stepIndex })} onClose={() => setOpen(null)}
          checked={isChecked?.(openTask)} onToggle={onToggle && (() => onToggle(openTask))} />
      )}
    </div>
  );
}
