import { describe, it, expect } from "vitest";
import { parseVoiceCommand, parseVoiceTail, parseVoiceAlternatives, VOICE_PHRASES, cookPageSpeech, tipSpeech, voiceTimerTarget, stepTechniques, techniqueSpeech, VOICE_HELP, voiceCommandLabel, elapsedSpeech, itemsSpeech, quantitySpeech, remainingSpeech, timerDoneSpeech } from "@/lib/cookSession/voiceCommands.js";
import { buildTechniqueIndex, type TechniqueEntry } from "@/lib/recipes/techniques.js";
import type { CookTimer } from "@/lib/planning/cookTimers.js";

describe("parseVoiceCommand", () => {
  it("reconnaît les trois commandes et le retour, sans casse ni accents", () => {
    expect(parseVoiceCommand("Suivant")).toEqual({ kind: "next" });
    expect(parseVoiceCommand("étape suivante !")).toEqual({ kind: "next" });
    expect(parseVoiceCommand("RÉPÈTE")).toEqual({ kind: "repeat" });
    expect(parseVoiceCommand("tu peux relire")).toEqual({ kind: "repeat" });
    expect(parseVoiceCommand("précédent")).toEqual({ kind: "prev" });
    expect(parseVoiceCommand("minuteur")).toEqual({ kind: "timer" });
  });
  it("lit la durée dite avec le minuteur", () => {
    expect(parseVoiceCommand("lance un minuteur de 10 minutes")).toEqual({ kind: "timer", duration: { minutes: 10, label: "10 min" } });
    expect(parseVoiceCommand("minuteur 1 h 30")).toEqual({ kind: "timer", duration: { minutes: 90, label: "1 h 30" } });
  });
  it("donne la priorité au minuteur sur la navigation", () => {
    expect(parseVoiceCommand("minuteur suivant")).toEqual({ kind: "timer" });
  });
  it("ignore les phrases longues, qui relèvent de la conversation", () => {
    expect(parseVoiceCommand("tu crois qu'on passe à la suite ou on attend encore un peu suivant")).toBeNull();
  });
  it("ignore les mots trop courants et les phrases sans mot-clé", () => {
    expect(parseVoiceCommand("et après")).toBeNull();
    expect(parseVoiceCommand("encore")).toBeNull();
    expect(parseVoiceCommand("ça sent bon")).toBeNull();
  });
  it("rend null sur une entrée vide", () => {
    expect(parseVoiceCommand("")).toBeNull();
    expect(parseVoiceCommand("   ")).toBeNull();
    expect(parseVoiceCommand(null)).toBeNull();
    expect(parseVoiceCommand(undefined)).toBeNull();
  });
  it("ne confond pas un mot-clé inclus dans un autre mot", () => {
    expect(parseVoiceCommand("les suivantes")).toBeNull();
  });
});

describe("cookPageSpeech", () => {
  it("annonce la mise en place", () => {
    expect(cookPageSpeech({ kind: "overview", title: "Tarte Tatin", ingredients: 8, utensils: 1, cuts: [] })).toBe("Mise en place pour Tarte Tatin. 8 ingrédients et 1 ustensile.");
    expect(cookPageSpeech({ kind: "overview", ingredients: 1, utensils: 0, cuts: [] })).toBe("Mise en place. 1 ingrédient.");
    expect(cookPageSpeech({ kind: "overview", title: "Tarte Tatin", ingredients: 0, utensils: 0, cuts: [] })).toBe("Mise en place pour Tarte Tatin.");
    expect(cookPageSpeech({ kind: "overview", title: "  ", ingredients: 0, utensils: 0, cuts: [] })).toBe("Mise en place.");
  });
  it("énumère les découpes de la mise en place", () => {
    expect(cookPageSpeech({ kind: "overview", ingredients: 6, utensils: 2, cuts: ["Ciseler : 3 oignons", "Râper : 200 g carotte"] }))
      .toBe("Mise en place. 6 ingrédients, 2 ustensiles et 2 découpes. À découper : ciseler 3 oignons et râper 200 g carotte.");
    expect(cookPageSpeech({ kind: "overview", ingredients: 0, utensils: 0, cuts: ["Émincer : 1 poireau", "  "] }))
      .toBe("Mise en place. 1 découpe. À découper : émincer 1 poireau.");
  });
  it("annonce les préparations de base", () => {
    expect(cookPageSpeech({ kind: "bases", count: 2 })).toBe("D'abord, 2 préparations de base à réaliser.");
  });
  it("lit l'étape et signale la dernière", () => {
    expect(cookPageSpeech({ kind: "step", number: 2, total: 5, text: " Faire fondre le beurre. " })).toBe("Étape 2. Faire fondre le beurre.");
    expect(cookPageSpeech({ kind: "step", number: 5, total: 5, text: "Servir." })).toBe("Étape 5, la dernière. Servir.");
    expect(cookPageSpeech({ kind: "step", number: 1, total: 3, text: "" })).toBe("Étape 1.");
  });
});

