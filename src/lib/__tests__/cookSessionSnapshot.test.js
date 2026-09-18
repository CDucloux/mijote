import { describe, it, expect } from "vitest";
import {
  buildCookSnapshot, pickPilotTimer, pickPilotTimerId,
} from "@/lib/cookSession/snapshot.ts";

/** Fabrique un minuteur minimal pour les tests (défauts : en marche, non échu). */
function timer(over = {}) {
  return {
    id: "t1", label: "6 min", totalSec: 360, running: true,
    endAt: 1000, remainingMs: 360000, done: false, stepIdx: 0, stepLabel: "Étape 1",
    ...over,
  };
}

describe("pickPilotTimer", () => {
  it("choisit le minuteur en marche le plus proche de sonner", () => {
    const timers = [
      timer({ id: "a", endAt: 5000, label: "5 min" }),
      timer({ id: "b", endAt: 2000, label: "2 min" }),
      timer({ id: "c", endAt: 9000, label: "9 min" }),
    ];
    expect(pickPilotTimer(timers)).toEqual({ label: "2 min", endAt: 2000, running: true });
    expect(pickPilotTimerId(timers)).toBe("b");
  });

  it("ignore les minuteurs en pause, échus ou sans échéance", () => {
    const timers = [
      timer({ id: "paused", running: false, endAt: null, remainingMs: 120000 }),
      timer({ id: "done", done: true, endAt: 1000 }),
      timer({ id: "live", endAt: 8000, label: "8 min" }),
    ];
    expect(pickPilotTimerId(timers)).toBe("live");
  });

  it("renvoie null quand aucun minuteur ne tourne", () => {
    expect(pickPilotTimer([])).toBeNull();
    expect(pickPilotTimerId([])).toBeNull();
    expect(pickPilotTimer([timer({ running: false, endAt: null })])).toBeNull();
  });
});

describe("buildCookSnapshot", () => {
  const base = {
    recipeTitle: "Tarte aux pommes",
    pageKind: "step", stepIdx: 2, totalSteps: 5, realIdx: 1,
    stepText: "Étaler la pâte.", timers: [],
  };

  it("numérote l'étape sur le total d'étapes réelles (hors pages meta)", () => {
    // 5 pages, l'étape réelle 1 est en page 2 => 1 page meta avant => 4 étapes.
    const snap = buildCookSnapshot(base);
    expect(snap.stepLabel).toBe("Étape 2 / 4");
    expect(snap.canPrev).toBe(true);
    expect(snap.canNext).toBe(true);
  });

  it("désactive Précédent en première page et Suivant en dernière", () => {
    expect(buildCookSnapshot({ ...base, stepIdx: 0, realIdx: 0 }).canPrev).toBe(false);
    expect(buildCookSnapshot({ ...base, stepIdx: 4, realIdx: 3 }).canNext).toBe(false);
  });

  it("libelle les pages meta et vide leur texte d'étape", () => {
    const over = buildCookSnapshot({ ...base, pageKind: "overview", realIdx: -1, stepText: "" });
    expect(over.stepLabel).toBe("Mise en place");
    expect(over.stepText).toBe("");
    const bases = buildCookSnapshot({ ...base, pageKind: "bases", realIdx: -1, stepText: "" });
    expect(bases.stepLabel).toBe("Bases à réaliser");
  });

  it("tronque un texte d'étape trop long en coupant sur un mot", () => {
    const long = "Mélanger ".repeat(40).trim();
    const snap = buildCookSnapshot({ ...base, stepText: long });
    expect(snap.stepText.length).toBeLessThanOrEqual(121);
    expect(snap.stepText.endsWith("…")).toBe(true);
    expect(snap.stepText).not.toContain("  ");
  });

  it("retombe sur un titre par défaut si la recette n'en a pas", () => {
    expect(buildCookSnapshot({ ...base, recipeTitle: "  " }).recipeTitle).toBe("Recette");
  });

  it("expose le minuteur pilote dans le snapshot", () => {
    const snap = buildCookSnapshot({ ...base, timers: [timer({ endAt: 4200, label: "1 min" })] });
    expect(snap.timer).toEqual({ label: "1 min", endAt: 4200, running: true });
  });
});
