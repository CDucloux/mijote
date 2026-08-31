import { describe, it, expect } from "vitest";
import { paginateStockShelves, compareIngredientName } from "@/lib/food/stockShelves.js";

/** Fabrique une catégorie de `n` ingrédients (ids stables i0, i1, …). */
const cat = (key, n) => [key, Array.from({ length: n }, (_, i) => ({ id: `${key}${i}`, name: `${key}${i}` }))];

describe("paginateStockShelves", () => {
  it("compte toutes les étagères mais ne matérialise que le budget visible", () => {
    // 3 catégories : 5, 3, 4 ingrédients ; perRow 2 -> 3 + 2 + 2 = 7 étagères.
    const grouped = [cat("a", 5), cat("b", 3), cat("c", 4)];
    const { groups, totalShelves } = paginateStockShelves(grouped, 2, new Set(), new Set(), 4);
    expect(totalShelves).toBe(7);
    // Budget 4 : a(3) puis b(1) -> 2 rayons visibles, b partiel, c absent.
    expect(groups.map(g => g.catKey)).toEqual(["a", "b"]);
    expect(groups[0].shelves).toHaveLength(3);
    expect(groups[1].shelves).toHaveLength(1);
  });

  it("découpe les rangées dans l'ordre, sans trou ni chevauchement", () => {
    const grouped = [cat("a", 5)];
    const { groups } = paginateStockShelves(grouped, 2, new Set(), new Set(), 99);
    const rows = groups[0].shelves.map(s => s.row.map(i => i.id));
    expect(rows).toEqual([["a0", "a1"], ["a2", "a3"], ["a4"]]);
  });

  it("marque lastRow sur la dernière rangée RÉELLE de la catégorie, même tronquée", () => {
    const grouped = [cat("a", 5)];
    // Budget 2 : on ne voit que 2 des 3 rangées -> aucune n'est la dernière.
    const partial = paginateStockShelves(grouped, 2, new Set(), new Set(), 2);
    expect(partial.groups[0].shelves.some(s => s.lastRow)).toBe(false);
    // Budget suffisant : la 3e rangée est bien lastRow.
    const full = paginateStockShelves(grouped, 2, new Set(), new Set(), 99);
    expect(full.groups[0].shelves.map(s => s.lastRow)).toEqual([false, false, true]);
  });

  it("compte in-stock (incluant les low) et low séparément, comme l'UI", () => {
    const grouped = [cat("a", 4)]; // ids a0..a3
    const stock = new Set(["a0", "a1", "a2"]); // a2 est aussi bientôt vide
    const low = new Set(["a2"]);
    const { groups } = paginateStockShelves(grouped, 4, stock, low, 99);
    expect(groups[0].total).toBe(4);
    expect(groups[0].inStockInCat).toBe(3);
    expect(groups[0].lowInCat).toBe(1);
  });

  it("ramène un perRow <= 0 à 1 (une colonne) plutôt que de diviser par zéro", () => {
    const grouped = [cat("a", 3)];
    const { groups, totalShelves } = paginateStockShelves(grouped, 0, new Set(), new Set(), 99);
    expect(totalShelves).toBe(3);
    expect(groups[0].shelves.every(s => s.row.length === 1)).toBe(true);
  });

  it("budget nul : aucun rayon matérialisé mais le total reste exact", () => {
    const grouped = [cat("a", 5), cat("b", 3)];
    const { groups, totalShelves } = paginateStockShelves(grouped, 2, new Set(), new Set(), 0);
    expect(groups).toEqual([]);
    expect(totalShelves).toBe(3 + 2);
  });

  it("grouped vide -> aucun rayon, zéro étagère", () => {
    const { groups, totalShelves } = paginateStockShelves([], 3, new Set(), new Set(), 4);
    expect(groups).toEqual([]);
    expect(totalShelves).toBe(0);
  });
});

describe("compareIngredientName", () => {
  it("ordonne en français en ignorant la casse et les accents pour le classement", () => {
    const arr = [{ name: "Élan" }, { name: "abricot" }, { name: "Ail" }];
    const sorted = [...arr].sort(compareIngredientName).map(i => i.name);
    expect(sorted).toEqual(["abricot", "Ail", "Élan"]);
  });

  it("tolère les noms absents (traités comme chaîne vide, donc en tête)", () => {
    const arr = [{ name: "banane" }, {}, { name: "ananas" }];
    const sorted = [...arr].sort(compareIngredientName).map(i => i.name ?? "");
    expect(sorted).toEqual(["", "ananas", "banane"]);
  });
});
