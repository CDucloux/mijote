import { describe, it, expect } from "vitest";
import { pickHeroMeal, buildWeekOverview } from "@/lib/planning/dashboard.js";
import type { TodayMealCard } from "@/lib/planning/dashboard.js";

const card = (slot: string): TodayMealCard => ({ slot, primary: { slot, recipeId: slot, recipe: { id: slot, name: slot } as TodayMealCard["primary"]["recipe"] }, others: [] });
const at = (h: number) => new Date(2026, 9, 23, h, 0);

describe("pickHeroMeal", () => {
  it("met en avant le premier repas dont le créneau n'est pas passé", () => {
    const cards = [card("matin"), card("midi"), card("soir")];
    expect(pickHeroMeal(cards, at(12)).hero?.slot).toBe("midi");
    expect(pickHeroMeal(cards, at(12)).rest.map(c => c.slot)).toEqual(["matin", "soir"]);
    expect(pickHeroMeal(cards, at(8)).hero?.slot).toBe("matin");
  });
  it("garde le dernier repas en tête une fois tous les créneaux passés", () => {
    expect(pickHeroMeal([card("midi")], at(21)).hero?.slot).toBe("midi");
  });
  it("rend un héros nul sans repas", () => {
    expect(pickHeroMeal([], at(12))).toEqual({ hero: null, rest: [] });
  });
});

describe("buildWeekOverview", () => {
  const week = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
  const plan = {
    "2026-10-19": [{ recipeId: "r1", slot: "soir" }],
    "2026-10-23": [{ recipeId: "r1", slot: "midi" }, { recipeId: "gone", slot: "soir" }],
    "2026-10-24": [{ recipeId: "r2", slot: "midi" }, { recipeId: "r2", slot: "soir" }],
  };
  const recipes = [{ id: "r1" }, { id: "r2" }];

  it("marque les créneaux pourvus, aujourd'hui et le passé", () => {
    const { days } = buildWeekOverview(plan, recipes, week, "2026-10-23");
    expect(days[0]).toMatchObject({ isPast: true, isToday: false, slots: [{ slot: "midi", filled: false }, { slot: "soir", filled: true }] });
    expect(days[4]).toMatchObject({ isToday: true, isPast: false });
  });
  it("compte une recette disparue comme libre", () => {
    const { days } = buildWeekOverview(plan, recipes, week, "2026-10-23");
    expect(days[4].slots).toEqual([{ slot: "midi", filled: true }, { slot: "soir", filled: false }]);
  });
  it("ne compte les créneaux libres qu'à partir d'aujourd'hui", () => {
    expect(buildWeekOverview(plan, recipes, week, "2026-10-23").free).toBe(3);
    expect(buildWeekOverview({}, [], week, "2026-10-26").free).toBe(0);
  });
});
