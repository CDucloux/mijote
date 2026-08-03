import { describe, it, expect } from "vitest";
import { buildBatchSession, weekEntries } from "@/lib/planning/batchSession.js";

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

import { buildMiseEnPlace, groupCookings } from "@/lib/planning/batchSession.js";

describe("buildMiseEnPlace – mutualisation par ingrédient", () => {
  // Deux recettes qui partagent l'oignon : on doit sommer, estimer les pièces, et
  // remonter le geste de préparation + les recettes concernées.
  const curry = { id: "curry", name: "Curry", servings: 2, ingredients: [{ dbId: "oignon", name: "Oignon", amount: 200, unit: "g" }, { dbId: "tomate", name: "Tomate", amount: 3, unit: "" }] };
  const soupe = { id: "soupe", name: "Soupe", servings: 2, ingredients: [{ dbId: "oignon", name: "Oignon", amount: 300, unit: "g" }] };
  const recs = [curry, soupe];
  const recipesById = new Map(recs.map(r => [r.id, r]));
  const ingredientDB = [
    { id: "oignon", name: "Oignon", category: "vegetable", gramsPerPiece: 110, tips: [{ type: "prep", text: "Émincer finement" }] },
    { id: "tomate", name: "Tomate", category: "vegetable", gramsPerPiece: 120 },
  ];

  it("somme un ingrédient partagé et estime les pièces", () => {
    const { dishes } = buildBatchSession([{ recipeId: "curry", portions: 1 }, { recipeId: "soupe", portions: 1 }], recs);
    const cat = (c) => ({ vegetable: 0, other: 99 }[c] ?? 99);
    const groups = buildMiseEnPlace(dishes, { recipesById, ingredientDB, categoryOrder: cat });
    const veg = groups.find(g => g.category === "vegetable");
    const oignon = veg.items.find(i => i.dbId === "oignon");
    expect(oignon.amount).toBe(500);            // 200 + 300
    expect(oignon.pieces).toBe(5);              // 500 g / 110 g ≈ 5 (arrondi)
    expect(oignon.prepTip).toBe("Émincer finement");
    expect(oignon.usedBy.sort()).toEqual(["Curry", "Soupe"]);
  });

  it("multiplie par le nombre de cuissons", () => {
    // curry planifié 2× portions=1 → 2 cuissons → 2 × 200 g d'oignon.
    const { dishes } = buildBatchSession([{ recipeId: "curry", portions: 1 }, { recipeId: "curry", portions: 1 }], recs);
    const groups = buildMiseEnPlace(dishes, { recipesById, ingredientDB });
    const oignon = groups.flatMap(g => g.items).find(i => i.dbId === "oignon");
    expect(oignon.amount).toBe(400);
  });
});

describe("groupCookings – cuissons mutualisées", () => {
  it("regroupe les plats partageant le même appareil (≥ 2)", () => {
    const g1 = { id: "g1", name: "Gratin", utensils: [{ name: "Plat à gratin" }] };
    const g2 = { id: "g2", name: "Légumes rôtis", utensils: [{ name: "Four" }] };
    const p1 = { id: "p1", name: "Poêlée", utensils: [{ name: "Poêle" }] };
    const dishes = [g1, g2, p1].map(r => ({ recipe: r, meals: 1, cookings: 1, servings: 2 }));
    const groups = groupCookings(dishes);
    const four = groups.find(g => g.method === "four");
    expect(four).toBeTruthy();
    expect(four.dishes.map(d => d.recipe.id).sort()).toEqual(["g1", "g2"]); // les 2 vont au four
    expect(groups.find(g => g.method === "plaques")).toBeFalsy();            // un seul plat → pas de mutualisation
  });
});
