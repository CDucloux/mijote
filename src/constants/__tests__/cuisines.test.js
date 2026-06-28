import { describe, it, expect } from "vitest";
import { normalizeCuisine, cuisineEmoji } from "../cuisines.js";

describe("normalizeCuisine", () => {
  it("canonicalises case (française → Française)", () => {
    expect(normalizeCuisine("française")).toBe("Française");
    expect(normalizeCuisine("FRANÇAISE")).toBe("Française");
    expect(normalizeCuisine("  italienne ")).toBe("Italienne");
  });
  it("leaves an already-canonical label untouched", () => {
    expect(normalizeCuisine("Japonaise")).toBe("Japonaise");
  });
  it("keeps an unknown cuisine (trimmed) and returns '' for empty", () => {
    expect(normalizeCuisine("  Sénégalaise ")).toBe("Sénégalaise");
    expect(normalizeCuisine("")).toBe("");
    expect(normalizeCuisine(null)).toBe("");
  });
  it("the canonical form resolves to its emoji", () => {
    expect(cuisineEmoji(normalizeCuisine("française"))).toBe("🇫🇷");
  });
});
