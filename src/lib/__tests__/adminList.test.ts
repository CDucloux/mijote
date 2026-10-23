import { describe, it, expect } from "vitest";
import { groupAdminList, countAdminCategories } from "@/lib/admin/adminList.js";

interface Entry { name?: string; cat?: string; ok?: boolean }
const items: Entry[] = [{ name: "b", cat: "x" }, { name: "A", cat: "x", ok: true }, { name: "c", cat: "y" }, { cat: "z" }];
const acc = { category: (e: Entry) => e.cat ?? "", labels: (e: Entry) => [e.name], name: (e: Entry) => e.name };

describe("groupAdminList", () => {
  it("suit l'ordre fourni puis les catégories inconnues triées", () => {
    expect(groupAdminList(items, ["y", "x"], { category: null, search: "" }, acc).map(g => g.category)).toEqual(["y", "x", "z"]);
  });
  it("trie par nom sans casse, nom absent en tête", () => {
    const groups = groupAdminList([...items, { cat: "x" }], ["x"], { category: "x", search: "" }, acc);
    expect(groups[0].items.map(e => e.name)).toEqual([undefined, "A", "b"]);
  });
  it("applique le filtre de suivi et la recherche", () => {
    expect(groupAdminList(items, ["x", "y"], { category: null, search: "" }, { ...acc, keep: (e: Entry) => !!e.ok }).flatMap(g => g.items)).toEqual([items[1]]);
    expect(groupAdminList(items, ["x", "y"], { category: null, search: "C" }, acc).flatMap(g => g.items)).toEqual([items[2]]);
  });
  it("ne mute pas l'entrée", () => {
    const copy = [...items];
    groupAdminList(items, ["x"], { category: null, search: "" }, acc);
    expect(items).toEqual(copy);
  });
});

describe("countAdminCategories", () => {
  it("compte par catégorie, filtre compris", () => {
    expect(countAdminCategories(items, acc.category)).toEqual({ x: 2, y: 1, z: 1 });
    expect(countAdminCategories(items, acc.category, e => !!e.ok)).toEqual({ x: 1 });
    expect(countAdminCategories([], acc.category)).toEqual({});
  });
});
