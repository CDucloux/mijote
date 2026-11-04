import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Icon } from "../ui/Icon.jsx";
import { fmtTime } from "../../lib/format.js";
import { clockLabel, dayLabel, timeToClock, reminderMessage } from "@/lib/planning/serveSchedule.js";
import {
  planMealService, dateAtClock, ovenConflictMessage, holdAdvice, serviceReminders, DEFAULT_SERVE_CLOCK,
  type ServiceDishInput,
} from "@/lib/planning/mealService.js";
import type { RoleId } from "@/lib/planning/composedMeal.js";
import { deriveNotifId, ensureTimerNotificationPermission, scheduleTimerNotification } from "@/lib/notifications/localNotifications.js";
import { SLOT_BY_ID } from "../../constants/mealSlots.js";
import { ServiceGantt } from "./ServiceGantt.jsx";
import { ClockPicker } from "../ui/ClockPicker.jsx";
import type { StepReferences } from "./ServiceStepModal.jsx";
import type { Recipe } from "@/lib/types.js";
import "../../styles/service.css";

/** Plat du repas à organiser : la recette et son rôle dans le repas. */
export interface ServiceMealDish {
  recipe: Recipe;
  role: RoleId;
}

interface ServicePlanViewProps {
  /** Jour du repas, `YYYY-MM-DD`. */
  date: string;
  /** Créneau du planning (`midi`, `soir`…). */
  slot: string;
  dishes: ServiceMealDish[];
  /** Bases de référence pour illustrer une étape ouverte depuis la frise. */
  references?: StepReferences;
  onClose: () => void;
}

const TIME_CHOICES: Record<string, string[]> = {
  matin: ["08:00", "08:30", "09:00", "09:30"],
  midi: ["12:00", "12:30", "13:00", "13:30"],
  soir: ["19:00", "19:30", "20:00", "20:30", "21:00"],
};
const TICK_MS = 30_000;

/**
 * Panneau plein écran « Organiser le service » d'un repas du planning : heure de
 * service, plats placés à rebours en partageant le four et les mains, en frise
 * (chaque étape s'ouvre au tap). Tout le repas est prêt à l'heure choisie ; les
 * conflits de four résolus et les plats à garder au chaud sont expliqués.
 */
