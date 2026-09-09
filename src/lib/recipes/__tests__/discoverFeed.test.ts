import { describe, it, expect } from "vitest";
import {
  isQuickRecipe, matchesDiscoverCategory, STATIC_CATEGORIES, QUICK_MAX_MIN,
  type DiscoverFlags,
} from "@/lib/recipes/discoverFeed.js";

const flags = (over: Partial<DiscoverFlags> = {}): DiscoverFlags => ({
  isFavorite: false, isVegan: false, isInSeason: false, isQuick: false,
  isComponent: false, cuisine: "", ...over,
});

describe("isQuickRecipe", () => {
  it("vrai sous le seuil, faux au-delà ou pile au seuil", () => {
    expect(isQuickRecipe({ prepTime: 5, cookTime: 10 })).toBe(true);
    expect(isQuickRecipe({ prepTime: 10, cookTime: QUICK_MAX_MIN })).toBe(false);
    expect(isQuickRecipe({ prepTime: 30 })).toBe(false);
  });
  it("faux si aucun temps renseigné (évite de classer une recette sans durée)", () => {
    expect(isQuickRecipe({})).toBe(false);
    expect(isQuickRecipe(null)).toBe(false);
    expect(isQuickRecipe({ prepTime: 0, cookTime: 0 })).toBe(false);
  });
  it("tolère des durées en chaîne", () => {
    expect(isQuickRecipe({ prepTime: "5", cookTime: "10" })).toBe(true);
  });
});

describe("matchesDiscoverCategory", () => {
  it("« tout » laisse tout passer", () => {
    expect(matchesDiscoverCategory(flags(), "tout")).toBe(true);
  });
  it("lit le bon drapeau pour chaque clé statique", () => {
    expect(matchesDiscoverCategory(flags({ isFavorite: true }), "fav")).toBe(true);
    expect(matchesDiscoverCategory(flags(), "fav")).toBe(false);
    expect(matchesDiscoverCategory(flags({ isVegan: true }), "vegan")).toBe(true);
    expect(matchesDiscoverCategory(flags({ isInSeason: true }), "saison")).toBe(true);
    expect(matchesDiscoverCategory(flags({ isQuick: true }), "rapide")).toBe(true);
    expect(matchesDiscoverCategory(flags({ isComponent: true }), "bases")).toBe(true);
  });
  it("apparie une cuisine par label, insensible à la casse et aux accents", () => {
    expect(matchesDiscoverCategory(flags({ cuisine: "Italienne" }), "italienne")).toBe(true);
    expect(matchesDiscoverCategory(flags({ cuisine: "Japonaise" }), "Japonaise")).toBe(true);
    expect(matchesDiscoverCategory(flags({ cuisine: "Française" }), "francaise")).toBe(true);
    expect(matchesDiscoverCategory(flags({ cuisine: "Italienne" }), "Marocaine")).toBe(false);
  });
  it("sans cuisine, aucune catégorie de cuisine ne matche", () => {
    expect(matchesDiscoverCategory(flags({ cuisine: "" }), "Italienne")).toBe(false);
  });
});

describe("STATIC_CATEGORIES", () => {
  it("commence par « Tout » et contient les catégories attendues", () => {
    expect(STATIC_CATEGORIES[0]).toEqual({ key: "tout", label: "Tout" });
    const keys = STATIC_CATEGORIES.map(c => c.key);
    expect(keys).toEqual(["tout", "fav", "vegan", "saison", "rapide", "bases"]);
  });
});
