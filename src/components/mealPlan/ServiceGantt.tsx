import { stepSummary, clockLabel } from "@/lib/planning/serveSchedule.js";
import { ovenSpans, type ServicePlan, type ServiceTask } from "@/lib/planning/mealService.js";
import { roleLabel } from "@/lib/planning/composedMeal.js";
import type { Recipe } from "@/lib/types.js";

/** Largeur maximale de la frise : au-delà, le début (préparations d'avance) est rogné. */
const MAX_WINDOW_MS = 6 * 60 * 60_000;

interface ServiceGanttProps {
  plan: ServicePlan;
  recipeOf: (dishId: string) => Pick<Recipe, "steps"> | undefined;
}

const taskKind = (task: ServiceTask): string => task.oven ? "is-oven" : task.active * 2 >= task.minutes ? "is-hands" : "is-wait";

/**
 * Frise du service : une ligne par plat, alignée sur l'heure de service, puis deux
 * lignes de ressources (le four et ses températures, les mains). Les créneaux
 * qu'un plat a dû céder au four sont hachurés à leur place d'origine.
 */
export function ServiceGantt({ plan, recipeOf }: ServiceGanttProps) {
  const windowStart = Math.max(plan.start, plan.end - MAX_WINDOW_MS);
  const span = Math.max(1, plan.end - windowStart);
  const pos = (time: number): string => `${Math.max(0, (time - windowStart) / span * 100)}%`;
  const width = (start: number, end: number): string => `${Math.max(0.6, (Math.min(end, plan.end) - Math.max(start, windowStart)) / span * 100)}%`;
  const tickStep = span > 4 * 60 * 60_000 ? 60 * 60_000 : 30 * 60_000;
  const ticks: number[] = [];
  for (let tick = Math.ceil(windowStart / tickStep) * tickStep; tick <= plan.end; tick += tickStep) ticks.push(tick);
  const grid = ticks.map(tick => <span key={tick} className="svc-g__grid" style={{ left: pos(tick) }} />);
  const moved = new Map(plan.ovenConflicts.map(conflict => [`${conflict.dishId}:${conflict.stepIndex}`, conflict.shift]));

  return (
    <div className="svc-g">
      <div className="svc-g__inner">
        <div className="svc-g__row svc-g__row--axis">
          <span />
          <span className="svc-g__axis">{ticks.map(tick => <span key={tick} style={{ left: pos(tick) }}>{clockLabel(tick)}</span>)}</span>
        </div>
        {plan.dishes.map(dish => (
          <div key={dish.id} className="svc-g__row">
            <span className="svc-g__label">
              <span className="svc-g__role">{roleLabel(dish.role)}</span>
              <span className="svc-g__name">{dish.name}</span>
              <span className="svc-g__serve">{dish.start < windowStart ? `dès ${clockLabel(dish.start)} · ` : ""}servi à {clockLabel(dish.serveAt)}</span>
            </span>
            <span className="svc-g__track">
              {grid}
              {dish.tasks.map(task => {
                const shift = moved.get(`${dish.id}:${task.stepIndex}`);
                return shift ? <span key={`m${task.stepIndex}`} className="svc-g__moved" title="Créneau d'origine, four occupé"
                  style={{ left: pos(task.start + shift * 60_000), width: width(task.start + shift * 60_000, task.end + shift * 60_000) }} /> : null;
              })}
              {dish.tasks.filter(task => task.end > windowStart).map(task => (
                <span key={task.stepIndex} className={`svc-g__bar ${taskKind(task)}`} style={{ left: pos(task.start), width: width(task.start, task.end) }}
                  title={`${clockLabel(task.start)} à ${clockLabel(task.end)} · ${stepSummary(recipeOf(dish.id)?.steps?.[task.stepIndex]?.text)}`}>
                  {task.oven && task.temperature != null ? `${task.temperature} °C` : stepSummary(recipeOf(dish.id)?.steps?.[task.stepIndex]?.text, 28)}
                </span>
              ))}
              <span className="svc-g__serveline" style={{ left: pos(dish.serveAt) }} />
            </span>
          </div>
        ))}
        <div className="svc-g__row svc-g__row--res">
          <span className="svc-g__label"><span className="svc-g__role">Ressource</span><span className="svc-g__name">Four</span></span>
          <span className="svc-g__track">
            {grid}
            {ovenSpans(plan).filter(oven => oven.end > windowStart).map(oven => (
              <span key={oven.start} className="svc-g__bar is-oven" style={{ left: pos(oven.start), width: width(oven.start, oven.end) }}>
                {oven.temperature != null ? `${oven.temperature} °C` : "Four"}
              </span>
            ))}
          </span>
        </div>
        <div className="svc-g__row svc-g__row--res">
          <span className="svc-g__label"><span className="svc-g__role">Ressource</span><span className="svc-g__name">Tes mains</span></span>
          <span className="svc-g__track">
            {grid}
            {plan.dishes.flatMap(dish => dish.tasks.filter(task => task.active > 0 && task.end > windowStart).map(task => (
              <span key={`${dish.id}${task.stepIndex}`} className="svc-g__bar is-hands" style={{ left: pos(task.start), width: width(task.start, task.start + task.active * 60_000) }} />
            )))}
          </span>
        </div>
      </div>
      <div className="svc-g__legend">
        <span><i className="is-hands" />Mains occupées</span>
        <span><i className="is-wait" />Attente, tu es libre</span>
        <span><i className="is-oven" />Au four</span>
        {plan.ovenConflicts.length > 0 && <span><i className="is-moved" />Créneau cédé au four</span>}
      </div>
    </div>
  );
}
