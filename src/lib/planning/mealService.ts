/**
 * Rétro planning d'un repas à plusieurs plats (« Organiser le service ») : chaque
 * plat a son heure de service (décalée selon son rôle), et ses étapes sont placées
 * à rebours en partageant deux ressources :
 * - **les mains** : `cooks` tâches « mains occupées » au plus en même temps ;
 * - **le four** : une seule température à la fois (deux plats au même degré
 *   cohabitent, une étape au four sans température connue s'adapte à tout).
 *
 * Ordonnancement glouton, plat le plus long d'abord : chaque étape est placée le
 * plus tard possible, puis reculée par pas de 5 min tant qu'elle heurte une
 * ressource. Un plat qui finit trop tôt (four pris) le dit (`hold`) pour qu'on le
 * garde au chaud. Le plan est invariant par translation : en retard, décaler le
 * service de l'écart suffit (`lateBy`).
 *
 * @module planning/mealService
 */
import type { Recipe, Step } from "@/lib/types.js";
import { recipeTiming, type RecipeTiming, type TimingSource } from "@/lib/planning/stepTiming.js";
import { roleOrder, type RoleId } from "@/lib/planning/composedMeal.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";

const MINUTE = 60_000;
const STEP_MS = 5 * MINUTE;
/** Recul maximal d'une étape avant d'abandonner la recherche (deux jours). */
const MAX_SHIFT_MS = 48 * 60 * MINUTE;

/** Décalage par défaut (minutes) de l'heure de service de chaque rôle après l'entrée. */
export const DEFAULT_ROLE_OFFSETS: Record<RoleId, number> = { entree: 0, plat: 30, accompagnement: 30, dessert: 75 };

/** Attente au-delà de laquelle un plat prêt trop tôt doit être gardé au chaud. */
export const HOLD_WARNING_MINUTES = 15;

/** Un plat du repas à organiser. */
export interface ServiceDishInput {
  id: string;
  name: string;
  role: RoleId;
  recipe: Pick<Recipe, "steps" | "prepTime" | "cookTime">;
  /** Décalage propre au plat (minutes après l'entrée), prioritaire sur celui du rôle. */
  offset?: number;
}

/** Options du calcul. */
export interface ServiceOptions {
  /** Heure de service de l'entrée (le premier rôle), en ms. */
  serveAt: number;
  /** Décalages par rôle, en minutes (défaut {@link DEFAULT_ROLE_OFFSETS}). */
  offsets?: Partial<Record<RoleId, number>>;
  /** Nombre de cuisiniers (paires de mains), 1 par défaut. */
  cooks?: number;
  /** Instant présent (ms), pour le retard. */
  now: number;
}

/** Une étape d'un plat placée dans le temps. */
export interface ServiceTask {
  dishId: string;
  stepIndex: number;
  start: number;
  end: number;
  minutes: number;
  /** Minutes « mains occupées », en début d'étape. */
  active: number;
  source: TimingSource;
  /** L'étape occupe le four. */
  oven: boolean;
  /** Température du four (°C), `null` si inconnue. */
  temperature: number | null;
}

/** Un plat placé. */
export interface ServiceDish {
  id: string;
  name: string;
  role: RoleId;
  serveAt: number;
  start: number;
  /** Fin de la dernière étape (≤ `serveAt`). */
  end: number;
  /** Minutes entre la fin du plat et son service (plat à garder au chaud). */
  hold: number;
  tasks: ServiceTask[];
  timing: RecipeTiming;
}

/** Conflit de four résolu en avançant une étape. */
export interface OvenConflict {
  dishId: string;
  stepIndex: number;
  /** Plat qui occupait le four. */
  withDishId: string;
  /** Avance imposée, en minutes. */
  shift: number;
  temperature: number | null;
  otherTemperature: number | null;
}

/** Plan du service. */
export interface ServicePlan {
  /** Plats dans l'ordre de service. */
  dishes: ServiceDish[];
  /** Début du premier geste. */
  start: number;
  /** Dernier service (fin du repas). */
  end: number;
  /** Minutes « mains occupées » au total. */
  active: number;
  ovenConflicts: OvenConflict[];
  /** Nombre d'étapes décalées pour ne pas avoir deux tâches en main. */
  handShifts: number;
  /** Retard en minutes (au pas de 5) si le départ est déjà passé, sinon 0. */
  lateBy: number;
}

