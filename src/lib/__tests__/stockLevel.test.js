import { describe, it, expect } from "vitest";
import { stockLevelOf, nextStockLevel, applyStockLevel, recipesUsingIngredient } from "@/lib/food/stockLevel.js";
import { createIngredientResolver } from "@/lib/food/nameMatcher.js";

describe("stockLevelOf", () => {
  it("lit plein, bientôt vide (prioritaire) et à racheter", () => {
    const stock = new Set(["a", "b"]), low = new Set(["b"]);
    expect(stockLevelOf("a", stock, low)).toBe("full");
    expect(stockLevelOf("b", stock, low)).toBe("low");
    expect(stockLevelOf("c", stock, low)).toBe("empty");
  });
});

describe("nextStockLevel", () => {
  it("boucle à racheter, plein, bientôt vide", () => {
    expect(nextStockLevel("empty")).toBe("full");
    expect(nextStockLevel("full")).toBe("low");
    expect(nextStockLevel("low")).toBe("empty");
  });
});

describe("applyStockLevel", () => {
  const lists = { stock: ["a", "b"], lowStock: ["b"] };

  it("pose chaque niveau en gardant lowStock inclus dans stock", () => {
    expect(applyStockLevel(lists, "c", "full")).toEqual({ stock: ["a", "b", "c"], lowStock: ["b"] });
    expect(applyStockLevel(lists, "c", "low")).toEqual({ stock: ["a", "b", "c"], lowStock: ["b", "c"] });
    expect(applyStockLevel(lists, "b", "full")).toEqual({ stock: ["a", "b"], lowStock: [] });
    expect(applyStockLevel(lists, "b", "empty")).toEqual({ stock: ["a"], lowStock: [] });
    expect(applyStockLevel(lists, "a", "low")).toEqual({ stock: ["a", "b"], lowStock: ["b", "a"] });
  });

  it("rend les mêmes tableaux quand le niveau ne change pas", () => {
    const out = applyStockLevel(lists, "b", "low");
    expect(out.stock).toBe(lists.stock);
    expect(out.lowStock).toBe(lists.lowStock);
    const none = applyStockLevel(lists, "z", "empty");
    expect(none.stock).toBe(lists.stock);
    expect(none.lowStock).toBe(lists.lowStock);
  });

  it("n'ajoute pas de doublon", () => {
    expect(applyStockLevel(lists, "a", "full").stock).toEqual(["a", "b"]);
  });
});

describe("recipesUsingIngredient", () => {
  const db = [
    { id: "pc", name: "Pois chiches", category: "legume" },
    { id: "ci", name: "Citron", category: "fruit" },
    { id: "ta", name: "Tahini", category: "epicerie" },
    { id: "sel", name: "Sel", category: "condiment" },
    { id: "ri", name: "Riz", category: "feculent" },
  ];
  const resolver = createIngredientResolver(db);
  const line = (name, extra = {}) => ({ name, ...extra });
  const recipes = [
    { id: "r1", name: "Salade", ingredients: [line("pois chiches"), line("citron"), line("tahini")] },
    { id: "r2", name: "Houmous", ingredients: [line("Pois chiches"), line("Tahini"), line("Sel")] },
    { id: "r3", name: "Riz nature", ingredients: [line("riz"), line("sel")] },
    { id: "r4", name: "Bol", ingredients: [line("pois chiches"), line("Sauce maison", { recipeId: "base1" }), line("ingrédient inconnu")] },
  ];

  it("ne garde que les recettes qui utilisent l'ingrédient, les plus faisables d'abord", () => {
    const out = recipesUsingIngredient("pc", recipes, resolver, new Set(["pc", "ta"]));
    // r4 et r1 manquent chacun d'un ingrédient : départagés par nom (Bol < Salade).
    expect(out.map(r => r.recipe.id)).toEqual(["r2", "r4", "r1"]);
    expect(out[0].missing).toEqual([]);           // sel = basique, jamais manquant
    expect(out[2].missing).toEqual(["citron"]);   // libellé tel qu'écrit
  });

  it("compte une préparation de base absente comme manquante, ignore les lignes inconnues", () => {
    const bol = recipesUsingIngredient("pc", recipes, resolver, new Set()).find(r => r.recipe.id === "r4");
    expect(bol.missing).toEqual(["Sauce maison"]);
    const stocked = recipesUsingIngredient("pc", recipes, resolver, new Set(["base1"])).find(r => r.recipe.id === "r4");
    expect(stocked.missing).toEqual([]);
  });

  it("départage par nom à manques égaux, et dédoublonne les manques par fiche", () => {
    const twins = [
      { id: "b", name: "Bœuf", ingredients: [line("pois chiches"), line("citron"), line("Citron")] },
      { id: "a", name: "Avocat", ingredients: [line("pois chiches"), line("riz")] },
    ];
    const out = recipesUsingIngredient("pc", twins, resolver, new Set());
    expect(out.map(r => r.recipe.id)).toEqual(["a", "b"]);
    expect(out[1].missing).toEqual(["citron"]);
  });

  it("tolère une bibliothèque vide ou des recettes sans ingrédients", () => {
    expect(recipesUsingIngredient("pc", [], resolver, new Set())).toEqual([]);
    expect(recipesUsingIngredient("pc", [{ id: "x", name: "Vide" }], resolver, new Set())).toEqual([]);
  });
});
