import { describe, it, expect } from "vitest";
import { prepareRecipeImport } from "@/lib/recipes/recipeImport.js";

// Petit helper : encode une recette minimale valide et renvoie ses ingrédients préparés.
const prep = (ingredients) => {
  const res = prepareRecipeImport(JSON.stringify({ name: "Test", ingredients }), {});
  if ("error" in res) throw new Error(res.error);
  return res.prepared[0].ingredients;
};

describe("prepareRecipeImport : découpe (cut)", () => {
  it("ramène une découpe brute (chaîne) au vocabulaire fermé", () => {
    const [ing] = prep([{ name: "oignon", amount: 2, cut: "émincé" }]);
    expect(ing.cut).toEqual({ forme: "emince" });
  });

  it("accepte l'objet { forme, calibre } et normalise le calibre", () => {
    const [ing] = prep([{ name: "carotte", amount: 200, unit: "g", cut: { forme: "brunoise", calibre: "petit" } }]);
    expect(ing.cut).toEqual({ forme: "brunoise", calibre: "fin" });
  });

  it("écarte une découpe non reconnue (aucun champ cut stocké)", () => {
    const [ing] = prep([{ name: "farine", amount: 250, unit: "g", cut: "spiralé" }]);
    expect(ing.cut).toBeUndefined();
    expect("cut" in ing).toBe(false);
  });

  it("narrowe la découpe même quand le dbId est déjà présent", () => {
    const [ing] = prep([{ name: "ail", amount: 3, dbId: "ing_ail", cut: "haché" }]);
    expect(ing.dbId).toBe("ing_ail");
    expect(ing.cut).toEqual({ forme: "hache" });
  });
});
