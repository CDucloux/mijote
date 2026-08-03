import { describe, it, expect } from "vitest";
import { mergeShared } from "@/lib/household/householdMigration.js";

describe("mergeShared", () => {
  const local = {
    recipes: [
      { id: "r1", name: "Tarte", collections: ["cL"] },
      { id: "r2", name: "Soupe maison" },
    ],
    collections: [
      { id: "cL", name: "Desserts" },   // homonyme d'un carnet du foyer
      { id: "cX", name: "Perso" },      // unique
    ],
    stock: ["i1", "i2"],
    lowStock: ["i1"],
    mealPlan: { "2026-06-01": [{ recipeId: "r1" }] },
    shoppingLists: [{ id: "slL", name: "ma liste" }],
  };
  const remote = {
    recipes: [{ id: "r9", name: "Tarte" }],   // même nom que la locale
    collections: [{ id: "cR", name: "Desserts" }],
    stock: ["i2", "i3"],
    lowStock: ["i3"],
    mealPlan: { "2026-06-02": [{ recipeId: "r9" }] },
    shoppingLists: [{ id: "slR", name: "foyer" }],
  };

  const m = mergeShared(local, remote);

  it("recettes : union, dédup par nom (le foyer gagne)", () => {
    const names = m.recipes.map(r => r.name).sort();
    expect(names).toEqual(["Soupe maison", "Tarte"]); // une seule Tarte
    expect(m.recipes.find(r => r.name === "Tarte").id).toBe("r9"); // celle du foyer
  });

  it("carnets : dédup par nom + remap des références locales", () => {
    // "Desserts" local (cL) fusionné dans cR ; "Perso" (cX) conservé
    const names = m.collections.map(c => c.name).sort();
    expect(names).toEqual(["Desserts", "Perso"]);
    const soupe = m.recipes.find(r => r.name === "Soupe maison");
    void soupe;
    // la recette locale "Tarte" est écartée (homonyme), donc le remap se vérifie
    // sur les carnets : un seul "Desserts", celui du foyer (cR).
    expect(m.collections.filter(c => c.name === "Desserts").map(c => c.id)).toEqual(["cR"]);
  });

  it("stock : union des ids", () => {
    expect([...m.stock].sort()).toEqual(["i1", "i2", "i3"]);
    expect([...m.lowStock].sort()).toEqual(["i1", "i3"]);
  });

  it("planning & listes : adopte le foyer", () => {
    expect(m.mealPlan).toEqual(remote.mealPlan);
    expect(m.shoppingLists).toEqual(remote.shoppingLists);
  });

  it("foyer vide (création) : on récupère les données locales", () => {
    const created = mergeShared(local, {});
    expect(created.recipes.map(r => r.name).sort()).toEqual(["Soupe maison", "Tarte"]);
    expect(created.shoppingLists).toEqual([]); // remote vide → adopté vide
  });
});
