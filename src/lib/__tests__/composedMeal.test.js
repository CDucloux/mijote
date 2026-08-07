import { describe, it, expect } from "vitest";
import { roleForCategory, itemRole, groupSlotMeals, newGroupId, platNeedsSide } from "@/lib/planning/composedMeal.js";

describe("roleForCategory", () => {
  it("mappe le type vers un rôle", () => {
    expect(roleForCategory("entree")).toBe("entree");
    expect(roleForCategory("aperitif")).toBe("entree"); // un apéritif compte comme une entrée
    expect(roleForCategory("accompagnement")).toBe("accompagnement");
    expect(roleForCategory("dessert")).toBe("dessert");
    expect(roleForCategory("gratin")).toBe("plat");
    expect(roleForCategory("")).toBe("plat");
  });
});

describe("itemRole", () => {
  it("privilégie le rôle explicite, sinon déduit de la recette", () => {
    expect(itemRole({ role: "accompagnement" }, { category: "plat" })).toBe("accompagnement");
    expect(itemRole({}, { category: "dessert" })).toBe("dessert");
  });
});

describe("groupSlotMeals", () => {
  const byId = new Map([
    ["riz", { id: "riz", category: "accompagnement" }],
    ["boeuf", { id: "boeuf", category: "plat" }],
    ["tarte", { id: "tarte", category: "dessert" }],
  ]);
  it("regroupe par groupId et trie par rôle (entrée→plat→accompagnement→dessert)", () => {
    const entries = [
      { recipeId: "riz", groupId: "g1", role: "accompagnement" },
      { recipeId: "boeuf", groupId: "g1", role: "plat" },
      { recipeId: "tarte", groupId: "g1", role: "dessert" },
    ];
    const groups = groupSlotMeals(entries, byId);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map(x => x.item.recipeId)).toEqual(["boeuf", "riz", "tarte"]);
    expect(groups[0].items.map(x => x.idx)).toEqual([1, 0, 2]); // idx d'origine préservés
  });
  it("les items sans groupId sont des repas d'un seul item", () => {
    const groups = groupSlotMeals([{ recipeId: "boeuf" }, { recipeId: "tarte" }], byId);
    expect(groups).toHaveLength(2);
  });
});

describe("newGroupId", () => {
  it("génère des identifiants distincts", () => {
    expect(newGroupId()).not.toBe(newGroupId());
  });
});

describe("platNeedsSide", () => {
  it("un plat générique appelle un accompagnement", () => {
    expect(platNeedsSide({ category: "plat" })).toBe(true);
    expect(platNeedsSide({})).toBe(true);
  });
  it("les plats complets n'en ont pas besoin", () => {
    for (const cat of ["soupe", "salade", "pasta", "pizza", "gratin", "tarte"]) {
      expect(platNeedsSide({ category: cat })).toBe(false);
    }
  });
});
