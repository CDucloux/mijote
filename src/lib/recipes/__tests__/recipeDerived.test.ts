import { describe, it, expect, vi } from "vitest";
import { createRecipeDerivedCache, type DeriveContext, type RecipeDerived } from "../recipeDerived.js";
import type { SavedRecipe } from "@/lib/types.js";

const R = (id: string, over: Partial<SavedRecipe> = {}) => ({ id, name: id, ingredients: [], ...over }) as SavedRecipe;
const DERIVED: RecipeDerived = { inSeason: true, vegan: false, nutriLetter: "A", healthScore: 1 };
const resolver = (() => null) as unknown as DeriveContext["resolver"];
const DB: DeriveContext["ingredientDB"] = [];
const ctxOf = (recipes: SavedRecipe[], over: Partial<DeriveContext> = {}): DeriveContext =>
  ({ recipes, resolver, ingredientDB: DB, recipesById: new Map(), ...over });

describe("createRecipeDerivedCache", () => {
  it("ne recalcule que la recette dont l'objet a changé", () => {
    const derive = vi.fn(() => DERIVED);
    const deriveAll = createRecipeDerivedCache(derive);
    const a = R("a"), b = R("b");
    expect(deriveAll(ctxOf([a, b])).size).toBe(2);
    expect(derive).toHaveBeenCalledTimes(2);
    const b2 = { ...b, collections: ["nb1"] };
    deriveAll(ctxOf([a, b2]));
    expect(derive).toHaveBeenCalledTimes(3);
    expect(derive).toHaveBeenLastCalledWith(b2, expect.anything());
  });

  it("vide le cache si une préparation de base change, ou le résolveur / la base", () => {
    const derive = vi.fn(() => DERIVED);
    const deriveAll = createRecipeDerivedCache(derive);
    const a = R("a"), base = R("fond", { isComponent: true });
    deriveAll(ctxOf([a, base]));
    deriveAll(ctxOf([a, { ...base, name: "Fond brun" }]));
    expect(derive).toHaveBeenCalledTimes(4);
    deriveAll(ctxOf([a, base], { ingredientDB: [] }));
    expect(derive).toHaveBeenCalledTimes(6);
  });

  it("ignore les recettes sans id et gère une bibliothèque vide", () => {
    const deriveAll = createRecipeDerivedCache(() => DERIVED);
    expect(deriveAll(ctxOf([])).size).toBe(0);
    expect(deriveAll(ctxOf([{ name: "x" } as SavedRecipe])).size).toBe(0);
  });
});
