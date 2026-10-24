import { describe, it, expect } from "vitest";
import {
  prepStageOf, prepWorkOrder, prepGain, planBatchCooking, addDays, daysBetween, defaultBatchDay, shortDayLabel, weekdayName,
  planStorage, storageZone, boxLabels, recipeHasFish, batchSettingsFor, withBatchSettings, prepKey, storeKey,
} from "../batchPlan.js";
import type { PrepItem } from "../batchSession.js";
import type { Step } from "@/lib/types.js";

const item = (name: string, category: string, usedBy: string[] = ["a"]): PrepItem => ({ key: name, name, category, amount: 1, unit: "", usedBy });
const at = (day: number, hours: number, minutes = 0): number => new Date(2026, 9, day, hours, minutes).getTime();
const step = (duration: number, activeTime: number, text = "Étape"): Step => ({ text, duration, activeTime, durationEstimated: false });

describe("ordre de travail de la découpe", () => {
  it("range légumes clairs, aromatiques, cru, puis le reste", () => {
    expect(prepStageOf(item("Courge", "vegetable"))).toBe("clairs");
    expect(prepStageOf(item("Oignons rouges", "vegetable"))).toBe("aromatiques");
    expect(prepStageOf(item("Échalote", "vegetable"))).toBe("aromatiques");
    expect(prepStageOf(item("Coriandre", "herbs"))).toBe("aromatiques");
    expect(prepStageOf(item("Poulet", "meat"))).toBe("cru");
    expect(prepStageOf(item("Comté", "dairy"))).toBe("autres");
  });

  it("ordonne les temps et, dans chacun, les ingrédients les plus partagés d'abord", () => {
    const stages = prepWorkOrder([
      { category: "herbs", items: [item("Persil", "herbs")] },
      { category: "vegetable", items: [item("Ail", "vegetable", ["a", "b"]), item("Carotte", "vegetable"), item("Courge", "vegetable", ["a", "b", "c"])] },
    ]);
    expect(stages.map(s => [s.id, s.items.map(i => i.name)])).toEqual([["clairs", ["Courge", "Carotte"]], ["aromatiques", ["Ail", "Persil"]]]);
    expect(prepWorkOrder([])).toEqual([]);
  });

  it("estime le temps gagné au nombre de recettes en plus", () => {
    expect(prepGain({ usedBy: ["a", "b", "c"] })).toBe(6);
    expect(prepGain({ usedBy: ["a"] })).toBe(0);
    expect(prepGain({ usedBy: [] })).toBe(0);
  });
});

describe("planBatchCooking", () => {
  it("commence à l'heure dite, la base avant le plat qui l'utilise", () => {
    const plan = planBatchCooking([
      { id: "soupe", name: "Soupe", recipe: { steps: [step(5, 5), step(25, 0)] } },
      { id: "bouillon", name: "Bouillon", recipe: { steps: [step(10, 10), step(45, 0)] }, feeds: ["soupe"] },
      { id: "chili", name: "Chili", recipe: { steps: [step(15, 15), step(60, 0)] } },
    ], { startAt: at(25, 14), now: at(25, 9) });
    const byId = Object.fromEntries(plan.dishes.map(d => [d.id, d]));
    expect(plan.start).toBe(at(25, 14));
    expect(byId.bouillon.end).toBeLessThanOrEqual(byId.soupe.start);
    expect(plan.lateBy).toBe(0);
    expect(plan.end).toBe(Math.max(...plan.dishes.map(d => d.end)));
  });

  it("tient une session vide", () => {
    expect(planBatchCooking([], { startAt: at(25, 14), now: at(25, 9) })).toMatchObject({ dishes: [], start: at(25, 14) });
  });
});

describe("jours", () => {
  it("calcule les décalages et la veille de la semaine", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(daysBetween("2026-10-25", "2026-10-29")).toBe(4);
    expect(daysBetween("x", "2026-10-29")).toBeNull();
    expect(defaultBatchDay("2026-10-26")).toBe("2026-10-25");
    expect(addDays("pas une date", 1)).toBe("pas une date");
  });

  it("nomme les jours", () => {
    expect(shortDayLabel("2026-10-28")).toBe("mer. 28");
    expect(weekdayName("2026-10-25")).toBe("dimanche");
    expect(shortDayLabel("?")).toBe("?");
    expect(weekdayName("?")).toBe("");
  });
});

