import { describe, it, expect } from "vitest";
import { validateRecipeSchema } from "../recipeSchema.js";

const base = { name: "Bœuf bourguignon" };

describe("validateRecipeSchema : chef", () => {
  it("accepte une recette sans chef ou avec un chef texte", () => {
    expect(validateRecipeSchema(base, "R")).toEqual([]);
    expect(validateRecipeSchema({ ...base, chef: "Adam Byatt" }, "R")).toEqual([]);
    expect(validateRecipeSchema({ ...base, chef: "" }, "R")).toEqual([]);
  });
  it("refuse un chef qui n'est pas une chaîne", () => {
    expect(validateRecipeSchema({ ...base, chef: 42 }, "R")).toEqual(['R : "chef" doit être une chaîne.']);
    expect(validateRecipeSchema({ ...base, chef: ["Adam"] }, "R")).toEqual(['R : "chef" doit être une chaîne.']);
  });
  it("refuse un chef trop long", () => {
    expect(validateRecipeSchema({ ...base, chef: "x".repeat(121) }, "R")).toEqual(['R : "chef" trop long (max 120 caractères).']);
    expect(validateRecipeSchema({ ...base, chef: "x".repeat(120) }, "R")).toEqual([]);
  });
});
