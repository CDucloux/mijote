import { describe, it, expect } from "vitest";
import { groupIngredientsByCategory, buildPendingComponents } from "../cookSession/misEnPlace.ts";

const CATEGORIES = {
  legume: { label: "Légumes", icon: "🥕", order: 1 },
  laitier: { label: "Produits laitiers", icon: "🧀", order: 2 },
  other: { label: "Autres", icon: "📦", order: 99 },
};

const DB = [
  { id: "carotte", name: "carotte", category: "legume", image: "carotte.png" },
  { id: "beurre", name: "beurre", category: "laitier", image: "beurre.png" },
];

describe("groupIngredientsByCategory", () => {
  it("returns an empty array when there are no ingredients", () => {
    expect(groupIngredientsByCategory([], DB, CATEGORIES)).toEqual([]);
    expect(groupIngredientsByCategory(null, DB, CATEGORIES)).toEqual([]);
  });

  it("groups ingredients by their db category, in configured order", () => {
    const groups = groupIngredientsByCategory(
      [
        { id: "a", dbId: "beurre", name: "beurre" },
        { id: "b", dbId: "carotte", name: "carotte" },
      ],
      DB,
      CATEGORIES,
    );
    expect(groups.map(g => g.key)).toEqual(["legume", "laitier"]);
    expect(groups[0].label).toBe("Légumes");
    expect(groups[0].items.map(i => i.id)).toEqual(["b"]);
  });

  it("resolves by name when dbId is missing, and falls back to 'other'", () => {
    const groups = groupIngredientsByCategory(
      [
        { id: "a", name: "carotte" },
        { id: "b", name: "objet mystere" },
      ],
      DB,
      CATEGORIES,
    );
    const byKey = Object.fromEntries(groups.map(g => [g.key, g]));
    expect(byKey.legume.items.map(i => i.id)).toEqual(["a"]);
    expect(byKey.other.items.map(i => i.id)).toEqual(["b"]);
  });

  it("omits empty categories", () => {
    const groups = groupIngredientsByCategory([{ id: "a", dbId: "carotte" }], DB, CATEGORIES);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("legume");
  });
});

describe("buildPendingComponents", () => {
  const sauce = { id: "sauce", name: "Sauce tomate", yield: { amount: 500, unit: "g" }, steps: [{ id: "s1", text: "cuire" }] };
  const recipesById = new Map([["sauce", sauce]]);

  it("returns [] without a recipe index", () => {
    const recipe = { ingredients: [{ id: "i1", recipeId: "sauce" }] };
    expect(buildPendingComponents(recipe, null, new Set(), 1)).toEqual([]);
  });

  it("keeps only component lines absent from stock", () => {
    const recipe = {
      ingredients: [
        { id: "i1", recipeId: "sauce", amount: 250, unit: "g" },
        { id: "i2", dbId: "carotte", amount: 2 },
      ],
    };
    const out = buildPendingComponents(recipe, recipesById, new Set(), 1);
    expect(out).toHaveLength(1);
    expect(out[0].comp.id).toBe("sauce");
    expect(out[0].line.id).toBe("i1");
  });

  it("drops components already in stock", () => {
    const recipe = { ingredients: [{ id: "i1", recipeId: "sauce", amount: 250, unit: "g" }] };
    expect(buildPendingComponents(recipe, recipesById, new Set(["sauce"]), 1)).toEqual([]);
  });

  it("ignores component lines whose recipe is unknown", () => {
    const recipe = { ingredients: [{ id: "i1", recipeId: "ghost" }] };
    expect(buildPendingComponents(recipe, recipesById, new Set(), 1)).toEqual([]);
  });

  it("scales nestedMult by mult times the consumed fraction", () => {
    const recipe = { ingredients: [{ id: "i1", recipeId: "sauce", amount: 250, unit: "g" }] };
    const out = buildPendingComponents(recipe, recipesById, new Set(), 2);
    // 250 g consommés sur 500 g produits = 0.5, x mult(2) = 1
    expect(out[0].nestedMult).toBeCloseTo(1, 5);
  });
});