describe("planStorage", () => {
  const meals = [
    { recipeId: "chili", date: "2026-10-27", slot: "midi" },
    { recipeId: "chili", date: "2026-10-29", slot: "soir" },
    { recipeId: "chili", date: "2026-10-30", slot: "midi" },
    { recipeId: "saumon", date: "2026-10-28", slot: "soir" },
    { recipeId: "soupe", date: "2026-10-26", slot: "soir" },
    { recipeId: "soupe", date: "2026-10-24", slot: "soir" },
  ];
  const storage = planStorage("2026-10-25", meals, id => id === "saumon");
  const byId = Object.fromEntries(storage.dishes.map(d => [d.recipeId, d]));

  it("met au frigo jusqu'à J+3 et congèle au-delà, à sortir la veille", () => {
    expect(byId.chili.meals.map(m => [m.date, m.zone, m.thawOn])).toEqual([
      ["2026-10-27", "fridge", undefined], ["2026-10-29", "freezer", "2026-10-28"], ["2026-10-30", "freezer", "2026-10-29"],
    ]);
    expect(byId.chili.fridgeUntil).toBe("2026-10-28");
  });

  it("raccourcit à J+2 pour le poisson", () => {
    expect(byId.saumon.meals[0].zone).toBe("freezer");
    expect(byId.saumon.fridgeDays).toBe(2);
  });

  it("ignore les repas antérieurs à la session et compte les boîtes", () => {
    expect(storage).toMatchObject({ fridge: 2, freezer: 3, skipped: 1 });
    expect(byId.soupe.meals).toHaveLength(1);
  });

  it("classe chaque plat par zone", () => {
    expect(storageZone(byId.chili)).toBe("mixed");
    expect(storageZone(byId.saumon)).toBe("freezer");
    expect(storageZone(byId.soupe)).toBe("fridge");
  });

  it("écrit une étiquette par boîte", () => {
    expect(boxLabels("Chili", "2026-10-25", byId.chili)).toEqual([
      "Chili · cuit dim. 25 · avant mer. 28", "Chili · cuit dim. 25 · congelé", "Chili · cuit dim. 25 · congelé",
    ]);
  });
});

describe("recipeHasFish", () => {
  it("repère une ligne de poisson par la catégorie de la base", () => {
    const categoryOf = (id: string) => ({ saumon: "fish_seafood", riz: "grain" } as Record<string, string>)[id];
    expect(recipeHasFish({ ingredients: [{ dbId: "riz" }, { dbId: "saumon" }] }, categoryOf)).toBe(true);
    expect(recipeHasFish({ ingredients: [{ dbId: "riz" }, { name: "saumon" }] }, categoryOf)).toBe(false);
    expect(recipeHasFish({}, categoryOf)).toBe(false);
  });
});

describe("batchSettingsFor / withBatchSettings", () => {
  it("complète des réglages absents ou malformés", () => {
    expect(batchSettingsFor(undefined, "2026-10-26")).toEqual({ day: "2026-10-25", clock: "14:00", cooks: 1, checked: [], done: false });
    expect(batchSettingsFor({ day: "demain", clock: 14, cooks: 3, checked: ["p:a", 4], done: "oui" }, "2026-10-26"))
      .toEqual({ day: "2026-10-25", clock: "14:00", cooks: 1, checked: ["p:a"], done: false });
    expect(batchSettingsFor({ day: "2026-10-24", clock: "10:30", cooks: 2, checked: [], done: true }, "2026-10-26"))
      .toMatchObject({ day: "2026-10-24", clock: "10:30", cooks: 2, done: true });
  });

  it("ne garde que les huit semaines les plus récentes", () => {
    const settings = batchSettingsFor(undefined, "2026-01-05");
    let all = {};
    for (let week = 1; week <= 10; week++) all = withBatchSettings(all, `2026-03-${String(week).padStart(2, "0")}`, settings);
    expect(Object.keys(all)).toHaveLength(8);
    expect(Object.keys(all)[0]).toBe("2026-03-03");
  });
});

describe("prepKey / storeKey", () => {
  it("préfixe les clés par onglet pour qu'elles ne se croisent pas", () => {
    expect(prepKey({ key: "oignon|" })).toBe("p:oignon|");
    expect(storeKey({ recipeId: "chili" })).toBe("s:chili");
  });
});
