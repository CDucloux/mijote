import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Icon } from "../ui/Icon.jsx";
import { fmtTime } from "../../lib/format.js";
import { useIsDesktop } from "../../hooks/useIsDesktop.js";
import { clockLabel, dayLabel, timeToClock, reminderMessage } from "@/lib/planning/serveSchedule.js";
import {
  planMealService, dateAtClock, ovenConflictMessage, holdAdvice, serviceReminders, DEFAULT_SERVE_CLOCK, DEFAULT_ROLE_OFFSETS,
  type ServiceDishInput,
} from "@/lib/planning/mealService.js";
import { roleLabel, type RoleId } from "@/lib/planning/composedMeal.js";
import { deriveNotifId, ensureTimerNotificationPermission, scheduleTimerNotification } from "@/lib/notifications/localNotifications.js";
import { SLOT_BY_ID } from "../../constants/mealSlots.js";
import { ServiceGantt } from "./ServiceGantt.jsx";
import { ServiceRoadmap } from "./ServiceRoadmap.jsx";
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
  onClose: () => void;
}

const TIME_CHOICES: Record<string, string[]> = {
  matin: ["08:00", "08:30", "09:00", "09:30"],
  midi: ["12:00", "12:30", "13:00", "13:30"],
  soir: ["19:00", "19:30", "20:00", "20:30", "21:00"],
};
const OFFSET_STEP = 15;
const TICK_MS = 30_000;

/**
 * Panneau plein écran « Organiser le service » d'un repas du planning : heure de
 * service, plats placés à rebours en partageant le four et les mains, en frise
 * (ordinateur) ou en feuille de route (téléphone). Les heures de service par plat
 * se règlent au quart d'heure ; les conflits de four résolus et les plats à garder
 * au chaud sont expliqués.
 */
export function ServicePlanView({ date, slot, dishes, onClose }: ServicePlanViewProps) {
  const isDesktop = useIsDesktop();
  const [view, setView] = useState<"roadmap" | "frise">(isDesktop ? "frise" : "roadmap");
  const [clock, setClock] = useState(DEFAULT_SERVE_CLOCK[slot] ?? "20:00");
  const [cooks, setCooks] = useState(1);
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const [remindersSet, setRemindersSet] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const inputs = useMemo<ServiceDishInput[]>(() => dishes.map((dish, index) => {
    const id = `${dish.recipe.id ?? "r"}-${index}`;
    return { id, name: dish.recipe.name || "Sans nom", role: dish.role, recipe: dish.recipe, offset: offsets[id] };
  }), [dishes, offsets]);
  const recipes = useMemo(() => new Map(inputs.map((input, index) => [input.id, dishes[index].recipe])), [inputs, dishes]);
  const recipeOf = (dishId: string) => recipes.get(dishId);
  const serveAt = dateAtClock(date, clock) ?? now;
  const plan = useMemo(() => planMealService(inputs, { serveAt, cooks, now }), [inputs, serveAt, cooks, now]);
  const nameOf = (dishId: string) => plan.dishes.find(dish => dish.id === dishId)?.name ?? "";
  const reminders = serviceReminders(plan, now);
  const estimated = plan.dishes.filter(dish => dish.timing.quality !== "reliable").map(dish => dish.name);
  const holds = plan.dishes.map(holdAdvice).filter((advice): advice is string => !!advice);
  const native = Capacitor.isNativePlatform();

  const reset = () => setRemindersSet(false);
  const shiftDish = (dishId: string, role: RoleId, delta: number) => {
    setOffsets(prev => ({ ...prev, [dishId]: Math.max(-60, (prev[dishId] ?? DEFAULT_ROLE_OFFSETS[role]) + delta) }));
    reset();
  };
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
                <input type="time" value={clock} aria-label="Autre heure" onChange={e => { if (e.target.value) { setClock(e.target.value); reset(); } }} />
              </label>
            </div>
            <div className="serve-days" role="group" aria-label="Cuisiniers">
              {[1, 2].map(count => (
                <button key={count} type="button" className={`serve-day${cooks === count ? " on" : ""}`} onClick={() => { setCooks(count); reset(); }}>
                  {count === 1 ? "Seul en cuisine" : "À deux"}
                </button>
              ))}
            </div>
          </div>

          <div className="svc-stats">
            <div className="svc-stat"><b>{startPrefix}{clockLabel(plan.start)}</b><span>Début</span></div>
            <div className="svc-stat"><b>{fmtTime(plan.active)}</b><span>Mains occupées</span></div>
            {plan.ovenConflicts.length > 0 && <div className="svc-stat is-warn"><b>{plan.ovenConflicts.length}</b><span>Conflit{plan.ovenConflicts.length > 1 ? "s" : ""} de four résolu{plan.ovenConflicts.length > 1 ? "s" : ""}</span></div>}
          </div>

          <div className="svc-dishes">
            {plan.dishes.map(dish => (
              <div key={dish.id} className="svc-dish">
                <span className="svc-dish__role">{roleLabel(dish.role)}</span>
                <span className="svc-dish__name">{dish.name}</span>
                <span className="svc-dish__serve">
                  <button type="button" aria-label="Servir plus tôt" onClick={() => shiftDish(dish.id, dish.role, -OFFSET_STEP)}><Icon name="chevronDown" size={12} /></button>
                  {clockLabel(dish.serveAt)}
                  <button type="button" aria-label="Servir plus tard" onClick={() => shiftDish(dish.id, dish.role, OFFSET_STEP)}><Icon name="chevronUp" size={12} /></button>
                </span>
              </div>
            ))}
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

          <div className="serve-days svc-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={view === "roadmap"} className={`serve-day${view === "roadmap" ? " on" : ""}`} onClick={() => setView("roadmap")}>Feuille de route</button>
            <button type="button" role="tab" aria-selected={view === "frise"} className={`serve-day${view === "frise" ? " on" : ""}`} onClick={() => setView("frise")}>Frise</button>
          </div>
        </div>

        <div className={view === "frise" ? "svc-wide" : "svc-col"}>
          {view === "frise" ? <ServiceGantt plan={plan} recipeOf={recipeOf} /> : <ServiceRoadmap plan={plan} now={now} recipeOf={recipeOf} />}
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
