import { describe, it, expect } from "vitest";
import {
  ingredientMonths, isIngredientInSeason, recipeSeasonScore, isRecipeInSeason,
  parseMonths, formatMonths,
} from "../seasonality.js";

describe("ingredientMonths", () => {
  it("returns null when months is missing or not an array", () => {
    expect(ingredientMonths({})).toBeNull();
    expect(ingredientMonths({ months: "1-3" })).toBeNull();
  });
  it("returns null for a 12-month (year-round) ingredient — no seasonal signal", () => {
    expect(ingredientMonths({ months: [1,2,3,4,5,6,7,8,9,10,11,12] })).toBeNull();
  });
  it("dedupes, sorts and filters out-of-range values", () => {
    expect(ingredientMonths({ months: [6, 6, 13, 0, 3, 5] })).toEqual([3, 5, 6]);
  });
});

describe("isIngredientInSeason", () => {
  const tomato = { months: [6, 7, 8, 9] };
  it("is true within the window", () => {
    expect(isIngredientInSeason(tomato, 7)).toBe(true);
  });
  it("is false outside the window", () => {
    expect(isIngredientInSeason(tomato, 1)).toBe(false);
  });
  it("returns null when there is no seasonal data", () => {
    expect(isIngredientInSeason({}, 7)).toBeNull();
  });
});

describe("recipeSeasonScore", () => {
  const db = {
    tomate: { id: "tomate", months: [6, 7, 8, 9] },
    courge: { id: "courge", months: [10, 11, 12, 1] },
    sel: { id: "sel" }, // no months → ignored
  };
  const resolver = name => db[name] || null;
  const recipe = { ingredients: [{ name: "tomate" }, { name: "courge" }, { name: "sel" }] };

  it("scores the share of seasonal ingredients in season", () => {
    // July: tomate in, courge out → 1/2 = 50
    expect(recipeSeasonScore(recipe, resolver, 7)).toEqual({ score: 50, total: 2, inSeason: 1 });
  });
  it("ignores ingredients with no seasonal data", () => {
    const r = recipeSeasonScore(recipe, resolver, 7);
    expect(r.total).toBe(2); // sel excluded
  });
  it("does not double-count the same resolved ingredient", () => {
    const dupe = { ingredients: [{ name: "tomate" }, { name: "tomate" }] };
    expect(recipeSeasonScore(dupe, resolver, 7).total).toBe(1);
  });
  it("returns null when no seasonal ingredient is identifiable", () => {
    expect(recipeSeasonScore({ ingredients: [{ name: "sel" }] }, resolver, 7)).toBeNull();
  });
});

describe("isRecipeInSeason", () => {
  const db = { tomate: { id: "tomate", months: [6, 7, 8] } };
  const resolver = name => db[name] || null;
  it("is true at/above the 50% threshold", () => {
    expect(isRecipeInSeason({ ingredients: [{ name: "tomate" }] }, resolver, 7)).toBe(true);
  });
  it("is false below threshold", () => {
    expect(isRecipeInSeason({ ingredients: [{ name: "tomate" }] }, resolver, 1)).toBe(false);
  });
});

describe("parseMonths / formatMonths round-trip", () => {
  it("parses ranges and singletons", () => {
    expect(parseMonths("1-3,11-12")).toEqual([1, 2, 3, 11, 12]);
    expect(parseMonths("4-6")).toEqual([4, 5, 6]);
    expect(parseMonths("1, 7 , 12")).toEqual([1, 7, 12]);
  });
  it("is robust to disorder and out-of-range", () => {
    expect(parseMonths("12,1,99,-5")).toEqual([1, 12]);
  });
  it("compresses consecutive runs into ranges", () => {
    expect(formatMonths([1, 2, 3, 11, 12])).toBe("1-3,11-12");
    expect(formatMonths([5])).toBe("5");
    expect(formatMonths([1, 3, 5])).toBe("1,3,5");
  });
  it("round-trips parse → format", () => {
    expect(formatMonths(parseMonths("1-3,11-12"))).toBe("1-3,11-12");
  });
});
