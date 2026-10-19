import { describe, it, expect } from "vitest";
import { stepLinked } from "@/lib/recipes/stepLinks.js";

describe("stepLinked", () => {
  const items = [{ id: "a", name: "farine" }, { id: "b", name: "sucre" }, { id: "c", name: "œuf" }];

  it("garde les éléments liés dans l'ordre de la recette", () => {
    expect(stepLinked(items, ["c", "a"]).map(i => i.id)).toEqual(["a", "c"]);
  });

  it("ignore les ids liés inconnus", () => {
    expect(stepLinked(items, ["z", "b"]).map(i => i.id)).toEqual(["b"]);
  });

  it("renvoie une liste vide sans éléments ou sans liaisons", () => {
    expect(stepLinked(undefined, ["a"])).toEqual([]);
    expect(stepLinked(null, ["a"])).toEqual([]);
    expect(stepLinked(items, undefined)).toEqual([]);
    expect(stepLinked(items, [])).toEqual([]);
  });

  it("ne lie jamais un élément sans id", () => {
    expect(stepLinked([{ name: "sel" }, { id: "a" }], ["a"])).toEqual([{ id: "a" }]);
  });
});
