import { describe, it, expect } from "vitest";
import { linkCutBowl, type CutBowlRecipe } from "../cutBowl.js";

const recipe = (over: Partial<CutBowlRecipe> = {}): CutBowlRecipe => ({
  ingredients: [{ id: "i0", cut: { forme: "emince" } }, { id: "i1" }],
  utensils: [{ id: "u0", dbId: "", name: "Couteau" }],
  steps: [{ ingredients: ["i0"], utensils: ["u0"] }, { ingredients: ["i1"], utensils: [] }],
  ...over,
});
const KNOWN = ["Couteau", "Bol mixeur", "Bol", "Saladier"];

describe("linkCutBowl", () => {
  it("ajoute le bol de la base et le relie à l'étape qui découpe, pas aux autres", () => {
    const out = linkCutBowl(recipe(), KNOWN);
    expect(out.utensils.at(-1)).toEqual({ id: "u1", dbId: "", name: "Bol" });
    expect(out.steps[0].utensils).toEqual(["u0", "u1"]);
    expect(out.steps[1].utensils).toEqual([]);
  });

  it("une étape reliée à une planche compte comme une découpe", () => {
    const out = linkCutBowl(recipe({
      ingredients: [{ id: "i0" }],
      utensils: [{ id: "u0", dbId: "", name: "Planche à découper" }],
      steps: [{ ingredients: ["i0"], utensils: ["u0"] }],
    }), KNOWN);
    expect(out.steps[0].utensils).toEqual(["u0", "u1"]);
  });

  it("réutilise le bol déjà présent, sans doublon ni double liaison", () => {
    const out = linkCutBowl(recipe({
      utensils: [{ id: "u0", dbId: "", name: "Couteau" }, { id: "u1", dbId: "", name: "bols" }],
      steps: [{ ingredients: ["i0"], utensils: ["u0", "u1"] }, { ingredients: ["i0"], utensils: [] }],
    }), KNOWN);
    expect(out.utensils).toHaveLength(2);
    expect(out.steps[0].utensils).toEqual(["u0", "u1"]);
    expect(out.steps[1].utensils).toEqual(["u1"]);
  });

  it("sans bol dans la base, ne touche à rien", () => {
    const out = linkCutBowl(recipe(), ["Couteau", "Saladier", "Bolduc"]);
    expect(out.utensils).toHaveLength(1);
    expect(out.steps[0].utensils).toEqual(["u0"]);
  });

  it("sans étape de découpe, n'ajoute pas de bol", () => {
    const out = linkCutBowl(recipe({ ingredients: [{ id: "i0" }, { id: "i1" }] }), KNOWN);
    expect(out.utensils).toHaveLength(1);
  });

  it("évite une collision d'id si les ids ne sont pas contigus", () => {
    const out = linkCutBowl(recipe({ utensils: [{ id: "u1", dbId: "", name: "Couteau" }], steps: [{ ingredients: ["i0"], utensils: [] }] }), KNOWN);
    expect(out.utensils.map((u) => u.id)).toEqual(["u1", "u2"]);
  });

  it("recette vide : ne plante pas", () => {
    expect(linkCutBowl({ ingredients: [], utensils: [], steps: [] }, KNOWN).utensils).toEqual([]);
  });
});
