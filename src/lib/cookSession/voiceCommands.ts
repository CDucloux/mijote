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

/** Nombre de mots maximal d'une phrase prise pour une commande. */
export const MAX_COMMAND_WORDS = 6;

const VOCABULARY: readonly [VoiceCommand["kind"], readonly string[]][] = [
  ["timer", ["minuteur", "minuterie", "chrono", "timer"]],
  ["repeat", ["repete", "repetes", "repeter", "relis", "relire", "redis", "redire"]],
  ["prev", ["precedent", "precedente", "retour", "reviens", "arriere"]],
  ["next", ["suivant", "suivante", "ensuite", "continue", "continuer"]],
];

/**
 * Commande portée par une phrase transcrite, ou `null` si elle n'en contient pas.
 * Le minuteur est cherché en premier : « minuteur suivant » ne doit pas tourner la page.
 * @param transcript - Phrase reconnue par la dictée (casse, accents et ponctuation indifférents).
 * @returns La commande, ou `null` (phrase vide, trop longue, ou sans mot-clé).
 */
export function parseVoiceCommand(transcript: string | null | undefined): VoiceCommand | null {
  const words = normalizeStr(transcript).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > MAX_COMMAND_WORDS) return null;
  const said = new Set(words);
  for (const [kind, keywords] of VOCABULARY) {
    if (!keywords.some(keyword => said.has(keyword))) continue;
    if (kind !== "timer") return { kind };
    const duration = parseDurations(transcript)[0];
    return duration ? { kind, duration } : { kind };
  }
  return null;
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
