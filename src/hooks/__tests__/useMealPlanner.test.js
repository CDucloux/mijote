// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// On isole la LOGIQUE du hook (branchement, undo) en simulant la génération pure.
vi.mock("@/lib/planning/mealPlanner.js", () => ({
  generateWeek: vi.fn(),
  GEN_STYLES: { equilibre: {}, facile: {}, aventureux: {} },
}));
import { generateWeek } from "@/lib/planning/mealPlanner.js";
import { useMealPlanner } from "../useMealPlanner.js";

function setup(initialPlan = {}) {
  const state = { plan: initialPlan };
  const setMealPlan = vi.fn(u => { state.plan = typeof u === "function" ? u(state.plan) : u; });
  const { result } = renderHook(() =>
    useMealPlanner({ recipes: [{ id: "r1" }], ingredientDB: [], preferences: {}, stock: [], mealPlan: state.plan, setMealPlan })
  );
  return { result, setMealPlan, state };
}

describe("useMealPlanner", () => {
  beforeEach(() => { generateWeek.mockReset(); localStorage.clear(); });

  it("applique les assignations au planning et active l'undo", () => {
    generateWeek.mockReturnValue([{ date: "2026-01-01", slot: "midi", recipeId: "r1", role: "plat" }]);
    const { result, setMealPlan, state } = setup();
    let res;
    act(() => { res = result.current.generate(["2026-01-01"], ["midi"]); });
    expect(res.count).toBe(1);
    expect(setMealPlan).toHaveBeenCalled();
    expect(state.plan["2026-01-01"]).toEqual([{ recipeId: "r1", slot: "midi", portions: 1, role: "plat" }]);
    expect(result.current.canUndo).toBe(true);
    // undoKey = 1er jour de la semaine générée → l'undo n'est proposé QUE là.
    expect(result.current.undoKey).toBe("2026-01-01");
  });

  it("undoKey cible la semaine générée et se vide à l'undo (pas d'undo ailleurs)", () => {
    generateWeek.mockReturnValue([{ date: "2026-01-05", slot: "midi", recipeId: "r1" }]);
    const { result } = setup();
    expect(result.current.undoKey).toBe(null);
    act(() => { result.current.generate(["2026-01-05", "2026-01-06"], ["midi"]); });
    expect(result.current.undoKey).toBe("2026-01-05"); // semaine de la génération
    act(() => { result.current.undo(); });
    expect(result.current.undoKey).toBe(null);
  });

  it("ne compte pas les accompagnements comme des recettes", () => {
    generateWeek.mockReturnValue([
      { date: "2026-01-01", slot: "midi", recipeId: "r1", role: "plat", groupId: "g1" },
      { date: "2026-01-01", slot: "midi", recipeId: "r2", role: "accompagnement", groupId: "g1" },
    ]);
    const { result } = setup();
    let res;
    act(() => { res = result.current.generate(["2026-01-01"], ["midi"], { compose: true }); });
    expect(res.count).toBe(1);
  });

  it("compte une recette étalée sur plusieurs jours (restes) une seule fois", () => {
    generateWeek.mockReturnValue([
      { date: "2026-01-01", slot: "midi", recipeId: "r1", role: "plat" },
      { date: "2026-01-02", slot: "midi", recipeId: "r1", role: "plat" }, // reste du même plat
      { date: "2026-01-02", slot: "soir", recipeId: "r2", role: "plat" },
    ]);
    const { result } = setup();
    let res;
    act(() => { res = result.current.generate(["2026-01-01", "2026-01-02"], ["midi", "soir"]); });
    expect(res.count).toBe(2); // r1 (2 jours) + r2 = 2 recettes distinctes
  });

  it("ne touche à rien et n'active pas l'undo si aucune assignation", () => {
    generateWeek.mockReturnValue([]);
    const { result, setMealPlan } = setup();
    let res;
    act(() => { res = result.current.generate(["2026-01-01"], ["midi"]); });
    expect(res).toEqual({ count: 0 });
    expect(setMealPlan).not.toHaveBeenCalled();
    expect(result.current.canUndo).toBe(false);
  });

  it("restaure l'instantané précédent à l'undo puis désactive l'undo", () => {
    generateWeek.mockReturnValue([{ date: "2026-01-02", slot: "soir", recipeId: "r1" }]);
    const { result, state } = setup({ existing: true });
    act(() => { result.current.generate(["2026-01-02"], ["soir"]); });
    expect(state.plan["2026-01-02"]).toBeDefined();
    act(() => { result.current.undo(); });
    expect(state.plan).toEqual({ existing: true });
    expect(result.current.canUndo).toBe(false);
  });

  it("persiste l'undo (snapshot + semaine) : un nouveau montage le restaure (survit au reload)", () => {
    generateWeek.mockReturnValue([{ date: "2026-03-02", slot: "midi", recipeId: "r1" }]);
    const first = setup({ existing: true });
    act(() => { first.result.current.generate(["2026-03-02"], ["midi"]); });
    expect(localStorage.getItem("rf_mealplan_undo")).toBeTruthy();

    // Remontage (simule un reload) : l'undo est réhydraté depuis le stockage.
    const second = setup({ generated: true });
    expect(second.result.current.undoKey).toBe("2026-03-02");
    expect(second.result.current.canUndo).toBe(true);
    act(() => { second.result.current.undo(); });
    expect(second.state.plan).toEqual({ existing: true }); // snapshot d'avant génération restauré
    expect(localStorage.getItem("rf_mealplan_undo")).toBe(null);
  });
});
