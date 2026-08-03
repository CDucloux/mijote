import { describe, it, expect } from "vitest";
import { parseDurations, fmtCountdown } from "@/lib/planning/stepTimers.js";

const mins = (t) => parseDurations(t).map(d => d.minutes);

describe("parseDurations", () => {
  it("repère les minutes sous diverses formes", () => {
    expect(mins("cuire 6 minutes")).toEqual([6]);
    expect(mins("laisser 20 min à feu doux")).toEqual([20]);
    expect(mins("attendre 3min puis 10 mn")).toEqual([3, 10]);
  });

  it("gère l'exemple réel (environ 6 minutes de cuisson)", () => {
    const d = parseDurations("Quand les spaghetti sont encore très al dente (environ 6 minutes de cuisson), les égoutter.");
    expect(d).toEqual([{ minutes: 6, label: "6 min" }]);
  });

  it("convertit les heures", () => {
    expect(mins("reposer 1 h")).toEqual([60]);
    expect(mins("cuisson 1h30")).toEqual([90]);
    expect(mins("laisser 1 h 30 au frais")).toEqual([90]);
    expect(mins("2 heures de repos")).toEqual([120]);
  });

  it("déduplique et trie", () => {
    expect(mins("5 minutes puis encore 5 minutes, et 2 min")).toEqual([2, 5]);
  });

  it("ignore le bruit et les valeurs absurdes", () => {
    expect(mins("préchauffer à 180°C")).toEqual([]);
    expect(mins("mélanger doucement")).toEqual([]);
  });

  it("formate le compte à rebours", () => {
    expect(fmtCountdown(90)).toBe("1:30");
    expect(fmtCountdown(5)).toBe("0:05");
    expect(fmtCountdown(0)).toBe("0:00");
  });
});
