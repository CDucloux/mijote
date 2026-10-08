import { describe, it, expect } from "vitest";
import { CUT_FAMILIES, CUT_GUIDE, familyOf, hasSizes, cutShortlist, cutSizeLabel, isCuttableCategory } from "../cutGuide.js";
import { FORMES } from "../decoupe.js";

describe("CUT_FAMILIES", () => {
  it("range chaque forme dans exactement une famille", () => {
    const all = CUT_FAMILIES.flatMap(f => f.formes);
    expect([...all].sort()).toEqual([...FORMES].sort());
    expect(new Set(all).size).toBe(all.length);
  });
  it("familyOf retrouve la famille d'une forme", () => {
    expect(familyOf("brunoise")).toBe("cubes");
    expect(familyOf("rondelle")).toBe("tranches");
    expect(familyOf("chiffonade")).toBe("batons");
    expect(familyOf("rape")).toBe("fin");
    expect(familyOf("quartier")).toBe("morceaux");
  });
});

describe("CUT_GUIDE", () => {
  it("décrit chaque forme sans tiret cadratin", () => {
    for (const forme of FORMES) {
      const g = CUT_GUIDE[forme];
      expect(g.name && g.hint && g.result).toBeTruthy();
      expect(`${g.name}${g.hint}${g.result}`).not.toMatch(/\u2014/);
    }
  });
  it("n'offre pas de calibre aux formes dont la taille fait partie de la définition", () => {
    expect(hasSizes("brunoise")).toBe(false);
    expect(hasSizes("julienne")).toBe(false);
    expect(hasSizes("des")).toBe(true);
  });
});

describe("cutShortlist", () => {
  it("propose les découpes usuelles d'après le nom", () => {
    expect(cutShortlist("lard")).toEqual(["des", "batonnet", "lamelle"]);
    expect(cutShortlist("Oignons rouges")).toEqual(["emince", "cisele", "hache"]);
    expect(cutShortlist("Échalote")).toEqual(["emince", "cisele", "hache"]);
    expect(cutShortlist("persil plat")).toEqual(["cisele", "hache", "chiffonade"]);
  });
  it("teste les expressions composées avant les mots seuls", () => {
    expect(cutShortlist("pomme de terre")).toEqual(["des", "lamelle", "rondelle", "batonnet"]);
    expect(cutShortlist("pomme")).toEqual(["des", "lamelle", "quartier"]);
  });
  it("ne confond pas un mot avec un fragment (« ail » dans « caille »)", () => {
    expect(cutShortlist("caille", "meat")).toEqual(["des", "lamelle", "emince"]);
  });
  it("retombe sur la catégorie, puis sur une liste générique", () => {
    expect(cutShortlist("topinambour", "vegetable")).toEqual(["des", "emince", "rondelle", "lamelle"]);
    expect(cutShortlist("ingrédient mystère", "inconnue")).toEqual(["des", "emince", "lamelle", "hache"]);
    expect(cutShortlist("", null)).toEqual(["des", "emince", "lamelle", "hache"]);
    expect(cutShortlist(undefined)).toEqual(["des", "emince", "lamelle", "hache"]);
  });
  it("garde la découpe déjà posée en tête quand elle n'est pas suggérée", () => {
    expect(cutShortlist("lard", null, "chiffonade")).toEqual(["chiffonade", "des", "batonnet", "lamelle"]);
    expect(cutShortlist("lard", null, "des")).toEqual(["des", "batonnet", "lamelle"]);
  });
});

describe("cutSizeLabel", () => {
  it("donne un repère chiffré ou descriptif selon la forme", () => {
    expect(cutSizeLabel("des", "moyen")).toBe("environ 1 cm");
    expect(cutSizeLabel("rape", "fin")).toBe("râpe fine");
  });
  it("renvoie une chaîne vide sans calibre ou pour une forme sans tailles", () => {
    expect(cutSizeLabel("des")).toBe("");
    expect(cutSizeLabel("des", null)).toBe("");
    expect(cutSizeLabel("brunoise", "gros")).toBe("");
  });
});

describe("isCuttableCategory", () => {
  it("exclut alcools, huiles, acides, sauces et sucres", () => {
    for (const c of ["alcohol", "oil", "acid", "sauce", "sugar"]) expect(isCuttableCategory(c)).toBe(false);
  });
  it("garde les catégories qui se taillent", () => {
    for (const c of ["vegetable", "herbs", "meat", "dairy", "other"]) expect(isCuttableCategory(c)).toBe(true);
  });
  it("reste découpable quand la catégorie est absente ou inconnue", () => {
    expect(isCuttableCategory(undefined)).toBe(true);
    expect(isCuttableCategory(null)).toBe(true);
    expect(isCuttableCategory("")).toBe(true);
    expect(isCuttableCategory("inconnue")).toBe(true);
  });
});
