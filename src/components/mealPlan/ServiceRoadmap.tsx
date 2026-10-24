import { Fragment } from "react";
import { Icon } from "../ui/Icon.jsx";
import { fmtTime } from "../../lib/format.js";
import { stepSummary, clockLabel } from "@/lib/planning/serveSchedule.js";
import { serviceRoadmap, serviceTaskKey, type ServicePlan, type RoadmapTask } from "@/lib/planning/mealService.js";
import { roleLabel } from "@/lib/planning/composedMeal.js";
import type { Recipe } from "@/lib/types.js";

interface ServiceRoadmapProps {
  plan: ServicePlan;
  now: number;
  recipeOf: (dishId: string) => Pick<Recipe, "steps"> | undefined;
  /** Libellé du plat au-dessus de l'étape (défaut : rôle · nom). */
  dishLabel?: (task: RoadmapTask) => string;
  /** Étapes cochables (session batch) : état et bascule. */
  isChecked?: (task: RoadmapTask) => boolean;
  onToggle?: (task: RoadmapTask) => void;
  /** Dernière ligne (défaut : « à table » à l'heure du premier service). */
  end?: { time: number; label: string };
}

/** Pastilles d'une tâche : mains, attente, four, durée estimée. */
function TaskTags({ task }: { task: RoadmapTask }) {
  const wait = task.minutes - task.active;
  return (
    <span className="serve-tags">
      {task.active > 0 && <span className="serve-tag is-hands"><Icon name="utensils" size={11} color="currentColor" />{fmtTime(task.active)} mains</span>}
      {wait > 0 && (task.oven
        ? <span className="serve-tag is-oven"><Icon name="fire" size={11} color="currentColor" />{task.temperature != null ? `${task.temperature} °C · ` : ""}{fmtTime(wait)}</span>
        : <span className="serve-tag"><Icon name="clock" size={11} color="currentColor" />{fmtTime(wait)} d'attente</span>)}
      {task.source !== "recipe" && <span className="serve-tag is-estimated">estimée</span>}
    </span>
  );
}

/**
 * Feuille de route du service : toutes les étapes de tous les plats, heure par
 * heure. Chaque créneau dit l'écart avec le précédent ; les étapes passées sont
 * barrées.
 */
export function ServiceRoadmap({ plan, now, recipeOf, dishLabel, isChecked, onToggle, end }: ServiceRoadmapProps) {
  const slots: { time: number; tasks: RoadmapTask[] }[] = [];
  for (const task of serviceRoadmap(plan)) {
    const last = slots[slots.length - 1];
    if (last?.time === task.start) last.tasks.push(task);
    else slots.push({ time: task.start, tasks: [task] });
  }
  const nowIndex = slots.findIndex(slot => slot.time > now);
  return (
    <div className="svc-road">
      {slots.map((slot, index) => (
        <Fragment key={slot.time}>
        {index === nowIndex && index > 0 && <div className="svc-road__now">Il est {clockLabel(now)}</div>}
        <section className={`svc-road__slot${slot.tasks.every(task => task.end <= now) ? " is-past" : ""}`}>
          <header className="svc-road__head">
            <span className="svc-road__time">{clockLabel(slot.time)}</span>
            <span className="svc-road__gap">{index ? `+${fmtTime(Math.round((slot.time - slots[index - 1].time) / 60_000))}` : "c'est parti"}</span>
          </header>
          {slot.tasks.map(task => {
            const checked = isChecked?.(task) ?? false;
            const kind = task.oven ? "is-oven" : task.active * 2 >= task.minutes ? "is-hands" : "is-wait";
            const body = (
              <>
              <span className="svc-road__rail" />
              <span className="svc-road__body">
                <span className="svc-road__dish">{dishLabel ? dishLabel(task) : `${roleLabel(task.role)} · ${task.dishName}`}</span>
                <span className="svc-road__what">{stepSummary(recipeOf(task.dishId)?.steps?.[task.stepIndex]?.text)}</span>
                <TaskTags task={task} />
              </span>
              </>
            );
            return onToggle
              ? <button key={serviceTaskKey(task)} type="button" aria-pressed={checked} className={`svc-road__task is-checkable ${kind}${checked ? " is-checked" : ""}`} onClick={() => onToggle(task)}>{body}</button>
              : <div key={serviceTaskKey(task)} className={`svc-road__task ${kind}`}>{body}</div>;
          })}
        </section>
        </Fragment>
      ))}
      <section className="svc-road__slot is-end">
        <header className="svc-road__head"><span className="svc-road__time">{clockLabel(end?.time ?? plan.dishes[0]?.serveAt ?? plan.end)}</span><span className="svc-road__gap">{end?.label ?? "à table"}</span></header>
      </section>
    </div>
  );
}