describe("parseVoiceTail", () => {
  it("trouve la commande à la fin d'une longue dictée (lecture captée puis commande)", () => {
    const transcript = "étape 2 faire fondre le beurre dans une poêle suivant";
    expect(parseVoiceTail(transcript)).toEqual({ command: { kind: "next" }, words: 10 });
  });
  it("ne réexamine pas les mots déjà traités", () => {
    expect(parseVoiceTail("suivant faire fondre", 1).command).toBeNull();
    expect(parseVoiceTail("suivant faire fondre répète", 1).command).toEqual({ kind: "repeat" });
  });
  it("ignore les mots-clés présents dans le texte en cours de lecture", () => {
    const spoken = "Étape 3. Ajouter la crème, ensuite laisser réduire.";
    expect(parseVoiceTail("ajouter la crème ensuite laisser", 0, spoken).command).toBeNull();
    expect(parseVoiceTail("ajouter la crème suivant", 0, spoken).command).toEqual({ kind: "next" });
    expect(parseVoiceTail("ensuite", 0, null).command).toEqual({ kind: "next" });
  });
  it("lit la durée d'un minuteur en fin de dictée", () => {
    expect(parseVoiceTail("bon alors on va dire minuteur 10 minutes").command).toEqual({ kind: "timer", duration: { minutes: 10, label: "10 min" } });
  });
  it("rend une commande nulle sur une entrée vide ou entièrement traitée", () => {
    expect(parseVoiceTail("")).toEqual({ command: null, words: 0 });
    expect(parseVoiceTail(null)).toEqual({ command: null, words: 0 });
    expect(parseVoiceTail("suivant", 1)).toEqual({ command: null, words: 1 });
  });
});

describe("parseVoiceAlternatives", () => {
  it("retient la commande d'une hypothèse suivante quand la première n'en porte pas", () => {
    expect(parseVoiceAlternatives(["suis vent", "suivant", "suivants"])).toEqual({ command: { kind: "next" }, words: 2 });
  });
  it("garde l'ordre de la dictée : la première commande trouvée gagne", () => {
    expect(parseVoiceAlternatives(["répète", "suivant"]).command).toEqual({ kind: "repeat" });
  });
  it("reprend après le plus grand nombre de mots, pour ne pas redéclencher", () => {
    expect(parseVoiceAlternatives(["suivant", "suis vent"], 2)).toEqual({ command: null, words: 2 });
  });
  it("applique le filtre d'écho à chaque hypothèse", () => {
    const spoken = "Étape 3. Ajouter la crème, ensuite laisser réduire.";
    expect(parseVoiceAlternatives(["ensuite", "en suite"], 0, spoken).command).toBeNull();
  });
  it("tolère une liste vide ou des entrées nulles", () => {
    expect(parseVoiceAlternatives([])).toEqual({ command: null, words: 0 });
    expect(parseVoiceAlternatives([null, undefined, "stop"]).command).toEqual({ kind: "stop" });
  });
  it("comprend « précédant », graphie fréquente de la dictée", () => {
    expect(parseVoiceCommand("précédant")).toEqual({ kind: "prev" });
  });
});

describe("VOICE_PHRASES", () => {
  it("reprend les commandes de l'aide et leurs variantes, en minuscules et sans doublon", () => {
    expect(VOICE_PHRASES).toContain("suivant");
    expect(VOICE_PHRASES).toContain("précédent");
    expect(VOICE_PHRASES).toContain("minuteur 10 minutes");
    expect(new Set(VOICE_PHRASES).size).toBe(VOICE_PHRASES.length);
    expect(VOICE_PHRASES.every(phrase => phrase === phrase.toLowerCase())).toBe(true);
  });
  it("ne contient que des phrases que la dictée sait reconnaître", () => {
    for (const phrase of VOICE_PHRASES) expect(parseVoiceCommand(phrase), phrase).not.toBeNull();
  });
});

