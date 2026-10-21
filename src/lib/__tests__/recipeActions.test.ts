import { describe, it, expect } from "vitest";
import { prepareRecipeForSave, upsertRecipe, buildShoppingItems } from "@/lib/recipes/recipeActions.js";

const existing = { id: "r1", name: "Tarte", ingredients: [] };

describe("prepareRecipeForSave", () => {
  it("nouvelle recette : reçoit un identifiant et une date de création", () => {
    const res = prepareRecipeForSave({ name: "Soupe", ingredients: [] }, { recipes: [existing], ingredientDB: [] });
    expect("recipe" in res && res.recipe.id).toMatch(/^r\d+$/);
  });
  it("édition : garde son identifiant (non-régression du typage SavedRecipe)", () => {
    const res = prepareRecipeForSave({ ...existing, name: "Tarte fine" }, { recipes: [existing], ingredientDB: [] });
    expect("recipe" in res && res.recipe.id).toBe("r1");
  });
  it("refuse un nom déjà pris ou vide", () => {
    expect(prepareRecipeForSave({ name: "tarte", ingredients: [] }, { recipes: [existing], ingredientDB: [] })).toHaveProperty("error");
    expect(prepareRecipeForSave({ name: "  ", ingredients: [] }, { recipes: [existing], ingredientDB: [] })).toHaveProperty("error");
  });
});

describe("upsertRecipe", () => {
  it("remplace sur place une recette connue, insère en tête une nouvelle", () => {
    const list = [existing, { id: "r2", name: "Soupe" }];
    expect(upsertRecipe(list, { id: "r2", name: "Velouté" }).map(r => r.name)).toEqual(["Tarte", "Velouté"]);
    expect(upsertRecipe(list, { id: "r3", name: "Gratin" }).map(r => r.id)).toEqual(["r3", "r1", "r2"]);
  });
});

describe("buildShoppingItems", () => {
  it("ligne sans nom : article nommé vide plutôt qu'indéfini", () => {
    const [item] = buildShoppingItems({ ingredients: [{ amount: 2, unit: "g" }] }, null, 1, [], new Map(), new Set());
    expect(item.name).toBe("");
    expect(item).toMatchObject({ amount: 2, unit: "g", checked: false });
  });
  it("applique le multiplicateur et l'image de la base", () => {
    const [item] = buildShoppingItems({ ingredients: [{ name: "Farine", dbId: "farine", amount: 100, unit: "g" }] }, null, 2, [{ id: "farine", image: "f.png" }], new Map(), new Set());
    expect(item).toMatchObject({ name: "Farine", amount: 200, image: "f.png" });
  });
});
