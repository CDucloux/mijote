import { Fragment, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { Icon } from "../ui/Icon.jsx";
import { fmtTime } from "../../lib/format.js";
import {
  scheduleService, clockToTime, timeToClock, clockLabel, dayLabel, scheduleDays, serveReminders,
  timingWarning, stepSummary, reminderMessage, type ScheduledStep,
} from "@/lib/planning/serveSchedule.js";
import { deriveNotifId, ensureTimerNotificationPermission, scheduleTimerNotification } from "@/lib/notifications/localNotifications.js";
import type { Recipe } from "@/lib/types.js";

interface ServeAtSheetProps {
  recipe: Recipe;
  onClose: () => void;
  /** Ouvre l'éditeur pour corriger les durées (absent : pas de raccourci). */
  onEditTimings?: () => void;
}

const TIME_CHOICES = ["12:00", "12:30", "13:00", "19:00", "19:30", "20:00", "20:30", "21:00"];
const DEFAULT_CLOCK = "20:00";
const TICK_MS = 30_000;

/** Tag de durée d'une étape : mains occupées, attente, ou les deux. */
function StepTag({ step }: { step: ScheduledStep }) {
  const wait = step.minutes - step.active;
  return (
    <span className="serve-tags">
      {step.active > 0 && <span className="serve-tag is-hands"><Icon name="utensils" size={11} color="currentColor" />{fmtTime(step.active)} mains</span>}
      {wait > 0 && <span className="serve-tag"><Icon name="clock" size={11} color="currentColor" />{fmtTime(wait)} d'attente</span>}
      {step.source !== "recipe" && <span className="serve-tag is-estimated">estimée</span>}
    </span>
  );
}

/**
 * Feuille « Servir à… » (rétro planning d'une recette) : on choisit l'heure du
 * repas, la feuille répond par l'heure de départ et le déroulé, étapes placées à
 * rebours. Elle dit quand l'horaire repose sur des durées estimées et, dans l'app
 * native, programme les rappels (départ, retours en cuisine après une attente).
 */
export function ServeAtSheet({ recipe, onClose, onEditTimings }: ServeAtSheetProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  const [dayOffset, setDayOffset] = useState(() => ((clockToTime(DEFAULT_CLOCK, 0, Date.now()) ?? 0) <= Date.now() ? 1 : 0));
  const [clock, setClock] = useState(DEFAULT_CLOCK);
  const [remindersSet, setRemindersSet] = useState(false);

  const serveAt = clockToTime(clock, dayOffset, now) ?? now;
  const schedule = useMemo(() => scheduleService(recipe, serveAt, now), [recipe, serveAt, now]);
  const days = scheduleDays(schedule, now);
  const reminders = serveReminders(schedule, now);
  const reminderSteps = new Set(reminders.map(reminder => reminder.stepIndex));
  const warning = timingWarning(schedule.timing);
  const steps = recipe.steps ?? [];
  const multiDay = days.length > 1;
  const span = Math.max(1, schedule.serveAt - schedule.start);
  const native = Capacitor.isNativePlatform();

  const pick = (nextClock: string, nextDay = dayOffset) => { setClock(nextClock); setDayOffset(nextDay); setRemindersSet(false); };
  const serveEarliest = () => {
    if (schedule.earliestServe == null) return;
    const offset = dayLabel(schedule.earliestServe, now) === "Aujourd'hui" ? 0 : 1;
    pick(timeToClock(schedule.earliestServe), offset);
  };
  const activateReminders = async () => {
    if (!(await ensureTimerNotificationPermission())) return;
    await Promise.all(reminders.map(reminder => scheduleTimerNotification({
      notifId: deriveNotifId(`serve-${recipe.id ?? recipe.name}-${reminder.stepIndex}`),
      ...reminderMessage(reminder, recipe.name, steps[reminder.stepIndex]?.text),
      at: new Date(reminder.at),
    })));
    setRemindersSet(true);
  };

  const startsIn = schedule.start - now;
  const verdict = schedule.status === "late" ? (
    <div className="serve-verdict is-late">
      <span className="serve-verdict__k">Il fallait commencer à {clockLabel(schedule.start)}</span>
      <span className="serve-verdict__big">Prêt au plus tôt à {schedule.earliestServe != null && clockLabel(schedule.earliestServe)}</span>
      <span className="serve-verdict__sub">En commençant maintenant, pour {fmtTime(schedule.timing.total)} de recette.</span>
      <button type="button" className="serve-verdict__act" onClick={serveEarliest}>
        Servir à {schedule.earliestServe != null && clockLabel(schedule.earliestServe)}
      </button>
    </div>
  ) : (
    <div className={`serve-verdict${multiDay ? " is-eve" : ""}`}>
      <span className="serve-verdict__k">{multiDay ? "Une partie se prépare à l'avance" : `Pour servir à ${clockLabel(schedule.serveAt)}`}</span>
      <span className="serve-verdict__big">Commence {multiDay || dayOffset ? `${dayLabel(schedule.start, now).toLowerCase()} ` : ""}à {clockLabel(schedule.start)}</span>
      <span className="serve-verdict__sub">
        {startsIn < 60 * 60_000 ? `dans ${fmtTime(Math.max(1, Math.round(startsIn / 60_000)))}` : `dans ${fmtTime(Math.round(startsIn / 60_000 / 5) * 5)}`}
        {" · "}<b>{fmtTime(schedule.timing.total)}</b> en tout, dont <b>{fmtTime(schedule.timing.active)} les mains occupées</b>
      </span>
      {!multiDay && (
        <span className="serve-handbar" aria-hidden="true">
          {schedule.steps.filter(step => step.active > 0).map(step => (
            <i key={step.index} style={{ left: `${(step.start - schedule.start) / span * 100}%`, width: `${Math.max(0.8, step.active * 60_000 / span * 100)}%` }} />
          ))}
        </span>
      )}
    </div>
  );

  return (
    <SwipeableSheet onClose={onClose}>
      <div className="serve-head">
        <span className="serve-head__badge"><Icon name="clock" size={21} color="var(--accent)" /></span>
        <div style={{ minWidth: 0 }}>
          <h3 className="serve-head__title">Servir à…</h3>
          <p className="serve-head__sub">{recipe.name}</p>
        </div>
      </div>

      <div className="serve-days" role="tablist" aria-label="Jour du repas">
        {["Aujourd'hui", "Demain"].map((label, offset) => (
          <button key={label} type="button" role="tab" aria-selected={dayOffset === offset} className={`serve-day${dayOffset === offset ? " on" : ""}`} onClick={() => pick(clock, offset)}>{label}</button>
        ))}
      </div>
      <div className="serve-times">
        {TIME_CHOICES.map(choice => (
          <button key={choice} type="button" className={`serve-time${clock === choice ? " on" : ""}`} onClick={() => pick(choice)}>{choice.replace(":", " h ").replace(" h 00", " h")}</button>
        ))}
        <label className={`serve-time serve-time--custom${TIME_CHOICES.includes(clock) ? "" : " on"}`}>
          <input type="time" value={clock} aria-label="Autre heure" onChange={e => e.target.value && pick(e.target.value)} />
        </label>
      </div>

      {verdict}

      {warning && (
        <div className="serve-warning">
          <Icon name="info" size={15} color="currentColor" />
          <span>{warning}</span>
          {onEditTimings && <button type="button" onClick={onEditTimings}>Corriger</button>}
        </div>
      )}

      <ol className="serve-tl">
        {days.map(day => (
          <Fragment key={day.label}>
            {multiDay && <li className="serve-tl__day">{day.label}</li>}
            {day.steps.map(step => (
              <li key={step.index} className={`serve-tl__row${step.end <= now ? " is-past" : ""}`}>
                <span className="serve-tl__time">{clockLabel(step.start)}</span>
                <span className={`serve-tl__dot${step.active * 2 >= step.minutes ? "" : " is-wait"}`} />
                <span className="serve-tl__body">
                  <span className="serve-tl__what">{stepSummary(steps[step.index]?.text)}</span>
                  <StepTag step={step} />
                  {native && reminderSteps.has(step.index) && <span className="serve-tl__bell"><Icon name="bell" size={11} color="currentColor" />Rappel à {clockLabel(step.start)}</span>}
                </span>
              </li>
            ))}
          </Fragment>
        ))}
        <li className="serve-tl__row is-end">
          <span className="serve-tl__time">{clockLabel(schedule.serveAt)}</span>
          <span className="serve-tl__dot" />
          <span className="serve-tl__body"><span className="serve-tl__what">À table</span></span>
        </li>
      </ol>

      {native && reminders.length > 0 && (
        <button type="button" className="serve-cta ripple" disabled={remindersSet} onClick={activateReminders}>
          <Icon name={remindersSet ? "check" : "bell"} size={16} color="#fff" />
          {remindersSet ? `${reminders.length} rappel${reminders.length > 1 ? "s" : ""} programmé${reminders.length > 1 ? "s" : ""}` : "Activer les rappels"}
        </button>
      )}
    </SwipeableSheet>
  );
}
