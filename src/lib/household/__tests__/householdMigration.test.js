import { describe, it, expect } from "vitest";
import { mergeShared } from "../householdMigration.js";

// mergeShared est le FILET DE SÉCURITÉ de la réparation de foyer : quand un membre
// retrouve son pointeur, ses données solo résiduelles sont refusionnées dans le foyer.
// La fusion doit être STRICTEMENT additive côté bibliothèque (aucune recette perdue),
// et ADOPTER le foyer pour le planning / les listes (ressources partagées).

describe("mergeShared", () => {
  it("entrées nulles/vides : renvoie une structure complète et vide (jamais de crash)", () => {
    expect(mergeShared(null, null)).toEqual({
      recipes: [], collections: [], mealPlan: {}, shoppingLists: [], stock: [], lowStock: [],
    });
    expect(mergeShared(undefined, undefined)).toEqual({
      recipes: [], collections: [], mealPlan: {}, shoppingLists: [], stock: [], lowStock: [],
    });
  });

  it("ne perd AUCUNE recette : union du foyer et des recettes solo propres au membre", () => {
    const local = { recipes: [{ id: "r1", name: "Dahl" }, { id: "r2", name: "Tarte" }] };
    const remote = { recipes: [{ id: "rA", name: "Curry" }] };
    const { recipes } = mergeShared(local, remote);
    const names = recipes.map(r => r.name).sort();
    expect(names).toEqual(["Curry", "Dahl", "Tarte"]);
  });

  it("homonyme de recette : la version du foyer gagne, le doublon local est écarté", () => {
    const local = { recipes: [{ id: "r1", name: "Dahl", note: "perso" }] };
    const remote = { recipes: [{ id: "rA", name: "dahl", note: "foyer" }] };
    const { recipes } = mergeShared(local, remote);
    expect(recipes).toHaveLength(1);
    expect(recipes[0].note).toBe("foyer");
  });

  it("collision d'id entre une recette locale conservée et une recette du foyer : l'id local est régénéré", () => {
    const local = { recipes: [{ id: "dup", name: "Tarte perso" }] };
    const remote = { recipes: [{ id: "dup", name: "Curry foyer" }] };
    const { recipes } = mergeShared(local, remote);
    expect(recipes).toHaveLength(2);
    const ids = recipes.map(r => r.id);
    expect(new Set(ids).size).toBe(2); // plus aucune collision d'id
    expect(recipes.find(r => r.name === "Curry foyer").id).toBe("dup"); // le foyer garde le sien
  });

  it("carnets homonymes : dédupliqués, et les références des recettes locales sont remappées vers l'id du foyer", () => {
    const local = {
      collections: [{ id: "cLocal", name: "Desserts" }],
      recipes: [{ id: "r1", name: "Tarte", collections: ["cLocal"] }],
    };
    const remote = { collections: [{ id: "cFoyer", name: "desserts" }], recipes: [] };
    const { collections, recipes } = mergeShared(local, remote);
    // Un seul carnet "Desserts", celui du foyer.
    expect(collections).toHaveLength(1);
    expect(collections[0].id).toBe("cFoyer");
    // La recette locale pointe désormais vers le carnet du foyer, pas vers l'ancien id.
    expect(recipes[0].collections).toEqual(["cFoyer"]);
  });

  it("carnet local sans homonyme : conservé tel quel, en plus de ceux du foyer", () => {
    const local = { collections: [{ id: "cLocal", name: "Mes essais" }] };
    const remote = { collections: [{ id: "cFoyer", name: "Classiques" }] };
    const { collections } = mergeShared(local, remote);
    expect(collections.map(c => c.id).sort()).toEqual(["cFoyer", "cLocal"]);
  });

  it("planning : on ADOPTE celui du foyer, jamais le local (ressource partagée)", () => {
    const local = { mealPlan: { "2026-01-01": ["perso"] } };
    const remote = { mealPlan: { "2026-02-02": ["foyer"] } };
    expect(mergeShared(local, remote).mealPlan).toEqual({ "2026-02-02": ["foyer"] });
  });

  it("listes de courses : on ADOPTE celles du foyer, jamais les locales", () => {
    const local = { shoppingLists: [{ id: "lPerso" }] };
    const remote = { shoppingLists: [{ id: "lFoyer" }] };
    expect(mergeShared(local, remote).shoppingLists).toEqual([{ id: "lFoyer" }]);
  });

  it("foyer sans planning ni listes : le local n'est PAS récupéré (le foyer fait foi, même vide)", () => {
    const local = { mealPlan: { x: 1 }, shoppingLists: [{ id: "lPerso" }] };
    const remote = {};
    const merged = mergeShared(local, remote);
    expect(merged.mealPlan).toEqual({});
    expect(merged.shoppingLists).toEqual([]);
  });

  it("stock et lowStock : union dédupliquée des ids", () => {
    const local = { stock: ["a", "b"], lowStock: ["x"] };
    const remote = { stock: ["b", "c"], lowStock: ["x", "y"] };
    const merged = mergeShared(local, remote);
    expect(merged.stock.sort()).toEqual(["a", "b", "c"]);
    expect(merged.lowStock.sort()).toEqual(["x", "y"]);
  });

  it("refusionner un membre déjà à jour (local ⊆ foyer) ne duplique rien : opération stable", () => {
    const remote = {
      recipes: [{ id: "rA", name: "Curry" }, { id: "rB", name: "Dahl" }],
      collections: [{ id: "cFoyer", name: "Classiques" }],
      stock: ["a"], lowStock: [], mealPlan: { d: 1 }, shoppingLists: [{ id: "l1" }],
    };
    // Le membre a déjà adopté le foyer : son "local" est une copie du foyer.
    const merged = mergeShared(remote, remote);
    expect(merged.recipes.map(r => r.name).sort()).toEqual(["Curry", "Dahl"]);
    expect(merged.collections).toHaveLength(1);
    expect(merged.stock).toEqual(["a"]);
    expect(merged.mealPlan).toEqual({ d: 1 });
    expect(merged.shoppingLists).toEqual([{ id: "l1" }]);
  });

  it("ne mute pas les entrées (pas d'effet de bord sur les tableaux source)", () => {
    const local = { recipes: [{ id: "r1", name: "Tarte" }], stock: ["a"] };
    const remote = { recipes: [{ id: "rA", name: "Curry" }], stock: ["b"] };
    const localSnapshot = JSON.parse(JSON.stringify(local));
    const remoteSnapshot = JSON.parse(JSON.stringify(remote));
    mergeShared(local, remote);
    expect(local).toEqual(localSnapshot);
    expect(remote).toEqual(remoteSnapshot);
  });
});
