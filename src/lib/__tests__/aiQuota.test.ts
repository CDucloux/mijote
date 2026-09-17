import { describe, it, expect } from "vitest";
import { MONTHLY_CREDITS, DAILY_CREDITS, CREDIT_COST, creditCost, periodKeys, currentCredits, creditState, canImport } from "../aiQuota.js";

// Ces constantes DOIVENT rester alignées avec functions/quota.ts (autorité serveur).
describe("constantes (parité serveur)", () => {
  it("150 crédits/mois, soft cap 30/jour, photo = 2 crédits", () => {
    expect(MONTHLY_CREDITS).toBe(150);
    expect(DAILY_CREDITS).toBe(30);
    expect(CREDIT_COST).toEqual({ url: 1, text: 1, pdf: 1, photo: 2 });
    expect(creditCost("photo")).toBe(2);
    expect(creditCost("url")).toBe(1);
  });
});

describe("periodKeys (Europe/Paris)", () => {
  it("formate jour et mois locaux", () => {
    expect(periodKeys(new Date("2026-08-06T10:00:00Z"))).toEqual({ day: "2026-08-06", month: "2026-08" });
  });
});

describe("currentCredits", () => {
  const day = "2026-08-06", month = "2026-08";
  it("0 sans données", () => {
    expect(currentCredits(undefined, day, month)).toEqual({ dayCount: 0, monthCount: 0 });
  });
  it("reset jour si la clé jour a changé (mois conservé)", () => {
    expect(currentCredits({ creditsDay: "2026-08-05", creditsDayCount: 4, creditsMonth: month, creditsMonthCount: 40 }, day, month))
      .toEqual({ dayCount: 0, monthCount: 40 });
  });
  it("voit un ancien document (quotas par type) à zéro", () => {
    expect(currentCredits({ url: { day, dayCount: 3, month, monthCount: 30 } }, day, month))
      .toEqual({ dayCount: 0, monthCount: 0 });
  });
});

describe("creditState", () => {
  const now = new Date("2026-08-06T10:00:00Z");
  it("reliquat plein sans usage", () => {
    expect(creditState(null, now)).toMatchObject({ monthUsed: 0, monthLeft: 150, monthLimit: 150, dayUsed: 0, dayLeft: 30, dayLimit: 30 });
  });
  it("décompte les crédits consommés", () => {
    const s = creditState({ creditsDay: "2026-08-06", creditsDayCount: 4, creditsMonth: "2026-08", creditsMonthCount: 40 }, now);
    expect(s).toMatchObject({ monthUsed: 40, monthLeft: 110, dayUsed: 4, dayLeft: 26 });
  });
  it("ne descend jamais sous zéro", () => {
    const s = creditState({ creditsDay: "2026-08-06", creditsDayCount: 99, creditsMonth: "2026-08", creditsMonthCount: 999 }, now);
    expect(s).toMatchObject({ monthLeft: 0, dayLeft: 0 });
  });
});

describe("canImport", () => {
  const now = new Date("2026-08-06T10:00:00Z");
  it("autorise tant qu'il reste assez de crédits (mois et jour)", () => {
    expect(canImport(creditState(null, now), "url")).toBe(true);
    expect(canImport(creditState(null, now), "photo")).toBe(true);
  });
  it("refuse la photo (2 crédits) quand il ne reste qu'1 crédit sur le mois", () => {
    const s = creditState({ creditsDay: "2026-08-06", creditsDayCount: 0, creditsMonth: "2026-08", creditsMonthCount: MONTHLY_CREDITS - 1 }, now);
    expect(canImport(s, "photo")).toBe(false);
    expect(canImport(s, "url")).toBe(true);
  });
  it("refuse tout import quand le soft cap journalier est atteint", () => {
    const s = creditState({ creditsDay: "2026-08-06", creditsDayCount: DAILY_CREDITS, creditsMonth: "2026-08", creditsMonthCount: 40 }, now);
    expect(canImport(s, "url")).toBe(false);
  });
});