describe("commandes de minuteur", () => {
  it("reconnaît pause, reprise et stop", () => {
    expect(parseVoiceCommand("pause")).toEqual({ kind: "pause" });
    expect(parseVoiceCommand("reprends")).toEqual({ kind: "resume" });
    expect(parseVoiceCommand("stop")).toEqual({ kind: "stop" });
    expect(parseVoiceCommand("stoppe")).toEqual({ kind: "stop" });
  });
  it("n'arrête pas un minuteur sur « arrête », trop fréquent en cuisine", () => {
    expect(parseVoiceCommand("arrête")).toBeNull();
    expect(parseVoiceCommand("arrête de toucher ça")).toBeNull();
  });
  it("fait passer l'action avant le lancement d'un minuteur", () => {
    expect(parseVoiceCommand("pause le minuteur")).toEqual({ kind: "pause" });
    expect(parseVoiceCommand("stop minuteur")).toEqual({ kind: "stop" });
    expect(parseVoiceCommand("reprends le minuteur")).toEqual({ kind: "resume" });
  });
});

describe("voiceTimerTarget", () => {
  const timer = (id: string, patch: Partial<CookTimer>): CookTimer => ({
    id, label: id, totalSec: 600, running: true, endAt: 10_000, remainingMs: 0, done: false, stepIdx: 0, stepLabel: "Étape 1", ...patch,
  });
  const soon = timer("soon", { endAt: 5_000 });
  const late = timer("late", { endAt: 9_000 });
  const pausedShort = timer("pausedShort", { running: false, endAt: null, remainingMs: 30_000 });
  const pausedLong = timer("pausedLong", { running: false, endAt: null, remainingMs: 90_000 });
  const ringing = timer("ringing", { running: false, done: true, endAt: null });

  it("met en pause le minuteur en marche le plus proche de sonner", () => {
    expect(voiceTimerTarget([late, soon, pausedShort], "pause")?.id).toBe("soon");
  });
  it("reprend le minuteur en pause le plus proche de la fin", () => {
    expect(voiceTimerTarget([pausedLong, pausedShort, soon], "resume")?.id).toBe("pausedShort");
  });
  it("arrête d'abord celui qui sonne, puis celui en marche, puis celui en pause", () => {
    expect(voiceTimerTarget([soon, ringing, pausedShort], "stop")?.id).toBe("ringing");
    expect(voiceTimerTarget([late, soon, pausedShort], "stop")?.id).toBe("soon");
    expect(voiceTimerTarget([pausedLong, pausedShort], "stop")?.id).toBe("pausedShort");
  });
  it("rend null quand aucun minuteur n'est concerné", () => {
    expect(voiceTimerTarget([], "stop")).toBeNull();
    expect(voiceTimerTarget([pausedShort], "pause")).toBeNull();
    expect(voiceTimerTarget([soon, ringing], "resume")).toBeNull();
  });
});

describe("retour à la mise en place", () => {
  it("reconnaît « mise en place », même en fin de dictée", () => {
    expect(parseVoiceCommand("mise en place")).toEqual({ kind: "overview" });
    expect(parseVoiceCommand("retourne à la mise en place")).toEqual({ kind: "overview" });
    expect(parseVoiceTail("bon on revient à la mise en place").command).toEqual({ kind: "overview" });
  });
  it("exige les trois mots dans l'ordre", () => {
    expect(parseVoiceCommand("en place")).toBeNull();
    expect(parseVoiceCommand("place mise")).toBeNull();
  });
  it("ignore l'expression quand elle est lue à voix haute", () => {
    const spoken = "Mise en place : 8 ingrédients et 2 ustensiles.";
    expect(parseVoiceTail("mise en place 8 ingrédients", 0, spoken).command).toBeNull();
  });
});

