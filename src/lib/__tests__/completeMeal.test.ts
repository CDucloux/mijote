import { describe, it, expect } from "vitest";
import { completeMealSections, type CompleteCandidate } from "@/lib/planning/completeMeal.js";
import type { PlannerContext } from "@/lib/planning/mealPlanner.js";

const ctx: PlannerContext = { resolver: () => null, month: 7, stockSet: new Set(), preferences: {} };
const R = (id: string, over: Partial<CompleteCandidate> = {}): CompleteCandidate =>
  ({ id, name: id, category: "plat", prepTime: 10, cookTime: 20, ingredients: [], ...over });

const base = R("base");
const lib = [
  base,
  R("Tzatziki", { category: "entree" }),
  R("Salade", { category: "salade" }),
  R("Houmous", { category: "entree" }),
  R("Fond brun", { category: "entree", isComponent: true }),
  R("Tarte", { category: "dessert" }),
];

describe("completeMealSections", () => {
  it("sans recherche : suggestions du rôle, puis tout le reste de la bibliothèque sans doublon", () => {
    const { suggestions, library } = completeMealSections(base, lib, lib, ctx, "entree", "");
    expect(suggestions.map(r => r.id).sort()).toEqual(["Houmous", "Tzatziki"]);
    expect(library.map(r => r.id)).toEqual(["Salade", "Tarte"]);
  });

  it("exclut le plat de base et les préparations de base", () => {
    const { suggestions, library } = completeMealSections(base, lib, [], ctx, "entree", "");
    const both = completeMealSections(base, lib, lib, ctx, "entree", "");
    const ids = [...suggestions, ...library, ...both.suggestions, ...both.library].map(r => r.id);
    expect(ids).not.toContain("base");
    expect(ids).not.toContain("Fond brun");
  });

  it("met le rôle demandé en tête, puis l'ordre alphabétique", () => {
    const { library } = completeMealSections(base, lib, [], ctx, "entree", "");
    expect(library.map(r => r.id)).toEqual(["Houmous", "Tzatziki", "Salade", "Tarte"]);
  });

  it("avec recherche : pas de suggestions, filtre toute la bibliothèque (accents ignorés)", () => {
    const withAccent = [...lib, R("Crème brûlée", { category: "dessert" })];
    const { suggestions, library } = completeMealSections(base, withAccent, withAccent, ctx, "entree", "  creme ");
    expect(suggestions).toEqual([]);
    expect(library.map(r => r.id)).toEqual(["Crème brûlée"]);
  });

  it("sans plat de base ni nom : ne plante pas", () => {
    const nameless = [R("x", { name: undefined })];
    expect(completeMealSections(null, nameless, [], ctx, "dessert", "").library).toHaveLength(1);
  });
});
