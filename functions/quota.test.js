import { describe, it, expect } from "vitest";
import { LIMITS, periodKeys, currentCounts, quotaError } from "./quota.js";

describe("periodKeys", () => {
  it("formate jour YYYY-MM-DD et mois YYYY-MM en Europe/Paris", () => {
    // 2026-08-06 10:00 UTC → 12:00 Paris (été)
    const { day, month } = periodKeys(new Date("2026-08-06T10:00:00Z"));
    expect(day).toBe("2026-08-06");
    expect(month).toBe("2026-08");
  });
  it("bascule de journée selon le fuseau Paris, pas UTC", () => {
    // 2026-08-06 23:30 UTC → 01:30 Paris le 7 (été, +2)
    const { day } = periodKeys(new Date("2026-08-06T23:30:00Z"));
    expect(day).toBe("2026-08-07");
  });
});

describe("currentCounts", () => {
  const day = "2026-08-06", month = "2026-08";
  it("renvoie 0 quand aucune donnée", () => {
    expect(currentCounts(undefined, day, month)).toEqual({ dayCount: 0, monthCount: 0 });
  });
  it("conserve les compteurs quand jour et mois correspondent", () => {
    const data = { day, dayCount: 3, month, monthCount: 12 };
    expect(currentCounts(data, day, month)).toEqual({ dayCount: 3, monthCount: 12 });
  });
  it("remet le compteur jour à zéro sur changement de jour (mois conservé)", () => {
    const data = { day: "2026-08-05", dayCount: 3, month, monthCount: 12 };
    expect(currentCounts(data, day, month)).toEqual({ dayCount: 0, monthCount: 12 });
  });
  it("remet le compteur mois à zéro sur changement de mois", () => {
    const data = { day: "2026-07-31", dayCount: 3, month: "2026-07", monthCount: 12 };
    expect(currentCounts(data, day, month)).toEqual({ dayCount: 0, monthCount: 0 });
  });
});

describe("quotaError", () => {
  it("null tant qu'on est sous les limites", () => {
    expect(quotaError({ dayCount: 0, monthCount: 0 }, "url")).toBeNull();
    expect(quotaError({ dayCount: LIMITS.url.day - 1, monthCount: 0 }, "url")).toBeNull();
    expect(quotaError({ dayCount: 0, monthCount: 0 }, "photo")).toBeNull();
  });
  it("bloque au quota jour atteint (url = 5, photo = 3)", () => {
    expect(quotaError({ dayCount: 5, monthCount: 0 }, "url")).toMatch(/par jour/);
    expect(quotaError({ dayCount: 3, monthCount: 0 }, "photo")).toMatch(/par jour/);
  });
  it("bloque au quota mois atteint quand le jour est encore OK (url = 60, photo = 30)", () => {
    expect(quotaError({ dayCount: 0, monthCount: 60 }, "url")).toMatch(/ce mois-ci/);
    expect(quotaError({ dayCount: 0, monthCount: 30 }, "photo")).toMatch(/ce mois-ci/);
  });
  it("priorise le message jour quand les deux limites sont atteintes", () => {
    expect(quotaError({ dayCount: 5, monthCount: 60 }, "url")).toMatch(/par jour/);
  });
});
