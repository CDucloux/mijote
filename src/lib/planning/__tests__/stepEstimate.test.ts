import { describe, it, expect } from "vitest";
import { preheatMinutes, gestureEstimate, mentionsPreheat, stepPhase, DEFAULT_PREHEAT_MINUTES } from "../stepEstimate.js";

describe("preheatMinutes", () => {
  it("suit la table de préchauffage (milieu des fourchettes)", () => {
    expect(preheatMinutes(180)).toBe(10);
    expect(preheatMinutes(200)).toBe(13);
    expect(preheatMinutes(220)).toBe(15);
    expect(preheatMinutes(250)).toBe(20);
  });

  it("interpole entre deux paliers et prolonge au-delà, borné", () => {
    expect(preheatMinutes(210)).toBe(14);
    expect(preheatMinutes(235)).toBe(18);
    expect(preheatMinutes(150)).toBe(6);
    expect(preheatMinutes(50)).toBe(5);
    expect(preheatMinutes(275)).toBe(24);
    expect(preheatMinutes(300)).toBe(25);
  });

  it("retient un préchauffage moyen sans température lisible", () => {
    expect(preheatMinutes(null)).toBe(DEFAULT_PREHEAT_MINUTES);
    expect(preheatMinutes(undefined)).toBe(DEFAULT_PREHEAT_MINUTES);
    expect(preheatMinutes(Number.NaN)).toBe(DEFAULT_PREHEAT_MINUTES);
  });
});

describe("mentionsPreheat", () => {
  it("repère le préchauffage, accents ou non", () => {
    expect(mentionsPreheat("Préchauffer le four")).toBe(true);
    expect(mentionsPreheat("four préchauffé à 180 °C")).toBe(true);
    expect(mentionsPreheat("Enfourner")).toBe(false);
    expect(mentionsPreheat(null)).toBe(false);
  });
});

describe("gestureEstimate", () => {
  it("additionne chaque geste une fois", () => {
    expect(gestureEstimate("Faire fondre le beurre puis ajouter la farine pour obtenir un roux")).toEqual({ minutes: 12, active: 11 });
    expect(gestureEstimate("Mélanger, mélanger encore")).toEqual({ minutes: 2, active: 2 });
  });

  it("compte l'eau à bouillir surtout comme de l'attente", () => {
    expect(gestureEstimate("Porter à ébullition une grande casserole d'eau")).toEqual({ minutes: 10, active: 1 });
  });

  it("peut ignorer la découpe, chiffrée à part", () => {
    expect(gestureEstimate("Couper l'oignon", { skipCut: true })).toBeNull();
    expect(gestureEstimate("Couper l'oignon")).toEqual({ minutes: 6, active: 6 });
  });

  it("plafonne une étape qui cumule les gestes, et ignore un texte vide ou inconnu", () => {
    expect(gestureEstimate("Pétrir, étaler, garnir, mijoter, réduire, porter à ébullition")?.minutes).toBe(45);
    expect(gestureEstimate("")).toBeNull();
    expect(gestureEstimate("Finir le plat")).toBeNull();
  });
});

describe("stepPhase", () => {
  it("classe le four et le feu en cuisson, en priorité", () => {
    expect(stepPhase({ text: "Enfourner l'aubergine entière" })).toBe("cuisson");
    expect(stepPhase({ text: "Laisser", utensilParams: { u1: { temperature: 180 } } })).toBe("cuisson");
    expect(stepPhase({ text: "Ajouter les viandes et les faire revenir à feu vif" })).toBe("cuisson");
    expect(stepPhase({ text: "Couper l'oignon et le faire suer" })).toBe("cuisson");
    expect(stepPhase({ text: "Précuire les feuilles de lasagne dans l'eau bouillante" })).toBe("cuisson");
  });

  it("classe la taille sans cuisson en découpe", () => {
    expect(stepPhase({ text: "Éplucher les légumes et les couper en brunoise" })).toBe("decoupe");
    expect(stepPhase({ text: "Râper le concombre" })).toBe("decoupe");
  });

  it("range le reste en « autre », sans confondre la cuisson évoquée ni l'adjectif", () => {
    expect(stepPhase({ text: "Mélanger le yaourt et l'ail" })).toBe("preparation");
    expect(stepPhase({ text: "Pendant la cuisson, mélanger la sauce" })).toBe("preparation");
    expect(stepPhase({ text: "Servir avec les aubergines rôties" })).toBe("preparation");
    expect(stepPhase({ text: "Écraser à la fourchette" })).toBe("preparation");
    expect(stepPhase({})).toBe("preparation");
  });
});
