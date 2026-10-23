import { describe, it, expect } from "vitest";
import { parseVoiceCommand, parseVoiceTail, cookPageSpeech } from "@/lib/cookSession/voiceCommands.js";

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
    expect(cookPageSpeech({ kind: "overview", ingredients: 8, utensils: 1 })).toBe("Mise en place : 8 ingrédients et 1 ustensile.");
    expect(cookPageSpeech({ kind: "overview", ingredients: 1, utensils: 0 })).toBe("Mise en place : 1 ingrédient.");
    expect(cookPageSpeech({ kind: "overview", ingredients: 0, utensils: 0 })).toBe("Mise en place.");
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
