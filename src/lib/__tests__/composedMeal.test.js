import { describe, it, expect } from "vitest";
import { roleForCategory, itemRole, groupSlotMeals, mealsForSlot, newGroupId, platNeedsSide, moveMealItem, copyMealToDays, addRecipeToSlot } from "@/lib/planning/composedMeal.js";

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

describe("mealsForSlot", () => {
  const DB = new Map([
    ["p1", { id: "p1", category: "pasta" }],   // plat
    ["p2", { id: "p2", category: "gratin" }],  // plat
    ["e1", { id: "e1", category: "entree" }],  // entrée
    ["d1", { id: "d1", category: "dessert" }], // dessert
  ]);
  it("≤ 1 plat → un seul repas, même si les groupId diffèrent (fusion rétroactive)", () => {
    const entries = [
      { recipeId: "p1", slot: "midi", groupId: "gA" },
      { recipeId: "e1", slot: "midi", groupId: "gB" }, // groupId différent
    ];
    const meals = mealsForSlot(entries, DB);
    expect(meals.length).toBe(1);
    expect(meals[0].items.map(x => x.item.recipeId).sort()).toEqual(["e1", "p1"]);
    expect(meals[0].groupId).toBe("gA"); // représentatif = le plat
  });
  it("trie les items par rôle (entrée avant plat avant dessert)", () => {
    const entries = [
      { recipeId: "d1", slot: "midi", groupId: "g" },
      { recipeId: "p1", slot: "midi", groupId: "g" },
      { recipeId: "e1", slot: "midi", groupId: "g" },
    ];
    const meals = mealsForSlot(entries, DB);
    expect(meals[0].items.map(x => x.item.recipeId)).toEqual(["e1", "p1", "d1"]);
  });
  it("2 plats → repas multiples (regroupement par groupId conservé)", () => {
    const entries = [
      { recipeId: "p1", slot: "midi", groupId: "gA" },
      { recipeId: "p2", slot: "midi", groupId: "gB" },
    ];
    expect(mealsForSlot(entries, DB).length).toBe(2);
  });
  it("créneau vide → aucun repas", () => {
    expect(mealsForSlot([], DB)).toEqual([]);
  });
});

describe("moveMealItem", () => {
  const gid = () => "gNEW";

  it("déplace vers une autre semaine (autre date) et rattache au repas cible existant", () => {
    const plan = {
      "2026-08-24": [{ recipeId: "boeuf", slot: "soir", groupId: "g1", role: "plat" }],
      "2026-08-31": [{ recipeId: "riz", slot: "soir", groupId: "g2", role: "plat" }],
    };
    const next = moveMealItem(plan, "2026-08-24", 0, "2026-08-31", "soir", gid);
    expect(next["2026-08-24"]).toEqual([]); // source vidée
    expect(next["2026-08-31"]).toHaveLength(2);
    // L'item déplacé reprend le groupId du repas déjà présent sur le créneau cible.
    expect(next["2026-08-31"][1]).toMatchObject({ recipeId: "boeuf", slot: "soir", groupId: "g2" });
  });

  it("créneau cible vide → l'item fonde un nouveau repas (groupId neuf)", () => {
    const plan = { "2026-08-24": [{ recipeId: "boeuf", slot: "midi", groupId: "g1" }] };
    const next = moveMealItem(plan, "2026-08-24", 0, "2026-08-25", "soir", gid);
    expect(next["2026-08-25"][0]).toMatchObject({ recipeId: "boeuf", slot: "soir", groupId: "gNEW" });
  });

  it("créneau du matin → repas non composé (pas de groupId)", () => {
    const plan = { "2026-08-24": [{ recipeId: "boeuf", slot: "soir", groupId: "g1" }] };
    const next = moveMealItem(plan, "2026-08-24", 0, "2026-08-24", "matin", gid);
    expect(next["2026-08-24"][0]).toMatchObject({ recipeId: "boeuf", slot: "matin" });
    expect(next["2026-08-24"][0].groupId).toBeUndefined();
  });

  it("index hors bornes → planning inchangé (même référence)", () => {
    const plan = { "2026-08-24": [{ recipeId: "boeuf", slot: "midi" }] };
    expect(moveMealItem(plan, "2026-08-24", 5, "2026-08-25", "soir", gid)).toBe(plan);
  });

  it("ne mute pas le planning d'origine", () => {
    const plan = { "2026-08-24": [{ recipeId: "boeuf", slot: "midi", groupId: "g1" }] };
    const snapshot = JSON.parse(JSON.stringify(plan));
    moveMealItem(plan, "2026-08-24", 0, "2026-08-25", "soir", gid);
    expect(plan).toEqual(snapshot);
  });
});

