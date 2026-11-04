import { describe, it, expect } from "vitest";
import { preheatMinutes, isPreheatOnlyText, withPreheatTiming, DEFAULT_PREHEAT_MINUTES } from "../preheat.js";
import { assignIdsAndLink } from "../recipeExtract.js";

describe("preheatMinutes", () => {
  it("suit la table et l'interpole, borné", () => {
    expect([180, 200, 220, 250].map(preheatMinutes)).toEqual([10, 13, 15, 20]);
    expect(preheatMinutes(210)).toBe(14);
    expect(preheatMinutes(50)).toBe(5);
    expect(preheatMinutes(300)).toBe(25);
    expect(preheatMinutes(null)).toBe(DEFAULT_PREHEAT_MINUTES);
  });
});

describe("isPreheatOnlyText", () => {
  it("reconnaît un préchauffage seul, réglages compris", () => {
    expect(isPreheatOnlyText("Préchauffer le four à 220 °C (th. 7).")).toBe(true);
    expect(isPreheatOnlyText("Préchauffer le four à 180°C en chaleur tournante")).toBe(true);
  });

  it("écarte une étape qui fait autre chose", () => {
    expect(isPreheatOnlyText("Préchauffer le four à 200 °C et couper les tomates")).toBe(false);
    expect(isPreheatOnlyText("Enfourner à 200 °C")).toBe(false);
    expect(isPreheatOnlyText("")).toBe(false);
    expect(isPreheatOnlyText(null)).toBe(false);
  });
});

describe("withPreheatTiming", () => {
  it("remplace une durée estimée par celle de la table, mains libres (non-régression : 45 min à 220 °C)", () => {
    expect(withPreheatTiming({ text: "Préchauffer le four à 220 °C", duration: 45, activeTime: 5, durationEstimated: true }))
      .toEqual({ text: "Préchauffer le four à 220 °C", duration: 15, activeTime: 0, durationEstimated: true });
    expect(withPreheatTiming({ text: "Préchauffer le four", utensilParams: { u0: { temperature: "250" } } }).duration).toBe(20);
    expect(withPreheatTiming({ text: "Préchauffer le four th. 6" }).duration).toBe(10);
  });

  it("garde la durée donnée par la source et les autres étapes", () => {
    const sourced = { text: "Préchauffer le four à 220 °C", duration: 30, durationEstimated: false };
    expect(withPreheatTiming(sourced)).toBe(sourced);
    const other = { text: "Enfourner 30 min", duration: 31, durationEstimated: true };
    expect(withPreheatTiming(other)).toBe(other);
  });

  it("s'applique à l'assemblage du brouillon", () => {
    const recipe = assignIdsAndLink({ name: "Gratin", steps: [{ text: "Préchauffer le four à 180 °C", duration: 30, activeTime: 2, durationEstimated: true }] });
    expect(recipe.steps[0]).toMatchObject({ duration: 10, activeTime: 0, durationEstimated: true });
  });
});
