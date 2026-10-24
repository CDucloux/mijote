import { describe, it, expect } from "vitest";
import { recipeTiming, stepTiming, withEditedTiming, isWaitingStep, DEFAULT_STEP_MINUTES } from "../stepTiming.js";
import type { Step } from "@/lib/types.js";

describe("isWaitingStep", () => {
  it("repère four, repos, froid et mijotage, accents ou non", () => {
    expect(isWaitingStep("Enfourner pour 40 min")).toBe(true);
    expect(isWaitingStep("Laisser reposer sous papier alu")).toBe(true);
    expect(isWaitingStep("Réserver 2 h au réfrigérateur")).toBe(true);
    expect(isWaitingStep("Faire mijoter à couvert")).toBe(true);
  });

  it("ne confond pas un geste actif avec de l'attente", () => {
    expect(isWaitingStep("Faire revenir l'oignon 5 min en remuant")).toBe(false);
    expect(isWaitingStep("")).toBe(false);
    expect(isWaitingStep(undefined)).toBe(false);
  });
});

describe("recipeTiming", () => {
  it("fait confiance aux durées de la recette : fiabilité « reliable », rien à relire", () => {
    const timing = recipeTiming({ steps: [
      { text: "Trancher", duration: 20, activeTime: 20, durationEstimated: false },
      { text: "Enfourner", duration: 76, activeTime: 1, durationEstimated: false },
    ], prepTime: 20, cookTime: 75 });
    expect(timing.steps).toEqual([{ minutes: 20, active: 20, source: "recipe" }, { minutes: 76, active: 1, source: "recipe" }]);
    expect(timing).toMatchObject({ total: 96, active: 21, quality: "reliable", toReview: [], declaredGap: 1 });
  });

  it("marque les durées estimées à l'import comme à relire", () => {
    const timing = recipeTiming({ steps: [{ text: "Éplucher", duration: 15, activeTime: 15, durationEstimated: true }] });
    expect(timing.steps[0].source).toBe("estimated");
    expect(timing).toMatchObject({ quality: "estimated", toReview: [0], declaredGap: null });
  });

  it("lit la plus longue durée du texte, mains libres pour une attente", () => {
    const timing = recipeTiming({ steps: [
      { text: "Enfourner 30 min, vérifier au bout de 25 min" },
      { text: "Faire revenir l'oignon 5 min en remuant" },
    ] });
    expect(timing.steps).toEqual([{ minutes: 30, active: 5, source: "text" }, { minutes: 5, active: 5, source: "text" }]);
    expect(timing.quality).toBe("estimated");
  });

  it("borne la part active à la durée et ignore une part active négative", () => {
    const timing = recipeTiming({ steps: [
      { text: "a", duration: 10, activeTime: 30, durationEstimated: false },
      { text: "b", duration: 10, activeTime: -2, durationEstimated: false },
    ] });
    expect(timing.steps.map(step => step.active)).toEqual([10, 10]);
  });

  it("répartit le reste des temps déclarés entre les étapes sans durée, au pas de 5 min", () => {
    const timing = recipeTiming({ steps: [
      { text: "Cuire 20 min" },
      { text: "Préparer la garniture" },
      { text: "Dresser" },
    ], prepTime: 30, cookTime: 20 });
    expect(timing.steps.slice(1)).toEqual([{ minutes: 15, active: 15, source: "fallback" }, { minutes: 15, active: 15, source: "fallback" }]);
    expect(timing).toMatchObject({ total: 50, quality: "rough", toReview: [0, 1, 2], declaredGap: 0 });
  });

  it("garde 5 min minimum par étape quand les temps déclarés sont déjà dépassés", () => {
    const timing = recipeTiming({ steps: [{ text: "Reposer 2 h" }, { text: "Servir" }], prepTime: 10 });
    expect(timing.steps[1]).toEqual({ minutes: 5, active: 5, source: "fallback" });
    expect(timing.declaredGap).toBe(115);
  });

  it("retombe sur une durée par défaut sans aucun temps déclaré", () => {
    const timing = recipeTiming({ steps: [{ text: "Mélanger" }] });
    expect(timing.steps[0]).toEqual({ minutes: DEFAULT_STEP_MINUTES, active: DEFAULT_STEP_MINUTES, source: "fallback" });
  });

  it("une recette sans étapes est « rough », sans total", () => {
    expect(recipeTiming({ steps: [], prepTime: 10 })).toMatchObject({ steps: [], total: 0, active: 0, quality: "rough", declaredGap: -10 });
    expect(recipeTiming({}).quality).toBe("rough");
  });
});

describe("stepTiming", () => {
  it("renvoie null sans durée ni mention de temps", () => {
    expect(stepTiming({ text: "Dresser" })).toBeNull();
    expect(stepTiming({ text: "Dresser", duration: 0 })).toBeNull();
  });
});

describe("withEditedTiming", () => {
  it("fait foi : durée arrondie, part active bornée, plus estimée, autres champs gardés", () => {
    expect(withEditedTiming<Step>({ text: "Cuire", durationEstimated: true }, 44.6, 60)).toEqual({ text: "Cuire", duration: 45, activeTime: 45, durationEstimated: false });
    expect(withEditedTiming<Step>({ text: "Cuire" }, 40, 2)).toEqual({ text: "Cuire", duration: 40, activeTime: 2, durationEstimated: false });
  });

  it("retire une part active vide ou négative", () => {
    expect(withEditedTiming<Step>({ text: "a", activeTime: 3 }, 40, null)).toEqual({ text: "a", duration: 40, durationEstimated: false });
    expect(withEditedTiming<Step>({ text: "a" }, 40, -1)).toEqual({ text: "a", duration: 40, durationEstimated: false });
  });

  it("supprime les champs (jamais undefined) pour une durée vide, nulle ou invalide", () => {
    const step = { text: "a", duration: 10, activeTime: 5, durationEstimated: true };
    for (const value of [null, 0, Number.NaN]) {
      const next = withEditedTiming(step, value, 5);
      expect(next).toEqual({ text: "a" });
      expect(Object.keys(next)).toEqual(["text"]);
    }
    expect(step.duration).toBe(10);
  });

  it("plafonne la durée à 48 h", () => {
    expect(withEditedTiming<Step>({}, 5000, null).duration).toBe(2880);
  });
});
