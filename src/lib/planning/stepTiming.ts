/**
 * Durées d'une recette, étape par étape, pour le rétro planning : combien de temps
 * prend chaque étape, et combien de ce temps occupe les mains (le reste est de
 * l'attente : four, repos, froid). Le planning ne vaut que ce que valent ces
 * durées, d'où une source et un niveau de fiabilité sur chacune, pour dire au
 * cuisinier quand vérifier.
 *
 * Ordre de confiance : durée saisie ou lue dans la source, durée estimée à
 * l'import, durée repérée dans le texte de l'étape, puis repli sur les temps
 * déclarés de la recette répartis entre les étapes restantes.
 *
 * @module planning/stepTiming
 */
import type { Recipe, Step } from "@/lib/types.js";
import { parseDurations } from "@/lib/planning/stepTimers.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";

/** Origine d'une durée d'étape, de la plus sûre à la plus approximative. */
export type TimingSource = "recipe" | "estimated" | "text" | "fallback";

/** Durée retenue pour une étape. */
export interface StepTimingInfo {
  /** Durée totale en minutes, attente comprise. */
  minutes: number;
  /** Minutes « mains occupées » (≤ `minutes`). */
  active: number;
  source: TimingSource;
}

/**
 * Fiabilité d'ensemble : `reliable` quand toutes les durées viennent de la recette,
 * `estimated` dès qu'une durée est estimée, `rough` dès qu'une étape n'a aucune
 * durée (repli sur les temps déclarés) ou que la recette n'a pas d'étapes.
 */
export type TimingQuality = "reliable" | "estimated" | "rough";

/** Durées de toute une recette. */
export interface RecipeTiming {
  steps: StepTimingInfo[];
  /** Durée totale en minutes (étapes enchaînées). */
  total: number;
  /** Minutes « mains occupées » au total. */
  active: number;
  quality: TimingQuality;
  /** Index des étapes dont la durée mérite une relecture (toute source sauf `recipe`). */
  toReview: number[];
  /**
   * Écart (minutes) entre la durée des étapes et les temps déclarés (préparation +
   * cuisson), `null` si la recette n'en déclare pas. Positif : les étapes sont plus
   * longues que ce que la recette annonce.
   */
  declaredGap: number | null;
}

/** Durée par défaut d'une étape quand la recette ne déclare aucun temps. */
export const DEFAULT_STEP_MINUTES = 10;
/** Part active retenue pour une étape d'attente repérée dans le texte. */
const WAIT_ACTIVE_MINUTES = 5;

/** Gestes où l'on attend plus qu'on ne travaille (texte normalisé, sans accents). */
const WAIT_RE = /\b(enfourn\w*|au four|repos\w*|marin\w*|refrigere\w*|refrigerat\w*|au frais|au frigo|congel\w*|mijot\w*|a couvert|infuse\w*|lever|levee|pousser|pousse|tiedir|refroidir|prendre au)/;

/**
 * L'étape est-elle surtout de l'attente (four, repos, froid, mijotage) ?
 *
 * @param text - Le texte de l'étape.
 * @returns `true` si un geste d'attente y est nommé.
 */
export function isWaitingStep(text: string | null | undefined): boolean {
  return WAIT_RE.test(normalizeStr(text));
}

const validMinutes = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;

/**
 * Durée d'une étape seule : portée par l'étape, sinon lue dans son texte.
 *
 * @param step - L'étape (durées éventuelles et texte).
 * @returns La durée retenue, ou `null` si rien d'exploitable (la recette entière
 *   permet alors un repli, cf. {@link recipeTiming}).
 */
