import { describe, it, expect } from "vitest";
import { ingredientMatch } from "@/lib/recipes/ingredientMatch.js";
import type { IngredientLine } from "@/lib/types.js";

const ing = (over: Partial<IngredientLine> = {}): IngredientLine => ({
  id: "l1", name: "", amount: "", unit: "", dbId: "", ...over,
});

describe("ingredientMatch", () => {
  it("marque vide une ligne sans rien de saisi", () => {
    const m = ingredientMatch(ing());
    expect(m.empty).toBe(true);
    expect(m.tone).toBe("neutral");
    expect(m.summary).toBe("");
  });

  it("est ok pour un ingrédient reconnu et quantifié", () => {
    const m = ingredientMatch(ing({ name: "pomme de terre", amount: 300, unit: "g", dbId: "db1" }));
    expect(m.tone).toBe("ok");
    expect(m.recognized).toBe(true);
    expect(m.hasQuantity).toBe(true);
    expect(m.hasUnit).toBe(true);
    expect(m.summary).toBe("Ingrédient reconnu");
  });

  it("reste ok sans unité pour un ingrédient à la pièce", () => {
    const m = ingredientMatch(ing({ name: "oeuf", amount: 2, unit: "", dbId: "db2" }));
    expect(m.tone).toBe("ok");
    expect(m.hasUnit).toBe(false);
    expect(m.summary).toBe("Ingrédient reconnu");
  });

  it("alerte quand le nom n'est pas apparié à la base", () => {
    const m = ingredientMatch(ing({ name: "topinambour", amount: 200, unit: "g", dbId: "" }));
    expect(m.tone).toBe("warn");
    expect(m.recognized).toBe(false);
    expect(m.summary).toBe("Ingrédient non référencé");
  });

  it("alerte quand la quantité manque sur un ingrédient reconnu", () => {
    const m = ingredientMatch(ing({ name: "carotte", amount: "", unit: "", dbId: "db3" }));
    expect(m.tone).toBe("warn");
    expect(m.hasQuantity).toBe(false);
    expect(m.summary).toBe("Quantité manquante");
  });

  it("priorise le nom manquant sur le reste", () => {
    const m = ingredientMatch(ing({ name: "", amount: 300, unit: "g", dbId: "" }));
    expect(m.tone).toBe("warn");
    expect(m.named).toBe(false);
    expect(m.summary).toBe("Ingrédient à nommer");
  });

  it("traite une quantité 0 ou non numérique comme absente", () => {
    expect(ingredientMatch(ing({ name: "sel", amount: 0, dbId: "db4" })).hasQuantity).toBe(false);
    expect(ingredientMatch(ing({ name: "sel", amount: "abc", dbId: "db4" })).hasQuantity).toBe(false);
  });

  it("accepte la virgule décimale comme quantité", () => {
    const m = ingredientMatch(ing({ name: "huile", amount: "1,5", unit: "cs", dbId: "db5" }));
    expect(m.hasQuantity).toBe(true);
    expect(m.tone).toBe("ok");
  });

  it("tolère une ligne nulle ou indéfinie", () => {
    expect(ingredientMatch(null).empty).toBe(true);
    expect(ingredientMatch(undefined).empty).toBe(true);
  });
});
