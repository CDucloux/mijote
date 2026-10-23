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
import type { CookTimer } from "@/lib/planning/cookTimers.js";
import { annotateText, type TechniqueEntry, type TechniqueIndex } from "@/lib/recipes/techniques.js";

/** Action vocale sur un minuteur déjà lancé. */
export type TimerAction = "pause" | "resume" | "stop";

/** Commande vocale reconnue. `duration` : durée dite avec « minuteur », sinon absente. */
export type VoiceCommand =
  | { kind: "next" }
  | { kind: "prev" }
  | { kind: "repeat" }
  | { kind: "overview" }
  | { kind: "tip" }
  | { kind: "technique"; query?: string }
  | { kind: "finish" }
  | { kind: "silence" }
  | { kind: "readOff" }
  | { kind: "readOn" }
  | { kind: "help" }
  | { kind: "close" }
  | { kind: "timer"; duration?: StepDuration }
  | { kind: TimerAction };

/** Nombre de mots examinés : une phrase courte, ou la fin d'une dictée plus longue. */
export const MAX_COMMAND_WORDS = 6;

// Ordre = priorité : « pause le minuteur » met en pause, il n'en lance pas un nouveau.
// Une entrée peut tenir en plusieurs mots (« mise en place »). « arrête » est exclu :
// trop fréquent dans une cuisine pour couper un minuteur.
const VOCABULARY: readonly [VoiceCommand["kind"], readonly string[]][] = [
  ["finish", ["recette terminee", "recette finie", "recette fini"]],
  ["help", ["commandes", "commande vocale", "commandes vocales", "aide"]],
  ["close", ["ferme", "fermer"]],
  ["readOff", ["lecture off", "lecture of", "lecture coupee"]],
  ["readOn", ["lecture on", "lecture activee"]],
  ["silence", ["silence", "chut"]],
  ["stop", ["stop", "stoppe"]],
  ["pause", ["pause"]],
  ["resume", ["reprends", "reprendre", "reprise"]],
  ["timer", ["minuteur", "minuterie", "chrono", "timer"]],
  ["overview", ["mise en place"]],
  ["tip", ["astuce"]],
  ["technique", ["technique", "techniques"]],
  ["repeat", ["repete", "repetes", "repeter", "relis", "relire", "redis", "redire"]],
  ["prev", ["precedent", "precedente", "retour", "reviens", "arriere"]],
  ["next", ["suivant", "suivante", "ensuite", "continue", "continuer"]],
];

/** Mots de liaison ignorés après « technique » (« technique du monter », « technique pour… »). */
const FILLER = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "pour", "sur"]);

const wordsOf = (text: string | null | undefined): string[] =>
  normalizeStr(text).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

/**
 * Commande portée par une phrase transcrite, ou `null` si elle n'en contient pas.
 * Les actions sur un minuteur passent avant son lancement, et le minuteur avant la
 * navigation : « stop minuteur » arrête, « minuteur suivant » ne tourne pas la page.
 * @param transcript - Phrase reconnue par la dictée (casse, accents et ponctuation indifférents).
 * @param ignoredWords - Mots à ne pas prendre en compte (ceux du texte en cours de lecture) :
 *   un mot-clé en plusieurs mots n'est ignoré que si tous ses mots le sont.
 * @returns La commande, ou `null` (phrase vide, trop longue, ou sans mot-clé).
 */
