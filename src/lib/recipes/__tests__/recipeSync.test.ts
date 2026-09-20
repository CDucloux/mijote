import { describe, it, expect } from "vitest";
import { planRecipeUpserts } from "../recipeSync.js";
import type { Recipe } from "@/lib/types.js";

const r = (id: string, name: string = id): Recipe => ({ id, name } as Recipe);
const mapOf = (arr: Recipe[]): Map<string, Recipe> => new Map(arr.map(x => [x.id as string, x]));

describe("planRecipeUpserts", () => {
  it("retient les nouvelles et les modifiées, ignore les inchangées", () => {
    const last = mapOf([r("a"), r("b")]);
    const upserts = planRecipeUpserts([r("a"), { id: "b", name: "B modifié" } as Recipe, r("c")], last);
    expect(upserts.map(x => x.id).sort()).toEqual(["b", "c"]); // a inchangée écartée
  });

  it("ne supprime rien : une recette absente en local n'apparaît pas (aucune suppression déduite)", () => {
    const last = mapOf([r("a"), r("b"), r("c")]);
    const upserts = planRecipeUpserts([r("a")], last); // b et c absentes → simplement ignorées
    expect(upserts).toEqual([]);
  });

  it("écarte les recettes sans id", () => {
    const upserts = planRecipeUpserts([{ name: "sans id" } as Recipe, r("a")], new Map());
    expect(upserts.map(x => x.id)).toEqual(["a"]);
  });

  it("cas vide", () => {
    expect(planRecipeUpserts([], new Map())).toEqual([]);
  });

  it("tout est nouveau quand la carte est vide", () => {
    expect(planRecipeUpserts([r("a"), r("b")], new Map()).map(x => x.id)).toEqual(["a", "b"]);
  });
});