const OVEN_RE = /\b(enfourn\w*|au four|four|prechauff\w*|gratiner|rotir)\b/;

/**
 * Température du four lue dans les réglages d'appareil de l'étape, sinon dans son
 * texte (« 180 °C », « th. 6 »).
 *
 * @param step - L'étape.
 * @returns La température en °C (50 à 300), ou `null`.
 */
export function stepOvenTemperature(step: Pick<Step, "text" | "utensilParams">): number | null {
  for (const params of Object.values(step.utensilParams ?? {})) {
    const value = params?.temperature;
    if (typeof value === "number" && value >= 50 && value <= 300) return Math.round(value);
  }
  const text = step.text ?? "";
  const celsius = /(\d{2,3})\s*°\s*c?/i.exec(text);
  if (celsius) {
    const value = Number(celsius[1]);
    if (value >= 50 && value <= 300) return value;
  }
  const thermostat = /\bth(?:ermostat)?\.?\s*(\d{1,2})\b/i.exec(text);
  if (thermostat) {
    const value = Number(thermostat[1]) * 30;
    if (value >= 50 && value <= 300) return value;
  }
  return null;
}

/**
 * L'étape occupe-t-elle le four ? Une température lue en vaut indice, comme les
 * gestes du four nommés dans le texte (enfourner, préchauffer, gratiner…).
 *
 * @param step - L'étape.
 * @returns `true` si l'étape se passe au four.
 */
export function stepUsesOven(step: Pick<Step, "text" | "utensilParams">): boolean {
  if (stepOvenTemperature(step) != null) return true;
  return OVEN_RE.test(normalizeStr(step.text));
}

interface Interval { start: number; end: number }
interface OvenInterval extends Interval { temperature: number | null; dishId: string }

const overlaps = (a: Interval, b: Interval): boolean => a.start < b.end && b.start < a.end;

/** Premier usage du four incompatible (autre température connue) avec l'intervalle. */
function ovenClash(oven: OvenInterval[], slot: Interval, temperature: number | null): OvenInterval | null {
  return oven.find(use => overlaps(use, slot) && use.temperature != null && temperature != null && use.temperature !== temperature) ?? null;
}

/** Les mains sont-elles déjà toutes prises sur l'intervalle ? */
function handsFull(hands: Interval[], slot: Interval, cooks: number): boolean {
  if (slot.end <= slot.start) return false;
  return hands.filter(task => overlaps(task, slot)).length >= cooks;
}

/**
 * Organise le service d'un repas à plusieurs plats.
 *
 * @param dishes - Les plats du repas.
 * @param options - Heure de service, décalages par rôle, nombre de cuisiniers, instant présent.
 * @returns Le plan : plats placés, conflits de four résolus, retard éventuel.
 */
