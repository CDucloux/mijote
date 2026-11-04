/**
 * Durée du préchauffage du four à l'import. Le modèle surestime volontiers ce
 * temps (45 min pour 220 °C) : une étape qui ne fait que préchauffer reçoit la
 * durée de la table, mains libres, sauf si la source donnait sa propre durée.
 *
 * Même table que le client (`src/lib/planning/stepEstimate.ts`) et que le prompt
 * (`functions/prompts/recipeExtract.md`) : à garder synchronisées.
 *
 * @module imports/preheat
 */
import type { RecipeStep } from "./recipeExtract.js";

/** Température (°C) → minutes de préchauffage, milieu des fourchettes d'un four domestique. */
export const PREHEAT_TABLE: readonly (readonly [number, number])[] = [[180, 10], [200, 12.5], [220, 15], [250, 20]];

/** Préchauffage retenu sans température lisible (~200 °C). */
export const DEFAULT_PREHEAT_MINUTES = 12;

/**
 * Minutes de préchauffage, interpolées dans {@link PREHEAT_TABLE} et prolongées
 * au-delà (5 à 25 min).
 *
 * @param temperature - Température visée (°C), `null` si inconnue.
 * @returns Les minutes, arrondies.
 */
export function preheatMinutes(temperature: number | null | undefined): number {
  if (temperature == null || !Number.isFinite(temperature)) return DEFAULT_PREHEAT_MINUTES;
  const last = PREHEAT_TABLE.length - 1;
  const segment = temperature <= PREHEAT_TABLE[0][0] ? 0 : temperature >= PREHEAT_TABLE[last][0] ? last - 1
    : PREHEAT_TABLE.findIndex(([upper]) => temperature <= upper) - 1;
  const [t0, m0] = PREHEAT_TABLE[segment];
  const [t1, m1] = PREHEAT_TABLE[segment + 1];
  return Math.round(Math.min(Math.max(m0 + ((temperature - t0) * (m1 - m0)) / (t1 - t0), 5), 25));
}

const norm = (text: string): string => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Mots d'une consigne de préchauffage qui ne décrivent aucun autre geste. */
const PREHEAT_WORDS = new Set([
  "prechauffer", "prechauffez", "faire", "le", "la", "votre", "four", "a", "au", "en", "sur", "chaleur", "tournante",
  "statique", "traditionnel", "traditionnelle", "mode", "sole", "voute", "gril", "th", "thermostat", "c", "degres", "position", "environ",
]);

/**
 * L'étape ne fait-elle que préchauffer le four (« Préchauffer le four à 220 °C (th. 7) ») ?
 *
 * @param text - Texte de l'étape.
 * @returns `true` si, hors réglages du four, il ne reste aucun mot.
 */
export function isPreheatOnlyText(text: string | null | undefined): boolean {
  const words = norm(text ?? "").split(/[^a-z0-9]+/).filter(word => word && !/^\d+$/.test(word));
  return words.includes("prechauffer") && words.every(word => PREHEAT_WORDS.has(word));
}

/** Température lue dans les réglages d'appareils, sinon dans le texte (°C ou thermostat). */
function temperatureOf(step: Pick<RecipeStep, "text" | "utensilParams">): number | null {
  for (const params of Object.values(step.utensilParams ?? {})) {
    const raw = params?.temperature;
    const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (value >= 50 && value <= 300) return Math.round(value);
  }
  const celsius = /(\d{2,3})\s*°/.exec(step.text);
  if (celsius && Number(celsius[1]) >= 50 && Number(celsius[1]) <= 300) return Number(celsius[1]);
  const thermostat = /\bth(?:ermostat)?\.?\s*(\d{1,2})\b/i.exec(step.text);
  return thermostat ? Number(thermostat[1]) * 30 : null;
}

/**
 * Applique la table de préchauffage à une étape qui ne fait que préchauffer, sauf
 * durée donnée par la source (`durationEstimated: false`).
 *
 * @param step - L'étape assemblée (durées déjà bornées).
 * @returns L'étape, avec `duration` réglée sur la température, `activeTime` à 0 et
 *   `durationEstimated` à `true` ; inchangée sinon.
 */
export function withPreheatTiming<T extends Pick<RecipeStep, "text" | "utensilParams" | "duration" | "activeTime" | "durationEstimated">>(step: T): T {
  if (!isPreheatOnlyText(step.text) || step.durationEstimated === false) return step;
  return { ...step, duration: preheatMinutes(temperatureOf(step)), activeTime: 0, durationEstimated: true };
}
