import { describe, it, expect } from "vitest";
import { parseVoiceCommand, cookPageSpeech, isSpeechEcho } from "@/lib/cookSession/voiceCommands.js";

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

describe("isSpeechEcho", () => {
  const spoken = "Étape 4. Ajouter la pâte et passer à l'étape suivante après 2 minutes.";
  it("reconnaît un fragment du texte lu, sans casse ni accents", () => {
    expect(isSpeechEcho("l'étape suivante", spoken)).toBe(true);
    expect(isSpeechEcho("ETAPE 4", spoken)).toBe(true);
  });
  it("laisse passer une commande absente du texte lu", () => {
    expect(isSpeechEcho("répète", spoken)).toBe(false);
    expect(isSpeechEcho("suivant", spoken)).toBe(false);
  });
  it("ne prend pas un mot partiel pour un écho", () => {
    expect(isSpeechEcho("ape", spoken)).toBe(false);
  });
  it("rend false sur une entrée vide", () => {
    expect(isSpeechEcho("", spoken)).toBe(false);
    expect(isSpeechEcho("suivant", "")).toBe(false);
    expect(isSpeechEcho(null, null)).toBe(false);
  });
});
