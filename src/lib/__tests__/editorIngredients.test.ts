import { describe, it, expect } from "vitest";
import { cleanEditorIngredients } from "@/lib/recipes/editorIngredients.js";

describe("cleanEditorIngredients", () => {
  it("retire les lignes totalement vides en silence", () => {
    const { cleaned, missingQty } = cleanEditorIngredients([{ name: "", amount: "" }, { name: "Farine", amount: 200 }]);
    expect(cleaned).toEqual([{ name: "Farine", amount: 200 }]);
    expect(missingQty).toEqual([]);
  });

  it("signale une ligne nommée ou liée sans quantité valide", () => {
    const lines = [{ name: "Sel", amount: "" }, { dbId: "beurre", amount: 0 }, { recipeId: "pate", amount: "abc" }];
    const { cleaned, missingQty } = cleanEditorIngredients(lines);
    expect(cleaned).toHaveLength(3);
    expect(missingQty).toEqual(lines);
  });

  it("accepte une quantité saisie en texte numérique", () => {
    expect(cleanEditorIngredients([{ name: "Lait", amount: "250" }]).missingQty).toEqual([]);
  });

  it("garde une quantité sans nom (ligne en cours de saisie) sans la signaler", () => {
    const { cleaned, missingQty } = cleanEditorIngredients([{ name: "", amount: 3 }]);
    expect(cleaned).toHaveLength(1);
    expect(missingQty).toEqual([]);
  });

  it("gère une liste vide", () => {
    expect(cleanEditorIngredients([])).toEqual({ cleaned: [], missingQty: [] });
  });
});
