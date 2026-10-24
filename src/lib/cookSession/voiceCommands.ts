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
import { remainingSecs, type CookTimer } from "@/lib/planning/cookTimers.js";
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
  | { kind: "goto"; step: number }
  | { kind: "elapsed" }
  | { kind: "remaining" }
  | { kind: "ingredients"; query?: string }
  | { kind: "utensils" }
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
const VOCABULARY: readonly [Exclude<VoiceCommand["kind"], "goto">, readonly string[]][] = [
  ["finish", ["termine", "terminee", "recette finie", "recette fini"]],
  ["help", ["commandes", "commande vocale", "commandes vocales", "aide"]],
  ["close", ["ferme", "fermer"]],
  ["readOff", ["lecture off", "lecture of", "lecture coupee"]],
  ["readOn", ["lecture on", "lecture activee"]],
  ["silence", ["silence", "chut"]],
  // « combien de temps il reste » : le temps restant passe avant la durée écoulée.
  ["remaining", ["temps restant", "temps il reste", "il reste combien", "reste combien"]],
  ["elapsed", ["duree", "combien de temps"]],
  ["stop", ["stop", "stoppe"]],
  ["pause", ["pause"]],
  ["resume", ["reprends", "reprendre", "reprise"]],
  ["timer", ["minuteur", "minuterie", "chrono", "timer"]],
  ["overview", ["mise en place"]],
  ["tip", ["astuce"]],
  ["technique", ["technique", "techniques"]],
  ["ingredients", ["ingredients", "ingredient", "combien de", "combien d"]],
  ["utensils", ["ustensiles", "ustensile"]],
  ["repeat", ["repete", "repetes", "repeter", "relis", "relire", "redis", "redire"]],
  ["prev", ["precedent", "precedente", "precedant", "retour", "reviens", "arriere"]],
  ["next", ["suivant", "suivante", "ensuite", "continue", "continuer"]],
];

/** Nombres dits en toutes lettres (la dictée rend souvent « étape un », « étape deux »). */
const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, dix_sept: 17, dix_huit: 18, dix_neuf: 19, vingt: 20,
};

