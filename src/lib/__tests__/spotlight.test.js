import { describe, it, expect } from "vitest";
import { pickSpotlightIngredient, publicRecipesWithIngredient } from "../spotlight.js";
import { createIngredientResolver } from "../nameMatcher.js";

// août = mois 8
const AUG = new Date(2025, 7, 15);
const DB = [
  { id: "figue", name: "Figue", category: "fruit", months: [8, 9, 10], description: "Fragile." },
  { id: "poireau", name: "Poireau", category: "vegetable", months: [1, 2, 11, 12] }, // hors saison en août
  { id: "courgette", name: "Courgette", category: "vegetable", months: [6, 7, 8, 9] },
  { id: "boeuf", name: "Bœuf", category: "meat", months: [8] }, // pas fruit/légume
];

describe("pickSpotlightIngredient", () => {
  it("choisit un fruit/légume de saison ce mois", () => {
    const pick = pickSpotlightIngredient(DB, AUG);
    expect(["figue", "courgette"]).toContain(pick.id);
  });

  it("ignore viande et hors-saison", () => {
    const pick = pickSpotlightIngredient(DB, AUG);
    expect(pick.category === "fruit" || pick.category === "vegetable").toBe(true);
    expect(pick.id).not.toBe("poireau");
    expect(pick.id).not.toBe("boeuf");
  });

  it("null si aucun candidat de saison", () => {
    expect(pickSpotlightIngredient([{ id: "x", name: "X", category: "fruit", months: [1] }], AUG)).toBe(null);
  });

  it("tourne d'une semaine à l'autre même si un seul candidat a une description", () => {
    // Régression : la préférence « avec description » figeait la vedette.
    const picks = new Set();
    for (let d = 1; d <= 28; d++) picks.add(pickSpotlightIngredient(DB, new Date(2025, 7, d)).id);
    expect(picks.size).toBeGreaterThan(1); // figue ET courgette apparaissent sur le mois
  });
});

describe("publicRecipesWithIngredient", () => {
  const resolver = createIngredientResolver(DB);
  const fig = DB[0];
  const pubs = [
    { pubId: "a", isComponent: false, recipe: { ingredients: [{ name: "Figues fraîches" }, { name: "Chèvre" }] } },
    { pubId: "b", isComponent: false, recipe: { ingredients: [{ name: "Poireau" }] } },
    { pubId: "c", isComponent: true, recipe: { ingredients: [{ name: "Figue" }] } }, // base exclue
  ];
  it("retrouve les recettes utilisant l'ingrédient (pluriel géré)", () => {
    const out = publicRecipesWithIngredient(fig, pubs, resolver);
    expect(out.map(p => p.pubId)).toEqual(["a"]);
  });
  it("évite les faux positifs poire/poireau", () => {
    const out = publicRecipesWithIngredient(DB[1] /* poireau */, [
      { pubId: "z", isComponent: false, recipe: { ingredients: [{ name: "Poire" }] } },
    ], resolver);
    expect(out).toHaveLength(0);
  });
});
