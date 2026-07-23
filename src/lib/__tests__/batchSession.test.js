import { describe, it, expect } from "vitest";
import { buildBatchSession, weekEntries } from "../batchSession.js";

const bechamel = { id: "bech", name: "Béchamel", isComponent: true, yield: { amount: 500, unit: "g" }, ingredients: [{ name: "Lait" }, { name: "Farine" }] };
const gratin = { id: "gratin", name: "Gratin", servings: 4, ingredients: [{ recipeId: "bech", amount: 300, unit: "g" }, { name: "Courgette" }] };
const lasagne = { id: "lasagne", name: "Lasagnes", servings: 6, ingredients: [{ recipeId: "bech", amount: 400, unit: "g" }] };
const salade = { id: "salade", name: "Salade", servings: 2, ingredients: [{ name: "Laitue" }] };
const recipes = [bechamel, gratin, lasagne, salade];

describe("buildBatchSession – plats", () => {
  it("regroupe les repas et déduit les cuissons via les portions réutilisées", () => {
    // lasagne planifiée 3× avec portions=3 → 1 seule cuisson pour 3 repas.
    const entries = [
      { recipeId: "lasagne", portions: 3 }, { recipeId: "lasagne", portions: 3 }, { recipeId: "lasagne", portions: 3 },
      { recipeId: "gratin", portions: 1 },
    ];
    const { dishes } = buildBatchSession(entries, recipes);
    const las = dishes.find(d => d.recipe.id === "lasagne");
    expect(las.meals).toBe(3);
    expect(las.cookings).toBe(1);        // réutilisation : une cuisson
    expect(las.servings).toBe(6);        // 1 × servings(6)
  });
});

describe("buildBatchSession – préparations de base", () => {
  it("agrège la base partagée entre plats, dans l'unité du rendement", () => {
    const entries = [{ recipeId: "gratin", portions: 1 }, { recipeId: "lasagne", portions: 1 }];
    const { bases } = buildBatchSession(entries, recipes);
    const bech = bases.find(b => b.recipe.id === "bech");
    expect(bech).toBeTruthy();
    expect(bech.amount).toBe(700);       // 300 (gratin) + 400 (lasagne)
    expect(bech.unit).toBe("g");
    expect(bech.shared).toBe(true);
    expect(bech.usedBy.sort()).toEqual(["Gratin", "Lasagnes"]);
  });
  it("multiplie par le nombre de cuissons", () => {
    // gratin (servings 4) planifié 2× portions=1 → 2 cuissons → 2 × 300 g de béchamel.
    const entries = [{ recipeId: "gratin", portions: 1 }, { recipeId: "gratin", portions: 1 }];
    const { bases } = buildBatchSession(entries, recipes);
    expect(bases.find(b => b.recipe.id === "bech").amount).toBe(600);
  });
  it("ignore les recettes sans base", () => {
    const { bases } = buildBatchSession([{ recipeId: "salade", portions: 1 }], recipes);
    expect(bases).toHaveLength(0);
  });
});

describe("weekEntries", () => {
  it("aplatit le mealPlan sur les dates données", () => {
    const mp = { "2026-07-01": [{ recipeId: "a" }], "2026-07-02": [{ recipeId: "b" }, { recipeId: "c" }] };
    expect(weekEntries(mp, ["2026-07-01", "2026-07-02"]).length).toBe(3);
    expect(weekEntries(mp, ["2026-07-03"]).length).toBe(0);
  });
});
