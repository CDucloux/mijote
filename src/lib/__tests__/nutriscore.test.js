import { describe, it, expect } from "vitest";
import { computeNutriInfo, computeHealthScore } from "@/lib/recipes/nutriscore.js";

const DB = [
  { id: "beurre", name: "Beurre", nutrition: { calories: 745, fat: 82, saturatedFat: 51, salt: 0.02, sugar: 0.6, protein: 0.7, fiber: 0 } },
  { id: "carotte", name: "Carotte", nutrition: { calories: 41, sugar: 4.7, saturatedFat: 0.04, salt: 0.07, fiber: 2.8, protein: 0.9, isVegetable: true } },
];

describe("computeNutriInfo return shape", () => {
  it("always returns { score, letter } – even with no resolvable nutrition", () => {
    // lignes présentes mais aucune avec dbId/nutrition → masse nulle
    const r = computeNutriInfo([{ name: "Inconnu", amount: 100, unit: "g" }], DB, new Map());
    expect(r).toEqual({ score: 50, letter: null });
    // computeHealthScore en dérive un nombre, pas undefined
    expect(computeHealthScore([{ name: "Inconnu", amount: 100, unit: "g" }], DB, new Map())).toBe(50);
  });

  it("empty ingredient list returns the neutral shape", () => {
    expect(computeNutriInfo([], DB, new Map())).toEqual({ score: 50, letter: null });
  });

  it("scores a real ingredient line (letter in A..E, numeric score)", () => {
    const r = computeNutriInfo([{ dbId: "beurre", name: "Beurre", amount: 50, unit: "g" }], DB, new Map());
    expect(["A", "B", "C", "D", "E"]).toContain(r.letter);
    expect(typeof r.score).toBe("number");
  });
});
