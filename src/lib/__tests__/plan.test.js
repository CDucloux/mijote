import { describe, it, expect } from "vitest";
import { FREE_RECIPE_LIMIT, recipeQuotaCount, canAddRecipes } from "@/lib/recipes/plan.js";

const mk = (n, isComponent = false) => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, isComponent }));

describe("plan / quota recettes", () => {
  it("ne compte pas les préparations de base dans le quota", () => {
    const recipes = [...mk(3), ...mk(5, true)];
    expect(recipeQuotaCount(recipes)).toBe(3);
  });

  it("Mijoté+ : toujours autorisé", () => {
    expect(canAddRecipes(mk(FREE_RECIPE_LIMIT), true, 10)).toBe(true);
  });

  it("gratuit : autorisé tant qu'on reste sous la limite", () => {
    expect(canAddRecipes(mk(FREE_RECIPE_LIMIT - 1), false, 1)).toBe(true);
    expect(canAddRecipes(mk(FREE_RECIPE_LIMIT), false, 1)).toBe(false);
  });

  it("gratuit : un ajout multiple qui dépasse est refusé", () => {
    expect(canAddRecipes(mk(FREE_RECIPE_LIMIT - 2), false, 3)).toBe(false);
    expect(canAddRecipes(mk(FREE_RECIPE_LIMIT - 2), false, 2)).toBe(true);
  });

  it("les composants ne consomment pas le quota", () => {
    const recipes = [...mk(FREE_RECIPE_LIMIT - 1), ...mk(20, true)];
    expect(canAddRecipes(recipes, false, 1)).toBe(true);
  });
});