export function parseVoiceCommand(transcript: string | null | undefined, ignoredWords?: ReadonlySet<string>): VoiceCommand | null {
  const words = wordsOf(transcript);
  if (words.length === 0 || words.length > MAX_COMMAND_WORDS) return null;
  const said = ` ${words.join(" ")} `;
  const heardKeyword = (keyword: string): boolean =>
    said.includes(` ${keyword} `) && !keyword.split(" ").every(word => ignoredWords?.has(word));
  for (const [kind, keywords] of VOCABULARY) {
    if (!keywords.some(heardKeyword)) continue;
    if (kind === "technique") {
      // « technique monter » : les mots qui suivent nomment le geste voulu.
      const at = words.findIndex(word => word.startsWith("technique"));
      const query = words.slice(at + 1).filter(word => !FILLER.has(word)).join(" ");
      return query ? { kind, query } : { kind };
    }
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

const soonest = (timers: readonly CookTimer[], remaining: (timer: CookTimer) => number): CookTimer | null =>
  timers.reduce<CookTimer | null>((best, timer) => (best === null || remaining(timer) < remaining(best) ? timer : best), null);

/**
 * Minuteur visé par une action vocale, quand on ne le nomme pas.
 *
 * « pause » vise le minuteur en marche le plus proche de sonner, « reprends » le
 * minuteur en pause le plus proche de la fin. « stop » coupe d'abord un minuteur
 * qui sonne, sinon le plus proche de sonner, sinon un minuteur en pause.
 * @param timers - Minuteurs de la session.
 * @param action - Action dite.
 * @returns Le minuteur visé, ou `null` s'il n'y en a aucun de concerné.
 */
export function voiceTimerTarget(timers: readonly CookTimer[], action: TimerAction): CookTimer | null {
  const running = timers.filter(timer => timer.running && !timer.done && timer.endAt != null);
  const paused = timers.filter(timer => !timer.running && !timer.done);
  const pilot = soonest(running, timer => timer.endAt ?? Infinity);
  const nextPaused = soonest(paused, timer => timer.remainingMs);
  if (action === "pause") return pilot;
  if (action === "resume") return nextPaused;
  return timers.find(timer => timer.done) ?? pilot ?? nextPaused;
}

/** Une commande de l'aide : ce qu'on dit, ce que ça fait, et la commande reconnue. */
export interface VoiceHelpEntry {
  say: string;
  does: string;
  kind: VoiceCommand["kind"];
}

/** Groupe de commandes de l'aide (« Naviguer », « Minuteurs »…). */
export interface VoiceHelpGroup {
  title: string;
  entries: readonly VoiceHelpEntry[];
}

/** Aide des commandes vocales, affichée dans le pas à pas (« commandes »). */
export const VOICE_HELP: readonly VoiceHelpGroup[] = [
  {
    title: "Naviguer",
    entries: [
      { say: "Suivant", does: "Page suivante. Aussi « ensuite », « continue ».", kind: "next" },
      { say: "Précédent", does: "Page précédente. Aussi « retour ».", kind: "prev" },
      { say: "Mise en place", does: "Revenir aux ingrédients, ustensiles et découpes.", kind: "overview" },
      { say: "Recette terminée", does: "Terminer la recette.", kind: "finish" },
    ],
  },
  {
    title: "Écouter",
    entries: [
      { say: "Répète", does: "Relire la page.", kind: "repeat" },
      { say: "Astuce", does: "Lire l'astuce de l'étape.", kind: "tip" },
      { say: "Technique", does: "Expliquer le geste de l'étape. « Technique monter » pour en choisir un.", kind: "technique" },
      { say: "Silence", does: "Couper la lecture en cours. Aussi « chut ».", kind: "silence" },
      { say: "Lecture off", does: "Ne plus lire les étapes en tournant la page.", kind: "readOff" },
      { say: "Lecture on", does: "Relire les étapes en tournant la page.", kind: "readOn" },
    ],
  },
  {
    title: "Minuteurs",
    entries: [
      { say: "Minuteur", does: "Lancer le minuteur de l'étape.", kind: "timer" },
      { say: "Minuteur 10 minutes", does: "Lancer un minuteur de la durée dite.", kind: "timer" },
      { say: "Pause", does: "Mettre en pause le minuteur qui sonnera le plus tôt.", kind: "pause" },
      { say: "Reprends", does: "Relancer le minuteur en pause.", kind: "resume" },
      { say: "Stop", does: "Couper le minuteur qui sonne, sinon le prochain.", kind: "stop" },
    ],
  },
  {
    title: "Aide",
    entries: [
      { say: "Commandes", does: "Afficher cette page. Aussi « aide ».", kind: "help" },
      { say: "Ferme", does: "Fermer cette page.", kind: "close" },
    ],
  },
];

/** Page du pas à pas à lire à voix haute (sous-ensemble de la page du mode cuisine). */
export type SpokenPage =
  | { kind: "overview"; ingredients: number; utensils: number; cuts: readonly string[] }
  | { kind: "bases"; count: number }
  | { kind: "step"; number: number; total: number; text: string };

const plural = (n: number, word: string): string => `${n} ${word}${n > 1 ? "s" : ""}`;
const listFr = (items: readonly string[]): string =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}` : items[0] ?? "";
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * Réponse à « astuce » sur la page courante.
 * @param tip - Astuce de l'étape, absente ou vide s'il n'y en a pas.
 * @returns La phrase à lire.
 */
export function tipSpeech(tip: string | null | undefined): string {
  const text = tip?.trim();
  return text ? `Astuce de l'étape : ${text}` : "Pas d'astuce pour cette étape.";
}