describe("astuce et fin de recette", () => {
  it("reconnaît « astuce » et « recette terminée »", () => {
    expect(parseVoiceCommand("astuce")).toEqual({ kind: "tip" });
    expect(parseVoiceCommand("une astuce ?")).toEqual({ kind: "tip" });
    expect(parseVoiceCommand("recette terminée")).toEqual({ kind: "finish" });
    expect(parseVoiceTail("voilà c'est bon recette terminée").command).toEqual({ kind: "finish" });
  });
  it("termine sur « terminé » seul", () => {
    expect(parseVoiceCommand("terminé")).toEqual({ kind: "finish" });
    expect(parseVoiceCommand("c'est terminé")).toEqual({ kind: "finish" });
  });
  it("ne termine pas sur « terminée » lu dans l'étape", () => {
    expect(parseVoiceTail("une fois la cuisson terminée", 0, "Étape 4. Une fois la cuisson terminée, servir.").command).toBeNull();
  });
  it("lit l'astuce, ou dit qu'il n'y en a pas", () => {
    expect(tipSpeech(" Ne pas trop remuer. ")).toBe("Astuce de l'étape : Ne pas trop remuer.");
    expect(tipSpeech("")).toBe("Pas d'astuce pour cette étape.");
    expect(tipSpeech(undefined)).toBe("Pas d'astuce pour cette étape.");
  });
});

describe("silence et lecture automatique", () => {
  it("reconnaît « silence » et « chut »", () => {
    expect(parseVoiceCommand("silence")).toEqual({ kind: "silence" });
    expect(parseVoiceCommand("chut !")).toEqual({ kind: "silence" });
  });
  it("reconnaît « lecture off » et « lecture on », y compris mal transcrits", () => {
    expect(parseVoiceCommand("lecture off")).toEqual({ kind: "readOff" });
    expect(parseVoiceCommand("Lecture of")).toEqual({ kind: "readOff" });
    expect(parseVoiceCommand("lecture on")).toEqual({ kind: "readOn" });
  });
  it("ne réagit pas à « lecture » seul", () => {
    expect(parseVoiceCommand("lecture")).toBeNull();
  });
  it("ignore sa propre confirmation lue à voix haute", () => {
    expect(parseVoiceTail("lecture des étapes coupée", 0, "Lecture des étapes coupée.").command).toBeNull();
  });
});

describe("technique de l'étape", () => {
  const monter: TechniqueEntry = { id: "monter", name: "Monter en neige", aliases: ["monter les blancs"], definition: "Battre des blancs d'œufs pour y incorporer de l'air", expected_result: { summary: "Des blancs fermes qui tiennent au fouet." } };
  const incorporer: TechniqueEntry = { id: "incorporer", name: "Incorporer", definition: "Mélanger délicatement sans casser la préparation." };
  const index = buildTechniqueIndex([monter, incorporer]);

  it("reconnaît « technique », seul ou suivi du geste", () => {
    expect(parseVoiceCommand("technique")).toEqual({ kind: "technique" });
    expect(parseVoiceCommand("technique monter")).toEqual({ kind: "technique", query: "monter" });
    expect(parseVoiceCommand("la technique pour incorporer")).toEqual({ kind: "technique", query: "incorporer" });
  });
  it("repère les gestes de l'étape, dans l'ordre et sans doublon", () => {
    const found = stepTechniques("Monter en neige les blancs, puis incorporer. Incorporer encore.", index);
    expect(found.map(t => t.id)).toEqual(["monter", "incorporer"]);
    expect(stepTechniques("Servir chaud.", index)).toEqual([]);
    expect(stepTechniques(null, index)).toEqual([]);
  });
  it("lit la définition et le résultat attendu d'un geste unique", () => {
    expect(techniqueSpeech([monter])).toBe("Monter en neige. Battre des blancs d'œufs pour y incorporer de l'air. Résultat attendu : des blancs fermes qui tiennent au fouet.");
    expect(techniqueSpeech([incorporer])).toBe("Incorporer. Mélanger délicatement sans casser la préparation.");
  });
  it("énumère plusieurs gestes et invite à en nommer un", () => {
    expect(techniqueSpeech([monter, incorporer])).toBe("2 techniques dans cette étape : Monter en neige et Incorporer. Dis par exemple : technique Monter en neige.");
  });
  it("lit le geste nommé, par son nom, un alias ou un mot du nom", () => {
    expect(techniqueSpeech([monter, incorporer], "incorporer")).toMatch(/^Incorporer\./);
    expect(techniqueSpeech([monter, incorporer], "monter")).toMatch(/^Monter en neige\./);
    expect(techniqueSpeech([monter, incorporer], "monter les blancs")).toMatch(/^Monter en neige\./);
  });
  it("retombe sur la liste si le geste nommé n'est pas dans l'étape", () => {
    expect(techniqueSpeech([monter, incorporer], "flamber")).toMatch(/^2 techniques/);
  });
  it("le dit quand l'étape n'a aucune technique", () => {
    expect(techniqueSpeech([])).toBe("Pas de technique repérée dans cette étape.");
  });
});

