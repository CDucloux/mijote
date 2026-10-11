import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, it, expect } from "vitest";
import { parseCuisines, parseRecipeCategories, parseIngredientCategories, parseNutritionReferences } from "@/lib/data/referenceData.js";
import { sanitizeSources } from "@/lib/sources/recommendedSources.js";

const load = (file) => parse(readFileSync(`data/${file}`, "utf8"));

describe("parseCuisines", () => {
  it("keeps valid entries, trimmed, in file order", () => {
    expect(parseCuisines({ cuisines: [{ label: " Française ", emoji: "🇫🇷" }, { label: "Fusion", emoji: "🍴" }] }))
      .toEqual([{ label: "Française", emoji: "🇫🇷" }, { label: "Fusion", emoji: "🍴" }]);
  });
  it("drops malformed and duplicate (case-insensitive) entries", () => {
    const out = parseCuisines({ cuisines: [null, { label: "A" }, { emoji: "x" }, { label: "Thaï", emoji: "1" }, { label: "thaï", emoji: "2" }] });
    expect(out).toEqual([{ label: "Thaï", emoji: "1" }]);
  });
  it("returns an empty list for a malformed document", () => {
    expect(parseCuisines(null)).toEqual([]);
    expect(parseCuisines({ cuisines: "x" })).toEqual([]);
  });
});

describe("parseRecipeCategories", () => {
  it("splits meal and base families", () => {
    const out = parseRecipeCategories({ meal: [{ id: "plat", label: "Plat", emoji: "🍽️" }], base: [{ id: "fond", label: "Fond", emoji: "🥣" }] });
    expect(out.meal.map(c => c.id)).toEqual(["plat"]);
    expect(out.base.map(c => c.id)).toEqual(["fond"]);
  });
  it("keeps ids unique across both families (first wins)", () => {
    const out = parseRecipeCategories({
      meal: [{ id: "sauce", label: "Sauce", emoji: "a" }, { id: "sauce", label: "Bis", emoji: "b" }],
      base: [{ id: "sauce", label: "Sauce mère", emoji: "c" }, { id: "x", label: "", emoji: "d" }],
    });
    expect(out.meal).toHaveLength(1);
    expect(out.base).toEqual([]);
  });
  it("tolerates a missing family", () => {
    expect(parseRecipeCategories({})).toEqual({ meal: [], base: [] });
  });
});

describe("parseIngredientCategories", () => {
  it("indexes categories by key with their fields", () => {
    expect(parseIngredientCategories({ categories: { fruit: { label: "Fruits", color: "#80c080", icon: "🍎", order: 1 } } }))
      .toEqual({ fruit: { label: "Fruits", color: "#80c080", icon: "🍎", order: 1 } });
  });
  it("falls back on neutral values instead of dropping a labelled category", () => {
    expect(parseIngredientCategories({ categories: { a: { label: "A" }, b: { label: "B", color: "red", order: "2" } } })).toEqual({
      a: { label: "A", color: "#9a9490", icon: "📦", order: 0 },
      b: { label: "B", color: "#9a9490", icon: "📦", order: 1 },
    });
  });
  it("drops unlabelled entries and invalid keys", () => {
    expect(parseIngredientCategories({ categories: { a: {}, "Bad Key": { label: "X" }, c: "x" } })).toEqual({});
    expect(parseIngredientCategories(null)).toEqual({});
  });
});

describe("parseNutritionReferences", () => {
  it("keeps strictly positive finite amounts only", () => {
    expect(parseNutritionReferences({ daily: { calories: 2000, salt: 0, fat: -1, sugar: "90", fiber: 30 } }))
      .toEqual({ calories: 2000, fiber: 30 });
  });
  it("returns an empty map for a malformed document", () => {
    expect(parseNutritionReferences({ daily: [] })).toEqual({});
  });
});

describe("shipped data files", () => {
  it("cuisines.yaml parses without losing an entry", () => {
    const doc = load("cuisines.yaml");
    expect(parseCuisines(doc)).toHaveLength(doc.cuisines.length);
  });
  it("recipe-categories.yaml parses without losing an entry", () => {
    const doc = load("recipe-categories.yaml");
    const out = parseRecipeCategories(doc);
    expect(out.meal).toHaveLength(doc.meal.length);
    expect(out.base).toHaveLength(doc.base.length);
  });
  it("ingredient-categories.yaml keeps every key with valid colors and unique orders", () => {
    const doc = load("ingredient-categories.yaml");
    const out = parseIngredientCategories(doc);
    expect(Object.keys(out)).toEqual(Object.keys(doc.categories));
    expect(Object.values(out).every((c, i) => c.color === doc.categories[Object.keys(out)[i]].color)).toBe(true);
    expect(new Set(Object.values(out).map(c => c.order)).size).toBe(Object.keys(out).length);
  });
  it("sources.yaml parses without losing an entry", () => {
    const doc = load("sources.yaml");
    expect(sanitizeSources(doc.sources)).toHaveLength(doc.sources.length);
  });
  it("nutrition-references.yaml covers the nutrients the app displays", () => {
    const out = parseNutritionReferences(load("nutrition-references.yaml"));
    for (const key of ["calories", "fat", "saturatedFat", "carbs", "sugar", "fiber", "protein", "salt", "omega3"]) expect(out[key]).toBeGreaterThan(0);
  });
});
