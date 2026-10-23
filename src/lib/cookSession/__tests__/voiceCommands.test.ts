import { describe, it, expect } from "vitest";
import { parseVoiceCommand, parseVoiceTail, cookPageSpeech, tipSpeech, voiceTimerTarget } from "@/lib/cookSession/voiceCommands.js";
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
    expect(cookPageSpeech({ kind: "overview", ingredients: 8, utensils: 1, cuts: [] })).toBe("Mise en place : 8 ingrédients et 1 ustensile.");
    expect(cookPageSpeech({ kind: "overview", ingredients: 1, utensils: 0, cuts: [] })).toBe("Mise en place : 1 ingrédient.");
    expect(cookPageSpeech({ kind: "overview", ingredients: 0, utensils: 0, cuts: [] })).toBe("Mise en place.");
  });
  it("énumère les découpes de la mise en place", () => {
    expect(cookPageSpeech({ kind: "overview", ingredients: 6, utensils: 2, cuts: ["Ciseler : 3 oignons", "Râper : 200 g carotte"] }))
      .toBe("Mise en place : 6 ingrédients, 2 ustensiles et 2 découpes. À découper : ciseler 3 oignons et râper 200 g carotte.");
    expect(cookPageSpeech({ kind: "overview", ingredients: 0, utensils: 0, cuts: ["Émincer : 1 poireau", "  "] }))
      .toBe("Mise en place : 1 découpe. À découper : émincer 1 poireau.");
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
  it("ne termine pas sur « terminé » seul", () => {
    expect(parseVoiceCommand("terminé")).toBeNull();
  });
  it("lit l'astuce, ou dit qu'il n'y en a pas", () => {
    expect(tipSpeech(" Ne pas trop remuer. ")).toBe("Astuce de l'étape : Ne pas trop remuer.");
    expect(tipSpeech("")).toBe("Pas d'astuce pour cette étape.");
    expect(tipSpeech(undefined)).toBe("Pas d'astuce pour cette étape.");
  });
});
