import { describe, it, expect } from "vitest";
import { GIFT_RECIPE, GIFT_OFFER } from "../giftRecipe.js";
import { prepareRecipeImport } from "@/lib/recipes/recipeImport.js";

// La recette cadeau est servie via le MÊME pipeline qu'un import réel. Elle doit
// donc être cohérente (titre, ingrédients, étapes) et traverser le préparateur
// d'import sans planter, même avec des bases de rapprochement vides.
describe("GIFT_RECIPE", () => {
  it("porte un titre, des ingrédients et des étapes exploitables", () => {
    expect(GIFT_RECIPE.name?.trim()).toBeTruthy();
    expect(GIFT_RECIPE.ingredients?.length).toBeGreaterThan(0);
    expect(GIFT_RECIPE.steps?.length).toBeGreaterThan(0);
    expect(Number(GIFT_RECIPE.servings)).toBeGreaterThan(0);
  });

  it("a des lignes d'ingrédients nommées et des étapes avec du texte", () => {
    for (const i of GIFT_RECIPE.ingredients ?? []) {
      expect(i.name?.trim()).toBeTruthy();
    }
    for (const s of GIFT_RECIPE.steps ?? []) {
      expect(s.text?.trim()).toBeTruthy();
    }
  });

  it("nomme chaque ustensile proposé", () => {
    for (const u of GIFT_RECIPE.utensils ?? []) {
      expect(u.name?.trim()).toBeTruthy();
    }
  });

  it("traverse prepareRecipeImport sans erreur (bases vides)", () => {
    const res = prepareRecipeImport(JSON.stringify(GIFT_RECIPE), { ingredientDB: [], utensilDB: [] });
    expect("prepared" in res).toBe(true);
    if ("prepared" in res) {
      expect(res.prepared[0]?.name).toBe(GIFT_RECIPE.name);
    }
  });
});

describe("GIFT_OFFER", () => {
  it("expose un titre aligné sur la recette et une accroche", () => {
    expect(GIFT_OFFER.title).toBe(GIFT_RECIPE.name);
    expect(GIFT_OFFER.teaser.trim()).toBeTruthy();
  });
});
