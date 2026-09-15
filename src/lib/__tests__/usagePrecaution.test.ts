import { describe, it, expect } from "vitest";
import {
  isPrecautionTone,
  precautionVisual,
  PRECAUTION_TONES,
  resolveUsagePrecaution,
} from "@/lib/utensils/usagePrecaution.js";

describe("isPrecautionTone", () => {
  it("accepts known tones only", () => {
    expect(isPrecautionTone("info")).toBe(true);
    expect(isPrecautionTone("heat")).toBe(true);
    expect(isPrecautionTone("warning")).toBe(true);
    expect(isPrecautionTone("danger")).toBe(false);
    expect(isPrecautionTone(undefined)).toBe(false);
  });
});

describe("precautionVisual", () => {
  it("maps a known tone to its visual", () => {
    expect(precautionVisual("warning")).toBe(PRECAUTION_TONES.warning);
  });
  it("falls back to heat for missing or unknown tones", () => {
    expect(precautionVisual(undefined)).toBe(PRECAUTION_TONES.heat);
    expect(precautionVisual("nope")).toBe(PRECAUTION_TONES.heat);
  });
  // Non-regression : les icones referencent le set maison (Icon.jsx), jamais un
  // emoji. On verifie qu'aucune tonalite ne porte de caractere hors ASCII.
  it("uses icon-set names, never emoji", () => {
    for (const { icon } of Object.values(PRECAUTION_TONES)) {
      expect(icon).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});

describe("resolveUsagePrecaution", () => {
  it("returns null for nullish items or items without precaution", () => {
    expect(resolveUsagePrecaution(null)).toBeNull();
    expect(resolveUsagePrecaution(undefined)).toBeNull();
    expect(resolveUsagePrecaution({ id: "u", name: "Fouet" })).toBeNull();
  });
  it("returns null when title or description is missing", () => {
    expect(resolveUsagePrecaution({ id: "u", usagePrecaution: { title: "T", description: "" } })).toBeNull();
    expect(resolveUsagePrecaution({ id: "u", usagePrecaution: { title: "  ", description: "D" } })).toBeNull();
  });
  it("normalizes a complete precaution and defaults the tone to heat", () => {
    expect(resolveUsagePrecaution({
      id: "u",
      usagePrecaution: { title: "  Évitez le feu maximum  ", description: "  La fonte accumule la chaleur.  " },
    })).toEqual({ tone: "heat", title: "Évitez le feu maximum", description: "La fonte accumule la chaleur." });
  });
  it("keeps a valid tone and tip, drops a blank tip", () => {
    expect(resolveUsagePrecaution({
      id: "u",
      usagePrecaution: { tone: "warning", title: "T", description: "D", tip: " Commence doux. " },
    })).toEqual({ tone: "warning", title: "T", description: "D", tip: "Commence doux." });
    const noTip = resolveUsagePrecaution({ id: "u", usagePrecaution: { tone: "bogus" as never, title: "T", description: "D", tip: "  " } });
    expect(noTip).toEqual({ tone: "heat", title: "T", description: "D" });
  });
});
