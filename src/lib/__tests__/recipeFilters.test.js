import { describe, it, expect } from "vitest";
import { DEFAULT_FILTERS, activeFilterCount, matchesFilters, filtersEqual, matchesRecipeSearch, collectChefs, summarizeFilters } from "@/lib/recipes/recipeFilters.js";

describe("matchesFilters – catégorie (type de recette)", () => {
  const dessert = { name: "Tarte", category: "dessert", ingredients: [], isComponent: false };
  const plat = { name: "Curry", category: "plat", ingredients: [], isComponent: false };
  it("filtre sur une ou plusieurs catégories", () => {
    expect(matchesFilters(dessert, { ...DEFAULT_FILTERS, categories: ["dessert"] })).toBe(true);
    expect(matchesFilters(plat, { ...DEFAULT_FILTERS, categories: ["dessert"] })).toBe(false);
    expect(matchesFilters(plat, { ...DEFAULT_FILTERS, categories: ["dessert", "plat"] })).toBe(true);
  });
  it("aucune catégorie sélectionnée = pas de contrainte", () => {
    expect(matchesFilters({ name: "X", ingredients: [] }, { ...DEFAULT_FILTERS })).toBe(true);
  });
  it("compte la catégorie comme un filtre actif", () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, categories: ["dessert"] })).toBe(1);
    expect(activeFilterCount({ ...DEFAULT_FILTERS })).toBe(0);
  });
});

describe("filtersEqual", () => {
  it("vrai pour deux vues identiques (ordre des tableaux indifférent)", () => {
    const a = { ...DEFAULT_FILTERS, categories: ["dessert", "plat"], cuisines: ["Française"] };
    const b = { ...DEFAULT_FILTERS, categories: ["plat", "dessert"], cuisines: ["Française"] };
    expect(filtersEqual(a, b)).toBe(true);
  });
  it("faux quand un critère diffère", () => {
    expect(filtersEqual({ ...DEFAULT_FILTERS, timeMax: 30 }, { ...DEFAULT_FILTERS, timeMax: 60 })).toBe(false);
    expect(filtersEqual({ ...DEFAULT_FILTERS, categories: ["dessert"] }, { ...DEFAULT_FILTERS })).toBe(false);
  });
  it("comble les champs manquants avec les valeurs par défaut", () => {
    expect(filtersEqual({}, { ...DEFAULT_FILTERS })).toBe(true);
  });
});

describe("matchesRecipeSearch", () => {
  const recipe = { name: "Bœuf bourguignon", cuisine: "Française", chef: "Adam Byatt", ingredients: [{ name: "lard" }, { name: "carotte" }] };

  it("trouve par nom, cuisine, chef ou ingrédient, sans casse ni accents", () => {
    expect(matchesRecipeSearch(recipe, "bourguignon")).toBe(true);
    expect(matchesRecipeSearch(recipe, "francaise")).toBe(true);
    expect(matchesRecipeSearch(recipe, "BYATT")).toBe(true);
    expect(matchesRecipeSearch(recipe, "carotte")).toBe(true);
  });
  it("écarte une recette qui ne contient pas le texte", () => {
    expect(matchesRecipeSearch(recipe, "tiramisu")).toBe(false);
  });
  it("laisse tout passer sur une requête vide", () => {
    expect(matchesRecipeSearch(recipe, "")).toBe(true);
    expect(matchesRecipeSearch(recipe, "   ")).toBe(true);
    expect(matchesRecipeSearch(recipe, undefined)).toBe(true);
  });
  it("tolère une recette sans cuisine, chef ni ingrédients", () => {
    expect(matchesRecipeSearch({ name: "Soupe" }, "soupe")).toBe(true);
    expect(matchesRecipeSearch({ name: "Soupe" }, "byatt")).toBe(false);
  });
});

describe("filtre chef", () => {
  const byatt = { name: "Bœuf bourguignon", chef: "Adam Byatt", ingredients: [] };
  const pic = { name: "Soupe", chef: "Anne-Sophie Pic", ingredients: [] };
  const none = { name: "Tarte", ingredients: [] };
  const withChefs = (chefs) => ({ ...DEFAULT_FILTERS, chefs });

  it("ne garde que les recettes des chefs retenus, sans casse ni accents", () => {
    expect(matchesFilters(byatt, withChefs(["adam byatt"]))).toBe(true);
    expect(matchesFilters(pic, withChefs(["Adam Byatt"]))).toBe(false);
    expect(matchesFilters(none, withChefs(["Adam Byatt"]))).toBe(false);
    expect(matchesFilters(pic, withChefs(["Adam Byatt", "Anne-Sophie Pic"]))).toBe(true);
  });
  it("laisse tout passer sans chef retenu, y compris un état ancien sans le champ", () => {
    expect(matchesFilters(none, withChefs([]))).toBe(true);
    const { chefs, ...legacy } = DEFAULT_FILTERS;
    void chefs;
    expect(matchesFilters(none, legacy)).toBe(true);
    expect(activeFilterCount(legacy)).toBe(0);
  });
  it("compte, compare et résume le critère", () => {
    expect(activeFilterCount(withChefs(["Adam Byatt"]))).toBe(1);
    expect(filtersEqual(withChefs(["A", "B"]), withChefs(["B", "A"]))).toBe(true);
    expect(filtersEqual(withChefs(["A"]), withChefs([]))).toBe(false);
    expect(summarizeFilters(withChefs(["Adam Byatt"]))).toEqual(["Adam Byatt"]);
  });
});

describe("collectChefs", () => {
  it("dédoublonne sans casse ni accents et trie par nombre de recettes", () => {
    const recipes = [{ chef: "Adam Byatt" }, { chef: "Hélène Darroze" }, { chef: "adam byatt" }, { chef: "Anne-Sophie Pic" }];
    expect(collectChefs(recipes)).toEqual(["Adam Byatt", "Anne-Sophie Pic", "Hélène Darroze"]);
  });
  it("ignore les chefs vides et tolère une liste absente", () => {
    expect(collectChefs([{ chef: "  " }, {}, { chef: "Pic" }])).toEqual(["Pic"]);
    expect(collectChefs(undefined)).toEqual([]);
  });
});
