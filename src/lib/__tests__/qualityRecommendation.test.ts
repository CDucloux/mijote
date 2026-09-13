import { describe, it, expect } from "vitest";
import {
  isIngredientForm,
  normalizePreferredForms,
  formatPreferredForms,
  resolveQualityRecommendation,
} from "@/lib/food/qualityRecommendation.js";

describe("isIngredientForm", () => {
  it("accepts known forms, rejects the rest", () => {
    expect(isIngredientForm("fresh")).toBe(true);
    expect(isIngredientForm("frozen")).toBe(true);
    expect(isIngredientForm("gaseous")).toBe(false);
    expect(isIngredientForm(null)).toBe(false);
    expect(isIngredientForm(3)).toBe(false);
  });
});

describe("normalizePreferredForms", () => {
  it("filters unknown, dedupes and reorders to the canonical order", () => {
    expect(normalizePreferredForms(["frozen", "fresh", "frozen", "wat"])).toEqual(["fresh", "frozen"]);
  });
  it("returns an empty array when nothing is valid", () => {
    expect(normalizePreferredForms([])).toEqual([]);
    expect(normalizePreferredForms(["x", 1, null])).toEqual([]);
  });
});

describe("formatPreferredForms", () => {
  it("builds a capitalized recommendation label", () => {
    expect(formatPreferredForms(["fresh", "frozen"])).toBe("Frais ou surgelé recommandé");
    expect(formatPreferredForms(["fresh"])).toBe("Frais recommandé");
    expect(formatPreferredForms(["canned", "fresh", "dried"])).toBe("Frais, en conserve ou séché recommandé");
  });
  it("is empty when there is nothing to recommend", () => {
    expect(formatPreferredForms([])).toBe("");
  });
});

describe("resolveQualityRecommendation", () => {
  it("returns null for nullish items or items without recommendation", () => {
    expect(resolveQualityRecommendation(null)).toBeNull();
    expect(resolveQualityRecommendation(undefined)).toBeNull();
    expect(resolveQualityRecommendation({ id: "x", name: "Tomate" })).toBeNull();
  });
  it("returns null when preferredForms is missing, malformed or empty", () => {
    expect(resolveQualityRecommendation({ id: "x", qualityRecommendation: {} as never })).toBeNull();
    expect(resolveQualityRecommendation({ id: "x", qualityRecommendation: { preferredForms: [] } })).toBeNull();
    expect(resolveQualityRecommendation({ id: "x", qualityRecommendation: { preferredForms: ["nope"] as never } })).toBeNull();
  });
  it("resolves forms, derives the label and keeps a non-empty message", () => {
    const r = resolveQualityRecommendation({
      id: "db_i_petits_pois",
      qualityRecommendation: { preferredForms: ["frozen", "fresh"], message: "  Privilégiez frais ou surgelé.  " },
    });
    expect(r).toEqual({ forms: ["fresh", "frozen"], label: "Frais ou surgelé recommandé", message: "Privilégiez frais ou surgelé." });
  });
  it("omits a blank message", () => {
    const r = resolveQualityRecommendation({ id: "x", qualityRecommendation: { preferredForms: ["fresh"], message: "   " } });
    expect(r?.message).toBeUndefined();
    expect(r?.label).toBe("Frais recommandé");
  });
});