export function planMealService(dishes: ServiceDishInput[], options: ServiceOptions): ServicePlan {
  const offsets = { ...DEFAULT_ROLE_OFFSETS, ...options.offsets };
  const cooks = Math.max(1, Math.round(options.cooks ?? 1));
  const hands: Interval[] = [];
  const oven: OvenInterval[] = [];
  const ovenConflicts: OvenConflict[] = [];
  let handShifts = 0;

  const prepared = dishes.map(dish => ({ dish, timing: recipeTiming(dish.recipe), serveAt: options.serveAt + (dish.offset ?? offsets[dish.role] ?? 0) * MINUTE }));
  // Le plus long d'abord : il a le moins de marge, il choisit ses créneaux.
  const order = [...prepared].sort((a, b) => b.timing.total - a.timing.total);
  const placed = new Map<string, ServiceDish>();

  for (const { dish, timing, serveAt } of order) {
    const steps = dish.recipe.steps ?? [];
    const tasks: ServiceTask[] = [];
    let latestEnd = serveAt;
    for (let index = timing.steps.length - 1; index >= 0; index--) {
      const { minutes, active, source } = timing.steps[index];
      const step = steps[index] ?? {};
      const usesOven = stepUsesOven(step);
      const temperature = usesOven ? stepOvenTemperature(step) : null;
      let end = latestEnd;
      let blockedBy: OvenInterval | null = null;
      let handBlocked = false;
      for (;;) {
        const start = end - minutes * MINUTE;
        const clash = usesOven ? ovenClash(oven, { start, end }, temperature) : null;
        const busy = handsFull(hands, { start, end: start + active * MINUTE }, cooks);
        if ((!clash && !busy) || latestEnd - end >= MAX_SHIFT_MS) break;
        blockedBy ??= clash;
        handBlocked ||= busy;
        end -= STEP_MS;
      }
      const task: ServiceTask = { dishId: dish.id, stepIndex: index, start: end - minutes * MINUTE, end, minutes, active, source, oven: usesOven, temperature };
      const shift = Math.round((latestEnd - end) / MINUTE);
      if (shift > 0 && blockedBy) ovenConflicts.push({ dishId: dish.id, stepIndex: index, withDishId: blockedBy.dishId, shift, temperature, otherTemperature: blockedBy.temperature });
      else if (shift > 0 && handBlocked) handShifts++;
      if (active > 0) hands.push({ start: task.start, end: task.start + active * MINUTE });
      if (usesOven) oven.push({ start: task.start, end: task.end, temperature, dishId: dish.id });
      tasks.unshift(task);
      latestEnd = task.start;
    }
    const start = tasks[0]?.start ?? serveAt;
    const end = tasks[tasks.length - 1]?.end ?? serveAt;
    placed.set(dish.id, { id: dish.id, name: dish.name, role: dish.role, serveAt, start, end, hold: Math.round((serveAt - end) / MINUTE), tasks, timing });
  }

  const ordered = prepared.map(({ dish }) => placed.get(dish.id)).filter((dish): dish is ServiceDish => !!dish)
    .sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || a.serveAt - b.serveAt);
  const start = Math.min(...ordered.map(dish => dish.start), options.serveAt);
  const end = Math.max(...ordered.map(dish => dish.serveAt), options.serveAt);
  const late = options.now - start;
  return {
    dishes: ordered,
    start,
    end,
    active: ordered.reduce((sum, dish) => sum + dish.timing.active, 0),
    ovenConflicts,
    handShifts,
    lateBy: late > 0 ? Math.ceil(late / STEP_MS) * 5 : 0,
  };
}

/** Une tâche du plan, avec son plat, pour la feuille de route chronologique. */
export interface RoadmapTask extends ServiceTask {
  dishName: string;
  role: RoleId;
}

/**
 * Feuille de route : toutes les étapes de tous les plats, dans l'ordre chronologique
 * (à égalité, dans l'ordre de service des plats).
 *
 * @param plan - Le plan du service.
 * @returns Les tâches triées par heure de début.
 */
export function serviceRoadmap(plan: Pick<ServicePlan, "dishes">): RoadmapTask[] {
  return plan.dishes
    .flatMap(dish => dish.tasks.map(task => ({ ...task, dishName: dish.name, role: dish.role })))
    .sort((a, b) => a.start - b.start || roleOrder(a.role) - roleOrder(b.role));
}

/** Usage du four sur une plage (température constante). */
export interface OvenSpan extends Interval {
  temperature: number | null;
  dishIds: string[];
}

/**
 * Occupation du four au fil du service, plages contiguës à même température
 * fusionnées : la ligne « Four » de la frise.
 *
 * @param plan - Le plan du service.
 * @returns Les plages, dans l'ordre chronologique.
 */
export function ovenSpans(plan: Pick<ServicePlan, "dishes">): OvenSpan[] {
  const uses = plan.dishes.flatMap(dish => dish.tasks.filter(task => task.oven).map(task => ({ start: task.start, end: task.end, temperature: task.temperature, dishId: dish.id })))
    .sort((a, b) => a.start - b.start);
  const spans: OvenSpan[] = [];
  for (const use of uses) {
    const last = spans[spans.length - 1];
    if (last && use.start <= last.end && use.temperature === last.temperature) {
      last.end = Math.max(last.end, use.end);
      if (!last.dishIds.includes(use.dishId)) last.dishIds.push(use.dishId);
    } else {
      spans.push({ start: use.start, end: use.end, temperature: use.temperature, dishIds: [use.dishId] });
    }
  }
  return spans;
}

