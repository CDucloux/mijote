import { describe, it, expect } from "vitest";
import { cutPieces, cutProfileOf, cutSeconds, cutStepMinutes, recipeCutMinutes, DEFAULT_CUT_PROFILE, FORME_FACTOR } from "../cutTiming.js";

describe("cutProfileOf", () => {
  it("reconnaît un ingrédient au pluriel, accentué ou qualifié", () => {
    expect(cutProfileOf("Oignons jaunes")?.grams).toBe(150);
    expect(cutProfileOf("Échalote")?.grams).toBe(40);
    expect(cutProfileOf("Radis")?.grams).toBe(15);
  });

  it("préfère le nom composé à sa tête", () => {
    expect(cutProfileOf("Pommes de terre")?.grams).toBe(180);
    expect(cutProfileOf("Pomme")?.grams).toBe(170);
    expect(cutProfileOf("Céleri-rave")?.grams).toBe(600);
  });

  it("ignore l'inconnu et le vide", () => {
    expect(cutProfileOf("Beurre")).toBeNull();
    expect(cutProfileOf("")).toBeNull();
    expect(cutProfileOf(undefined)).toBeNull();
  });
});

describe("cutPieces", () => {
  it("compte les pièces, convertit les grammes, borne l'aberrant", () => {
    expect(cutPieces({ name: "Ail", amount: 3, unit: "gousses" })).toBe(3);
    expect(cutPieces({ name: "Oignon", amount: 300, unit: "g" })).toBe(2);
    expect(cutPieces({ name: "Carotte", amount: 0.6, unit: "kg" })).toBe(5);
    expect(cutPieces({ name: "Inconnu", amount: 200, unit: "g" })).toBe(200 / DEFAULT_CUT_PROFILE.grams);
    expect(cutPieces({ name: "Persil", amount: 2, unit: "cuillère à soupe" })).toBe(0.5);
    expect(cutPieces({ name: "Oignon", amount: null, unit: "" })).toBe(1);
    expect(cutPieces({ name: "Oignon", amount: -2, unit: "" })).toBe(1);
    expect(cutPieces({ name: "Oignon", amount: 999, unit: "" })).toBe(50);
    expect(cutPieces({ name: "Ail", amount: 0.1, unit: "" })).toBe(0.25);
  });
});

describe("cutSeconds", () => {
  it("coûte plus pour une forme fine que grossière, et pour un calibre fin", () => {
    const onion = (forme: keyof typeof FORME_FACTOR, calibre?: "fin" | "gros") => cutSeconds({ name: "Oignon", amount: 1, unit: "", forme, calibre });
    expect(onion("emince")).toBe(100);
    expect(onion("brunoise")).toBeGreaterThan(onion("cisele"));
    expect(onion("cisele")).toBeGreaterThan(onion("emince"));
    expect(onion("quartier")).toBeLessThan(onion("emince"));
    expect(onion("emince", "fin")).toBeGreaterThan(onion("emince"));
    expect(onion("emince", "gros")).toBeLessThan(onion("emince"));
  });
});

describe("cutStepMinutes", () => {
  it("ajoute mise en route et changement de poste, arrondi à la minute supérieure", () => {
    expect(cutStepMinutes([])).toBe(0);
    // 60 s de mise en route + 15 s de poste + 100 s d'émincé.
    expect(cutStepMinutes([{ name: "Oignon", amount: 1, unit: "", forme: "emince" }])).toBe(3);
    // Un kilo de pommes de terre en dés : une dizaine de minutes, pas trois.
    const potatoes = cutStepMinutes([{ name: "Pommes de terre", amount: 1, unit: "kg", forme: "des" }]);
    expect(potatoes).toBeGreaterThanOrEqual(9);
    expect(potatoes).toBeLessThanOrEqual(12);
  });
});

describe("recipeCutMinutes", () => {
  it("rattache les postes structurés à leur étape", () => {
    const minutes = recipeCutMinutes({
      ingredients: [{ id: "a", name: "Carotte", amount: 2, cut: { forme: "rondelle" } }],
      steps: [{ text: "Préchauffer le four" }, { text: "Couper les carottes en rondelles", ingredients: ["a"] }],
    });
    expect(minutes).toEqual([null, 3]);
  });

  it("se rabat sur les ingrédients liés et la forme du texte, sans la farine ni le beurre", () => {
    const minutes = recipeCutMinutes({
      ingredients: [{ id: "a", name: "Courgette", amount: 2 }, { id: "b", name: "Beurre", amount: 50, unit: "g" }],
      steps: [{ text: "Couper la courgette en julienne et le beurre en dés", ingredients: ["a", "b"] }, { text: "Mélanger", ingredients: ["a"] }],
    });
    expect(minutes[0]).toBe(Math.ceil((60 + 15 + 2 * (5 + 60 * FORME_FACTOR.julienne)) / 60));
    expect(minutes[1]).toBeNull();
  });

  it("reste vide sans étapes ni ingrédients", () => {
    expect(recipeCutMinutes({})).toEqual([]);
    expect(recipeCutMinutes({ steps: [{ text: "Couper" }] })).toEqual([null]);
  });
});
