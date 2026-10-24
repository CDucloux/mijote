import { Icon } from "../ui/Icon.jsx";
import { fmtTime } from "../../lib/format.js";
import { stepSummary, clockLabel } from "@/lib/planning/serveSchedule.js";
import { serviceRoadmap, type ServicePlan, type RoadmapTask } from "@/lib/planning/mealService.js";
import { roleLabel } from "@/lib/planning/composedMeal.js";
import type { Recipe } from "@/lib/types.js";

interface ServiceRoadmapProps {
  plan: ServicePlan;
  now: number;
  recipeOf: (dishId: string) => Pick<Recipe, "steps"> | undefined;
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
export function ServiceRoadmap({ plan, now, recipeOf }: ServiceRoadmapProps) {
  const slots: { time: number; tasks: RoadmapTask[] }[] = [];
  for (const task of serviceRoadmap(plan)) {
    const last = slots[slots.length - 1];
    if (last?.time === task.start) last.tasks.push(task);
    else slots.push({ time: task.start, tasks: [task] });
  }
  return (
    <div className="svc-road">
      {slots.map((slot, index) => (
        <section key={slot.time} className={`svc-road__slot${slot.tasks.every(task => task.end <= now) ? " is-past" : ""}`}>
          <header className="svc-road__head">
            <span className="svc-road__time">{clockLabel(slot.time)}</span>
            <span className="svc-road__gap">{index ? `+${fmtTime(Math.round((slot.time - slots[index - 1].time) / 60_000))}` : "c'est parti"}</span>
          </header>
          {slot.tasks.map(task => (
            <div key={`${task.dishId}${task.stepIndex}`} className={`svc-road__task ${task.oven ? "is-oven" : task.active * 2 >= task.minutes ? "is-hands" : "is-wait"}`}>
              <span className="svc-road__rail" />
              <span className="svc-road__body">
                <span className="svc-road__dish">{roleLabel(task.role)} · {task.dishName}</span>
                <span className="svc-road__what">{stepSummary(recipeOf(task.dishId)?.steps?.[task.stepIndex]?.text)}</span>
                <TaskTags task={task} />
              </span>
            </div>
          ))}
        </section>
      ))}
      <section className="svc-road__slot is-end">
        <header className="svc-road__head"><span className="svc-road__time">{clockLabel(plan.dishes[0]?.serveAt ?? plan.end)}</span><span className="svc-road__gap">à table</span></header>
      </section>
    </div>
  );
}
