import { describe, it, expect } from "vitest";
import { groupAdminIngredients, countByCategory } from "@/lib/food/ingredientAdminView.js";

const db = [
  { id: "1", name: "Tomate", category: "vegetable", status: "validated", image: "t.jpg", nutrition: { calories: 18 } },
  { id: "2", name: "Échalote", category: "vegetable", aliases: ["shallot"] },
  { id: "3", name: "Pomme", category: "fruit", image: "p.jpg" },
  { id: "4", name: "Ail", category: "vegetable" },
  { id: "5", name: "Mystère", category: "legacy" },
  { id: "6", name: "Orphelin" },
];
const order = ["fruit", "vegetable"];
const all = { category: null, filter: null, search: "" };

describe("groupAdminIngredients", () => {
  it("groupe dans l'ordre des catégories et trie par nom (accents ignorés)", () => {
    const groups = groupAdminIngredients(db, order, all);
    expect(groups.map(g => g.category)).toEqual(["fruit", "vegetable", "", "legacy"]);
    expect(groups[1].items.map(i => i.name)).toEqual(["Ail", "Échalote", "Tomate"]);
  });
  it("garde les fiches de catégorie inconnue ou absente en fin de liste", () => {
    const groups = groupAdminIngredients(db, [], all);
    expect(groups.flatMap(g => g.items)).toHaveLength(db.length);
  });
  it("restreint à la catégorie choisie", () => {
    const groups = groupAdminIngredients(db, order, { ...all, category: "fruit" });
    expect(groups).toEqual([{ category: "fruit", items: [db[2]] }]);
  });
  it("applique le filtre de suivi et omet les groupes vides", () => {
    const groups = groupAdminIngredients(db, order, { ...all, filter: "validated" });
    expect(groups).toEqual([{ category: "vegetable", items: [db[0]] }]);
  });
  it("cherche sur le nom et les alias, sans casse ni accents", () => {
    expect(groupAdminIngredients(db, order, { ...all, search: "ECHAL" }).flatMap(g => g.items)).toEqual([db[1]]);
    expect(groupAdminIngredients(db, order, { ...all, search: "shall" }).flatMap(g => g.items)).toEqual([db[1]]);
    expect(groupAdminIngredients(db, order, { ...all, search: "  " })).toHaveLength(4);
  });
  it("rend une liste vide sur une base vide", () => {
    expect(groupAdminIngredients([], order, all)).toEqual([]);
  });
});

describe("countByCategory", () => {
  it("compte par catégorie sous le filtre de suivi", () => {
    expect(countByCategory(db, null)).toEqual({ vegetable: 3, fruit: 1, legacy: 1, "": 1 });
    expect(countByCategory(db, "no-image")).toEqual({ vegetable: 2, legacy: 1, "": 1 });
  });
});
