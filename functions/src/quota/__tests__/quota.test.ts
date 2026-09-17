import { describe, it, expect } from "vitest";
import { MONTHLY_CREDITS, DAILY_CREDITS, CREDIT_COST, creditCost, periodKeys, currentCredits, creditsError } from "../quota.js";

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

describe("creditCost", () => {
  it("1 crédit pour lien / texte / PDF, 2 pour la photo", () => {
    expect(CREDIT_COST).toEqual({ url: 1, text: 1, pdf: 1, photo: 2 });
    expect(creditCost("url")).toBe(1);
    expect(creditCost("text")).toBe(1);
    expect(creditCost("pdf")).toBe(1);
    expect(creditCost("photo")).toBe(2);
  });
});

describe("currentCredits", () => {
  const day = "2026-08-06", month = "2026-08";
  it("renvoie 0 quand aucune donnée", () => {
    expect(currentCredits(undefined, day, month)).toEqual({ dayCount: 0, monthCount: 0 });
  });
  it("conserve les compteurs quand jour et mois correspondent", () => {
    const data = { creditsDay: day, creditsDayCount: 3, creditsMonth: month, creditsMonthCount: 12 };
    expect(currentCredits(data, day, month)).toEqual({ dayCount: 3, monthCount: 12 });
  });
  it("remet le compteur jour à zéro sur changement de jour (mois conservé)", () => {
    const data = { creditsDay: "2026-08-05", creditsDayCount: 3, creditsMonth: month, creditsMonthCount: 12 };
    expect(currentCredits(data, day, month)).toEqual({ dayCount: 0, monthCount: 12 });
  });
  it("remet le compteur mois à zéro sur changement de mois", () => {
    const data = { creditsDay: "2026-07-31", creditsDayCount: 3, creditsMonth: "2026-07", creditsMonthCount: 12 };
    expect(currentCredits(data, day, month)).toEqual({ dayCount: 0, monthCount: 0 });
  });
  it("voit un ancien document (quotas par type, sans champ credits*) à zéro", () => {
    const legacy = { url: { day, dayCount: 4, month, monthCount: 40 } };
    expect(currentCredits(legacy, day, month)).toEqual({ dayCount: 0, monthCount: 0 });
  });
});

describe("creditsError", () => {
  it("null tant qu'il reste des crédits sur le mois et le jour", () => {
    expect(creditsError({ dayCount: 0, monthCount: 0 }, "url")).toBeNull();
    expect(creditsError({ dayCount: 0, monthCount: MONTHLY_CREDITS - 1 }, "url")).toBeNull();
    expect(creditsError({ dayCount: 0, monthCount: MONTHLY_CREDITS - 2 }, "photo")).toBeNull();
  });
  it("bloque quand le coût dépasserait le pool mensuel (message mois)", () => {
    expect(creditsError({ dayCount: 0, monthCount: MONTHLY_CREDITS }, "url")).toMatch(/ce mois-ci/);
    // 1 crédit restant mais une photo en coûte 2 → refusée
    expect(creditsError({ dayCount: 0, monthCount: MONTHLY_CREDITS - 1 }, "photo")).toMatch(/ce mois-ci/);
  });
  it("bloque au soft cap journalier quand le mois est encore ouvert", () => {
    expect(creditsError({ dayCount: DAILY_CREDITS, monthCount: 0 }, "url")).toMatch(/aujourd'hui/);
    expect(creditsError({ dayCount: DAILY_CREDITS - 1, monthCount: 0 }, "photo")).toMatch(/aujourd'hui/);
  });
  it("le mois épuisé prime sur le jour dans le message", () => {
    expect(creditsError({ dayCount: DAILY_CREDITS, monthCount: MONTHLY_CREDITS }, "url")).toMatch(/ce mois-ci/);
  });
});
