import { describe, it, expect } from "vitest";
import { isEligible, collectIngredientSignals, ALLERGEN_SIGNALS } from "@/lib/food/dietFilter.js";

// Base ingrédients minimale : le résolveur mappe un nom → { id, name, category }.
const DB = [
  { id: "boeuf", name: "Bœuf", category: "meat" },
  { id: "saumon", name: "Saumon", category: "fish_seafood" },
  { id: "creme", name: "Crème", category: "dairy" },
  { id: "carotte", name: "Carotte", category: "vegetable" },
  { id: "farine", name: "Farine de blé", category: "grain" },
  { id: "amande", name: "Amande", category: "nuts_seeds" },
  { id: "riz", name: "Riz", category: "grain" },
];
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const resolver = (name) => DB.find(i => norm(i.name) === norm(name || "")) || null;

const R = (name, ings) => ({ id: name, name, ingredients: ings.map(n => ({ name: n })) });

describe("isEligible – régimes", () => {
  const boeuf = R("Bœuf carottes", ["Bœuf", "Carotte"]);
  const poisson = R("Saumon crème", ["Saumon", "Crème"]);
  const veggie = R("Carottes rôties", ["Carotte", "Crème"]);
  it("végétarien exclut viande et poisson, garde le laitier", () => {
    const p = { diet: "vegetarien" };
    expect(isEligible(boeuf, p, { resolver })).toBe(false);
    expect(isEligible(poisson, p, { resolver })).toBe(false);
    expect(isEligible(veggie, p, { resolver })).toBe(true);
  });
  it("pescatarien garde le poisson, exclut la viande", () => {
    const p = { diet: "pescatarien" };
    expect(isEligible(poisson, p, { resolver })).toBe(true);
    expect(isEligible(boeuf, p, { resolver })).toBe(false);
  });
  it("vegan exclut le laitier", () => {
    expect(isEligible(veggie, { diet: "vegan" }, { resolver })).toBe(false);
    expect(isEligible(R("Carottes", ["Carotte"]), { diet: "vegan" }, { resolver })).toBe(true);
  });
  it("omnivore / flexitarien : aucune contrainte dure", () => {
    expect(isEligible(boeuf, { diet: "omnivore" }, { resolver })).toBe(true);
    expect(isEligible(boeuf, { diet: "flexitarien" }, { resolver })).toBe(true);
  });
});

describe("isEligible – catégories exclues", () => {
  it("exclut une recette contenant une catégorie d'ingrédient bannie", () => {
    const p = { excludedCategories: ["meat"] };
    expect(isEligible(R("Steak", ["Bœuf"]), p, { resolver })).toBe(false);
    expect(isEligible(R("Salade", ["Carotte"]), p, { resolver })).toBe(true);
  });
});

describe("isEligible – allergènes (heuristique)", () => {
  it("gluten via mot-clé (farine de blé), pas via la catégorie grain (riz OK)", () => {
    const p = { allergens: ["Gluten"] };
    expect(isEligible(R("Gâteau", ["Farine de blé"]), p, { resolver })).toBe(false);
    expect(isEligible(R("Riz pilaf", ["Riz"]), p, { resolver })).toBe(true);
  });
  it("fruits à coque via catégorie nuts_seeds", () => {
    expect(isEligible(R("Financier", ["Amande"]), { allergens: ["Fruits à coque"] }, { resolver })).toBe(false);
  });
  it("lactose via catégorie dairy", () => {
    expect(isEligible(R("Gratin", ["Crème"]), { allergens: ["Lactose"] }, { resolver })).toBe(false);
  });
});

describe("collectIngredientSignals – bases récursives", () => {
  it("descend dans une préparation de base référencée par recipeId", () => {
    const bechamel = { id: "bechamel", ingredients: [{ name: "Crème" }, { name: "Farine de blé" }] };
    const gratin = { id: "gratin", ingredients: [{ name: "Carotte" }, { recipeId: "bechamel" }] };
    const byId = new Map([[bechamel.id, bechamel]]);
    const sig = collectIngredientSignals(gratin, { resolver, byId });
    expect(sig.categories.has("dairy")).toBe(true);
    expect(sig.names).toContain("farine de ble");
  });
  it("le régime végétarien voit la viande d'une base", () => {
    const sauce = { id: "sauce", ingredients: [{ name: "Bœuf" }] };
    const plat = { id: "plat", ingredients: [{ recipeId: "sauce" }] };
    expect(isEligible(plat, { diet: "vegetarien" }, { resolver, recipes: [sauce] })).toBe(false);
  });
});

describe("ALLERGEN_SIGNALS", () => {
  it("couvre les 12 allergènes courants", () => {
    expect(Object.keys(ALLERGEN_SIGNALS).length).toBe(12);
  });
});
