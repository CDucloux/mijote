import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Icon } from "../ui/Icon.jsx";
import { fmtTime } from "@/lib/format.js";
import { clockLabel, reminderMessage } from "@/lib/planning/serveSchedule.js";
import { ovenSpans, serviceReminders, serviceTaskKey, type ServicePlan, type RoadmapTask } from "@/lib/planning/mealService.js";
import { addDays, boxLabels, prepKey, shortDayLabel, storeKey, weekdayName, type BatchSettings, type BatchStorage, type PrepStage } from "@/lib/planning/batchPlan.js";
import { deriveNotifId, ensureTimerNotificationPermission, scheduleTimerNotification } from "@/lib/notifications/localNotifications.js";
import { BatchPrepTab } from "./BatchPrepTab.jsx";
import { BatchStoreTab } from "./BatchStoreTab.jsx";
import { ServiceRoadmap } from "./ServiceRoadmap.jsx";
import { ServiceGantt } from "./ServiceGantt.jsx";
import type { Recipe } from "@/lib/types.js";
import "../../styles/service.css";
import "../../styles/batch.css";

interface BatchSessionViewProps {
  weekLabel: string;
  /** Jours de la semaine affichée, `YYYY-MM-DD` (le lundi en premier). */
  weekDays: string[];
  mealOccasions: number;
  prepStages: PrepStage[];
  decoupeByName: Map<string, Set<string>>;
  cookingPlan: ServicePlan;
  storage: BatchStorage;
  /** Ids des bases de la session (libellé « Base » dans la feuille de route). */
  baseIds: Set<string>;
  settings: BatchSettings;
  onSettings: (patch: Partial<BatchSettings>) => void;
  onToggle: (key: string) => void;
  recipeOf: (recipeId: string) => Recipe | undefined;
  onClose: () => void;
}

type Tab = "prep" | "cook" | "store";
const TICK_MS = 30_000;
const THAW_REMINDER_HOUR = 19;

/**
 * Session batch plein écran (route /meal-plan/batch) : on choisit le jour et
 * l'heure, la session répond par l'heure de fin et guide en trois temps.
 * « Préparer » (découpe groupée), « Cuisiner » (feuille de route ou frise, bases
 * d'abord, four partagé), « Ranger » (frigo ou congélateur, jour par jour).
 * L'avancement est gardé pour la semaine.
 */
