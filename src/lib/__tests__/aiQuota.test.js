import { describe, it, expect } from "vitest";
import { LIMITS, periodKeys, currentCounts, remainingFor } from "../aiQuota.js";

// Ces limites DOIVENT rester alignées avec functions/quota.js (autorité serveur).
describe("LIMITS (parité serveur)", () => {
  it("url 5/jour 60/mois · photo 3/jour 30/mois", () => {
    expect(LIMITS).toEqual({ url: { day: 5, month: 60 }, photo: { day: 3, month: 30 } });
  });
});

describe("periodKeys (Europe/Paris)", () => {
  it("formate jour et mois locaux", () => {
    expect(periodKeys(new Date("2026-08-06T10:00:00Z"))).toEqual({ day: "2026-08-06", month: "2026-08" });
  });
});

describe("currentCounts", () => {
  const day = "2026-08-06", month = "2026-08";
  it("0 sans données", () => {
    expect(currentCounts(undefined, day, month)).toEqual({ dayCount: 0, monthCount: 0 });
  });
  it("reset jour si la clé jour a changé", () => {
    expect(currentCounts({ day: "2026-08-05", dayCount: 4, month, monthCount: 9 }, day, month))
      .toEqual({ dayCount: 0, monthCount: 9 });
  });
});

describe("remainingFor", () => {
  const now = new Date("2026-08-06T10:00:00Z");
  it("reliquat plein sans usage", () => {
    const r = remainingFor(null, "url", now);
    expect(r).toMatchObject({ dayLeft: 5, dayLimit: 5, monthLeft: 60, monthLimit: 60, blocked: false });
  });
  it("décompte l'usage du jour", () => {
    const r = remainingFor({ url: { day: "2026-08-06", dayCount: 2, month: "2026-08", monthCount: 2 } }, "url", now);
    expect(r).toMatchObject({ dayUsed: 2, dayLeft: 3, monthUsed: 2, monthLeft: 58, blocked: false });
  });
  it("blocked quand le jour est épuisé", () => {
    const r = remainingFor({ photo: { day: "2026-08-06", dayCount: 3, month: "2026-08", monthCount: 5 } }, "photo", now);
    expect(r).toMatchObject({ dayLeft: 0, blocked: true });
  });
  it("blocked quand le mois est épuisé (jour encore ok)", () => {
    const r = remainingFor({ url: { day: "2026-08-06", dayCount: 1, month: "2026-08", monthCount: 60 } }, "url", now);
    expect(r).toMatchObject({ dayLeft: 4, monthLeft: 0, blocked: true });
  });
});
