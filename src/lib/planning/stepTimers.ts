/**
 * Détection des durées dans le texte d'une étape de recette et formatage des
 * comptes à rebours pour les minuteurs du mode cuisine.
 *
 * @module planning/stepTimers
 */
import type { Step, Utensil } from "@/lib/types.js";
import { getApplianceSchema, validateParamValues } from "@/lib/utensils/appliances.js";

/** Une durée détectée dans une étape : sa valeur en minutes et son libellé affichable. */
export interface StepDuration {
  /** Durée en minutes, bornée à 24 h (fractionnaire pour un réglage d'appareil en secondes). */
  minutes: number;
  /** Libellé lisible tel qu'on l'affiche sur le bouton, ex. `"6 min"` ou `"1 h 30"`. */
  label: string;
}

/**
 * Repère les mentions de temps (« 6 min », « 6 minutes », « 1 h 30 », « 2 heures »)
 * dans le texte d'une étape pour proposer des minuteurs en un clic.
 *
 * Les heures sont converties en minutes ; les valeurs sont dédupliquées (par
 * nombre de minutes) et triées par ordre croissant. Le bruit courant (« 180°C »,
 * « quelques minutes ») est ignoré.
 *
 * @param text - Texte brut de l'étape.
 * @returns Les durées détectées, triées et dédupliquées.
 *
 * @example
 * parseDurations("cuire 6 minutes puis reposer 1 h 30");
 * // → [{ minutes: 6, label: "6 min" }, { minutes: 90, label: "1 h 30" }]
 */
export function parseDurations(text: string | null | undefined): StepDuration[] {
  if (!text) return [];
  const seen = new Set<number>();
  const out: StepDuration[] = [];
  const push = (minutes: number, label: string): void => {
    const m = Math.round(minutes);
    if (m > 0 && m <= 24 * 60 && !seen.has(m)) { seen.add(m); out.push({ minutes: m, label }); }
  };

  // Les heures sont blanchies au fil du remplacement : sinon le « 30 » de « 1 h 30 »
  // serait re-capturé comme « 30 min » à l'étape suivante.
  const work = text.replace(/(\d+)\s*h(?:eures?)?(?:\s*(\d{1,2}))?/gi, (full, h: string, mm?: string) => {
    const mins = mm ? Number(mm) : 0;
    push(Number(h) * 60 + mins, mins ? `${h} h ${String(mins).padStart(2, "0")}` : `${h} h`);
    return " ".repeat(full.length);
  });

  // `\b` : accepte « 6 min » mais pas « 6 minimum ».
  for (const m of work.matchAll(/(\d+)\s*(?:min(?:ute)?s?|mn)\b/gi)) push(Number(m[1]), `${m[1]} min`);

  return out.sort((a, b) => a.minutes - b.minutes);
}

/** Durée maximale d'un minuteur, en minutes (24 h). */
export const MAX_TIMER_MINUTES = 24 * 60;

/**
 * Libellé d'une durée, au format des minuteurs détectés dans le texte.
 *
 * @param minutes - Durée en minutes (fractionnaire sous la minute).
 * @returns Par exemple `"30 s"`, `"45 min"`, `"2 h"` ou `"1 h 05"`.
 */
export function durationLabel(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const rest = total % 60;
  return rest ? `${Math.floor(total / 60)} h ${String(rest).padStart(2, "0")}` : `${Math.floor(total / 60)} h`;
}

/**
 * Durées réglées sur les appareils d'une étape (« Four 180 °C · 45 min ») : le
 * temps y est saisi comme réglage et ne figure souvent pas dans le texte, il doit
 * pourtant se lancer en minuteur comme les durées écrites.
 *
 * @param step - L'étape et ses réglages par ustensile (`utensilParams`).
 * @param utensils - Ustensiles liés à l'étape.
 * @param applianceOf - Clé d'appareil d'un ustensile (lue dans la base d'ustensiles).
 * @returns Les durées trouvées (réglage `duree`, en minutes ou en secondes selon
 *   l'appareil), triées et dédupliquées ; un réglage invalide est ignoré.
 */
export function applianceDurations<U extends Pick<Utensil, "id">>(
  step: Pick<Step, "utensilParams">,
  utensils: U[],
  applianceOf: (utensil: U) => unknown,
): StepDuration[] {
  const found = utensils.flatMap(utensil => {
    const raw = utensil.id ? step.utensilParams?.[utensil.id] : undefined;
    if (!raw) return [];
    const appliance = applianceOf(utensil);
    const duree = validateParamValues(appliance, raw).values.duree;
    if (typeof duree !== "number" || duree <= 0) return [];
    const unit = getApplianceSchema(appliance).find(field => field.key === "duree")?.unit;
    return [unit === "s" ? duree / 60 : duree];
  });
  return mergeDurations(found.map(minutes => ({ minutes, label: durationLabel(minutes) })));
}

/**
 * Fusionne des listes de durées : dédupliquées par durée (la première l'emporte),
 * bornées à {@link MAX_TIMER_MINUTES} et triées par ordre croissant.
 *
 * @param lists - Listes de durées (texte de l'étape, réglages d'appareils…).
 * @returns Une seule liste, prête à afficher en boutons de minuteur.
 */
export function mergeDurations(...lists: StepDuration[][]): StepDuration[] {
  const seen = new Set<number>();
  return lists.flat()
    .filter(d => d.minutes > 0 && d.minutes <= MAX_TIMER_MINUTES && !seen.has(d.minutes) && !!seen.add(d.minutes))
    .sort((a, b) => a.minutes - b.minutes);
}

/** Durées proposées d'un tap pour un minuteur libre. */
export const TIMER_PRESETS = [1, 3, 5, 10, 15, 20, 30, 45, 60] as const;

/**
 * Pas suivant d'un sélecteur de durée : à la minute sous 10 min, par 5 jusqu'à
 * l'heure, par quart d'heure au-delà (la précision utile décroît avec la durée).
 *
 * @param minutes - Durée courante.
 * @param direction - `1` pour allonger, `-1` pour raccourcir.
 * @returns La nouvelle durée, recalée sur le pas et bornée entre 1 min et 24 h.
 */
export function stepTimerMinutes(minutes: number, direction: 1 | -1): number {
  const current = Math.min(Math.max(Math.round(minutes) || 1, 1), MAX_TIMER_MINUTES);
  const pace = (m: number): number => (m < 10 ? 1 : m < 60 ? 5 : 15);
  const size = direction > 0 ? pace(current) : pace(current - 1);
  const next = direction > 0 ? Math.floor(current / size) * size + size : Math.ceil(current / size) * size - size;
  return Math.min(Math.max(next, 1), MAX_TIMER_MINUTES);
}

/**
 * Formate une durée en secondes vers un compte à rebours `m:ss`.
 *
 * @param totalSec - Nombre de secondes restantes (négatif traité comme 0).
 * @returns Une chaîne `m:ss`, ex. `fmtCountdown(90) === "1:30"`.
 */
export function fmtCountdown(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
