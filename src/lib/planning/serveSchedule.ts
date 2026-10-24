/**
 * Rétro planning d'une recette (« Servir à 20 h ») : à partir de l'heure de service,
 * on remonte les étapes (enchaînées, dans l'ordre de la recette) pour dire quand
 * commencer et quand revenir en cuisine. Les durées et leur fiabilité viennent de
 * {@link recipeTiming}. Les instants sont des horodatages en ms, en heure locale.
 *
 * @module planning/serveSchedule
 */
import type { Recipe } from "@/lib/types.js";
import { recipeTiming, type RecipeTiming, type TimingSource } from "@/lib/planning/stepTiming.js";

const MINUTE = 60_000;

/** Une étape placée dans le temps. */
export interface ScheduledStep {
  /** Index de l'étape dans la recette. */
  index: number;
  start: number;
  end: number;
  /** Durée totale en minutes. */
  minutes: number;
  /** Minutes « mains occupées », comptées en début d'étape. */
  active: number;
  source: TimingSource;
}

/** Déroulé d'une recette calé sur une heure de service. */
export interface ServeSchedule {
  serveAt: number;
  /** Heure de départ (début de la première étape). */
  start: number;
  steps: ScheduledStep[];
  timing: RecipeTiming;
  /** `late` : l'heure de départ est déjà passée. */
  status: "ok" | "late";
  /** Heure de service atteignable en commençant maintenant (au pas de 5 min), si en retard. */
  earliestServe: number | null;
}

/** Arrondit un instant aux 5 minutes supérieures. */
const ceilTo5 = (ms: number): number => Math.ceil(ms / (5 * MINUTE)) * 5 * MINUTE;

/**
 * Place les étapes d'une recette à rebours depuis l'heure de service.
 *
 * @param recipe - La recette (étapes et temps déclarés).
 * @param serveAt - Heure de service visée (ms).
 * @param now - Instant présent (ms), pour savoir si l'on est en retard.
 * @returns Le déroulé, avec l'heure de départ et le statut.
 */
export function scheduleService(recipe: Pick<Recipe, "steps" | "prepTime" | "cookTime">, serveAt: number, now: number): ServeSchedule {
  const timing = recipeTiming(recipe);
  const start = serveAt - timing.total * MINUTE;
  let cursor = start;
  const steps = timing.steps.map((step, index): ScheduledStep => {
    const scheduled = { index, start: cursor, end: cursor + step.minutes * MINUTE, minutes: step.minutes, active: step.active, source: step.source };
    cursor = scheduled.end;
    return scheduled;
  });
  const late = start < now;
  return { serveAt, start, steps, timing, status: late ? "late" : "ok", earliestServe: late ? ceilTo5(now + timing.total * MINUTE) : null };
}

/**
 * Instant correspondant à une heure d'horloge, aujourd'hui ou demain.
 *
 * @param clock - Heure au format `HH:MM` (24 h).
 * @param dayOffset - 0 pour aujourd'hui, 1 pour demain.
 * @param now - Instant présent (ms), qui fixe le jour de référence.
 * @returns L'horodatage (ms), ou `null` si `clock` est invalide.
 */
export function clockToTime(clock: string, dayOffset: number, now: number): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;
  const hours = Number(match[1]), minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

/**
 * Heure d'horloge `HH:MM` d'un instant (valeur d'un champ `<input type="time">`).
 *
 * @param time - Horodatage (ms).
 * @returns L'heure locale, ex. `"20:05"`.
 */
