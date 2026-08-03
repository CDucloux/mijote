import { describe, it, expect } from "vitest";
import { normalizeName, findIngredientMatch, buildNameMatcher, createIngredientResolver } from "@/lib/food/nameMatcher.js";

const db = [
  { id: "ail", name: "Ail" },
  { id: "huile-olive", name: "Huile d'olive" },
  { id: "tomate", name: "Tomate" },
  { id: "oignon", name: "Oignon", aliases: ["échalote grise"] },
  { id: "poivre-noir", name: "Poivre noir" },
];

describe("normalizeName", () => {
  it("lowercases, strips accents and punctuation, compacts spaces", () => {
    expect(normalizeName("Huile d'olive")).toBe("huile d olive");
    expect(normalizeName("  Crème   Fraîche ")).toBe("creme fraiche");
  });
});

describe("findIngredientMatch", () => {
  it("A – exact normalized match", () => {
    expect(findIngredientMatch("ail", db).id).toBe("ail");
    expect(findIngredientMatch("Huile d'olive", db).id).toBe("huile-olive");
  });

  it("B – singular/plural match", () => {
    expect(findIngredientMatch("Tomates", db).id).toBe("tomate");
  });

  it("C – canonical match strips preparation qualifiers and word order", () => {
    // "tomate" + qualifier "concassée" → still matches tomate
    expect(findIngredientMatch("tomates concassées", db).id).toBe("tomate");
    // word order indifferent on "ail" with qualifier
    expect(findIngredientMatch("ail émincé", db).id).toBe("ail");
  });

  it("matches via aliases", () => {
    expect(findIngredientMatch("échalote grise", db).id).toBe("oignon");
  });

  it("does NOT strip variety words (noir) – keeps distinct ingredients", () => {
    expect(findIngredientMatch("poivre noir", db).id).toBe("poivre-noir");
  });

  it("returns null on no match", () => {
    expect(findIngredientMatch("safran", db)).toBeNull();
  });

  it("returns null on empty inputs", () => {
    expect(findIngredientMatch("", db)).toBeNull();
    expect(findIngredientMatch("ail", [])).toBeNull();
  });
});

describe("buildNameMatcher", () => {
  it("returns a resolver mapping name → id (or empty string)", () => {
    const match = buildNameMatcher(db);
    expect(match("Tomates")).toBe("tomate");
    expect(match("inconnu")).toBe("");
  });
});

describe("createIngredientResolver", () => {
  it("returns the resolved item object or null", () => {
    const resolve = createIngredientResolver(db);
    expect(resolve("ail")).toMatchObject({ id: "ail" });
    expect(resolve("")).toBeNull();
  });
});
