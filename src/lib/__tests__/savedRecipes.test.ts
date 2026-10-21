import { describe, it, expect } from "vitest";
import { isSavedRecipe, isRecipeDraft } from "@/lib/recipes/savedRecipes.js";

describe("isSavedRecipe", () => {
  it("vraie pour une recette identifiée", () => {
    expect(isSavedRecipe({ id: "r1", name: "Tarte" })).toBe(true);
  });
  it("fausse sans identifiant, avec un identifiant vide ou non textuel", () => {
    expect(isSavedRecipe({ name: "Brouillon" })).toBe(false);
    expect(isSavedRecipe({ id: "" })).toBe(false);
    expect(isSavedRecipe({ id: 42 as unknown as string })).toBe(false);
  });
});

describe("isRecipeDraft", () => {
  it("accepte un brouillon, même minimal", () => {
    expect(isRecipeDraft({})).toBe(true);
    expect(isRecipeDraft({ name: "Tarte", ingredients: [], steps: [{ text: "Cuire" }] })).toBe(true);
  });
  it("refuse ce qui n'est pas un objet ou dont les champs clés sont malformés", () => {
    expect(isRecipeDraft(null)).toBe(false);
    expect(isRecipeDraft("Tarte")).toBe(false);
    expect(isRecipeDraft([{ name: "Tarte" }])).toBe(false);
    expect(isRecipeDraft({ name: 3 })).toBe(false);
    expect(isRecipeDraft({ id: 3 })).toBe(false);
    expect(isRecipeDraft({ ingredients: "oeufs" })).toBe(false);
  });
});