/** Rappel du service : départ du plat, ou retour en cuisine après une attente. */
export interface ServiceReminder {
  at: number;
  dishId: string;
  stepIndex: number;
  kind: "start" | "resume";
}

/** Attente minimale (minutes) avant un rappel de retour en cuisine. */
const REMINDER_MIN_WAIT = 10;

/**
 * Rappels du service, tous plats confondus : le départ de chaque plat, puis chaque
 * retour en cuisine après au moins 10 min sans rien à faire sur ce plat. Les
 * rappels passés sont écartés.
 *
 * @param plan - Le plan du service.
 * @param now - Instant présent (ms).
 * @returns Les rappels à venir, dans l'ordre chronologique.
 */
export function serviceReminders(plan: Pick<ServicePlan, "dishes">, now: number): ServiceReminder[] {
  return plan.dishes.flatMap(dish => dish.tasks.flatMap((task, position): ServiceReminder[] => {
    if (position === 0) return [{ at: task.start, dishId: dish.id, stepIndex: task.stepIndex, kind: "start" }];
    const previous = dish.tasks[position - 1];
    const idle = (task.start - (previous.start + previous.active * MINUTE)) / MINUTE;
    return idle >= REMINDER_MIN_WAIT ? [{ at: task.start, dishId: dish.id, stepIndex: task.stepIndex, kind: "resume" }] : [];
  })).filter(reminder => reminder.at > now).sort((a, b) => a.at - b.at);
}

/**
 * Instant d'un jour du planning à une heure donnée (heure locale).
 *
 * @param dateIso - Le jour, `YYYY-MM-DD`.
 * @param clock - L'heure, `HH:MM`.
 * @returns L'horodatage (ms), ou `null` si l'une des deux est invalide.
 */
export function dateAtClock(dateIso: string, clock: string): number | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  const time = /^(\d{1,2}):(\d{2})$/.exec(clock);
  if (!day || !time || Number(time[1]) > 23 || Number(time[2]) > 59) return null;
  const date = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]), Number(time[1]), Number(time[2]));
  return Number.isNaN(date.getTime()) || date.getDate() !== Number(day[3]) ? null : date.getTime();
}

/** Heure de service proposée par défaut pour un créneau du planning. */
export const DEFAULT_SERVE_CLOCK: Record<string, string> = { matin: "08:30", midi: "12:30", soir: "20:00" };

/**
 * Explication d'un conflit de four résolu, à afficher telle quelle.
 *
 * @param conflict - Le conflit.
 * @param nameOf - Nom d'un plat d'après son id.
 * @returns `{ title, body }`.
 */
export function ovenConflictMessage(conflict: OvenConflict, nameOf: (dishId: string) => string): { title: string; body: string } {
  const dish = nameOf(conflict.dishId), other = nameOf(conflict.withDishId);
  const degrees = (temperature: number | null): string => temperature != null ? ` (${temperature} °C)` : "";
  return {
    title: `${dish} et ${other} voulaient le four en même temps`,
    body: `${dish}${degrees(conflict.temperature)} passe ${fmtShift(conflict.shift)} plus tôt : le four est pris par ${other}${degrees(conflict.otherTemperature)}.`,
  };
}

/**
 * Conseil pour un plat prêt bien avant son service, `null` sous
 * {@link HOLD_WARNING_MINUTES} minutes d'attente.
 *
 * @param dish - Le plat placé.
 * @returns La phrase à afficher, ou `null`.
 */
export function holdAdvice(dish: Pick<ServiceDish, "name" | "hold">): string | null {
  if (dish.hold < HOLD_WARNING_MINUTES) return null;
  return `${dish.name} est prêt ${fmtShift(dish.hold)} avant de passer à table : garde-le au chaud, ou réchauffe-le quelques minutes juste avant.`;
}

/** Durée lisible d'un décalage : « 45 min », « 1 h 20 ». */
function fmtShift(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${String(rest).padStart(2, "0")}` : `${minutes / 60} h`;
}
