import { describe, it, expect } from "vitest";
import { isRecipeVegan } from "../dietary.js";

// resolver simple : name -> { id, category } d'après une petite base.
const DB = {
  tomate: { id: "tomate", category: "vegetable" },
  basilic: { id: "basilic", category: "herbs" },
  poulet: { id: "poulet", category: "meat" },
  saumon: { id: "saumon", category: "fish_seafood" },
  parmesan: { id: "parmesan", category: "dairy" },
  farine: { id: "farine", category: "grain" },
};
const resolver = (name) => DB[(name || "").toLowerCase()] || null;
const ing = (name, extra = {}) => ({ name, ...extra });

describe("isRecipeVegan", () => {
  it("vegan si aucun ingrédient animal", () => {
    const r = { ingredients: [ing("Tomate"), ing("Basilic"), ing("Farine")] };
    expect(isRecipeVegan(r, resolver)).toBe(true);
  });

  it("non vegan avec de la viande", () => {
    expect(isRecipeVegan({ ingredients: [ing("Tomate"), ing("Poulet")] }, resolver)).toBe(false);
  });

  it("non vegan avec du poisson", () => {
    expect(isRecipeVegan({ ingredients: [ing("Saumon")] }, resolver)).toBe(false);
  });

  it("non vegan avec un produit laitier (fromage)", () => {
    expect(isRecipeVegan({ ingredients: [ing("Tomate"), ing("Parmesan")] }, resolver)).toBe(false);
  });

  it("false si aucun ingrédient identifié (on n'affirme pas vegan à l'aveugle)", () => {
    expect(isRecipeVegan({ ingredients: [ing("Ingrédient inconnu")] }, resolver)).toBe(false);
    expect(isRecipeVegan({ ingredients: [] }, resolver)).toBe(false);
  });

  it("hérite de la non-véganité d'une préparation de base", () => {
    const base = { id: "bechamel", ingredients: [ing("Parmesan"), ing("Farine")] };
    const parent = { ingredients: [ing("Tomate"), ing("base", { recipeId: "bechamel" })] };
    expect(isRecipeVegan(parent, resolver, { recipes: [base] })).toBe(false);
  });
});
