import { describe, it, expect } from "vitest";
import { parseAppRoute, originPathOf } from "@/lib/ui/appRoute.js";

const base = { importRoute: null, newRoute: false, planRoute: false, cookModeRoute: false, editRoute: false, recipeId: null, ingredientId: null };

describe("parseAppRoute", () => {
  it("onglet simple : aucun écran particulier", () => {
    expect(parseAppRoute("/home")).toEqual(base);
    expect(parseAppRoute("/recipes")).toEqual(base);
    expect(parseAppRoute("/recipes/")).toEqual(base);
  });
  it("fiche, pas à pas et édition d'une recette (id décodé)", () => {
    expect(parseAppRoute("/recipes/r12")).toEqual({ ...base, recipeId: "r12" });
    expect(parseAppRoute("/recipes/r%2012/cookmode")).toEqual({ ...base, recipeId: "r 12", cookModeRoute: true });
    expect(parseAppRoute("/recipes/r12/edit")).toEqual({ ...base, recipeId: "r12", editRoute: true });
  });
  it("imports IA et nouvelle recette : aucune recette ouverte", () => {
    expect(parseAppRoute("/recipes/import-from-url")).toEqual({ ...base, importRoute: "url" });
    expect(parseAppRoute("/recipes/import-from-picture").importRoute).toBe("picture");
    expect(parseAppRoute("/recipes/import-from-text").importRoute).toBe("text");
    expect(parseAppRoute("/recipes/import-from-pdf").importRoute).toBe("pdf");
    expect(parseAppRoute("/recipes/new")).toEqual({ ...base, newRoute: true });
  });
  it("offre et fiche ingrédient", () => {
    expect(parseAppRoute("/plan")).toEqual({ ...base, planRoute: true });
    expect(parseAppRoute("/admin/ingredients/oeuf%20frais")).toEqual({ ...base, ingredientId: "oeuf frais" });
    expect(parseAppRoute("/admin").ingredientId).toBeNull();
  });
  it("encodage invalide : segment gardé tel quel, sans planter", () => {
    expect(parseAppRoute("/recipes/r%E0").recipeId).toBe("r%E0");
  });
});

describe("originPathOf", () => {
  it("lit le chemin d'origine mémorisé", () => {
    expect(originPathOf({ originPath: "/meal-plan" })).toBe("/meal-plan");
  });
  it("état absent ou malformé : null", () => {
    expect(originPathOf(null)).toBeNull();
    expect(originPathOf(undefined)).toBeNull();
    expect(originPathOf({ originPath: 3 })).toBeNull();
    expect(originPathOf("/home")).toBeNull();
  });
});
