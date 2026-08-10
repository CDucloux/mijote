import { describe, it, expect } from "vitest";
import { scoreRecipe, effortScore, simplicityScore, dishSeasonScore, eligibleForSlot, generateWeek, GEN_STYLES } from "@/lib/planning/mealPlanner.js";

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

describe("simplicityScore", () => {
  it("vaut 1 pour peu d'ingrédients et décroît ensuite", () => {
    expect(simplicityScore({ ingredients: Array.from({ length: 4 }) })).toBe(1);
    expect(simplicityScore({ ingredients: Array.from({ length: 16 }) })).toBeLessThan(1);
  });
});

describe("dishSeasonScore (affinité saisonnière du type de plat)", () => {
  it("favorise les plats consistants en hiver, les pénalise en été", () => {
    expect(dishSeasonScore({ category: "gratin" }, 1)).toBe(1);   // janvier
    expect(dishSeasonScore({ category: "gratin" }, 7)).toBe(-1);  // juillet
    expect(dishSeasonScore({ category: "soupe" }, 12)).toBe(1);
  });
  it("favorise le froid/léger en été, le pénalise en hiver", () => {
    expect(dishSeasonScore({ category: "soupe-froide" }, 7)).toBe(1);
    expect(dishSeasonScore({ category: "soupe-froide" }, 1)).toBe(-1);
    expect(dishSeasonScore({ category: "salade" }, 8)).toBe(1);
  });
  it("neutre en mi-saison ou pour un type non concerné", () => {
    expect(dishSeasonScore({ category: "gratin" }, 4)).toBe(0);   // avril
    expect(dishSeasonScore({ category: "plat" }, 1)).toBe(0);
  });
  it("distingue soupe chaude et soupe froide selon la saison", () => {
    const chaude = { category: "soupe", ingredients: [] };
    const froide = { category: "soupe-froide", ingredients: [] };
    const ete = { ...ctx, month: 7 };
    const hiver = { ...ctx, month: 1 };
    expect(scoreRecipe(froide, ete)).toBeGreaterThan(scoreRecipe(chaude, ete));
    expect(scoreRecipe(chaude, hiver)).toBeGreaterThan(scoreRecipe(froide, hiver));
  });
});

describe("styles de génération (GEN_STYLES)", () => {
  const rapideSimple = R("facile", { prepTime: 5, cookTime: 5, difficulty: 1, ingredients: [{ name: "Riz" }, { name: "Courgette" }] });
  const longDifficile = R("complexe", { prepTime: 60, cookTime: 60, difficulty: 5, ingredients: Array.from({ length: 14 }, (_, i) => ({ name: `ing${i}` })) });

  it("le style facile préfère la recette rapide et simple", () => {
    const c = { ...ctx, weights: GEN_STYLES.facile };
    expect(scoreRecipe(rapideSimple, c)).toBeGreaterThan(scoreRecipe(longDifficile, c));
  });
  it("le style aventureux préfère la recette longue et difficile", () => {
    const c = { ...ctx, weights: GEN_STYLES.aventureux };
    expect(scoreRecipe(longDifficile, c)).toBeGreaterThan(scoreRecipe(rapideSimple, c));
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

  it("compose un repas complet entrée + plat + accompagnement + dessert", () => {
    const lib = [
      R("plat1", { ingredients: [{ name: "Courgette" }] }),
      R("ent1", { category: "entree", ingredients: [{ name: "Courgette" }] }),
      R("acc1", { category: "accompagnement", ingredients: [{ name: "Riz" }] }),
      R("des1", { category: "dessert", ingredients: [{ name: "Courgette" }] }),
    ];
    const out = generateWeek({ dates: ["2026-07-01"], slots: ["midi"], recipes: lib, ctx, compose: true });
    const roles = out.map(a => a.role).sort();
    expect(roles).toEqual(["accompagnement", "dessert", "entree", "plat"]);
    expect(new Set(out.map(a => a.groupId)).size).toBe(1); // un seul repas
  });

  it("ne met pas d'accompagnement quand le plat se suffit (soupe, pasta…)", () => {
    const lib = [
      R("soupe1", { category: "soupe", ingredients: [{ name: "Courgette" }] }),
      R("ent1", { category: "entree", ingredients: [{ name: "Courgette" }] }),
      R("acc1", { category: "accompagnement", ingredients: [{ name: "Riz" }] }),
      R("des1", { category: "dessert", ingredients: [{ name: "Courgette" }] }),
    ];
    const out = generateWeek({ dates: ["2026-07-01"], slots: ["midi"], recipes: lib, ctx, compose: true });
    expect(out.find(a => a.role === "plat").recipeId).toBe("soupe1");
    expect(out.some(a => a.role === "accompagnement")).toBe(false); // côté sauté
    expect(out.map(a => a.role).sort()).toEqual(["dessert", "entree", "plat"]);
  });

  it("réutilise les portions cuisinées (recette pour 6 replacée sur plusieurs jours)", () => {
    const lib = [
      R("gros", { servings: 6, ingredients: [{ name: "Courgette" }] }),      // de saison → cuisiné en premier
      R("b", { servings: 2, ingredients: [{ name: "Potiron" }] }),           // hors saison
      R("c", { servings: 2, ingredients: [{ name: "Potiron" }] }),
    ];
    const dates = ["2026-07-01", "2026-07-02"];
    const out = generateWeek({ dates, slots: ["midi", "soir"], recipes: lib, ctx });
    const gros = out.filter(a => a.recipeId === "gros");
    expect(gros.length).toBe(3);                 // 1 cuisson pour 6 = 3 repas
    expect(gros.every(a => a.portions === 3)).toBe(true);
  });

  describe("mode batch cooking", () => {
    // Deux plats équivalents (même saison, même effort) : l'un à gros rendement,
    // l'autre non. En mode batch, le gros rendement doit être préféré à la 1re
    // cuisson (le petit ne peut pas gagner via ses restes puisqu'il n'en a pas).
    it("privilégie les plats à gros rendement (high yield)", () => {
      // Mêmes ingrédients (donc même saison/effort) : seul le rendement diffère.
      const lib = [
        R("petit", { servings: 2, ingredients: [{ name: "Riz" }] }),
        R("gros", { servings: 6, ingredients: [{ name: "Riz" }] }),
      ];
      const batched = generateWeek({ dates: ["2026-07-01"], slots: ["midi"], recipes: lib, ctx, batch: true });
      // À qualité égale, le mode batch retient d'abord le plat à gros rendement.
      expect(batched[0].recipeId).toBe("gros");
    });

    // Après avoir cuisiné un plat aux olives+feta, un second plat partageant ces
    // bases doit passer devant un plat sans base commune (écouler les restes).
    it("privilégie les recettes partageant des ingrédients bruts déjà engagés", () => {
      const lib = [
        R("mezze", { cuisine: "Grecque", ingredients: [{ name: "Olive" }, { name: "Feta" }, { name: "Courgette" }] }),
        R("salade", { cuisine: "Grecque", category: "salade", ingredients: [{ name: "Olive" }, { name: "Feta" }, { name: "Riz" }] }),
        R("autre", { cuisine: "Française", ingredients: [{ name: "Potiron" }] }),
      ];
      const out = generateWeek({ dates: ["2026-07-01"], slots: ["midi", "soir"], recipes: lib, ctx, batch: true });
      const ids = out.map(a => a.recipeId);
      // Les deux plats aux bases communes sont retenus avant le plat isolé.
      expect(ids).toContain("mezze");
      expect(ids).toContain("salade");
    });
  });
});
