import { describe, it, expect } from "vitest";
import { matchesTrackingFilter, countTrackingFilters } from "@/lib/food/ingredientTracking.js";

const full = { status: "validated", image: "x.jpg", nutrition: { calories: 52 } };
const bare = {};

describe("matchesTrackingFilter", () => {
  it("accepte tout sans filtre", () => {
    expect(matchesTrackingFilter(bare, null)).toBe(true);
  });
  it("sépare validés et en cours (statut absent = en cours)", () => {
    expect(matchesTrackingFilter(full, "validated")).toBe(true);
    expect(matchesTrackingFilter(full, "draft")).toBe(false);
    expect(matchesTrackingFilter(bare, "draft")).toBe(true);
    expect(matchesTrackingFilter({ status: "draft" }, "validated")).toBe(false);
  });
  it("détecte l'absence de photo, chaîne vide comprise", () => {
    expect(matchesTrackingFilter({ image: "" }, "no-image")).toBe(true);
    expect(matchesTrackingFilter(full, "no-image")).toBe(false);
  });
  it("compte sans nutrition une fiche sans calories, même avec d'autres valeurs", () => {
    expect(matchesTrackingFilter(bare, "no-nutrition")).toBe(true);
    expect(matchesTrackingFilter({ nutrition: { protein: 3 } }, "no-nutrition")).toBe(true);
    expect(matchesTrackingFilter({ nutrition: { calories: 0 } }, "no-nutrition")).toBe(false);
  });
});

describe("countTrackingFilters", () => {
  it("renvoie des zéros sur une base vide", () => {
    expect(countTrackingFilters([])).toEqual({ all: 0, draft: 0, validated: 0, "no-image": 0, "no-nutrition": 0 });
  });
  it("compte chaque filtre indépendamment", () => {
    expect(countTrackingFilters([full, bare, { status: "validated" }])).toEqual({
      all: 3, draft: 1, validated: 2, "no-image": 2, "no-nutrition": 2,
    });
  });
});
