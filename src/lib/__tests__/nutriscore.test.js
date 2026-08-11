import { describe, it, expect } from "vitest";
import { computeNutriInfo, computeHealthScore, ingredientGrams, computeNutriBreakdown } from "@/lib/recipes/nutriscore.js";

const DB = [
  { id: "beurre", name: "Beurre", nutrition: { calories: 745, fat: 82, saturatedFat: 51, salt: 0.02, sugar: 0.6, protein: 0.7, fiber: 0 } },
  { id: "carotte", name: "Carotte", nutrition: { calories: 41, sugar: 4.7, saturatedFat: 0.04, salt: 0.07, fiber: 2.8, protein: 0.9, isVegetable: true } },
  // Fruit enregistré AVANT que les fruits comptent : drapeau figé absent/faux.
  { id: "avocat", category: "fruit", gramsPerPiece: 150, nutrition: { calories: 160, sugar: 0.7, saturatedFat: 2.1, salt: 0.02, fiber: 6.7, protein: 2 } },
  { id: "citron_vert", category: "fruit", gramsPerPiece: 70, nutrition: { calories: 30, sugar: 1.7, saturatedFat: 0, salt: 0, fiber: 2.8, protein: 0.7 } },
  { id: "sel", category: "condiment", nutrition: { calories: 0, sugar: 0, saturatedFat: 0, salt: 100, fiber: 0, protein: 0 } },
];

describe("ingredientGrams (résolution du poids)", () => {
  const avocat = { id: "avocat", gramsPerPiece: 150 };
  it("un nombre nu sans unité compte des PIÈCES si un poids à la pièce existe", () => {
    // « 2 avocats » (unité vide) → 2 × 150 g, pas 2 g.
    expect(ingredientGrams({ amount: 2, unit: "" }, avocat)).toBe(300);
    expect(ingredientGrams({ amount: 0.5, unit: "" }, avocat)).toBe(75);
  });
  it("respecte l'unité « pièce » explicite via gramsPerPiece", () => {
    expect(ingredientGrams({ amount: 1, unit: "pièce" }, avocat)).toBe(150);
  });
  it("les grammes explicites priment sur le poids à la pièce", () => {
    expect(ingredientGrams({ amount: 50, unit: "g" }, avocat)).toBe(50);
  });
  it("sans poids à la pièce, un nombre nu retombe sur des grammes", () => {
    expect(ingredientGrams({ amount: 20, unit: "" }, { id: "x" })).toBe(20);
  });
});

describe("computeNutriBreakdown", () => {
  it("null si aucune donnée exploitable", () => {
    expect(computeNutriBreakdown([{ name: "Inconnu", amount: 100, unit: "g" }], DB, new Map())).toBe(null);
    expect(computeNutriBreakdown([], DB, new Map())).toBe(null);
  });
  it("détaille négatifs/positifs et l'équation N − P = ns", () => {
    const b = computeNutriBreakdown([{ dbId: "carotte", name: "Carotte", amount: 200, unit: "g" }], DB, new Map());
    expect(b).toBeTruthy();
    expect(b.negatives.map(c => c.key)).toEqual(["energy", "sugar", "satfat", "salt"]);
    expect(b.positives.map(c => c.key)).toEqual(["fruitveg", "fiber", "protein"]);
    expect(b.N).toBe(b.negatives.reduce((s, c) => s + c.pts, 0));
    expect(b.ns).toBe(b.N - b.P);
    expect(["A", "B", "C", "D", "E"]).toContain(b.letter);
    // Cohérence avec computeNutriInfo.
    expect(computeNutriInfo([{ dbId: "carotte", name: "Carotte", amount: 200, unit: "g" }], DB, new Map()).letter).toBe(b.letter);
  });
});

describe("computeNutriInfo return shape", () => {
  it("always returns { score, letter } – even with no resolvable nutrition", () => {
    // lignes présentes mais aucune avec dbId/nutrition → masse nulle
    const r = computeNutriInfo([{ name: "Inconnu", amount: 100, unit: "g" }], DB, new Map());
    expect(r).toEqual({ score: 50, letter: null });
    // computeHealthScore en dérive un nombre, pas undefined
    expect(computeHealthScore([{ name: "Inconnu", amount: 100, unit: "g" }], DB, new Map())).toBe(50);
  });

  it("empty ingredient list returns the neutral shape", () => {
    expect(computeNutriInfo([], DB, new Map())).toEqual({ score: 50, letter: null });
  });

  it("scores a real ingredient line (letter in A..E, numeric score)", () => {
    const r = computeNutriInfo([{ dbId: "beurre", name: "Beurre", amount: 50, unit: "g" }], DB, new Map());
    expect(["A", "B", "C", "D", "E"]).toContain(r.letter);
    expect(typeof r.score).toBe("number");
  });

  it("compte les FRUITS dans la composante positive, même sans drapeau figé", () => {
    // Guacamole simplifié : avocat + citron vert (fruits) + une pointe de sel.
    // Les fruits doivent porter la note vers le haut, jamais un E.
    const guac = [
      { dbId: "avocat", name: "Avocat", amount: 2, unit: "pièce" },
      { dbId: "citron_vert", name: "Citron vert", amount: 1, unit: "pièce" },
      { dbId: "sel", name: "Sel", amount: 0.5, unit: "cuillère à café" },
    ];
    const withFruit = computeNutriInfo(guac, DB, new Map());
    expect(["A", "B", "C"]).toContain(withFruit.letter);
    expect(withFruit.letter).not.toBe("E");
    // Sans catégorie fruit (donnée d'avant), le même plat serait moins bien noté :
    // on vérifie que la prise en compte des fruits améliore bien la lettre.
    const noCat = DB.map(d => d.category === "fruit" ? { ...d, category: undefined, nutrition: { ...d.nutrition } } : d);
    const withoutFruit = computeNutriInfo(guac, noCat, new Map());
    expect(withFruit.score).toBeGreaterThanOrEqual(withoutFruit.score);
  });
});
