import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, it, expect } from "vitest";
import { parseChefs, findChef } from "@/lib/recipes/chefs.js";

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
