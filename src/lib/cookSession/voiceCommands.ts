/**
 * Mains libres du mode cuisine : reconnaissance des commandes vocales dans une
 * transcription, et texte lu à voix haute pour chaque page du pas à pas.
 *
 * Le micro reste ouvert pendant toute la cuisine : il entend aussi les
 * conversations. Seule une phrase COURTE est donc prise pour une commande, et le
 * vocabulaire évite les mots trop courants (« après », « encore ») qui se
 * déclencheraient au milieu d'une phrase ordinaire.
 *
 * @module cookSession/voiceCommands
 */
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { parseDurations, type StepDuration } from "@/lib/planning/stepTimers.js";

/** Commande vocale reconnue. `duration` : durée dite avec « minuteur », sinon absente. */
export type VoiceCommand =
  | { kind: "next" }
  | { kind: "prev" }
  | { kind: "repeat" }
  | { kind: "timer"; duration?: StepDuration };

/** Nombre de mots examinés : une phrase courte, ou la fin d'une dictée plus longue. */
export const MAX_COMMAND_WORDS = 6;

const VOCABULARY: readonly [VoiceCommand["kind"], readonly string[]][] = [
  ["timer", ["minuteur", "minuterie", "chrono", "timer"]],
  ["repeat", ["repete", "repetes", "repeter", "relis", "relire", "redis", "redire"]],
  ["prev", ["precedent", "precedente", "retour", "reviens", "arriere"]],
  ["next", ["suivant", "suivante", "ensuite", "continue", "continuer"]],
];

const wordsOf = (text: string | null | undefined): string[] =>
  normalizeStr(text).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

/**
 * Commande portée par une phrase transcrite, ou `null` si elle n'en contient pas.
 * Le minuteur est cherché en premier : « minuteur suivant » ne doit pas tourner la page.
 * @param transcript - Phrase reconnue par la dictée (casse, accents et ponctuation indifférents).
 * @param ignoredWords - Mots-clés à ne pas prendre en compte (ceux du texte en cours de lecture).
 * @returns La commande, ou `null` (phrase vide, trop longue, ou sans mot-clé).
 */
export function parseVoiceCommand(transcript: string | null | undefined, ignoredWords?: ReadonlySet<string>): VoiceCommand | null {
  const words = wordsOf(transcript);
  if (words.length === 0 || words.length > MAX_COMMAND_WORDS) return null;
  const said = new Set(words);
  for (const [kind, keywords] of VOCABULARY) {
    if (!keywords.some(keyword => said.has(keyword) && !ignoredWords?.has(keyword))) continue;
    if (kind !== "timer") return { kind };
    const duration = parseDurations(words.join(" "))[0];
    return duration ? { kind, duration } : { kind };
  }
  return null;
}

/** Résultat de {@link parseVoiceTail}. */
export interface VoiceTail {
  command: VoiceCommand | null;
  /** Nombre de mots de la transcription : reprendre l'analyse après eux. */
  words: number;
}

/**
 * Commande dite à la fin d'une dictée en cours.
 *
 * Le micro reste ouvert pendant toute la cuisine, et certains navigateurs (Edge)
 * cousent en une seule longue transcription la lecture à voix haute captée par
 * le micro et la commande qui la suit. On n'examine donc que les derniers mots
 * nouveaux (après `fromWord`, déjà traités). Pendant une lecture, les mots-clés
 * présents dans le texte lu sont ignorés : « ensuite » lu dans une étape ne doit
 * pas tourner la page.
 * @param transcript - Transcription courante (provisoire ou définitive) de la dictée.
 * @param fromWord - Nombre de mots déjà analysés dans cette transcription.
 * @param spoken - Texte en cours de lecture à voix haute, s'il y en a un.
 * @returns La commande trouvée (ou `null`) et le nombre de mots de la transcription.
 */
export function parseVoiceTail(transcript: string | null | undefined, fromWord = 0, spoken?: string | null): VoiceTail {
  const words = wordsOf(transcript);
  const fresh = words.slice(Math.max(0, fromWord)).slice(-MAX_COMMAND_WORDS);
  const ignored = spoken ? new Set(wordsOf(spoken)) : undefined;
  return { command: parseVoiceCommand(fresh.join(" "), ignored), words: words.length };
}

/** Page du pas à pas à lire à voix haute (sous-ensemble de la page du mode cuisine). */
export type SpokenPage =
  | { kind: "overview"; ingredients: number; utensils: number }
  | { kind: "bases"; count: number }
  | { kind: "step"; number: number; total: number; text: string };

const plural = (n: number, word: string): string => `${n} ${word}${n > 1 ? "s" : ""}`;

/**
 * Texte lu à voix haute pour une page du pas à pas.
 * @param page - La page courante et ce qu'elle annonce.
 * @returns Une phrase prête pour la synthèse vocale.
 */
export function cookPageSpeech(page: SpokenPage): string {
  if (page.kind === "overview") {
    const parts = [page.ingredients > 0 && plural(page.ingredients, "ingrédient"), page.utensils > 0 && plural(page.utensils, "ustensile")].filter(Boolean);
    return parts.length ? `Mise en place : ${parts.join(" et ")}.` : "Mise en place.";
  }
  if (page.kind === "bases") return `D'abord, ${plural(page.count, "préparation")} de base à réaliser.`;
  const text = page.text.trim();
  const last = page.number === page.total ? ", la dernière" : "";
  return text ? `Étape ${page.number}${last}. ${text}` : `Étape ${page.number}${last}.`;
}
