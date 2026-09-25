import { describe, it, expect } from "vitest";
import { computeDayIntake } from "@/lib/planning/dayIntake.js";

// Base minimale : sel pur (100 g de sel / 100 g), riz sans sel, un ingrédient sans
// aucune donnée nutritionnelle (pour éprouver la couverture).
const ingredientDB = [
  { id: "sel", name: "Sel", nutrition: { salt: 100, calories: 0 } },
  { id: "riz", name: "Riz", nutrition: { salt: 0, calories: 350 } },
  { id: "prot", name: "Protéine", nutrition: { protein: 100, calories: 0 } },
  { id: "myst", name: "Mystère" },
];
// Plat pour 1 portion apportant `g` grammes de protéines.
const proteinDish = (id, g) => ({ id, name: id, servings: 1, ingredients: [{ name: "Protéine", dbId: "prot", amount: g, unit: "g" }] });

// Plat pour 1 portion apportant `g` grammes de sel (dbId figé pour un match direct).
const saltyDish = (id, g) => ({ id, name: id, servings: 1, ingredients: [{ name: "Sel", dbId: "sel", amount: g, unit: "g" }] });
const byId = (recipes) => new Map(recipes.map(r => [r.id, r]));

describe("computeDayIntake", () => {
  it("renvoie une journée vide et non fiable sans repas", () => {
    const r = computeDayIntake([], new Map(), ingredientDB);
    expect(r.salt).toBe(0);
    expect(r.meals).toBe(0);
    expect(r.reliable).toBe(false);
    expect(r.level).toBe("ok");
  });

  it("somme le sel PAR PORTION de chaque repas du jour", () => {
    const recipes = [saltyDish("a", 2), saltyDish("b", 1)];
    const r = computeDayIntake([{ recipeId: "a" }, { recipeId: "b" }], byId(recipes), ingredientDB);
    expect(r.salt).toBeCloseTo(3, 5);
    expect(r.meals).toBe(2);
  });

  it("classe une journée sous les 75 % du repère en `ok`", () => {
    const recipes = [saltyDish("a", 3)]; // 3 g sur 6 = 50 %
    const r = computeDayIntake([{ recipeId: "a" }], byId(recipes), ingredientDB);
    expect(r.saltRatio).toBeCloseTo(0.5, 5);
    expect(r.level).toBe("ok");
  });

  it("bascule en `warn` entre 75 % et 100 %", () => {
    const recipes = [saltyDish("a", 3), saltyDish("b", 1.5)]; // 4,5 g = 75 %
    const r = computeDayIntake([{ recipeId: "a" }, { recipeId: "b" }], byId(recipes), ingredientDB);
    expect(r.saltRatio).toBeCloseTo(0.75, 5);
    expect(r.level).toBe("warn");
  });

  it("bascule en `over` au dépassement du repère", () => {
    const recipes = [saltyDish("a", 4), saltyDish("b", 3)]; // 7 g > 6 g
    const r = computeDayIntake([{ recipeId: "a" }, { recipeId: "b" }], byId(recipes), ingredientDB);
    expect(r.saltRatio).toBeGreaterThan(1);
    expect(r.level).toBe("over");
  });

  it("ne divise que par les portions cuisinées (servings de la recette)", () => {
    // Plat pour 4 apportant 8 g de sel au total → 2 g par portion mangée.
    const recipes = [{ id: "grand", name: "Grand plat", servings: 4, ingredients: [{ name: "Sel", dbId: "sel", amount: 8, unit: "g" }] }];
    const r = computeDayIntake([{ recipeId: "grand" }], byId(recipes), ingredientDB);
    expect(r.salt).toBeCloseTo(2, 5);
  });

  it("ignore les items dont la recette n'existe plus", () => {
    const recipes = [saltyDish("a", 2)];
    const r = computeDayIntake([{ recipeId: "a" }, { recipeId: "disparu" }, {}], byId(recipes), ingredientDB);
    expect(r.salt).toBeCloseTo(2, 5);
    expect(r.meals).toBe(1);
  });

  it("marque l'estimation non fiable quand la couverture est trop faible", () => {
    // 100 g d'un ingrédient sans données + 1 g de sel → couverture ~1 %.
    const recipes = [{ id: "flou", name: "Flou", servings: 1, ingredients: [{ name: "Mystère", dbId: "myst", amount: 100, unit: "g" }, { name: "Sel", dbId: "sel", amount: 1, unit: "g" }] }];
    const r = computeDayIntake([{ recipeId: "flou" }], byId(recipes), ingredientDB);
    expect(r.coverage).toBeLessThan(0.5);
    expect(r.reliable).toBe(false);
  });

  it("somme les protéines par portion et les juge `low` sous 50 % du repère", () => {
    // Repère protéines = 50 g. 20 g < 25 g → faible.
    const recipes = [proteinDish("p", 20)];
    const r = computeDayIntake([{ recipeId: "p" }], byId(recipes), ingredientDB);
    expect(r.protein).toBeCloseTo(20, 5);
    expect(r.proteinTarget).toBe(50);
    expect(r.proteinLevel).toBe("low");
  });

  it("juge les protéines `ok` au-delà de 50 % du repère", () => {
    const recipes = [proteinDish("a", 20), proteinDish("b", 15)]; // 35 g > 25 g
    const r = computeDayIntake([{ recipeId: "a" }, { recipeId: "b" }], byId(recipes), ingredientDB);
    expect(r.protein).toBeCloseTo(35, 5);
    expect(r.proteinLevel).toBe("ok");
  });

  it("agrège aussi les calories par portion (sous-produit)", () => {
    const recipes = [{ id: "riz", name: "Riz", servings: 1, ingredients: [{ name: "Riz", dbId: "riz", amount: 100, unit: "g" }] }];
    const r = computeDayIntake([{ recipeId: "riz" }], byId(recipes), ingredientDB);
    expect(r.calories).toBeCloseTo(350, 0);
  });
});
