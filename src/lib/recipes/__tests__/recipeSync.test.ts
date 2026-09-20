import { describe, it, expect } from "vitest";
import { planRecipeSync, MAX_SYNC_DELETIONS } from "../recipeSync.js";
import type { Recipe } from "@/lib/types.js";

const r = (id: string, name: string = id): Recipe => ({ id, name } as Recipe);
const mapOf = (arr: Recipe[]): Map<string, Recipe> => new Map(arr.map(x => [x.id as string, x]));

describe("planRecipeSync", () => {
  it("écrit les nouvelles et modifiées, ignore les inchangées", () => {
    const last = mapOf([r("a"), r("b")]);
    const plan = planRecipeSync([r("a"), { id: "b", name: "B modifié" } as Recipe, r("c")], last);
    expect(plan.upserts.map(x => x.id).sort()).toEqual(["b", "c"]); // a inchangée
    expect(plan.deletions).toEqual([]);
    expect(plan.blockedDeletions).toEqual([]);
  });

  it("supprime normalement en dessous du seuil", () => {
    const last = mapOf([r("a"), r("b"), r("c"), r("d")]);
    const plan = planRecipeSync([r("a")], last, 3); // supprime b, c, d = 3 (== seuil, autorisé)
    expect(plan.deletions.sort()).toEqual(["b", "c", "d"]);
    expect(plan.blockedDeletions).toEqual([]);
  });

  it("BLOQUE toutes les suppressions au-delà du seuil, mais garde les upserts", () => {
    const last = mapOf([r("a"), r("b"), r("c"), r("d"), r("e")]);
    // état local périmé : ne reste que 'a', + une nouvelle 'z' → voudrait supprimer b,c,d,e (4 > 3)
    const plan = planRecipeSync([r("a"), r("z")], last, 3);
    expect(plan.deletions).toEqual([]);
    expect(plan.blockedDeletions.sort()).toEqual(["b", "c", "d", "e"]);
    expect(plan.upserts.map(x => x.id)).toEqual(["z"]); // l'ajout passe quand même
  });

  it("ignore les recettes sans id", () => {
    const plan = planRecipeSync([{ name: "sans id" } as Recipe, r("a")], new Map());
    expect(plan.upserts.map(x => x.id)).toEqual(["a"]);
  });

  it("cas vide : aucun op", () => {
    const plan = planRecipeSync([], new Map());
    expect(plan).toEqual({ upserts: [], deletions: [], blockedDeletions: [] });
  });

  it("le seuil par défaut est 3", () => {
    expect(MAX_SYNC_DELETIONS).toBe(3);
    const last = mapOf([r("a"), r("b"), r("c"), r("d")]);
    expect(planRecipeSync([], last).blockedDeletions.length).toBe(4); // 4 > 3 → bloqué
    expect(planRecipeSync([], mapOf([r("a"), r("b"), r("c")])).deletions.length).toBe(3); // 3 == seuil → ok
  });
});