export function BatchSessionView(props: BatchSessionViewProps) {
  const { weekLabel, weekDays, mealOccasions, prepStages, decoupeByName, cookingPlan: plan, storage, baseIds, settings, onSettings, onToggle, recipeOf, onClose } = props;
  const [tab, setTab] = useState<Tab>("prep");
  const [frise, setFrise] = useState(false);
  const [remindersSet, setRemindersSet] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const checked = new Set(settings.checked);
  const isChecked = (key: string) => checked.has(key);
  const prepKeys = prepStages.flatMap(stage => stage.items.map(prepKey));
  const taskKeys = plan.dishes.flatMap(dish => dish.tasks.map(serviceTaskKey));
  const storeKeys = storage.dishes.map(storeKey);
  const count = (keys: string[]) => keys.filter(isChecked).length;
  const total = prepKeys.length + taskKeys.length + storeKeys.length;
  const done = count(prepKeys) + count(taskKeys) + count(storeKeys);
  const dishCount = plan.dishes.filter(dish => !baseIds.has(dish.id)).length;
  const bases = plan.dishes.length - dishCount;
  const dayChoices = [addDays(weekDays[0] ?? settings.day, -1), ...weekDays];
  const native = Capacitor.isNativePlatform();

  const cookReminders = serviceReminders(plan, now);
  const thaws = storage.dishes.flatMap(dish => dish.meals.flatMap(meal => meal.thawOn ? [{ dish, meal }] : []));
  const activateReminders = async () => {
    if (!(await ensureTimerNotificationPermission())) return;
    const nameOf = (id: string) => plan.dishes.find(dish => dish.id === id)?.name;
    await Promise.all([
      ...cookReminders.map(reminder => scheduleTimerNotification({
        notifId: deriveNotifId(`batch-${settings.day}-${reminder.dishId}-${reminder.stepIndex}`),
        ...reminderMessage(reminder, nameOf(reminder.dishId), recipeOf(reminder.dishId)?.steps?.[reminder.stepIndex]?.text),
        at: new Date(reminder.at),
      })),
      ...thaws.map(({ dish, meal }) => {
        const [year, month, day] = (meal.thawOn ?? "").split("-").map(Number);
        return scheduleTimerNotification({
          notifId: deriveNotifId(`thaw-${dish.recipeId}-${meal.date}-${meal.slot}`),
          title: `${recipeOf(dish.recipeId)?.name ?? "Ton plat"} : à sortir du congélateur`,
          body: `Pour ${shortDayLabel(meal.date)}, à décongeler au frigo cette nuit.`,
          at: new Date(year, month - 1, day, THAW_REMINDER_HOUR),
        });
      }),
    ]);
    setRemindersSet(true);
  };
  const copyLabels = async () => {
    const lines = storage.dishes.flatMap(dish => boxLabels(recipeOf(dish.recipeId)?.name ?? "Plat", settings.day, dish));
    try { await navigator.clipboard.writeText(lines.join("\n")); setCopied(true); } catch { setCopied(false); }
  };
  const dishLabel = (task: RoadmapTask) => `${baseIds.has(task.dishId) ? "Base" : "Plat"} · ${task.dishName}`;
  const toggleTask = (task: RoadmapTask) => onToggle(serviceTaskKey(task));
  const span = Math.max(1, plan.end - plan.start);

  return (
    <div className="svc bt">
      <header className="svc-top">
        <button type="button" className="cook-close-btn svc-top__back" aria-label="Retour" onClick={onClose}><Icon name="back" size={16} /></button>
        <div style={{ minWidth: 0 }}>
          <span className="svc-top__k">{weekLabel}</span>
          <h2 className="svc-top__title">Session batch</h2>
        </div>
      </header>

      <div className="svc-body">
        {plan.dishes.length === 0 ? (
          <div className="svc-col bt-empty-state">
            <span className="bt-empty-state__ic"><Icon name="dish" size={24} color="var(--text3)" /></span>
            <p>Planifie des repas cette semaine pour préparer ta session batch.</p>
          </div>
        ) : <>
        <div className="svc-col">
          <div className={`bt-hero${settings.done ? " is-done" : ""}`}>
            <div className="bt-when">
              <label className="bt-pill"><Icon name="calendar" size={13} color="currentColor" />
                <select value={settings.day} aria-label="Jour de la session" onChange={e => onSettings({ day: e.target.value })}>
                  {dayChoices.map(day => <option key={day} value={day}>{weekdayName(day)} {shortDayLabel(day).split(" ")[1]}</option>)}
                </select>
              </label>
              <label className="bt-pill"><Icon name="clock" size={13} color="currentColor" />
                <input type="time" value={settings.clock} aria-label="Heure de début" onChange={e => e.target.value && onSettings({ clock: e.target.value })} />
              </label>
            </div>
            <span className="bt-hero__k">Pour {mealOccasions} repas · {dishCount} plat{dishCount > 1 ? "s" : ""}{bases ? ` + ${bases} base${bases > 1 ? "s" : ""}` : ""}</span>
            <span className="bt-hero__big">{settings.done ? "Session terminée" : `Fini vers ${clockLabel(plan.end)}`}</span>
            <span className="bt-hero__sub"><b>{fmtTime(Math.round(span / 60_000))}</b> en cuisine, dont <b>{fmtTime(plan.active)} les mains occupées</b></span>
            <span className="bt-prog"><span className="bt-prog__bar"><i style={{ width: `${total ? done / total * 100 : 0}%` }} /></span><span>{done} / {total}</span></span>
          </div>

          <div className="serve-days bt-tabs" role="tablist">
            {([["prep", "Préparer", prepKeys.length], ["cook", "Cuisiner", taskKeys.length], ["store", "Ranger", storage.fridge + storage.freezer]] as const).map(([id, label, n]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={`serve-day${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>{label} <small>{n}</small></button>
            ))}
          </div>
        </div>

        {tab === "prep" && <div className="svc-col"><BatchPrepTab stages={prepStages} decoupeByName={decoupeByName} isChecked={isChecked} onToggle={onToggle} /></div>}
        {tab === "cook" && (
          <>
            <div className="svc-col">
              <div className="bt-cookbar">
                <div className="serve-days" role="group" aria-label="Cuisiniers">
                  {[1, 2].map(n => <button key={n} type="button" className={`serve-day${settings.cooks === n ? " on" : ""}`} onClick={() => onSettings({ cooks: n })}>{n === 1 ? "Seul" : "À deux"}</button>)}
                </div>
                <div className="serve-days" role="group" aria-label="Vue">
                  <button type="button" className={`serve-day${!frise ? " on" : ""}`} onClick={() => setFrise(false)}>Feuille de route</button>
                  <button type="button" className={`serve-day${frise ? " on" : ""}`} onClick={() => setFrise(true)}>Frise</button>
                </div>
              </div>
              {!frise && ovenSpans(plan).length > 0 && (
                <div className="bt-oven">
                  <span className="bt-oven__l"><span>Four</span><span>{clockLabel(plan.start)} → {clockLabel(plan.end)}</span></span>
                  <span className="bt-oven__track">
                    {ovenSpans(plan).map(oven => (
                      <i key={oven.start} style={{ left: `${(oven.start - plan.start) / span * 100}%`, width: `${(oven.end - oven.start) / span * 100}%` }}>{oven.temperature != null ? `${oven.temperature}°` : ""}</i>
                    ))}
                  </span>
                </div>
              )}
            </div>
            <div className={frise ? "svc-wide" : "svc-col"}>
              {frise
                ? <ServiceGantt plan={plan} recipeOf={recipeOf} dishCaption={dish => `${baseIds.has(dish.id) ? "Base" : "Plat"} · prêt à ${clockLabel(dish.end)}`} />
                : <ServiceRoadmap plan={plan} now={now} recipeOf={recipeOf} dishLabel={dishLabel} isChecked={task => isChecked(serviceTaskKey(task))} onToggle={toggleTask} end={{ time: plan.end, label: "tout est cuit" }} />}
            </div>
          </>
        )}
        {tab === "store" && <div className="svc-col"><BatchStoreTab storage={storage} recipeOf={recipeOf} isChecked={isChecked} onToggle={onToggle} /></div>}
        </>}
      </div>

      {plan.dishes.length > 0 && <div className="svc-foot bt-foot">
        {tab === "prep" && <button type="button" className="serve-cta ripple" onClick={() => setTab("cook")}><Icon name="play" size={15} color="#fff" />Passer à la cuisson</button>}
        {tab === "cook" && (native && (cookReminders.length > 0 || thaws.length > 0)
          ? <button type="button" className="serve-cta ripple" disabled={remindersSet} onClick={activateReminders}><Icon name={remindersSet ? "check" : "bell"} size={16} color="#fff" />{remindersSet ? "Rappels programmés" : "Activer les rappels"}</button>
          : <button type="button" className="serve-cta ripple" onClick={() => setTab("store")}><Icon name="box" size={16} color="#fff" />Passer au rangement</button>)}
        {tab === "store" && (
          <>
            <button type="button" className="serve-cta bt-cta-sec ripple" onClick={copyLabels}><Icon name={copied ? "check" : "copy"} size={15} color="currentColor" />{copied ? "Copiées" : "Étiquettes"}</button>
            <button type="button" className="serve-cta ripple" onClick={() => onSettings({ done: !settings.done })}><Icon name="check" size={16} color="#fff" />{settings.done ? "Rouvrir la session" : "Session terminée"}</button>
          </>
        )}
      </div>}
    </div>
  );
}
