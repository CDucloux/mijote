import { describe, it, expect } from "vitest";
import { activityCounts, activityLevel, buildHeatmap } from "../cookingActivity.js";

describe("activityCounts", () => {
  it("compte les items par jour, ignore les jours vides", () => {
    const m = activityCounts({ "2026-07-01": [{}, {}], "2026-07-02": [], "2026-07-03": [{}] });
    expect(m.get("2026-07-01")).toBe(2);
    expect(m.has("2026-07-02")).toBe(false);
    expect(m.get("2026-07-03")).toBe(1);
  });
});

describe("activityLevel", () => {
  it("échelonne 0..4", () => {
    expect(activityLevel(0)).toBe(0);
    expect(activityLevel(2)).toBe(1);
    expect(activityLevel(4)).toBe(2);
    expect(activityLevel(6)).toBe(3);
    expect(activityLevel(9)).toBe(4);
  });
});

describe("buildHeatmap", () => {
  const end = new Date("2026-07-15T12:00:00");
  it("agrège total, jours actifs et max sur la fenêtre", () => {
    const mp = { "2026-07-15": [{}, {}], "2026-07-14": [{}], "2026-07-10": [{}, {}, {}] };
    const h = buildHeatmap(mp, { weeks: 8, end });
    expect(h.total).toBe(6);
    expect(h.activeDays).toBe(3);
    expect(h.max).toBe(3);
  });
  it("colonnes de 7 jours, dernier jour = end, jours futurs marqués", () => {
    const h = buildHeatmap({}, { weeks: 4, end });
    expect(h.cols.every(c => c.length === 7)).toBe(true);
    const flat = h.cols.flat();
    expect(flat.some(d => d.key === "2026-07-15")).toBe(true);
    // au-delà de end (fin de semaine en cours) → future
    expect(flat.some(d => d.future)).toBe(true);
  });
  it("compte les 7 derniers jours (thisWeek) et la série courante", () => {
    const mp = { "2026-07-15": [{}], "2026-07-14": [{}], "2026-07-13": [{}], "2026-07-11": [{}] };
    const h = buildHeatmap(mp, { weeks: 6, end });
    expect(h.thisWeek).toBe(4);
    expect(h.streak).toBe(3); // 15, 14, 13 consécutifs, coupé le 12
  });
});
