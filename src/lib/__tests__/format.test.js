import { describe, it, expect } from "vitest";
import { fmtTime, relativeDate } from "../format.js";

describe("fmtTime", () => {
  it("renders an em dash for null/undefined", () => {
    expect(fmtTime(null)).toBe("–");
    expect(fmtTime(undefined)).toBe("–");
  });

  it("keeps 0 as a real value (0m), not a dash", () => {
    expect(fmtTime(0)).toBe("0m");
  });

  it("renders minutes under an hour", () => {
    expect(fmtTime(5)).toBe("5m");
    expect(fmtTime(59)).toBe("59m");
  });

  it("renders whole hours without minutes", () => {
    expect(fmtTime(60)).toBe("1h");
    expect(fmtTime(120)).toBe("2h");
  });

  it("zero-pads the minutes part of an h+m time", () => {
    expect(fmtTime(65)).toBe("1h05");
    expect(fmtTime(90)).toBe("1h30");
    expect(fmtTime(125)).toBe("2h05");
  });
});

describe("relativeDate", () => {
  const now = new Date("2026-06-28T12:00:00Z").getTime();
  const ago = (days) => now - days * 86400000;

  it("returns '' for missing/invalid timestamps", () => {
    expect(relativeDate(null, now)).toBe("");
    expect(relativeDate(undefined, now)).toBe("");
    expect(relativeDate("nope", now)).toBe("");
  });
  it("says aujourd'hui for today (or future)", () => {
    expect(relativeDate(now, now)).toBe("aujourd'hui");
    expect(relativeDate(ago(0.4), now)).toBe("aujourd'hui");
    expect(relativeDate(now + 5000, now)).toBe("aujourd'hui");
  });
  it("counts days with plural agreement", () => {
    expect(relativeDate(ago(1), now)).toBe("il y a 1 jour");
    expect(relativeDate(ago(2), now)).toBe("il y a 2 jours");
    expect(relativeDate(ago(6), now)).toBe("il y a 6 jours");
  });
  it("counts weeks", () => {
    expect(relativeDate(ago(7), now)).toBe("il y a 1 semaine");
    expect(relativeDate(ago(20), now)).toBe("il y a 2 semaines");
  });
  it("counts months (invariable)", () => {
    expect(relativeDate(ago(30), now)).toBe("il y a 1 mois");
    expect(relativeDate(ago(90), now)).toBe("il y a 3 mois");
  });
  it("counts years with plural agreement", () => {
    expect(relativeDate(ago(365), now)).toBe("il y a 1 an");
    expect(relativeDate(ago(365 * 3), now)).toBe("il y a 3 ans");
  });
});
