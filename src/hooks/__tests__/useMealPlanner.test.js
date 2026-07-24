// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// On isole la LOGIQUE du hook (branchement, undo) en simulant la génération pure.
vi.mock("../../lib/mealPlanner.js", () => ({
  generateWeek: vi.fn(),
  GEN_STYLES: { equilibre: {}, facile: {}, aventureux: {} },
}));
import { generateWeek } from "../../lib/mealPlanner.js";
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
  beforeEach(() => generateWeek.mockReset());

  it("applique les assignations au planning et active l'undo", () => {
    generateWeek.mockReturnValue([{ date: "2026-01-01", slot: "midi", recipeId: "r1", role: "plat" }]);
    const { result, setMealPlan, state } = setup();
    let res;
    act(() => { res = result.current.generate(["2026-01-01"], ["midi"]); });
    expect(res.count).toBe(1);
    expect(setMealPlan).toHaveBeenCalled();
    expect(state.plan["2026-01-01"]).toEqual([{ recipeId: "r1", slot: "midi", portions: 1, role: "plat" }]);
    expect(result.current.canUndo).toBe(true);
  });

  it("ne compte pas les accompagnements comme des repas", () => {
    generateWeek.mockReturnValue([
      { date: "2026-01-01", slot: "midi", recipeId: "r1", role: "plat", groupId: "g1" },
      { date: "2026-01-01", slot: "midi", recipeId: "r2", role: "accompagnement", groupId: "g1" },
    ]);
    const { result } = setup();
    let res;
    act(() => { res = result.current.generate(["2026-01-01"], ["midi"], { compose: true }); });
    expect(res.count).toBe(1);
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
});