describe("aide des commandes vocales", () => {
  it("chaque phrase de l'aide, variantes comprises, déclenche la commande annoncée", () => {
    for (const entry of VOICE_HELP.flatMap(group => group.entries)) {
      for (const phrase of [entry.say, ...(entry.also ?? [])]) {
        expect(parseVoiceCommand(phrase)?.kind, phrase).toBe(entry.kind);
      }
    }
  });
  it("reconnaît « commandes », « commandes vocales », « aide » et « ferme »", () => {
    expect(parseVoiceCommand("commandes vocales")).toEqual({ kind: "help" });
    expect(parseVoiceCommand("aide")).toEqual({ kind: "help" });
    expect(parseVoiceCommand("ferme")).toEqual({ kind: "close" });
  });
});

describe("aller à une étape", () => {
  it("reconnaît le numéro en chiffres ou en lettres", () => {
    expect(parseVoiceCommand("étape 3")).toEqual({ kind: "goto", step: 3 });
    expect(parseVoiceCommand("va à l'étape deux")).toEqual({ kind: "goto", step: 2 });
    expect(parseVoiceCommand("étape une")).toEqual({ kind: "goto", step: 1 });
    expect(parseVoiceCommand("première étape")).toBeNull();
    expect(parseVoiceCommand("étape dix sept")).toEqual({ kind: "goto", step: 17 });
    expect(parseVoiceCommand("étape 12")).toEqual({ kind: "goto", step: 12 });
  });
  it("laisse « étape suivante » à la navigation", () => {
    expect(parseVoiceCommand("étape suivante")).toEqual({ kind: "next" });
  });
  it("ignore « étape » sans numéro valide", () => {
    expect(parseVoiceCommand("étape")).toBeNull();
    expect(parseVoiceCommand("étape 0")).toBeNull();
  });
  it("ignore l'annonce « Étape 3 » de la lecture captée par le micro", () => {
    expect(parseVoiceTail("étape 3 faire revenir", 0, "Étape 3. Faire revenir les oignons.").command).toBeNull();
    expect(parseVoiceTail("étape 5", 0, "Étape 3. Faire revenir les oignons.").command).toEqual({ kind: "goto", step: 5 });
  });
});

describe("voiceCommandLabel", () => {
  it("nomme la commande comme l'aide", () => {
    expect(voiceCommandLabel({ kind: "next" })).toBe("Suivant");
    expect(voiceCommandLabel({ kind: "finish" })).toBe("Terminé");
    expect(voiceCommandLabel({ kind: "timer" })).toBe("Minuteur");
  });
  it("précise l'étape, la durée ou le geste demandés", () => {
    expect(voiceCommandLabel({ kind: "goto", step: 3 })).toBe("Étape 3");
    expect(voiceCommandLabel({ kind: "timer", duration: { minutes: 10, label: "10 min" } })).toBe("Minuteur 10 min");
    expect(voiceCommandLabel({ kind: "technique", query: "monter" })).toBe("Technique monter");
  });
});

describe("durée de la recette", () => {
  it("reconnaît « durée » et « depuis combien de temps »", () => {
    expect(parseVoiceCommand("durée")).toEqual({ kind: "elapsed" });
    expect(parseVoiceCommand("ça fait combien de temps")).toEqual({ kind: "elapsed" });
  });
  it("dit le temps écoulé en mots", () => {
    expect(elapsedSpeech(30)).toBe("Recette lancée depuis moins d'une minute.");
    expect(elapsedSpeech(60)).toBe("Recette lancée depuis 1 minute.");
    expect(elapsedSpeech(12 * 60 + 40)).toBe("Recette lancée depuis 12 minutes.");
    expect(elapsedSpeech(3600)).toBe("Recette lancée depuis 1 heure.");
    expect(elapsedSpeech(2 * 3600 + 5 * 60)).toBe("Recette lancée depuis 2 heures 5.");
  });
  it("borne les valeurs aberrantes", () => {
    expect(elapsedSpeech(-10)).toBe("Recette lancée depuis moins d'une minute.");
    expect(elapsedSpeech(Number.NaN)).toBe("Recette lancée depuis moins d'une minute.");
  });
});

