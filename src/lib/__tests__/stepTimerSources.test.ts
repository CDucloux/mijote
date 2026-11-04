import { describe, it, expect } from "vitest";
import { applianceDurations, durationLabel, mergeDurations, stepTimerMinutes, MAX_TIMER_MINUTES } from "@/lib/planning/stepTimers.js";

type Ut = { id?: string; appliance?: unknown };
const applianceOf = (utensil: Ut): unknown => utensil.appliance;

describe("durationLabel", () => {
  it("suit le format des minuteurs détectés", () => {
    expect(durationLabel(0.5)).toBe("30 s");
    expect(durationLabel(45)).toBe("45 min");
    expect(durationLabel(120)).toBe("2 h");
    expect(durationLabel(65)).toBe("1 h 05");
  });
});

describe("applianceDurations", () => {
  it("lance la durée réglée sur le four, absente du texte (non-régression)", () => {
    const step = { utensilParams: { u1: { temperature: 180, duree: 45 } } };
    expect(applianceDurations(step, [{ id: "u1", appliance: "four" }], applianceOf)).toEqual([{ minutes: 45, label: "45 min" }]);
  });

  it("convertit un réglage en secondes", () => {
    const step = { utensilParams: { b: { duree: 30 } } };
    expect(applianceDurations(step, [{ id: "b", appliance: "blender" }], applianceOf)).toEqual([{ minutes: 0.5, label: "30 s" }]);
  });

  it("ignore réglages absents, invalides, nuls ou d'un ustensile non-appareil", () => {
    const step = { utensilParams: { a: { duree: 9999 }, b: { duree: 0 }, c: { duree: 10 }, d: { duree: "abc" } } };
    const uts: Ut[] = [{ id: "a", appliance: "four" }, { id: "b", appliance: "four" }, { id: "c" }, { id: "d", appliance: "four" }, { appliance: "four" }, { id: "z", appliance: "four" }];
    expect(applianceDurations(step, uts, applianceOf)).toEqual([]);
    expect(applianceDurations({}, uts, applianceOf)).toEqual([]);
  });

  it("déduplique deux appareils réglés sur la même durée", () => {
    const step = { utensilParams: { a: { duree: 20 }, b: { duree: "20" } } };
    expect(applianceDurations(step, [{ id: "a", appliance: "four" }, { id: "b", appliance: "air_fryer" }], applianceOf)).toHaveLength(1);
  });
});

describe("mergeDurations", () => {
  it("fusionne, déduplique (la première l'emporte), borne et trie", () => {
    const text = [{ minutes: 45, label: "45 minutes" }, { minutes: 5, label: "5 min" }];
    const appliance = [{ minutes: 45, label: "45 min" }, { minutes: MAX_TIMER_MINUTES + 1, label: "trop" }, { minutes: 0, label: "0" }];
    expect(mergeDurations(text, appliance)).toEqual([{ minutes: 5, label: "5 min" }, { minutes: 45, label: "45 minutes" }]);
    expect(mergeDurations()).toEqual([]);
  });
});

describe("stepTimerMinutes", () => {
  it("avance à la minute, puis par 5, puis par quart d'heure", () => {
    expect(stepTimerMinutes(5, 1)).toBe(6);
    expect(stepTimerMinutes(9, 1)).toBe(10);
    expect(stepTimerMinutes(10, 1)).toBe(15);
    expect(stepTimerMinutes(55, 1)).toBe(60);
    expect(stepTimerMinutes(60, 1)).toBe(75);
  });

  it("recule symétriquement et recale une valeur hors pas", () => {
    expect(stepTimerMinutes(10, -1)).toBe(9);
    expect(stepTimerMinutes(15, -1)).toBe(10);
    expect(stepTimerMinutes(75, -1)).toBe(60);
    expect(stepTimerMinutes(60, -1)).toBe(55);
    expect(stepTimerMinutes(12, 1)).toBe(15);
    expect(stepTimerMinutes(12, -1)).toBe(10);
  });

  it("reste borné entre 1 min et 24 h, même sur une entrée aberrante", () => {
    expect(stepTimerMinutes(1, -1)).toBe(1);
    expect(stepTimerMinutes(MAX_TIMER_MINUTES, 1)).toBe(MAX_TIMER_MINUTES);
    expect(stepTimerMinutes(Number.NaN, 1)).toBe(2);
    expect(stepTimerMinutes(-4, -1)).toBe(1);
  });
});
