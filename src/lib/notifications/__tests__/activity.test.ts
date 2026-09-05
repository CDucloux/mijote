import { describe, it, expect } from "vitest";
import { dayBucketLabel, countUnread } from "../activity.js";

describe("dayBucketLabel", () => {
  // `now` fixe : mercredi 9 septembre 2026, 14h00 locale.
  const now = new Date(2026, 8, 9, 14, 0, 0).getTime();

  it("même jour civil → « Aujourd'hui » (même tôt le matin)", () => {
    expect(dayBucketLabel(now, now)).toBe("Aujourd'hui");
    expect(dayBucketLabel(new Date(2026, 8, 9, 0, 5, 0).getTime(), now)).toBe("Aujourd'hui");
    expect(dayBucketLabel(new Date(2026, 8, 9, 23, 59, 0).getTime(), now)).toBe("Aujourd'hui");
  });

  it("veille → « Hier », y compris juste après minuit", () => {
    expect(dayBucketLabel(new Date(2026, 8, 8, 23, 55, 0).getTime(), now)).toBe("Hier");
    expect(dayBucketLabel(new Date(2026, 8, 8, 0, 1, 0).getTime(), now)).toBe("Hier");
  });

  it("2 à 6 jours → nom du jour, 1re lettre capitale", () => {
    // 6 sept 2026 = dimanche
    expect(dayBucketLabel(new Date(2026, 8, 6, 10, 0, 0).getTime(), now)).toBe("Dimanche");
    // 4 sept 2026 = vendredi
    expect(dayBucketLabel(new Date(2026, 8, 4, 10, 0, 0).getTime(), now)).toBe("Vendredi");
  });

  it("au-delà de 6 jours → date courte jour + mois", () => {
    expect(dayBucketLabel(new Date(2026, 7, 20, 10, 0, 0).getTime(), now)).toBe("20 août");
  });
});

describe("countUnread", () => {
  const acts = [{ ts: 300 }, { ts: 200 }, { ts: 100 }];

  it("jamais consulté (lastSeen = 0) → tout est non lu", () => {
    expect(countUnread(acts, 0)).toBe(3);
  });

  it("ne compte que les évènements strictement postérieurs à lastSeen", () => {
    expect(countUnread(acts, 200)).toBe(1);
    expect(countUnread(acts, 150)).toBe(2);
  });

  it("tout consulté → 0", () => {
    expect(countUnread(acts, 300)).toBe(0);
    expect(countUnread(acts, 999)).toBe(0);
  });

  it("flux vide → 0", () => {
    expect(countUnread([], 0)).toBe(0);
  });
});