describe("ingrédients et ustensiles", () => {
  const step = [{ name: "Guanciale", quantity: "120g" }, { name: "Vin blanc sec", quantity: "1 verre" }];
  const recipe = [...step, { name: "Beurre doux", quantity: "30 g" }, { name: "Sel", quantity: "" }];

  it("reconnaît « ingrédients », « combien de… » et « ustensiles »", () => {
    expect(parseVoiceCommand("ingrédients")).toEqual({ kind: "ingredients" });
    expect(parseVoiceCommand("combien de beurre")).toEqual({ kind: "ingredients", query: "beurre" });
    expect(parseVoiceCommand("il faut combien d'oignons")).toEqual({ kind: "ingredients", query: "oignons" });
    expect(parseVoiceCommand("ustensiles")).toEqual({ kind: "utensils" });
  });
  it("laisse « combien de temps » à la durée", () => {
    expect(parseVoiceCommand("combien de temps")).toEqual({ kind: "elapsed" });
  });
  it("lit les éléments de l'étape ou de la recette", () => {
    expect(itemsSpeech("ingredients", step, "step")).toBe("Pour cette étape : Guanciale, 120g ; Vin blanc sec, 1 verre.");
    expect(itemsSpeech("utensils", [{ name: "Poêle" }, { name: "Passoire" }], "recipe")).toBe("Ustensiles de la recette : Poêle ; Passoire.");
    expect(itemsSpeech("ingredients", [], "step")).toBe("Pas d'ingrédient lié à cette étape.");
    expect(itemsSpeech("utensils", [{ name: " " }], "recipe")).toBe("Pas d'ustensile dans cette recette.");
  });
  it("donne la quantité demandée, de l'étape puis de la recette", () => {
    expect(quantitySpeech("guanciale", step, recipe)).toBe("Guanciale : 120g.");
    expect(quantitySpeech("beurre", step, recipe)).toBe("Beurre doux : 30 g.");
    expect(quantitySpeech("sel", step, recipe)).toBe("Sel : pas de quantité indiquée.");
    expect(quantitySpeech("chocolat", step, recipe)).toBe("Je ne trouve pas chocolat dans la recette.");
  });
});

describe("temps restant et fin de minuteur", () => {
  const timer = (patch: Partial<CookTimer>): CookTimer => ({
    id: "t", label: "10 min", totalSec: 600, running: true, endAt: 0, remainingMs: 0, done: false, stepIdx: 2, stepLabel: "Étape 3", ...patch,
  });
  const now = 1_000_000;

  it("reconnaît « temps restant », y compris « combien de temps il reste »", () => {
    expect(parseVoiceCommand("temps restant")).toEqual({ kind: "remaining" });
    expect(parseVoiceCommand("combien de temps il reste")).toEqual({ kind: "remaining" });
    expect(parseVoiceCommand("il reste combien")).toEqual({ kind: "remaining" });
  });
  it("dit ce qu'il reste, le plus proche de sonner d'abord", () => {
    const long = timer({ id: "a", label: "1 h", endAt: now + 75 * 60_000 });
    const short = timer({ id: "b", label: "5 min", endAt: now + 200_000 });
    const paused = timer({ id: "c", label: "10 min", running: false, endAt: null, remainingMs: 45_000 });
    expect(remainingSpeech([long, short, paused], now))
      .toBe("Minuteur de 10 min : 45 secondes, en pause. Minuteur de 5 min : 3 minutes 20. Minuteur de 1 h : 1 heure 15.");
    expect(remainingSpeech([timer({ endAt: now + 12 * 60_000 + 30_000 })], now)).toBe("Minuteur de 10 min : 12 minutes.");
  });
  it("ignore les minuteurs terminés", () => {
    expect(remainingSpeech([timer({ done: true })], now)).toBe("Aucun minuteur en cours.");
    expect(remainingSpeech([], now)).toBe("Aucun minuteur en cours.");
  });
  it("annonce la fin d'un minuteur avec son étape", () => {
    expect(timerDoneSpeech({ label: "10 min", stepLabel: "Étape 3" })).toBe("Minuteur de 10 min terminé, étape 3.");
    expect(timerDoneSpeech({ label: "5 min", stepLabel: "" })).toBe("Minuteur de 5 min terminé.");
  });
});
