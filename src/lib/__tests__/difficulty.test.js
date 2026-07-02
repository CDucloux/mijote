import { describe, it, expect } from "vitest";
import { computeDifficulty } from "../difficulty.js";

const TECHS = [
  { id: "t1", name: "émincer", aliases: ["émince"], difficulty: 1 },
  { id: "t2", name: "émulsionner", aliases: ["émulsionne"], difficulty: 4 },
  { id: "t3", name: "flamber", aliases: ["flambe"], difficulty: 5 },
  { id: "t4", name: "monder", difficulty: 3 },
];

const step = (text) => ({ text });

describe("computeDifficulty", () => {
  it("renvoie null sans geste noté", () => {
    const r = { steps: [step("Mélanger le tout.")] };
    expect(computeDifficulty(r, TECHS).score).toBe(null);
  });

  it("prend la difficulté max des gestes détectés", () => {
    const r = { steps: [step("On émince puis on émulsionne la sauce.")] };
    const d = computeDifficulty(r, TECHS);
    expect(d.score).toBe(4);
    expect(d.drivers).toEqual(["émulsionner"]);
  });

  it("ajoute des modificateurs (nb de gestes, base, étapes) plafonnés à +2", () => {
    const steps = [
      step("émincer"), step("émulsionner"), step("monder"), step("flamber"),
      ...Array.from({ length: 9 }, () => step("remuer")),
    ];
    // base = flamber (5) → déjà au plafond ; reste borné à 5
    const r = { steps, ingredients: [{ recipeId: "sub1" }] };
    expect(computeDifficulty(r, TECHS).score).toBe(5);
  });

  it("les modificateurs relèvent une base modérée", () => {
    // base = monder (3) ; ≥4 gestes ? non ; base component +1 ; ≥12 étapes ? non → 4
    const r = { steps: [step("monder les tomates")], ingredients: [{ recipeId: "sub1" }] };
    expect(computeDifficulty(r, TECHS).score).toBe(4);
  });

  it("respecte difficultyOverride", () => {
    const r = { difficultyOverride: 2, steps: [step("flamber")] };
    const d = computeDifficulty(r, TECHS);
    expect(d.score).toBe(2);
    expect(d.overridden).toBe(true);
  });
});
