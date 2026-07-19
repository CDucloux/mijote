import { describe, it, expect } from "vitest";
import {
  panArea, panFactor, roundNice, densityFor, convertQuantity,
} from "./calculators.js";

describe("panArea", () => {
  it("surface d'un moule rond (π r²)", () => {
    expect(panArea("round", { diameter: 20 })).toBeCloseTo(Math.PI * 100, 5);
  });
  it("surface d'un moule rectangulaire (L × l)", () => {
    expect(panArea("rect", { length: 30, width: 20 })).toBe(600);
  });
  it("0 si dimensions manquantes ou forme inconnue", () => {
    expect(panArea("round", {})).toBe(0);
    expect(panArea("triangle", { diameter: 10 })).toBe(0);
  });
});

describe("panFactor", () => {
  it("ratio de surface quand pas de hauteurs", () => {
    const f = panFactor({ shape: "round", diameter: 20 }, { shape: "round", diameter: 24 });
    expect(f).toBeCloseTo((24 * 24) / (20 * 20), 5); // 1.44
  });
  it("ratio de volume quand les deux hauteurs sont fournies", () => {
    const f = panFactor(
      { shape: "round", diameter: 20, height: 4 },
      { shape: "round", diameter: 20, height: 6 },
    );
    expect(f).toBeCloseTo(1.5, 5);
  });
  it("rond → rectangle par surface", () => {
    const f = panFactor({ shape: "round", diameter: 20 }, { shape: "rect", length: 20, width: 20 });
    expect(f).toBeCloseTo(400 / (Math.PI * 100), 5);
  });
  it("null si un moule est incomplet", () => {
    expect(panFactor({ shape: "round", diameter: 20 }, { shape: "round" })).toBeNull();
  });
});

describe("roundNice", () => {
  it("arrondit selon l'ordre de grandeur", () => {
    expect(roundNice(342)).toBe(340);
    expect(roundNice(47.3)).toBe(47);
    expect(roundNice(3.47)).toBe(3.5);
    expect(roundNice(0.47)).toBe(0.47);
    expect(roundNice(0)).toBe(0);
  });
});

describe("densityFor", () => {
  it("reconnaît l'ingrédient (clé la plus spécifique)", () => {
    expect(densityFor("Farine de blé T55")).toBe(0.53);
    expect(densityFor("sucre glace")).toBe(0.56);
    expect(densityFor("sucre en poudre")).toBe(0.85);
    expect(densityFor("eau")).toBe(1);
  });
  it("null si inconnu", () => {
    expect(densityFor("plutonium")).toBeNull();
    expect(densityFor("")).toBeNull();
  });
});

describe("convertQuantity", () => {
  it("même nature : masse ↔ masse", () => {
    expect(convertQuantity(1, "kg", "g")).toBe(1000);
  });
  it("même nature : volume ↔ volume", () => {
    expect(convertQuantity(1, "l", "ml")).toBe(1000);
    expect(convertQuantity(2, "cuillère à soupe", "ml")).toBe(30);
  });
  it("masse ↔ volume via densité", () => {
    // 100 g de farine (0.53 g/ml) ≈ 188.7 ml
    expect(convertQuantity(100, "g", "ml", 0.53)).toBeCloseTo(100 / 0.53, 3);
    // 200 ml d'eau (1) = 200 g
    expect(convertQuantity(200, "ml", "g", 1)).toBeCloseTo(200, 3);
  });
  it("null sans densité pour un croisement", () => {
    expect(convertQuantity(100, "g", "ml")).toBeNull();
  });
  it("null pour une unité inconnue ou valeur non numérique", () => {
    expect(convertQuantity(1, "g", "parsec")).toBeNull();
    expect(convertQuantity("abc", "g", "kg")).toBeNull();
  });
});
