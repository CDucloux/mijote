import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, it, expect } from "vitest";
import { parseChefs, findChef, canonicalChef } from "@/lib/recipes/chefs.js";

describe("parseChefs", () => {
  it("keeps valid entries in file order, with optional note", () => {
    expect(parseChefs({ chefs: [{ name: " Paul Bocuse ", note: "Collonges" }, { name: "Jiro Ono" }] }))
      .toEqual([{ name: "Paul Bocuse", note: "Collonges" }, { name: "Jiro Ono" }]);
  });

  it("drops malformed, empty, too long and duplicate entries", () => {
    const chefs = parseChefs({ chefs: [null, "x", { name: 3 }, { name: "  " }, { name: "a".repeat(121) }, { name: "Joël Robuchon" }, { name: "joel robuchon" }] });
    expect(chefs).toEqual([{ name: "Joël Robuchon" }]);
  });

  it("returns an empty list for a malformed document", () => {
    expect(parseChefs(null)).toEqual([]);
    expect(parseChefs([{ name: "X" }])).toEqual([]);
    expect(parseChefs({ chefs: "nope" })).toEqual([]);
  });

  it("parses the shipped data/chefs.yaml without losing an entry", () => {
    const doc = parse(readFileSync("data/chefs.yaml", "utf8"));
    const chefs = parseChefs(doc);
    expect(chefs).toHaveLength(doc.chefs.length);
    expect(chefs.every(chef => chef.note)).toBe(true);
    expect(findChef(chefs, "Auguste Escoffier")).not.toBeNull();
  });
});

describe("findChef", () => {
  const chefs = [{ name: "Pierre Hermé" }];
  it("matches regardless of case and accents", () => {
    expect(findChef(chefs, "pierre herme")).toEqual({ name: "Pierre Hermé" });
  });
  it("returns null when absent or empty", () => {
    expect(findChef(chefs, "Inconnu")).toBeNull();
    expect(findChef(chefs, "")).toBeNull();
    expect(findChef(chefs, undefined)).toBeNull();
  });
});

describe("canonicalChef", () => {
  const chefs = [
    { name: "Auguste Escoffier" }, { name: "Pierre Hermé" }, { name: "Pierre Gagnaire" },
    { name: "Alain Ducasse" }, { name: "Marie-Antoine Carême" },
  ];
  it("returns the list spelling for an exact match, case and accents ignored", () => {
    expect(canonicalChef(chefs, "  pierre  herme ")).toBe("Pierre Hermé");
  });
  it("matches a lone surname when it designates a single chef", () => {
    expect(canonicalChef(chefs, "Escoffier")).toBe("Auguste Escoffier");
    expect(canonicalChef(chefs, "Careme")).toBe("Marie-Antoine Carême");
  });
  it("matches an initial or first name with the surname", () => {
    expect(canonicalChef(chefs, "A. Escoffier")).toBe("Auguste Escoffier");
    expect(canonicalChef(chefs, "Alain Ducasse")).toBe("Alain Ducasse");
  });
  it("keeps the name when the first name contradicts the list", () => {
    expect(canonicalChef(chefs, "Jean Ducasse")).toBe("Jean Ducasse");
    expect(canonicalChef(chefs, "B. Escoffier")).toBe("B. Escoffier");
  });
  it("keeps unknown or longer names as given, trimmed", () => {
    expect(canonicalChef(chefs, " Mamie  Jeanne ")).toBe("Mamie Jeanne");
    expect(canonicalChef(chefs, "Le Chef Escoffier Junior")).toBe("Le Chef Escoffier Junior");
  });
  it("returns an empty string for an empty value", () => {
    expect(canonicalChef(chefs, "")).toBe("");
    expect(canonicalChef(chefs, undefined)).toBe("");
  });
});
