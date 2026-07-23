import { describe, it, expect } from "vitest";
import { scoreRecipe, effortScore, eligibleForSlot, generateWeek } from "../mealPlanner.js";

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const DB = [
  { id: "courgette", name: "Courgette", category: "vegetable", months: [6, 7, 8, 9] },
  { id: "potiron", name: "Potiron", category: "vegetable", months: [10, 11, 12] },
  { id: "boeuf", name: "Bœuf", category: "meat" },
  { id: "riz", name: "Riz", category: "grain" },
];
const resolver = (name) => DB.find(i => norm(i.name) === norm(name)) || null;
const ctx = { resolver, month: 7, stockSet: new Set(), preferences: {} };

const R = (id, over = {}) => ({ id, name: id, category: "plat", prepTime: 10, cookTime: 20, ingredients: [], ...over });

describe("effortScore", () => {
  it("rapide ≈ 1, long ≈ 0", () => {
    expect(effortScore({ prepTime: 5, cookTime: 5 })).toBeGreaterThan(0.9);
    expect(effortScore({ prepTime: 60, cookTime: 60 })).toBe(0);
  });
});

describe("eligibleForSlot", () => {
  it("matin = petit-déj uniquement ; midi/soir = plats + non typés, jamais dessert", () => {
    expect(eligibleForSlot({ category: "petit-dej" }, "matin")).toBe(true);
    expect(eligibleForSlot({ category: "plat" }, "matin")).toBe(false);
    expect(eligibleForSlot({ category: "plat" }, "soir")).toBe(true);
    expect(eligibleForSlot({ category: "" }, "midi")).toBe(true);
    expect(eligibleForSlot({ category: "dessert" }, "soir")).toBe(false);
    expect(eligibleForSlot({ category: "plat", isComponent: true }, "soir")).toBe(false);
  });
});

describe("scoreRecipe", () => {
  it("privilégie la recette de saison", () => {
    const ete = R("ete", { ingredients: [{ name: "Courgette" }] });
    const hiver = R("hiver", { ingredients: [{ name: "Potiron" }] });
    expect(scoreRecipe(ete, ctx)).toBeGreaterThan(scoreRecipe(hiver, ctx));
  });
  it("pénalise une aversion", () => {
    const r = R("x", { ingredients: [{ name: "Bœuf" }] });
    const withDislike = scoreRecipe(r, { ...ctx, preferences: { dislikes: ["Bœuf"] }, byId: new Map() });
    const without = scoreRecipe(r, ctx);
    expect(withDislike).toBeLessThan(without);
  });
  it("bonus au stock disponible", () => {
    const r = R("s", { ingredients: [{ name: "Riz" }] });
    const inStock = scoreRecipe(r, { ...ctx, stockSet: new Set(["riz"]) });
    expect(inStock).toBeGreaterThan(scoreRecipe(r, ctx));
  });
});

describe("generateWeek", () => {
  const dates = ["2026-07-01", "2026-07-02", "2026-07-03"];
  const recipes = [
    R("a", { cuisine: "Française", ingredients: [{ name: "Courgette" }] }),
    R("b", { cuisine: "Italienne", category: "pasta", ingredients: [{ name: "Courgette" }] }),
    R("c", { cuisine: "Grecque", category: "salade", ingredients: [{ name: "Courgette" }] }),
    R("d", { cuisine: "Française", category: "gratin", ingredients: [{ name: "Courgette" }] }),
  ];

  it("ne remplit pas la semaine avec 7× la même recette", () => {
    const out = generateWeek({ dates, slots: ["midi", "soir"], recipes, ctx });
    const counts = {};
    out.forEach(a => { counts[a.recipeId] = (counts[a.recipeId] || 0) + 1; });
    // 6 cellules, 4 recettes → variété forcée, aucune ne domine tout
    expect(out).toHaveLength(6);
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
  });

  it("respecte les cellules déjà remplies (ne remplit que le vide)", () => {
    const existing = { "2026-07-01": [{ recipeId: "a", slot: "midi", portions: 1 }] };
    const out = generateWeek({ dates, slots: ["midi", "soir"], recipes, ctx, existing });
    expect(out.find(a => a.date === "2026-07-01" && a.slot === "midi")).toBeUndefined();
    expect(out).toHaveLength(5);
  });

  it("n'assigne que des recettes éligibles au créneau", () => {
    const withDessert = [...recipes, R("dess", { category: "dessert" })];
    const out = generateWeek({ dates, slots: ["midi", "soir"], recipes: withDessert, ctx });
    expect(out.some(a => a.recipeId === "dess")).toBe(false);
  });

  it("écarte le vivier non éligible (régime végétarien)", () => {
    const meaty = [R("veg", { ingredients: [{ name: "Courgette" }] }), R("carne", { ingredients: [{ name: "Bœuf" }] })];
    const out = generateWeek({ dates: ["2026-07-01"], slots: ["midi"], recipes: meaty, ctx: { ...ctx, preferences: { diet: "vegetarien" } } });
    expect(out.every(a => a.recipeId !== "carne")).toBe(true);
  });

  it("compose : rattache un accompagnement au plat sous un même groupId", () => {
    const withSides = [
      R("plat1", { ingredients: [{ name: "Courgette" }] }),
      R("riz", { category: "accompagnement", ingredients: [{ name: "Riz" }] }),
      R("puree", { category: "accompagnement", ingredients: [{ name: "Courgette" }] }),
    ];
    const out = generateWeek({ dates: ["2026-07-01"], slots: ["midi"], recipes: withSides, ctx, compose: true });
    const plat = out.find(a => a.role === "plat");
    const side = out.find(a => a.role === "accompagnement");
    expect(plat).toBeTruthy();
    expect(side).toBeTruthy();
    expect(side.groupId).toBe(plat.groupId); // même repas
  });

  it("sans compose : aucun accompagnement, pas de rôle accompagnement", () => {
    const withSides = [R("plat1", { ingredients: [{ name: "Courgette" }] }), R("riz", { category: "accompagnement" })];
    const out = generateWeek({ dates: ["2026-07-01"], slots: ["midi"], recipes: withSides, ctx });
    expect(out.some(a => a.role === "accompagnement")).toBe(false);
  });
});
