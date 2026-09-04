import { describe, it, expect } from "vitest";
import {
  todayKey, getTodayMeals, upcomingSlot, countShoppingTodo,
  getLowStockNames, buildDashboardSummary,
} from "@/lib/planning/dashboard.js";

const recipes = [
  { id: "r1", name: "Soupe" },
  { id: "r2", name: "Curry" },
];
const ingredientDB = [
  { id: "i1", name: "Riz" },
  { id: "i2", name: "Huile d'olive" },
];

describe("todayKey", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(todayKey(new Date("2026-06-28T10:00:00Z"))).toBe("2026-06-28");
  });
});

describe("getTodayMeals", () => {
  const mealPlan = {
    "2026-06-28": [
      { recipeId: "r2", portions: 1, slot: "soir" },
      { recipeId: "r1", portions: 2, slot: "midi" },
      { recipeId: "missing", portions: 1, slot: "midi" },
    ],
  };
  it("resolves recipes for the given day and orders midi before soir", () => {
    const meals = getTodayMeals(mealPlan, recipes, "2026-06-28");
    expect(meals.map(m => m.recipe.name)).toEqual(["Soupe", "Curry"]);
  });
  it("drops entries whose recipe no longer exists", () => {
    const meals = getTodayMeals(mealPlan, recipes, "2026-06-28");
    expect(meals).toHaveLength(2);
  });
  it("returns [] when nothing is planned", () => {
    expect(getTodayMeals(mealPlan, recipes, "2026-06-29")).toEqual([]);
    expect(getTodayMeals(undefined, recipes, "2026-06-29")).toEqual([]);
  });
});

describe("upcomingSlot", () => {
  it("matin avant 11h, midi avant 15h, soir ensuite", () => {
    expect(upcomingSlot(new Date("2026-06-28T08:00:00"))).toBe("matin");
    expect(upcomingSlot(new Date("2026-06-28T12:30:00"))).toBe("midi");
    expect(upcomingSlot(new Date("2026-06-28T19:00:00"))).toBe("soir");
  });
});

describe("countShoppingTodo", () => {
  it("une seule liste : somme directe des articles non cochés", () => {
    const lists = [
      { id: "a", items: [
        { id: "1", name: "Riz", checked: false },
        { id: "2", name: "Sel", checked: true },
        { id: "3", name: "Huile d'olive", checked: false },
      ] },
    ];
    expect(countShoppingTodo(lists, ingredientDB)).toBe(2);
  });
  it("dès deux listes : reflète la liste concaténée (ingrédient partagé compté une fois)", () => {
    const lists = [
      { id: "a", items: [
        { id: "1", name: "Riz", checked: false },
        { id: "2", name: "Huile d'olive", checked: false },
      ] },
      { id: "b", items: [
        { id: "3", name: "riz", checked: false },   // même ingrédient que la liste A
        { id: "4", name: "Poivre", checked: false },
      ] },
    ];
    // Concaténé : Riz, Huile d'olive, Poivre → 3 (et non 4).
    expect(countShoppingTodo(lists, ingredientDB)).toBe(3);
  });
  it("un article agrégé coché sur toutes ses listes ne compte plus", () => {
    const lists = [
      { id: "a", items: [{ id: "1", name: "Riz", checked: true }] },
      { id: "b", items: [{ id: "2", name: "riz", checked: true }, { id: "3", name: "Poivre", checked: false }] },
    ];
    expect(countShoppingTodo(lists, ingredientDB)).toBe(1);
  });
  it("un article coché sur une seule de ses listes reste à acheter", () => {
    const lists = [
      { id: "a", items: [{ id: "1", name: "Riz", checked: true }] },
      { id: "b", items: [{ id: "2", name: "riz", checked: false }] },
    ];
    expect(countShoppingTodo(lists, ingredientDB)).toBe(1);
  });
  it("is 0 for no lists", () => {
    expect(countShoppingTodo()).toBe(0);
  });
});

describe("getLowStockNames", () => {
  it("resolves ids to names and ignores unknown ids", () => {
    expect(getLowStockNames(["i2", "ghost", "i1"], ingredientDB)).toEqual(["Huile d'olive", "Riz"]);
  });
});

describe("buildDashboardSummary", () => {
  const date = new Date("2026-06-28T19:00:00");
  it("aggregates meals, shopping and low stock", () => {
    const s = buildDashboardSummary({
      mealPlan: { "2026-06-28": [{ recipeId: "r1", slot: "soir" }] },
      recipes,
      shoppingLists: [{ items: [{ checked: false }, { checked: false }] }],
      lowStock: ["i1"],
      ingredientDB,
      date,
    });
    expect(s.meals).toHaveLength(1);
    expect(s.shoppingTodo).toBe(2);
    expect(s.lowStockNames).toEqual(["Riz"]);
    expect(s.upcomingSlot).toBe("soir");
    expect(s.isCalm).toBe(false);
  });
  it("flags a calm day when there is nothing to surface", () => {
    const s = buildDashboardSummary({ mealPlan: {}, recipes, shoppingLists: [], lowStock: [], ingredientDB, date });
    expect(s.isCalm).toBe(true);
    expect(s.isEmpty).toBe(false); // calme mais avec des recettes → pas vide
  });
  it("flags an empty account (no recipes, nothing planned) as empty", () => {
    const s = buildDashboardSummary({ mealPlan: {}, recipes: [], shoppingLists: [], lowStock: [], ingredientDB, date });
    expect(s.isCalm).toBe(true);
    expect(s.isEmpty).toBe(true);
  });
  it("is not empty when the account has content to act on, even without recipes", () => {
    const s = buildDashboardSummary({
      mealPlan: {}, recipes: [],
      shoppingLists: [{ items: [{ checked: false }] }],
      lowStock: [], ingredientDB, date,
    });
    expect(s.isEmpty).toBe(false); // des courses à faire → inviter à démarrer n'a pas de sens
  });
});
