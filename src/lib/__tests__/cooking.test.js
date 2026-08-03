import { describe, it, expect } from "vitest";
import { recipeCookingMethods, matchesCooking } from "@/lib/recipes/cooking.js";

const u = (...names) => ({ utensils: names.map((name, i) => ({ id: "u" + i, name })) });

describe("recipeCookingMethods", () => {
  it("détecte le four", () => {
    expect(recipeCookingMethods(u("Plat à gratin", "Four")).has("four")).toBe(true);
  });
  it("détecte l'air fryer sans le confondre avec le four", () => {
    const m = recipeCookingMethods(u("Air fryer"));
    expect(m.has("airfryer")).toBe(true);
    expect(m.has("four")).toBe(false);
  });
  it("détecte les plaques (poêle, casserole, accents ignorés)", () => {
    expect(recipeCookingMethods(u("Poêle")).has("plaques")).toBe(true);
    expect(recipeCookingMethods(u("Casserole")).has("plaques")).toBe(true);
  });
  it("renvoie plusieurs modes pour une recette mixte", () => {
    const m = recipeCookingMethods(u("Four", "Poêle"));
    expect(m.size).toBe(2);
  });
  it("vide si aucun ustensile pertinent", () => {
    expect(recipeCookingMethods(u("Fouet", "Chinois")).size).toBe(0);
    expect(recipeCookingMethods({}).size).toBe(0);
  });
});

describe("matchesCooking", () => {
  it("laisse tout passer sans sélection", () => {
    expect(matchesCooking(u("Fouet"), [])).toBe(true);
  });
  it("filtre par mode (OU)", () => {
    expect(matchesCooking(u("Four"), ["plaques", "four"])).toBe(true);
    expect(matchesCooking(u("Fouet"), ["four"])).toBe(false);
  });
  it("gère le pseudo-mode mixte", () => {
    expect(matchesCooking(u("Four", "Poêle"), ["mixte"])).toBe(true);
    expect(matchesCooking(u("Four"), ["mixte"])).toBe(false);
  });
});
