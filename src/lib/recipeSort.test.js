import { describe, it, expect } from "vitest";
import { makeComparator, defaultDirFor, dirLabel } from "./recipeSort.js";

const sortIds = (recipes, sortBy, sortDir) =>
  [...recipes].sort(makeComparator({ sortBy, sortDir, techniques: [], techIndex: {}, recipes })).map(r => r.id);

const RECIPES = [
  { id: "r1000000000000", name: "Zébu", createdAt: "2024-01-01", healthScore: 40, prepTime: 10, cookTime: 20 },
  { id: "r2000000000000", name: "Avocat", createdAt: "2024-03-01", healthScore: 90, prepTime: 5, cookTime: 0 },
  { id: "r3000000000000", name: "Mangue", createdAt: "2024-02-01", healthScore: 60 }, // pas de temps
];

describe("makeComparator", () => {
  it("trie par récence (desc = plus récent d'abord)", () => {
    expect(sortIds(RECIPES, "date", "desc")).toEqual(["r2000000000000", "r3000000000000", "r1000000000000"]);
    expect(sortIds(RECIPES, "date", "asc")).toEqual(["r1000000000000", "r3000000000000", "r2000000000000"]);
  });

  it("trie alphabétiquement dans les deux sens", () => {
    expect(sortIds(RECIPES, "name", "asc")).toEqual(["r2000000000000", "r3000000000000", "r1000000000000"]);
    expect(sortIds(RECIPES, "name", "desc")).toEqual(["r1000000000000", "r3000000000000", "r2000000000000"]);
  });

  it("trie par nutri-score (desc = meilleur d'abord)", () => {
    expect(sortIds(RECIPES, "health", "desc")).toEqual(["r2000000000000", "r3000000000000", "r1000000000000"]);
    expect(sortIds(RECIPES, "health", "asc")).toEqual(["r1000000000000", "r3000000000000", "r2000000000000"]);
  });

  it("trie par temps et relègue les recettes sans temps à la fin", () => {
    expect(sortIds(RECIPES, "time", "asc")).toEqual(["r2000000000000", "r1000000000000", "r3000000000000"]);
    // Même en desc, la recette sans temps reste en fin de liste.
    expect(sortIds(RECIPES, "time", "desc")).toEqual(["r1000000000000", "r2000000000000", "r3000000000000"]);
  });

  it("expose les sens par défaut et libellés", () => {
    expect(defaultDirFor("date")).toBe("desc");
    expect(defaultDirFor("time")).toBe("asc");
    expect(dirLabel("name", "asc")).toBe("A → Z");
    expect(dirLabel("time", "desc")).toBe("Plus long");
  });
});
