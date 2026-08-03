import { describe, it, expect } from "vitest";
import { normalizeStr, parseIngredientInput } from "@/lib/food/parseIngredient.js";

describe("normalizeStr", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeStr("Crème Fraîche")).toBe("creme fraiche");
    expect(normalizeStr("  ÉCHALOTE ")).toBe("echalote");
  });
  it("handles empty input", () => {
    expect(normalizeStr("")).toBe("");
    expect(normalizeStr(null)).toBe("");
  });
});

describe("parseIngredientInput", () => {
  it("returns the raw name when there is no quantity", () => {
    expect(parseIngredientInput("Sel")).toEqual({ amount: "", unit: "", name: "Sel" });
  });

  it("parses amount + unit + name", () => {
    expect(parseIngredientInput("200 g de farine")).toEqual({ amount: 200, unit: "g", name: "farine" });
  });

  it("strips the liaison 'de' / \"d'\" after the unit", () => {
    expect(parseIngredientInput("1 gousse d'ail")).toEqual({ amount: 1, unit: "gousse", name: "ail" });
  });

  it("does not let a short unit swallow a longer word (g vs gousse)", () => {
    // "gousse" must not be parsed as unit "g" + "ousse"
    expect(parseIngredientInput("2 gousses ail").unit).toBe("gousses");
  });

  it("requires a word boundary after the unit", () => {
    // "litre" must not be eaten from "litchi"
    const r = parseIngredientInput("3 litchis");
    expect(r.unit).toBe("");
    expect(r.amount).toBe(3);
    expect(r.name).toBe("litchis");
  });

  it("normalizes decimal comma to dot", () => {
    expect(parseIngredientInput("1,5 l lait")).toEqual({ amount: 1.5, unit: "l", name: "lait" });
  });

  it("maps simple fractions to decimals", () => {
    expect(parseIngredientInput("1/2 citron")).toMatchObject({ amount: 0.5, name: "citron" });
  });

  it("adds a trailing fraction to an integer (1 1/2)", () => {
    expect(parseIngredientInput("1 1/2 oignon")).toMatchObject({ amount: 1.5, name: "oignon" });
  });

  it("handles an amount with no unit", () => {
    expect(parseIngredientInput("3 oeufs")).toEqual({ amount: 3, unit: "", name: "oeufs" });
  });
});
