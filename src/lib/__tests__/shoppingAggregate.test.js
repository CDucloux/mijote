import { describe, it, expect } from "vitest";
import { aggregateShopping } from "../shoppingAggregate.js";

const DB = [
  { id: "citron", name: "Citron", category: "fruits", image: "citron.png", aliases: ["citrons"] },
  { id: "farine", name: "Farine", category: "epicerie", image: "farine.png" },
];

const lists = [
  { id: "l1", name: "Pâtes ricotta", items: [
    { id: "a1", name: "citrons", amount: 2, unit: "pièces", checked: false },
    { id: "a2", name: "farine", amount: 200, unit: "g", checked: true },
  ] },
  { id: "l2", name: "Mermizeli", items: [
    { id: "b1", name: "Citron", amount: 2, unit: "pièce", checked: false },
    { id: "b2", name: "farine", amount: 300, unit: "g", checked: true },
  ] },
];

describe("aggregateShopping", () => {
  const byName = (arr) => Object.fromEntries(arr.map(a => [a.name, a]));

  it("déduplique par ingrédient et somme les quantités de même unité", () => {
    const agg = byName(aggregateShopping(lists, DB));
    expect(Object.keys(agg)).toHaveLength(2);
    // 2 pièces + 2 pièce → 4 pièces (somme sur unité singularisée, affichage = 1re orthographe vue)
    expect(agg.Citron.qtyDisplay).toBe("4 pièces");
    // 200 g + 300 g → 500g (grammes collés)
    expect(agg.Farine.qtyDisplay).toBe("500g");
  });

  it("conserve la provenance (listes d'origine, dédupliquée)", () => {
    const agg = byName(aggregateShopping(lists, DB));
    expect(agg.Citron.sources).toEqual(["Pâtes ricotta", "Mermizeli"]);
  });

  it("checked seulement si TOUS les contributeurs sont cochés", () => {
    const agg = byName(aggregateShopping(lists, DB));
    expect(agg.Farine.checked).toBe(true);   // les deux cochés
    expect(agg.Citron.checked).toBe(false);
    expect(agg.Citron.partial).toBe(false);
  });

  it("marque partial quand une partie seulement est cochée", () => {
    const partial = [
      { id: "l1", name: "A", items: [{ id: "x", name: "Citron", amount: 1, unit: "pièce", checked: true }] },
      { id: "l2", name: "B", items: [{ id: "y", name: "citrons", amount: 1, unit: "pièce", checked: false }] },
    ];
    const agg = byName(aggregateShopping(partial, DB));
    expect(agg.Citron.checked).toBe(false);
    expect(agg.Citron.partial).toBe(true);
    expect(agg.Citron.contributors).toHaveLength(2);
  });

  it("garde des unités distinctes séparées dans l'affichage", () => {
    const mixed = [
      { id: "l1", name: "A", items: [{ id: "x", name: "Citron", amount: 2, unit: "pièce", checked: false }] },
      { id: "l2", name: "B", items: [{ id: "y", name: "Citron", amount: 50, unit: "g", checked: false }] },
    ];
    const agg = byName(aggregateShopping(mixed, DB));
    expect(agg.Citron.qtyDisplay).toBe("2 pièce + 50g");
  });
});
