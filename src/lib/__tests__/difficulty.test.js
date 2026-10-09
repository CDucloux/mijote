import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseTechniquesYaml } from "@/lib/household/dataYaml.js";
import { computeDifficulty, explainDifficulty, workloadOf } from "@/lib/recipes/difficulty.js";

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

  it("hérite des gestes des préparations de base (héritage simple)", () => {
    // La recette parente n'a aucun geste propre ; toute la technique est dans la base.
    const base = { id: "sub1", name: "Sauce émulsionnée", steps: [step("émulsionner à feu doux")] };
    const parent = { steps: [step("Assembler et servir.")], ingredients: [{ recipeId: "sub1" }] };
    const d = computeDifficulty(parent, TECHS, { recipes: [base] });
    // base émulsionner (4) + modif « préparation de base » (+1) = 5
    expect(d.score).toBe(5);
    expect(d.drivers).toEqual(["émulsionner"]);
  });

  it("sans la liste des recettes, ne peut pas hériter (comportement historique)", () => {
    const parent = { steps: [step("Assembler et servir.")], ingredients: [{ recipeId: "sub1" }] };
    expect(computeDifficulty(parent, TECHS).score).toBe(null);
  });

  it("respecte difficultyOverride", () => {
    const r = { difficultyOverride: 2, steps: [step("flamber")] };
    const d = computeDifficulty(r, TECHS);
    expect(d.score).toBe(2);
    expect(d.overridden).toBe(true);
  });
});

describe("computeDifficulty : la difficulté mesure la technique, pas la longueur", () => {
  const T = [
    { id: "hacher", name: "hacher", difficulty: 1 },
    { id: "emincer", name: "émincer", difficulty: 1 },
    { id: "raper", name: "râper", difficulty: 1 },
    { id: "revenir", name: "faire revenir", difficulty: 1 },
    { id: "mijoter", name: "mijoter", difficulty: 1 },
    { id: "saisir", name: "saisir", difficulty: 1 },
    { id: "napper", name: "napper", difficulty: 2 },
    { id: "roux", name: "roux", difficulty: 3 },
    { id: "monter", name: "monter au beurre", difficulty: 2 },
    { id: "temperer", name: "tempérer", difficulty: 4 },
  ];

  it("ne compte pas les gestes de niveau 1 dans la variété (cas du bœuf bourguignon)", () => {
    const steps = ["hacher", "émincer", "râper", "faire revenir", "mijoter", "saisir", "roux", "napper"].map(step);
    expect(computeDifficulty({ steps: [...steps, ...Array.from({ length: 10 }, () => step("remuer"))] }, T).score).toBe(3);
  });
  it("ajoute un point dès 3 gestes de niveau 2 ou plus", () => {
    expect(computeDifficulty({ steps: [step("roux"), step("napper")] }, T).score).toBe(3);
    expect(computeDifficulty({ steps: [step("roux"), step("napper"), step("monter au beurre")] }, T).score).toBe(4);
  });
  it("n'utilise plus le nombre d'étapes", () => {
    const long = { steps: [step("napper"), ...Array.from({ length: 20 }, () => step("remuer"))] };
    expect(computeDifficulty(long, T).score).toBe(2);
  });
  it("plafonne le bonus à +1 même quand variété et sous-recette se cumulent", () => {
    const r = { steps: [step("roux"), step("napper"), step("monter au beurre")], ingredients: [{ recipeId: "b1" }] };
    expect(computeDifficulty(r, T).score).toBe(4);
  });
  it("réserve Expert (5) aux recettes portant un geste de niveau 4 ou plus", () => {
    const intermediate = { steps: [step("roux"), step("napper"), step("monter au beurre")], ingredients: [{ recipeId: "b1" }] };
    expect(computeDifficulty(intermediate, T).score).toBeLessThan(5);
    expect(computeDifficulty({ steps: [step("tempérer")], ingredients: [{ recipeId: "b1" }] }, T).score).toBe(5);
  });
});

describe("explainDifficulty", () => {
  const T = [
    { id: "roux", name: "roux", difficulty: 3 },
    { id: "napper", name: "napper", difficulty: 2 },
    { id: "monter", name: "monter au beurre", difficulty: 2 },
    { id: "hacher", name: "hacher", difficulty: 1 },
  ];
  it("détaille la variété (gestes de niveau 2+) et la sous-recette, sans ligne d'étapes", () => {
    const d = explainDifficulty({ steps: [step("roux"), step("napper"), step("hacher")] }, T);
    expect(d.score).toBe(3);
    expect(d.base).toBe(3);
    expect(d.mods.map(m => [m.detail, m.applied])).toEqual([["2 gestes de niveau 2 ou plus", false], ["aucune sous-recette", false]]);
    expect(d.mods.some(m => /étape/.test(m.label))).toBe(false);
  });
  it("signale qu'un seul bonus est retenu quand les deux s'appliquent", () => {
    const d = explainDifficulty({ steps: [step("roux"), step("napper"), step("monter au beurre")], ingredients: [{ recipeId: "b1" }] }, T);
    expect(d.modsApplied).toBe(1);
    expect(d.modsCapped).toBe(true);
    expect(d.score).toBe(4);
  });
  it("n'a rien à expliquer sans geste, et respecte l'override", () => {
    expect(explainDifficulty({ steps: [step("servir")] }, T)).toBe(null);
    expect(explainDifficulty({ difficultyOverride: 2, steps: [] }, T)).toMatchObject({ score: 2, overridden: true, mods: [] });
  });
});

describe("workloadOf", () => {
  const steps = (n) => ({ steps: Array.from({ length: n }, () => step("x")) });
  it("classe la charge de travail selon le nombre d'étapes", () => {
    expect(workloadOf(steps(1))).toEqual({ level: 1, label: "Légère", steps: 1 });
    expect(workloadOf(steps(6)).label).toBe("Légère");
    expect(workloadOf(steps(7)).label).toBe("Moyenne");
    expect(workloadOf(steps(11)).label).toBe("Moyenne");
    expect(workloadOf(steps(12))).toEqual({ level: 3, label: "Soutenue", steps: 12 });
  });
  it("renvoie null sans étape ou sans recette", () => {
    expect(workloadOf({ steps: [] })).toBe(null);
    expect(workloadOf({})).toBe(null);
    expect(workloadOf(null)).toBe(null);
  });
});

describe("roux blanc et roux brun (glossaire réel de data/)", () => {
  const { items } = parseTechniquesYaml(readFileSync("data/techniques.yaml", "utf8"));

  it("distingue le roux brun (niveau 3) du roux blanc ou blond (niveau 2)", () => {
    const explain = (text) => explainDifficulty({ steps: [step(text)] }, items);
    expect(explain("Faire un roux brun avec le beurre et la farine.").techniques.map(t => t.id)).toContain("tech_roux_brun");
    expect(explain("Faire un roux brun avec le beurre et la farine.").base).toBe(3);
    expect(explain("Faire un roux avec le beurre et la farine.").techniques.map(t => t.id)).toContain("tech_roux");
    expect(explain("Réaliser un roux blanc, puis mouiller au lait.").base).toBe(2);
  });
});
