import { describe, it, expect } from "vitest";
import { normalizeIngredientDraft, normalizeUtensilDraft, reorderCategories, groupReportsByRecipe } from "@/lib/household/masterDrafts.js";

describe("normalizeIngredientDraft", () => {
  it("rogne le nom et l'accroche, trie et dédoublonne les mois", () => {
    const out = normalizeIngredientDraft({ id: "i1", name: "  Poireau ", description: "  Doux ", months: [11, 1, 11, 3], status: "validated" });
    expect(out).toEqual({ id: "i1", name: "Poireau", description: "Doux", months: [1, 3, 11], status: "validated" });
  });

  it("retire les champs vides au lieu de les stocker vides", () => {
    const out = normalizeIngredientDraft({ id: "i1", name: "Ail", description: "   ", months: [], tips: [{ type: "conservation", text: "  " }], status: "draft" });
    expect(out).toEqual({ id: "i1", name: "Ail" });
  });

  it("garde les conseils remplis, rognés, et tolère un nom absent", () => {
    const out = normalizeIngredientDraft({ id: "i1", tips: [{ type: "usage", text: " Râper " }, { type: "usage", text: "" }] });
    expect(out).toEqual({ id: "i1", name: "", tips: [{ type: "usage", text: "Râper" }] });
  });

  it("préserve les champs non concernés", () => {
    const out = normalizeIngredientDraft({ id: "i1", name: "Riz", category: "grain", nutrition: null });
    expect(out).toEqual({ id: "i1", name: "Riz", category: "grain", nutrition: null });
  });
});

describe("normalizeUtensilDraft", () => {
  it("retire une précaution incomplète", () => {
    expect(normalizeUtensilDraft({ id: "u1", name: "Poêle", usagePrecaution: { title: "Feu doux", description: " " } })).toEqual({ id: "u1", name: "Poêle" });
  });

  it("rogne la précaution et applique la tonalité chaleur par défaut", () => {
    const out = normalizeUtensilDraft({ id: "u1", usagePrecaution: { title: " Feu doux ", description: " Le revêtement craint. " } });
    expect(out.usagePrecaution).toEqual({ tone: "heat", title: "Feu doux", description: "Le revêtement craint." });
  });

  it("garde le bon réflexe et la tonalité choisie", () => {
    const out = normalizeUtensilDraft({ id: "u1", usagePrecaution: { tone: "warning", title: "T", description: "D", tip: " Huiler " } });
    expect(out.usagePrecaution).toEqual({ tone: "warning", title: "T", description: "D", tip: "Huiler" });
  });

  it("laisse une fiche sans précaution intacte", () => {
    expect(normalizeUtensilDraft({ id: "u1", name: "Fouet" })).toEqual({ id: "u1", name: "Fouet" });
  });
});

describe("reorderCategories", () => {
  const cats = { a: { order: 0 }, b: { order: 1 }, c: { order: 2 } };

  it("déplace une catégorie et renumérote sans trou", () => {
    expect(reorderCategories(cats, "c", "a")).toEqual({ a: { order: 1 }, b: { order: 2 }, c: { order: 0 } });
    expect(reorderCategories(cats, "a", "c")).toEqual({ a: { order: 2 }, b: { order: 0 }, c: { order: 1 } });
  });

  it("renvoie null quand rien ne bouge", () => {
    expect(reorderCategories(cats, "a", "a")).toBeNull();
    expect(reorderCategories(cats, "x", "a")).toBeNull();
    expect(reorderCategories(cats, "a", "x")).toBeNull();
  });

  it("ne mute pas l'entrée", () => {
    reorderCategories(cats, "c", "a");
    expect(cats).toEqual({ a: { order: 0 }, b: { order: 1 }, c: { order: 2 } });
  });
});

describe("groupReportsByRecipe", () => {
  it("regroupe par recette dans l'ordre de première apparition", () => {
    const groups = groupReportsByRecipe([
      { id: "1", pubId: "p2", recipeName: "Tarte" },
      { id: "2", pubId: "p1" },
      { id: "3", pubId: "p2", recipeName: "Autre nom" },
    ]);
    expect(groups.map(g => [g.pubId, g.name, g.items.map(r => r.id)])).toEqual([
      ["p2", "Tarte", ["1", "3"]],
      ["p1", "Recette", ["2"]],
    ]);
  });

  it("renvoie une liste vide sans signalement", () => {
    expect(groupReportsByRecipe([])).toEqual([]);
  });
});