export function ServicePlanView({ date, slot, dishes, references, onClose }: ServicePlanViewProps) {
  const [clock, setClock] = useState(DEFAULT_SERVE_CLOCK[slot] ?? "20:00");
  const [remindersSet, setRemindersSet] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const inputs = useMemo<ServiceDishInput[]>(() => dishes.map((dish, index) => {
    const id = `${dish.recipe.id ?? "r"}-${index}`;
    return { id, name: dish.recipe.name || "Sans nom", role: dish.role, recipe: dish.recipe };
  }), [dishes]);
  const recipes = useMemo(() => new Map(inputs.map((input, index) => [input.id, dishes[index].recipe])), [inputs, dishes]);
  const recipeOf = (dishId: string) => recipes.get(dishId);
  const serveAt = dateAtClock(date, clock) ?? now;
  const plan = useMemo(() => planMealService(inputs, { serveAt, now }), [inputs, serveAt, now]);
  const nameOf = (dishId: string) => plan.dishes.find(dish => dish.id === dishId)?.name ?? "";
  const reminders = serviceReminders(plan, now);
  const estimated = plan.dishes.filter(dish => dish.timing.quality !== "reliable").map(dish => dish.name);
  const holds = plan.dishes.map(holdAdvice).filter((advice): advice is string => !!advice);
  const native = Capacitor.isNativePlatform();

  const reset = () => setRemindersSet(false);
  const activateReminders = async () => {
    if (!(await ensureTimerNotificationPermission())) return;
    await Promise.all(reminders.map(reminder => scheduleTimerNotification({
      notifId: deriveNotifId(`service-${date}-${slot}-${reminder.dishId}-${reminder.stepIndex}`),
      ...reminderMessage(reminder, nameOf(reminder.dishId), recipeOf(reminder.dishId)?.steps?.[reminder.stepIndex]?.text),
      at: new Date(reminder.at),
    })));
    setRemindersSet(true);
  };

  // Jour du départ vu depuis le jour du repas : rien le jour même, « La veille » sinon.
  const startDay = dayLabel(plan.start, serveAt);
  const startPrefix = startDay === "Aujourd'hui" ? "" : startDay === "Hier" ? "La veille, " : `${startDay}, `;
  const meta = SLOT_BY_ID[slot];
  return (
    <div className="svc">
      <header className="svc-top">
        <button type="button" className="cook-close-btn svc-top__back" aria-label="Retour" onClick={onClose}><Icon name="back" size={16} /></button>
        <div style={{ minWidth: 0 }}>
          <span className="svc-top__k">{dayLabel(serveAt, now)} · {meta?.meal ?? "Repas"}</span>
          <h2 className="svc-top__title">Organiser le service</h2>
        </div>
      </header>

      <div className="svc-body">
        <div className="svc-col">
          <div className="svc-controls">
            <span className="svc-controls__label">À table à</span>
            <div className="serve-times">
              {(TIME_CHOICES[slot] ?? TIME_CHOICES.soir).map(choice => (
                <button key={choice} type="button" className={`serve-time${clock === choice ? " on" : ""}`} onClick={() => { setClock(choice); reset(); }}>{clockLabel(dateAtClock(date, choice) ?? now)}</button>
              ))}
              <label className={`serve-time serve-time--custom${(TIME_CHOICES[slot] ?? TIME_CHOICES.soir).includes(clock) ? "" : " on"}`}>
                <ClockPicker value={clock} label="Autre heure" onChange={value => { setClock(value); reset(); }} />
              </label>
            </div>
          </div>

          <div className="svc-stats">
            <div className="svc-stat"><b>{startPrefix}{clockLabel(plan.start)}</b><span>Début</span></div>
            <div className="svc-stat"><b>{fmtTime(plan.active)}</b><span>Mains occupées</span></div>
            {plan.ovenConflicts.length > 0 && <div className="svc-stat is-warn"><b>{plan.ovenConflicts.length}</b><span>Conflit{plan.ovenConflicts.length > 1 ? "s" : ""} de four résolu{plan.ovenConflicts.length > 1 ? "s" : ""}</span></div>}
          </div>

          {plan.lateBy > 0 && (
            <div className="svc-note is-late">
              <Icon name="clock" size={16} color="currentColor" />
              <span><b>Il fallait commencer à {clockLabel(plan.start)}.</b> En partant maintenant, tout est prêt {fmtTime(plan.lateBy)} plus tard.</span>
              <button type="button" onClick={() => { setClock(timeToClock(serveAt + plan.lateBy * 60_000)); reset(); }}>Décaler le service</button>
            </div>
          )}
          {plan.ovenConflicts.map(conflict => {
            const message = ovenConflictMessage(conflict, nameOf);
            return (
              <div key={`${conflict.dishId}${conflict.stepIndex}`} className="svc-note">
                <Icon name="swap" size={16} color="currentColor" />
                <span><b>{message.title}</b> {message.body}</span>
              </div>
            );
          })}
          {holds.map(advice => <div key={advice} className="svc-note"><Icon name="fire" size={16} color="currentColor" /><span>{advice}</span></div>)}
          {estimated.length > 0 && (
            <div className="svc-note is-soft">
              <Icon name="info" size={16} color="currentColor" />
              <span>Durées estimées pour {estimated.join(", ")} : l'horaire peut bouger. Corrige-les dans l'éditeur de recette.</span>
            </div>
          )}
        </div>

        <div className="svc-wide">
          <ServiceGantt plan={plan} recipeOf={recipeOf} now={now} references={references} />
        </div>
      </div>

      {native && reminders.length > 0 && (
        <div className="svc-foot">
          <button type="button" className="serve-cta ripple" disabled={remindersSet} onClick={activateReminders}>
            <Icon name={remindersSet ? "check" : "bell"} size={16} color="#fff" />
            {remindersSet ? `${reminders.length} rappel${reminders.length > 1 ? "s" : ""} programmé${reminders.length > 1 ? "s" : ""}` : "Activer les rappels"}
          </button>
        </div>
      )}
    </div>
  );
}
