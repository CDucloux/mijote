import { describe, it, expect } from "vitest";
import { sameData, mergeImport, importHeadline, importContext } from "@/lib/household/importMerge.js";

const UTENSIL = { one: "ustensile", many: "ustensiles", newOne: "nouvel ustensile", newMany: "nouveaux ustensiles" };
const spread = (cur, row) => ({ ...cur, ...row, id: cur.id });
const opts = { matchByName: true, combine: spread, newId: (_row, n) => `new_${n}` };

describe("sameData", () => {
  it("ignore l'ordre des clés et confond absent, undefined et null", () => {
    expect(sameData({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
    expect(sameData({ a: 1, b: undefined }, { a: 1, c: null })).toBe(true);
  });
  it("voit une différence de valeur, de longueur ou de type", () => {
    expect(sameData({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameData([1, 2], [1])).toBe(false);
    expect(sameData([1], { 0: 1 })).toBe(false);
    expect(sameData("1", 1)).toBe(false);
    expect(sameData({ a: "" }, {})).toBe(false);
  });
});

describe("mergeImport", () => {
  const base = [
    { id: "u1", name: "Poêle Inox", category: "cuisson", usagePrecaution: { tone: "heat", title: "T", tip: "vieux" } },
    { id: "u2", name: "Bol", category: "preparation" },
  ];

  it("ne compte comme mises à jour que les entrées réellement modifiées", () => {
    const rows = [
      { id: "u1", name: "Poêle Inox", category: "cuisson", usagePrecaution: { tone: "heat", title: "T2" } },
      { id: "u2", name: "Bol", category: "preparation" },
    ];
    const { next, report } = mergeImport(base, rows, opts);
    expect(report).toEqual({ read: 2, created: [], updated: ["Poêle Inox"], unchanged: 1 });
    expect(next[0].usagePrecaution).toEqual({ tone: "heat", title: "T2" });
    expect(next[1]).toBe(base[1]);
  });

  it("apparie par nom normalisé, crée le reste et ne supprime rien", () => {
    const { next, report } = mergeImport(base, [{ name: "  poele inox ", category: "cuisson" }, { name: "Fouet" }], opts);
    expect(report.created).toEqual(["Fouet"]);
    expect(report.updated).toEqual(["  poele inox "]);
    expect(next[0].id).toBe("u1");
    expect(next).toHaveLength(3);
    expect(next[2]).toEqual({ name: "Fouet", id: "new_1" });
  });

  it("n'apparie pas par nom quand la base l'interdit, et ne mute pas l'entrée", () => {
    const { next, report } = mergeImport(base, [{ id: "x", name: "Bol" }], { ...opts, matchByName: false });
    expect(report.created).toEqual(["Bol"]);
    expect(next).toHaveLength(3);
    expect(base).toHaveLength(2);
  });

  it("indexe les créations : une ligne en double ne crée qu'une entrée", () => {
    const { next, report } = mergeImport([], [{ name: "Fouet" }, { name: "fouet", category: "x" }], opts);
    expect(next).toHaveLength(1);
    expect(report).toEqual({ read: 2, created: ["Fouet"], updated: ["fouet"], unchanged: 0 });
  });

  it("supporte un fichier vide", () => {
    expect(mergeImport(base, [], opts).report).toEqual({ read: 0, created: [], updated: [], unchanged: 0 });
  });
});

describe("importHeadline / importContext", () => {
  const report = (created, updated, unchanged) => ({ read: created.length + updated.length + unchanged, created, updated, unchanged });

  it("met en avant ce qui a changé", () => {
    expect(importHeadline(report([], ["a"], 68), UTENSIL)).toBe("1 ustensile mis à jour");
    expect(importHeadline(report([], ["a", "b", "c"], 66), UTENSIL)).toBe("3 ustensiles mis à jour");
    expect(importHeadline(report(["n"], [], 0), UTENSIL)).toBe("1 nouvel ustensile");
    expect(importHeadline(report(["n", "m"], ["a"], 0), UTENSIL)).toBe("2 nouveaux ustensiles, 1 mis à jour");
    expect(importHeadline(report([], [], 69), UTENSIL)).toBe("Tout était déjà à jour");
  });

  it("donne le contexte : lus, déjà à jour, rien de supprimé", () => {
    expect(importContext(report([], ["a"], 68), UTENSIL)).toBe("69 ustensiles lus, 68 déjà à jour. Rien n'a été supprimé.");
    expect(importContext(report(["n"], [], 0), UTENSIL)).toBe("1 ustensile lu. Rien n'a été supprimé.");
    expect(importContext(report([], [], 69), UTENSIL)).toBe("69 ustensiles lus, tous identiques à la base. Rien n'a été modifié.");
  });
});