export function timeToClock(time: number): string {
  const date = new Date(time);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Heure lisible d'un instant, à la française : `"20 h"`, `"17 h 25"`.
 *
 * @param time - Horodatage (ms).
 * @returns L'heure locale formatée.
 */
export function clockLabel(time: number): string {
  const date = new Date(time);
  const minutes = date.getMinutes();
  return minutes ? `${date.getHours()} h ${String(minutes).padStart(2, "0")}` : `${date.getHours()} h`;
}

/** Jours calendaires entre deux instants (heure locale), `b` moins `a`. */
function dayDiff(a: number, b: number): number {
  const startOf = (time: number): number => { const date = new Date(time); date.setHours(0, 0, 0, 0); return date.getTime(); };
  return Math.round((startOf(b) - startOf(a)) / (24 * 60 * MINUTE));
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/**
 * Nom relatif du jour d'un instant : « Aujourd'hui », « Demain », « Hier », sinon
 * le jour de la semaine (« Samedi »).
 *
 * @param time - L'instant à nommer (ms).
 * @param now - Instant présent (ms).
 * @returns Le libellé du jour, capitalisé.
 */
export function dayLabel(time: number, now: number): string {
  const diff = dayDiff(now, time);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  const name = WEEKDAYS[new Date(time).getDay()];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Étapes d'un même jour. */
export interface ScheduleDay {
  label: string;
  steps: ScheduledStep[];
}

/**
 * Regroupe le déroulé par jour (une marinade lancée la veille ouvre un premier
 * groupe). Un déroulé tenant dans une seule journée donne un seul groupe.
 *
 * @param schedule - Le déroulé.
 * @param now - Instant présent (ms), pour nommer les jours.
 * @returns Les groupes, dans l'ordre chronologique.
 */
export function scheduleDays(schedule: Pick<ServeSchedule, "steps">, now: number): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  for (const step of schedule.steps) {
    const label = dayLabel(step.start, now);
    const last = days[days.length - 1];
    if (last?.label === label) last.steps.push(step);
    else days.push({ label, steps: [step] });
  }
  return days;
}

/** Attente minimale (minutes) après laquelle on rappelle de revenir en cuisine. */
export const REMINDER_MIN_WAIT = 10;

/** Rappel à envoyer pendant le déroulé. */
export interface ServeReminder {
  at: number;
  /** Index de l'étape à attaquer. */
  stepIndex: number;
  /** `start` pour le départ, `resume` pour un retour en cuisine après une attente. */
  kind: "start" | "resume";
}

/**
 * Rappels utiles du déroulé : le départ, puis chaque retour en cuisine après au
 * moins {@link REMINDER_MIN_WAIT} min d'attente (four, repos, froid). Les rappels
 * déjà passés sont écartés.
 *
 * @param schedule - Le déroulé.
 * @param now - Instant présent (ms).
 * @returns Les rappels à venir, dans l'ordre.
 */
export function serveReminders(schedule: Pick<ServeSchedule, "steps">, now: number): ServeReminder[] {
  const reminders = schedule.steps.flatMap((step, position): ServeReminder[] => {
    if (position === 0) return [{ at: step.start, stepIndex: step.index, kind: "start" }];
    const previous = schedule.steps[position - 1];
    return previous.minutes - previous.active >= REMINDER_MIN_WAIT ? [{ at: step.start, stepIndex: step.index, kind: "resume" }] : [];
  });
  return reminders.filter(reminder => reminder.at > now);
}

/**
 * Phrase d'avertissement sur la fiabilité des durées, `null` quand elles viennent
 * toutes de la recette : un planning bâti sur des estimations doit le dire.
 *
 * @param timing - Les durées de la recette.
 * @returns L'avertissement à afficher, ou `null`.
 */
export function timingWarning(timing: Pick<RecipeTiming, "quality" | "steps">): string | null {
  if (timing.quality === "reliable") return null;
  if (!timing.steps.length) return "Cette recette n'a pas d'étapes : impossible de calculer un déroulé.";
  const missing = timing.steps.filter(step => step.source === "fallback").length;
  if (missing) return `${missing} étape${missing > 1 ? "s" : ""} sans durée, calculée${missing > 1 ? "s" : ""} d'après les temps de la recette : l'horaire est approximatif.`;
  const estimated = timing.steps.filter(step => step.source !== "recipe").length;
  return `${estimated} durée${estimated > 1 ? "s" : ""} estimée${estimated > 1 ? "s" : ""} : vérifie-les pour un horaire fiable.`;
}

/**
 * Résumé court d'une étape pour le déroulé et les rappels : sa première phrase,
 * coupée proprement au-delà de `max` caractères.
 *
 * @param text - Le texte de l'étape.
 * @param max - Longueur maximale.
 * @returns Le résumé (`"Étape suivante"` si le texte est vide).
 */
export function stepSummary(text: string | null | undefined, max = 90): string {
  const sentence = (text || "").trim().split(/(?<=[.!?])\s/)[0].replace(/[.\s]+$/, "");
  if (!sentence) return "Étape suivante";
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2)).trimEnd()}…`;
}

/**
 * Titre et corps d'une notification de rappel.
 *
 * @param reminder - Le rappel.
 * @param recipeName - Le nom de la recette.
 * @param stepText - Le texte de l'étape à attaquer.
 * @returns `{ title, body }` prêts pour la notification.
 */
export function reminderMessage(reminder: Pick<ServeReminder, "kind">, recipeName: string | undefined, stepText: string | undefined): { title: string; body: string } {
  const name = (recipeName || "").trim() || "Ta recette";
  return {
    title: reminder.kind === "start" ? `${name} : c'est l'heure de commencer` : `${name} : retour en cuisine`,
    body: stepSummary(stepText, 120),
  };
}
