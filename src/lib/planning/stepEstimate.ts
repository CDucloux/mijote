/**
 * Estimations d'une étape sans durée fiable : le préchauffage du four, réglé sur la
 * température, et les gestes courants (revenir, roux, déglacer…). Elles remplacent
 * la répartition uniforme des temps déclarés, qui donnait la même durée à « couper
 * un oignon » et à « monter les lasagnes ».
 *
 * @module planning/stepEstimate
 */
import type { Step } from "@/lib/types.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { mentionsCutGesture } from "@/lib/recipes/decoupe.js";

/**
 * Temps de préchauffage typique (°C → minutes), milieu des fourchettes d'un four
 * domestique : 180 °C 8 à 12 min, 200 °C 10 à 15, 220 °C 12 à 18, 250 °C 15 à 25.
 * À garder synchronisé avec le prompt d'import (`functions/prompts/recipeExtract.md`)
 * et `functions/src/imports/preheat.ts`.
 */
export const PREHEAT_TABLE: readonly (readonly [number, number])[] = [[180, 10], [200, 12.5], [220, 15], [250, 20]];

/** Préchauffage retenu quand la température est inconnue (four « chaud », ~200 °C). */
export const DEFAULT_PREHEAT_MINUTES = 12;

/**
 * Minutes de préchauffage d'un four, interpolées dans {@link PREHEAT_TABLE} et
 * prolongées au-delà (au moins 5 min, au plus 25).
 *
 * @param temperature - Température visée (°C), `null` si inconnue.
 * @returns Les minutes, arrondies à la minute.
 */
export function preheatMinutes(temperature: number | null | undefined): number {
  if (temperature == null || !Number.isFinite(temperature)) return DEFAULT_PREHEAT_MINUTES;
  const last = PREHEAT_TABLE.length - 1;
  const segment = temperature <= PREHEAT_TABLE[0][0] ? 0 : temperature >= PREHEAT_TABLE[last][0] ? last - 1
    : PREHEAT_TABLE.findIndex(([upper]) => temperature <= upper) - 1;
  const [t0, m0] = PREHEAT_TABLE[segment];
  const [t1, m1] = PREHEAT_TABLE[segment + 1];
  const minutes = m0 + ((temperature - t0) * (m1 - m0)) / (t1 - t0);
  return Math.round(Math.min(Math.max(minutes, 5), 25));
}

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

const OVEN_RE = /\b(enfourn\w*|au four|four|prechauff\w*|gratiner|rotir)\b/;

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

/** Nature d'une étape dans la frise : ce qui chauffe, ce qui se taille, la préparation (gestes et attentes). */
export type StepPhase = "cuisson" | "decoupe" | "preparation";

/** Gestes de cuisson sur le feu (le four est reconnu à part). */
const COOK_RE = /\b(cuire|revenir|dorer|saisir|rissoler|sauter|colorer|suer|fondre|roux|deglacer|reduire|mijoter|bouillir|ebullition|bouillante|blanchir|precuire|pocher|frire|griller|poeler|braiser|caramelis\w*|compoter|chauffer|rechauffer|vapeur)\b/;

/**
 * Nature d'une étape : la cuisson (four ou feu) prime, puis la découpe, sinon la
 * préparation (mélanger, monter, dresser, laisser reposer…).
 *
 * @param step - L'étape (texte et réglages d'appareils).
 * @returns `"cuisson"`, `"decoupe"` ou `"preparation"`.
 */
export function stepPhase(step: Pick<Step, "text" | "utensilParams">): StepPhase {
  if (stepUsesOven(step) || COOK_RE.test(normalizeStr(step.text))) return "cuisson";
  return mentionsCutGesture(step.text) ? "decoupe" : "preparation";
}

const PREHEAT_RE = /\bprechauff\w*/;

/**
 * L'étape lance-t-elle le préchauffage du four ?
 *
 * @param text - Texte de l'étape.
 * @returns `true` si « préchauffer » y figure.
 */
export function mentionsPreheat(text: string | null | undefined): boolean {
  return PREHEAT_RE.test(normalizeStr(text));
}

/** Un geste reconnu : durée totale et part « mains occupées » (minutes). */
interface Gesture {
  re: RegExp;
  minutes: number;
  active: number;
  /** Geste de découpe : remplacé par le modèle de découpe quand il s'applique. */
  cut?: boolean;
}

/** Gestes courants (texte normalisé, sans accents), ordres de grandeur d'amateur. */
const GESTURES: readonly Gesture[] = [
  { re: /\b(eplucher|peler)\b/, minutes: 5, active: 5, cut: true },
  { re: /\b(couper|tailler|detailler|emincer|ciseler|hacher|trancher|raper|concasser)\b/, minutes: 6, active: 6, cut: true },
  { re: /\b(laver|rincer)\b/, minutes: 3, active: 3 },
  { re: /\b(porter a ebullition|faire bouillir|eau bouillante)\b/, minutes: 10, active: 1 },
  { re: /\b(blanchir|precuire)\b/, minutes: 4, active: 2 },
  { re: /\b(revenir|dorer|saisir|rissoler|sauter|colorer)\b/, minutes: 8, active: 8 },
  { re: /\b(suer|fondre)\b/, minutes: 5, active: 4 },
  { re: /\broux\b/, minutes: 5, active: 5 },
  { re: /\b(deglacer)\b/, minutes: 3, active: 3 },
  { re: /\b(reduire)\b/, minutes: 10, active: 2 },
  { re: /\b(mijoter|cuire a couvert|a feu doux)\b/, minutes: 30, active: 3 },
  { re: /\b(fouetter|monter en neige|battre)\b/, minutes: 5, active: 5 },
  { re: /\b(petrir)\b/, minutes: 10, active: 10 },
  { re: /\b(etaler|abaisser)\b/, minutes: 5, active: 5 },
  { re: /\b(monter|assembler|alterner|garnir|farcir)\b/, minutes: 10, active: 10 },
  { re: /\b(mixer|blender)\b/, minutes: 3, active: 3 },
  { re: /\b(egoutter)\b/, minutes: 2, active: 2 },
  { re: /\b(melanger|incorporer|ajouter|assaisonner|verser|remuer)\b/, minutes: 2, active: 2 },
  { re: /\b(dresser|servir|parsemer|napper)\b/, minutes: 3, active: 3 },
];

/** Plafond d'une estimation par gestes : au-delà, l'étape cache une attente qu'on ne sait pas lire. */
const GESTURE_CAP = 45;

/**
 * Durée d'une étape d'après les gestes qu'elle nomme, chacun compté une fois.
 *
 * @param text - Texte de l'étape.
 * @param options - `skipCut` : ignorer les gestes de découpe (comptés à part par le modèle de découpe).
 * @returns `{ minutes, active }`, ou `null` si aucun geste n'est reconnu.
 */
export function gestureEstimate(text: string | null | undefined, options: { skipCut?: boolean } = {}): { minutes: number; active: number } | null {
  const normalized = normalizeStr(text);
  const found = GESTURES.filter(gesture => !(options.skipCut && gesture.cut) && gesture.re.test(normalized));
  if (!found.length) return null;
  const minutes = Math.min(found.reduce((sum, gesture) => sum + gesture.minutes, 0), GESTURE_CAP);
  const active = Math.min(found.reduce((sum, gesture) => sum + gesture.active, 0), minutes);
  return { minutes, active };
}
