import { describe, it, expect } from "vitest";
import { DEFAULT_FILTERS, activeFilterCount, matchesFilters, filtersEqual } from "../recipeFilters.js";

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