/** Numéro d'étape dit (« 3 », « trois », « premiere »), ou `null`. */
function stepNumber(word: string | undefined): number | null {
  if (!word) return null;
  if (/^\d{1,2}$/.test(word)) return Number(word);
  if (word === "premiere" || word === "1ere") return 1;
  return NUMBER_WORDS[word] ?? null;
}

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
  // « étape 3 » : aller à une étape. Passe avant « étape suivante » (sans numéro).
  // Les nombres composés (« dix sept ») sont recollés pour la table.
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] !== "etape") continue;
    const composed = words[i + 1] === "dix" && words[i + 2] ? stepNumber(`dix_${words[i + 2]}`) : null;
    const step = composed ?? stepNumber(words[i + 1]);
    const echoed = ignoredWords?.has("etape") && ignoredWords.has(words[i + 1] ?? "");
    if (step !== null && step > 0 && !echoed) return { kind: "goto", step };
  }
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
    if (kind === "ingredients") {
      // « combien de beurre » : l'ingrédient demandé suit « combien de ».
      const at = words.indexOf("combien");
      const query = at >= 0 ? words.slice(at + 1).filter(word => !FILLER.has(word)).join(" ") : "";
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

/**
 * Commande portée par l'une des transcriptions candidates d'une même dictée.
 *
 * La dictée classe ses hypothèses : sur un mot court dit de loin (« suivant »),
 * la première est souvent une phrase voisine (« suis vent ») et la bonne arrive
 * deuxième ou troisième. Les candidates sont examinées dans l'ordre et la
 * première commande trouvée gagne.
 * @param transcripts - Transcriptions candidates, la plus probable d'abord.
 * @param fromWord - Nombre de mots déjà analysés dans cette dictée.
 * @param spoken - Texte en cours de lecture à voix haute, s'il y en a un.
 * @returns La commande trouvée (ou `null`) et le plus grand nombre de mots des
 *   candidates : on reprend après, pour ne jamais redéclencher une commande.
 */
export function parseVoiceAlternatives(transcripts: readonly (string | null | undefined)[], fromWord = 0, spoken?: string | null): VoiceTail {
  let command: VoiceCommand | null = null;
  let words = 0;
  for (const transcript of transcripts) {
    const tail = parseVoiceTail(transcript, fromWord, spoken);
    words = Math.max(words, tail.words);
    command ??= tail.command;
  }
  return { command, words };
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

/** Une commande de l'aide : ce qu'on dit, ses variantes, ce que ça fait, et la commande reconnue. */
export interface VoiceHelpEntry {
  say: string;
  /** Autres façons de le dire. */
  also?: readonly string[];
  does: string;
  kind: VoiceCommand["kind"];
}

/** Groupe de commandes de l'aide (« Naviguer », « Minuteurs »…). */
export interface VoiceHelpGroup {
  title: string;
  icon: "swap" | "speaker" | "clock" | "help";
  entries: readonly VoiceHelpEntry[];
}

/** Aide des commandes vocales, affichée dans le pas à pas (« commandes »). */
export const VOICE_HELP: readonly VoiceHelpGroup[] = [
  {
    title: "Naviguer",
    icon: "swap",
    entries: [
      { say: "Suivant", also: ["ensuite", "continue"], does: "Page suivante", kind: "next" },
      { say: "Précédent", also: ["retour"], does: "Page précédente", kind: "prev" },
      { say: "Mise en place", does: "Ingrédients, ustensiles et découpes", kind: "overview" },
      { say: "Étape 3", does: "Aller à l'étape dite", kind: "goto" },
      { say: "Terminé", also: ["recette terminée"], does: "Terminer la recette", kind: "finish" },
    ],
  },
  {
    title: "Écouter",
    icon: "speaker",
    entries: [
      { say: "Répète", does: "Relire la page", kind: "repeat" },
      { say: "Ingrédients", also: ["combien de beurre"], does: "Les ingrédients de l'étape et leurs quantités", kind: "ingredients" },
      { say: "Ustensiles", does: "Les ustensiles de l'étape", kind: "utensils" },
      { say: "Astuce", does: "Lire l'astuce de l'étape", kind: "tip" },
      { say: "Technique", also: ["technique monter"], does: "Expliquer le geste de l'étape", kind: "technique" },
      { say: "Silence", also: ["chut"], does: "Couper la lecture en cours", kind: "silence" },
      { say: "Lecture off", does: "Ne plus lire les étapes", kind: "readOff" },
      { say: "Lecture on", does: "Lire à nouveau les étapes", kind: "readOn" },
    ],
  },
  {
    title: "Minuteurs",
    icon: "clock",
    entries: [
      { say: "Durée", also: ["depuis combien de temps"], does: "Temps écoulé depuis le lancement", kind: "elapsed" },
      { say: "Temps restant", also: ["combien de temps il reste"], does: "Ce qu'il reste sur les minuteurs", kind: "remaining" },
      { say: "Minuteur", also: ["minuteur 10 minutes"], does: "Lancer le minuteur de l'étape, ou la durée dite", kind: "timer" },
      { say: "Pause", does: "Mettre en pause le prochain à sonner", kind: "pause" },
      { say: "Reprends", does: "Relancer le minuteur en pause", kind: "resume" },
      { say: "Stop", does: "Couper celui qui sonne, sinon le prochain", kind: "stop" },
    ],
  },
  {
    title: "Aide",
    icon: "help",
    entries: [
      { say: "Commandes", also: ["aide"], does: "Afficher cette page", kind: "help" },
      { say: "Ferme", does: "Revenir à la recette", kind: "close" },
    ],
  },
];

/**
 * Phrases des commandes, telles qu'on les dit (aide et variantes). Transmises à
 * la dictée du système, qui favorise ces mots sur ses hypothèses voisines : un
 * « suivant » dit sans forcer la voix l'emporte sur « suis vent ».
 */
export const VOICE_PHRASES: readonly string[] = [
  ...new Set(VOICE_HELP.flatMap(group => group.entries.flatMap(entry => [entry.say, ...(entry.also ?? [])])).map(phrase => phrase.toLowerCase())),
];

/**
 * Libellé court d'une commande reconnue, pour la confirmer à l'écran (« Suivant »,
 * « Étape 3 »). Tiré de l'aide : un seul nom par commande, partout.
 * @param command - Commande reconnue.
 * @returns Le libellé à afficher.
 */
export function voiceCommandLabel(command: VoiceCommand): string {
  if (command.kind === "goto") return `Étape ${command.step}`;
  if (command.kind === "timer" && command.duration) return `Minuteur ${command.duration.label}`;
  if (command.kind === "technique" && command.query) return `Technique ${command.query}`;
  const entry = VOICE_HELP.flatMap(group => group.entries).find(item => item.kind === command.kind);
  return entry?.say ?? command.kind;
}

/**
 * Réponse à « durée » : depuis combien de temps la recette est lancée, en mots
 * (une synthèse vocale lit mal « 1:05 »).
 * @param seconds - Secondes écoulées depuis le lancement.
 * @returns La phrase à lire.
 */
export function elapsedSpeech(seconds: number): string {
  const minutes = Math.floor(Math.max(0, Number.isFinite(seconds) ? seconds : 0) / 60);
  if (minutes < 1) return "Recette lancée depuis moins d'une minute.";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `Recette lancée depuis ${plural(minutes, "minute")}.`;
  return `Recette lancée depuis ${plural(hours, "heure")}${rest ? ` ${rest}` : ""}.`;
}

/** Ingrédient ou ustensile à lire : son nom et, pour un ingrédient, la quantité affichée. */
export interface SpokenItem {
  name: string;
  quantity?: string;
}

const itemText = (item: SpokenItem): string => {
  const quantity = item.quantity?.trim();
  return quantity ? `${item.name.trim()}, ${quantity}` : item.name.trim();
};
const sameItem = (item: SpokenItem, query: string): boolean => {
  const name = wordsOf(item.name).join(" ");
  const wanted = wordsOf(query).join(" ");
  return name !== "" && wanted !== "" && (name.includes(wanted) || wanted.includes(name));
};

/**
 * Réponse à « ingrédients » ou « ustensiles » : ceux de l'étape, ou ceux de la
 * recette sur la mise en place. Chaque ingrédient est suivi de la quantité
 * affichée à l'écran (« guanciale, 120 g »), sans accord à risque.
 * @param kind - Ce qui est demandé.
 * @param items - Éléments de la page (liés à l'étape, ou toute la recette).
 * @param scope - `"step"` pour une étape, `"recipe"` pour la mise en place.
 * @returns La phrase à lire.
 */
export function itemsSpeech(kind: "ingredients" | "utensils", items: readonly SpokenItem[], scope: "step" | "recipe"): string {
  const named = items.filter(item => item.name.trim());
  const noun = kind === "ingredients" ? "ingrédient" : "ustensile";
  if (named.length === 0) return scope === "step" ? `Pas d'${noun} lié à cette étape.` : `Pas d'${noun} dans cette recette.`;
  const head = kind === "ingredients"
    ? (scope === "step" ? "Pour cette étape" : "Ingrédients de la recette")
    : (scope === "step" ? "Ustensiles pour cette étape" : "Ustensiles de la recette");
  return `${head} : ${named.map(itemText).join(" ; ")}.`;
}

/**
 * Réponse à « combien de beurre » : la quantité de l'ingrédient demandé, cherché
 * d'abord dans l'étape, puis dans toute la recette.
 * @param query - Ingrédient demandé.
 * @param stepItems - Ingrédients de l'étape, quantités affichées.
 * @param recipeItems - Ingrédients de la recette, quantités affichées.
 * @returns La phrase à lire.
 */
export function quantitySpeech(query: string, stepItems: readonly SpokenItem[], recipeItems: readonly SpokenItem[]): string {
  const found = stepItems.find(item => sameItem(item, query)) ?? recipeItems.find(item => sameItem(item, query));
  if (!found) return `Je ne trouve pas ${query} dans la recette.`;
  const quantity = found.quantity?.trim();
  return quantity ? `${capitalize(found.name.trim())} : ${quantity}.` : `${capitalize(found.name.trim())} : pas de quantité indiquée.`;
}

/** Temps en mots pour la synthèse vocale (« 45 secondes », « 3 minutes 20 », « 12 minutes »). */
function durationWords(seconds: number): string {
  if (seconds < 60) return plural(seconds, "seconde");
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${plural(hours, "heure")}${minutes % 60 ? ` ${minutes % 60}` : ""}`;
  }
  // Les secondes ne comptent que sur les fins de cuisson courtes.
  return minutes < 5 && rest > 0 ? `${plural(minutes, "minute")} ${rest}` : plural(minutes, "minute");
}

/**
 * Réponse à « temps restant » : ce qu'il reste sur chaque minuteur actif, le plus
 * proche de sonner en premier.
 * @param timers - Minuteurs de la session.
 * @param now - Horodatage courant (ms).
 * @returns La phrase à lire.
 */
export function remainingSpeech(timers: readonly CookTimer[], now: number): string {
  const live = timers
    .filter(timer => !timer.done)
    .map(timer => ({ timer, left: remainingSecs(timer, now) }))
    .sort((a, b) => a.left - b.left);
  if (live.length === 0) return "Aucun minuteur en cours.";
  return live
    .map(({ timer, left }) => `Minuteur de ${timer.label} : ${durationWords(left)}${timer.running ? "" : ", en pause"}.`)
    .join(" ");
}

/**
 * Annonce d'un minuteur qui vient de sonner : en mains libres, la sonnerie seule
 * ne dit pas lequel.
 * @param timer - Le minuteur terminé.
 * @returns La phrase à lire.
 */
export function timerDoneSpeech(timer: Pick<CookTimer, "label" | "stepLabel">): string {
  const step = timer.stepLabel?.trim();
  return step ? `Minuteur de ${timer.label} terminé, ${lowerFirst(step)}.` : `Minuteur de ${timer.label} terminé.`;
}

/** Page du pas à pas à lire à voix haute (sous-ensemble de la page du mode cuisine). */
export type SpokenPage =
  | { kind: "overview"; title?: string; ingredients: number; utensils: number; cuts: readonly string[] }
  | { kind: "bases"; count: number }
  | { kind: "step"; number: number; total: number; text: string };

const plural = (n: number, word: string): string => `${n} ${word}${n > 1 ? "s" : ""}`;
const listFr = (items: readonly string[]): string =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}` : items[0] ?? "";
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

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
    const title = page.title?.trim();
    const intro = title ? `Mise en place pour ${title}.` : "Mise en place.";
    const summary = parts.length ? `${intro} ${capitalize(listFr(parts))}.` : intro;
    // « Ciseler : 3 oignons » se lit « ciseler 3 oignons ».
    return cuts.length ? `${summary} À découper : ${listFr(cuts.map(cut => lowerFirst(cut.replace(" : ", " "))))}.` : summary;
  }
  if (page.kind === "bases") return `D'abord, ${plural(page.count, "préparation")} de base à réaliser.`;
  const text = page.text.trim();
  const last = page.number === page.total ? ", la dernière" : "";
  return text ? `Étape ${page.number}${last}. ${text}` : `Étape ${page.number}${last}.`;
}
