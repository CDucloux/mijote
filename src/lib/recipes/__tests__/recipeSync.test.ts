import { describe, it, expect } from "vitest";
import { planRecipeUpserts, reuseUnchanged, sameJson } from "../recipeSync.js";
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

describe("sameJson", () => {
  it("ignore l'ordre des clés et les champs undefined", () => {
    expect(sameJson({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 })).toBe(true);
    expect(sameJson({ a: 1, x: undefined }, { a: 1 })).toBe(true);
  });
  it("distingue contenus, tableaux et types différents", () => {
    expect(sameJson({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(sameJson({ a: 1 }, { a: "1" })).toBe(false);
    expect(sameJson([], {})).toBe(false);
    expect(sameJson(null, {})).toBe(false);
  });
});

describe("reuseUnchanged", () => {
  it("rend l'état local tel quel quand le distant est identique (écho)", () => {
    const local = [r("a"), r("b")];
    const remote = [{ name: "a", id: "a" } as Recipe, r("b")];
    expect(reuseUnchanged(local, remote)).toBe(local);
  });
  it("reprend les objets inchangés et garde les modifiés", () => {
    const local = [r("a"), r("b")];
    const changed = { id: "b", name: "B2" } as Recipe;
    const out = reuseUnchanged(local, [r("a"), changed]);
    expect(out).not.toBe(local);
    expect(out[0]).toBe(local[0]);
    expect(out[1]).toBe(changed);
  });
  it("gère ajout, retrait, ordre différent et recettes sans id", () => {
    const local = [r("a"), r("b")];
    const out = reuseUnchanged(local, [r("b"), r("c"), { name: "x" } as Recipe]);
    expect(out.map(x => x.id)).toEqual(["b", "c", undefined]);
    expect(out[0]).toBe(local[1]);
    expect(reuseUnchanged([], [])).toEqual([]);
  });
});