describe("copyMealToDays", () => {
  const gid = () => "gNEW";
  const item = { recipeId: "pasta", slot: "soir", groupId: "g1", role: "plat", portions: 2 };

  it("copie l'item sur chaque jour cible sans toucher à l'original", () => {
    const plan = { "2026-08-31": [item] };
    const next = copyMealToDays(plan, item, ["2026-09-01", "2026-09-02"], "soir", gid);
    expect(next["2026-08-31"]).toEqual([item]); // source intacte
    expect(next["2026-09-01"][0]).toMatchObject({ recipeId: "pasta", slot: "soir", role: "plat", portions: 2 });
    expect(next["2026-09-02"]).toHaveLength(1);
  });

  it("la copie ne reprend pas le groupId d'origine (nouveau repas)", () => {
    const next = copyMealToDays({}, item, ["2026-09-01"], "soir", gid);
    expect(next["2026-09-01"][0].groupId).toBe("gNEW");
  });

  it("rejoint le repas déjà présent sur le créneau cible", () => {
    const plan = { "2026-09-01": [{ recipeId: "riz", slot: "soir", groupId: "gExist", role: "plat" }] };
    const next = copyMealToDays(plan, item, ["2026-09-01"], "soir", gid);
    expect(next["2026-09-01"]).toHaveLength(2);
    expect(next["2026-09-01"][1]).toMatchObject({ recipeId: "pasta", groupId: "gExist" });
  });

  it("créneau du matin → copie non composée (pas de groupId)", () => {
    const next = copyMealToDays({}, item, ["2026-09-01"], "matin", gid);
    expect(next["2026-09-01"][0].groupId).toBeUndefined();
  });

  it("ignore les dates vides et dédoublonne", () => {
    const next = copyMealToDays({}, item, ["2026-09-01", "", "2026-09-01"], "soir", gid);
    expect(next["2026-09-01"]).toHaveLength(1);
  });

  it("ne mute pas le planning d'origine", () => {
    const plan = { "2026-08-31": [item] };
    const snapshot = JSON.parse(JSON.stringify(plan));
    copyMealToDays(plan, item, ["2026-09-01"], "soir", gid);
    expect(plan).toEqual(snapshot);
  });
});

describe("addRecipeToSlot", () => {
  const byId = new Map([
    ["boeuf", { id: "boeuf", category: "plat" }],
    ["riz", { id: "riz", category: "accompagnement" }],
    ["tarte", { id: "tarte", category: "dessert" }],
    ["soupe", { id: "soupe", category: "plat" }],
  ]);
  const gid = () => "G";

  it("matin : entrée simple, sans groupId", () => {
    const out = addRecipeToSlot([], { id: "tarte", category: "dessert" }, "matin", byId, gid);
    expect(out).toEqual([{ recipeId: "tarte", slot: "matin", portions: 1 }]);
  });

  it("créneau vide : démarre un repas (groupId + rôle déduit)", () => {
    const out = addRecipeToSlot([], { id: "boeuf", category: "plat" }, "midi", byId, gid);
    expect(out).toEqual([{ recipeId: "boeuf", slot: "midi", portions: 1, role: "plat", groupId: "G" }]);
  });

  it("complète le repas existant : l'accompagnement rejoint le groupe du plat", () => {
    const entries = [{ recipeId: "boeuf", slot: "midi", portions: 1, role: "plat", groupId: "g1" }];
    const out = addRecipeToSlot(entries, { id: "riz", category: "accompagnement" }, "midi", byId, gid);
    expect(out[1]).toEqual({ recipeId: "riz", slot: "midi", portions: 1, role: "accompagnement", groupId: "g1" });
  });

  it("promeut un item nu (sans groupId) en repas structuré quand on complète", () => {
    const entries = [{ recipeId: "boeuf", slot: "midi", portions: 1 }];
    const out = addRecipeToSlot(entries, { id: "riz", category: "accompagnement" }, "midi", byId, gid);
    expect(out[0].groupId).toBe("G");
    expect(out[0].role).toBe("plat");
    expect(out[1].groupId).toBe("G");
  });

  it("2ᵉ plat : démarre un nouveau repas quand tous les groupes ont déjà un plat", () => {
    const entries = [{ recipeId: "boeuf", slot: "midi", portions: 1, role: "plat", groupId: "g1" }];
    const out = addRecipeToSlot(entries, { id: "soupe", category: "plat" }, "midi", byId, gid);
    expect(out[1].groupId).toBe("G");
    expect(out[1].groupId).not.toBe("g1");
  });

  it("plat : comble un groupe sans plat plutôt que d'en créer un", () => {
    const entries = [{ recipeId: "riz", slot: "midi", portions: 1, role: "accompagnement", groupId: "g1" }];
    const out = addRecipeToSlot(entries, { id: "boeuf", category: "plat" }, "midi", byId, gid);
    expect(out[1].groupId).toBe("g1");
  });

  it("ne mute pas le tableau d'entrée", () => {
    const entries = [{ recipeId: "boeuf", slot: "midi", portions: 1, role: "plat", groupId: "g1" }];
    const copy = JSON.parse(JSON.stringify(entries));
    addRecipeToSlot(entries, { id: "riz", category: "accompagnement" }, "midi", byId, gid);
    expect(entries).toEqual(copy);
  });
});
