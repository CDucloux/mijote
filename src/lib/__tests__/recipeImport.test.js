import { describe, it, expect } from "vitest";
import { validateRecipeSchema } from "../recipeSchema.js";
import { prepareRecipeImport } from "../recipeImport.js";

describe("validateRecipeSchema — tolérance des quantités", () => {
  const withAmount = (amount) => ({ name: "R", ingredients: [{ name: "sucre", amount }], steps: [] });

  it("accepte un amount nombre", () => {
    expect(validateRecipeSchema(withAmount(200), "R")).toEqual([]);
  });
  it("accepte un amount chaîne numérique (ce que renvoie le LLM)", () => {
    expect(validateRecipeSchema(withAmount("200"), "R")).toEqual([]);
    expect(validateRecipeSchema(withAmount("1,5"), "R")).toEqual([]); // virgule décimale
  });
  it("rejette un amount non numérique", () => {
    expect(validateRecipeSchema(withAmount("beaucoup"), "R").length).toBe(1);
  });
});

describe("prepareRecipeImport — composants (préparations de base)", () => {
  // Composant tel que le renvoie le serveur d'extraction : amounts en CHAÎNES.
  const caramel = {
    name: "Caramel beurre salé", isComponent: true, yield: { amount: 400, unit: "g" }, _key: "cmp0",
    ingredients: [{ id: "i0", dbId: "", name: "sucre", amount: "200", unit: "g", _raw: "200 g sucre" }],
    utensils: [], steps: [{ id: "s0", title: "", text: "Faire un caramel.", tip: "", image: "", ingredients: ["i0"], utensils: [] }],
  };

  it("importe un composant sans le rejeter, en préservant isComponent/yield/_key", () => {
    const res = prepareRecipeImport(JSON.stringify(caramel), { ingredientDB: [], utensilDB: [] });
    expect(res.error).toBeUndefined();
    const c = res.prepared[0];
    expect(c.isComponent).toBe(true);
    expect(c.yield).toEqual({ amount: 400, unit: "g" });
    expect(c._key).toBe("cmp0");
    expect(c.id).toBeTruthy();
  });

  it("ne remplit jamais de dbId sur une ligne composant (recipeId préservé)", () => {
    const main = {
      name: "Tarte", ingredients: [{ recipeId: "cmp0", name: "Caramel beurre salé", amount: "400", unit: "g" }], steps: [],
    };
    const res = prepareRecipeImport(JSON.stringify(main), { ingredientDB: [{ id: "d1", name: "Caramel" }], utensilDB: [] });
    expect(res.error).toBeUndefined();
    const line = res.prepared[0].ingredients[0];
    expect(line.recipeId).toBe("cmp0");
    expect(line.dbId).toBeUndefined(); // pas de dbId → reste une ligne composant
  });
});