/**
 * Gestes du glossaire cités dans le texte d'une étape, dans l'ordre, sans doublon.
 * @param text - Texte de l'étape.
 * @param index - Glossaire indexé (cf. `buildTechniqueIndex`).
 * @returns Les techniques repérées.
 */
export function stepTechniques(text: string | null | undefined, index: TechniqueIndex | null | undefined): TechniqueEntry[] {
  const seen = new Set<string>();
  const found: TechniqueEntry[] = [];
  for (const segment of annotateText(text, index)) {
    if (!segment.tech || seen.has(segment.tech.id)) continue;
    seen.add(segment.tech.id);
    found.push(segment.tech);
  }
  return found;
}

const sentence = (text: string): string => (/[.!?…]$/.test(text) ? text : `${text}.`);
const techniqueName = (technique: TechniqueEntry): string => technique.name?.trim() || technique.id;

function describeTechnique(technique: TechniqueEntry): string {
  const parts = [`${techniqueName(technique)}.`];
  const definition = technique.definition?.trim();
  const expected = technique.expected_result?.summary?.trim();
  if (definition) parts.push(sentence(definition));
  if (expected) parts.push(`Résultat attendu : ${sentence(lowerFirst(expected))}`);
  return parts.join(" ");
}

/**
 * Réponse à « technique » : la définition et le résultat attendu du geste de
 * l'étape. Avec plusieurs gestes, on les énumère et on invite à en nommer un
 * (« technique monter ») plutôt que de tout lire d'une traite, trop long à
 * écouter les mains occupées.
 * @param techniques - Techniques de l'étape (cf. {@link stepTechniques}).
 * @param query - Geste nommé après « technique », s'il y en a un.
 * @returns La phrase à lire.
 */
export function techniqueSpeech(techniques: readonly TechniqueEntry[], query?: string): string {
  if (techniques.length === 0) return "Pas de technique repérée dans cette étape.";
  if (query) {
    const wanted = wordsOf(query).join(" ");
    const match = techniques.find(technique =>
      [techniqueName(technique), ...(technique.aliases ?? [])].some(label => {
        const name = wordsOf(label).join(" ");
        return name !== "" && (name.includes(wanted) || wanted.includes(name));
      }));
    if (match) return describeTechnique(match);
  }
  const [only] = techniques;
  if (techniques.length === 1 && only) return describeTechnique(only);
  const names = techniques.map(techniqueName);
  return `${techniques.length} techniques dans cette étape : ${listFr(names)}. Dis par exemple : technique ${names[0]}.`;
}

/**
 * Texte lu à voix haute pour une page du pas à pas.
 * @param page - La page courante et ce qu'elle annonce.
 * @returns Une phrase prête pour la synthèse vocale.
 */
export function cookPageSpeech(page: SpokenPage): string {
  if (page.kind === "overview") {
    const cuts = page.cuts.map(cut => cut.trim()).filter(Boolean);
    const parts = [
      page.ingredients > 0 ? plural(page.ingredients, "ingrédient") : "",
      page.utensils > 0 ? plural(page.utensils, "ustensile") : "",
      cuts.length > 0 ? plural(cuts.length, "découpe") : "",
    ].filter(Boolean);
    const summary = parts.length ? `Mise en place : ${listFr(parts)}.` : "Mise en place.";
    // « Ciseler : 3 oignons » se lit « ciseler 3 oignons ».
    return cuts.length ? `${summary} À découper : ${listFr(cuts.map(cut => lowerFirst(cut.replace(" : ", " "))))}.` : summary;
  }
  if (page.kind === "bases") return `D'abord, ${plural(page.count, "préparation")} de base à réaliser.`;
  const text = page.text.trim();
  const last = page.number === page.total ? ", la dernière" : "";
  return text ? `Étape ${page.number}${last}. ${text}` : `Étape ${page.number}${last}.`;
}
