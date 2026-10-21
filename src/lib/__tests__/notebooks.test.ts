import { describe, it, expect } from "vitest";
import {
  blankNotebookDraft, isSmartNotebook, notebookMatches, countNotebook, isSmartViewActive,
  reorderNotebooks, shiftNotebook, createNotebook, applyNotebookEdit, DEFAULT_NOTEBOOK_COLOR,
} from "@/lib/recipes/notebooks.js";
import type { Notebook } from "@/lib/types.js";
import { DEFAULT_FILTERS } from "@/lib/recipes/recipeFilters.js";

const tarte = { id: "r1", name: "Tarte aux pommes", collections: ["c1"] };
const soupe = { id: "r2", name: "Soupe de potiron", collections: [] };
const manual: Notebook = { id: "c1", name: "Mamie", kind: "manual" };
const smart: Notebook = { id: "c2", name: "Tartes", kind: "smart", filters: {}, search: "tarte" };
const list = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("isSmartNotebook", () => {
  it("distingue intelligent et manuel, robuste à l'absence", () => {
    expect(isSmartNotebook(smart)).toBe(true);
    expect(isSmartNotebook(manual)).toBe(false);
    expect(isSmartNotebook({})).toBe(false);
    expect(isSmartNotebook(null)).toBe(false);
  });
});

describe("notebookMatches / countNotebook", () => {
  it("manuel : appartenance explicite", () => {
    expect(notebookMatches(manual, tarte, {})).toBe(true);
    expect(notebookMatches(manual, soupe, {})).toBe(false);
    expect(notebookMatches(manual, { id: "r3" }, {})).toBe(false);
  });
  it("intelligent : recherche et filtres, sans tenir compte de l'appartenance", () => {
    expect(notebookMatches(smart, tarte, {})).toBe(true);
    expect(notebookMatches(smart, soupe, {})).toBe(false);
    expect(countNotebook(smart, [tarte, soupe, { id: "r4", name: "Tarte fine" }], {})).toBe(2);
  });
  it("bibliothèque vide : zéro", () => {
    expect(countNotebook(manual, [], {})).toBe(0);
  });
});

describe("isSmartViewActive", () => {
  const view = (over = {}) => ({ filters: { ...DEFAULT_FILTERS }, search: " tarte ", selectedId: null, ...over });
  it("vraie quand la vue courante est exactement celle du carnet", () => {
    expect(isSmartViewActive(smart, view())).toBe(true);
  });
  it("fausse avec un carnet manuel ouvert, une autre recherche ou d'autres filtres", () => {
    expect(isSmartViewActive(smart, view({ selectedId: "c1" }))).toBe(false);
    expect(isSmartViewActive(smart, view({ search: "soupe" }))).toBe(false);
    expect(isSmartViewActive(smart, view({ filters: { ...DEFAULT_FILTERS, vegan: true } }))).toBe(false);
  });
});

describe("reorderNotebooks", () => {
  it("prend la place du carnet visé", () => {
    expect(reorderNotebooks(list, "a", "c").map(n => n.id)).toEqual(["b", "c", "a"]);
    expect(reorderNotebooks(list, "c", "a").map(n => n.id)).toEqual(["c", "a", "b"]);
  });
  it("sans effet (même référence) sur soi-même ou un identifiant inconnu", () => {
    expect(reorderNotebooks(list, "a", "a")).toBe(list);
    expect(reorderNotebooks(list, "x", "a")).toBe(list);
  });
});

describe("shiftNotebook", () => {
  it("échange avec le voisin", () => {
    expect(shiftNotebook(list, "b", -1).map(n => n.id)).toEqual(["b", "a", "c"]);
    expect(shiftNotebook(list, "b", 1).map(n => n.id)).toEqual(["a", "c", "b"]);
  });
  it("sans effet en bout de liste ou pour un inconnu", () => {
    expect(shiftNotebook(list, "a", -1)).toBe(list);
    expect(shiftNotebook(list, "c", 1)).toBe(list);
    expect(shiftNotebook(list, "x", 1)).toBe(list);
  });
});

describe("createNotebook", () => {
  it("manuel : nom nettoyé, compteur à zéro", () => {
    expect(createNotebook(blankNotebookDraft({ name: "  Mamie " }), "c9")).toEqual({
      id: "c9", name: "Mamie", color: DEFAULT_NOTEBOOK_COLOR, icon: "📓", kind: "manual", count: 0,
    });
  });
  it("intelligent : vue complétée par les filtres par défaut, recherche nettoyée", () => {
    const nb = createNotebook(blankNotebookDraft({ name: "Vegan", smart: true, filters: { vegan: true }, search: " soupe " }), "c9");
    expect(nb).toMatchObject({ kind: "smart", search: "soupe", filters: { ...DEFAULT_FILTERS, vegan: true } });
  });
  it("intelligent sans vue : filtres par défaut et recherche vide", () => {
    expect(createNotebook(blankNotebookDraft({ name: "Tout", smart: true }), "c9")).toMatchObject({ filters: DEFAULT_FILTERS, search: "" });
  });
});

describe("applyNotebookEdit", () => {
  it("ne change que nom, couleur et picto du carnet visé", () => {
    const out = applyNotebookEdit([manual, smart], { id: "c2", name: " Tartes fines ", color: "#5b9cf6", icon: "🍰", editing: true, kind: "manual" });
    expect(out[0]).toBe(manual);
    expect(out[1]).toEqual({ ...smart, name: "Tartes fines", color: "#5b9cf6", icon: "🍰" });
  });
});