export function stepTiming(step: Pick<Step, "duration" | "activeTime" | "durationEstimated" | "text">): StepTimingInfo | null {
  const minutes = validMinutes(step.duration);
  if (minutes != null) {
    const active = typeof step.activeTime === "number" && step.activeTime >= 0 ? Math.min(Math.round(step.activeTime), minutes) : minutes;
    return { minutes, active, source: step.durationEstimated ? "estimated" : "recipe" };
  }
  // Plusieurs durées dans une même étape (« cuire 6 min puis reposer 1 h 30 ») :
  // la plus longue, jamais la somme (« vérifier au bout de 25 min » sur 30 min).
  const found = parseDurations(step.text);
  if (!found.length) return null;
  const longest = Math.max(...found.map(d => d.minutes));
  return { minutes: longest, active: isWaitingStep(step.text) ? Math.min(WAIT_ACTIVE_MINUTES, longest) : longest, source: "text" };
}

/**
 * Durées de chaque étape d'une recette et fiabilité d'ensemble. Les étapes sans
 * durée se partagent ce qui reste des temps déclarés (préparation + cuisson), au
 * moins 5 min chacune, comptées entièrement « mains occupées » : c'est l'hypothèse
 * prudente pour un planning (on ne promet pas des mains libres qu'on n'a pas).
 *
 * @param recipe - La recette (étapes et temps déclarés).
 * @returns Les durées par étape, les totaux, la fiabilité et les étapes à relire.
 */
export function recipeTiming(recipe: Pick<Recipe, "steps" | "prepTime" | "cookTime">): RecipeTiming {
  const steps = recipe.steps ?? [];
  const known = steps.map(stepTiming);
  const declared = (validMinutes(recipe.prepTime) ?? 0) + (validMinutes(recipe.cookTime) ?? 0);
  const knownTotal = known.reduce((sum, timing) => sum + (timing?.minutes ?? 0), 0);
  const missing = known.filter(timing => !timing).length;
  const share = missing === 0 ? 0
    : declared > 0 ? Math.max(5, Math.round((declared - knownTotal) / missing / 5) * 5)
    : DEFAULT_STEP_MINUTES;
  const timings = known.map(timing => timing ?? { minutes: share, active: share, source: "fallback" as const });

  const total = timings.reduce((sum, timing) => sum + timing.minutes, 0);
  const sources = new Set(timings.map(timing => timing.source));
  const quality: TimingQuality = !timings.length || sources.has("fallback") ? "rough"
    : sources.has("estimated") || sources.has("text") ? "estimated" : "reliable";
  return {
    steps: timings,
    total,
    active: timings.reduce((sum, timing) => sum + timing.active, 0),
    quality,
    toReview: timings.flatMap((timing, index) => timing.source === "recipe" ? [] : [index]),
    declaredGap: declared > 0 ? total - declared : null,
  };
}

/** Champs de durée d'une étape, tels qu'enregistrés. */
export type StepTimingFields = Pick<Step, "duration" | "activeTime" | "durationEstimated">;

/**
 * Applique à une étape les durées saisies à la main dans l'éditeur : elles font foi
 * (`durationEstimated` passe à `false`). Une durée vide ou nulle retire les trois
 * champs ; la part active est bornée à la durée, et vide, elle est retirée. Les
 * champs sont supprimés plutôt que mis à `undefined`, que Firestore refuse.
 *
 * @param step - L'étape à modifier (non mutée).
 * @param duration - Durée totale saisie, en minutes (`null` = aucune).
 * @param activeTime - Part « mains occupées » saisie, en minutes (`null` = inconnue).
 * @returns Une copie de l'étape avec ses champs de durée à jour.
 */
export function withEditedTiming<T extends StepTimingFields>(step: T, duration: number | null, activeTime: number | null): T {
  const { duration: _duration, activeTime: _activeTime, durationEstimated: _estimated, ...rest } = step;
  const total = duration != null && Number.isFinite(duration) && duration > 0 ? Math.min(Math.round(duration), 48 * 60) : null;
  if (total == null) return rest as T;
  const next = { ...rest, duration: total, durationEstimated: false } as T;
  if (activeTime != null && Number.isFinite(activeTime) && activeTime >= 0) next.activeTime = Math.min(Math.round(activeTime), total);
  return next;
}
