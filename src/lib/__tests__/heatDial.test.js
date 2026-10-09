import { describe, it, expect } from "vitest";
import { parsePowerRange, toNotches, heatRows, notchAngle, notchLabel } from "@/lib/utensils/heatDial.js";
import { parsePrecautionDescription } from "@/lib/utensils/precautionLayout.js";

describe("parsePowerRange", () => {
  it("lit les plages en fraction du maximum", () => {
    expect(parsePowerRange("1/5 à 1/3")).toEqual({ from: 0.2, to: 1 / 3 });
    expect(parsePowerRange("1/2 à 2/3")).toEqual({ from: 0.5, to: 2 / 3 });
  });
  it("comprend « fond », le maximum et les pourcentages", () => {
    expect(parsePowerRange("2/3 à fond")).toEqual({ from: 2 / 3, to: 1 });
    expect(parsePowerRange("À fond")).toEqual({ from: 1, to: 1 });
    expect(parsePowerRange("50 % - 75 %")).toEqual({ from: 0.5, to: 0.75 });
    expect(parsePowerRange("1/2")).toEqual({ from: 0.5, to: 0.5 });
  });
  it("remet les bornes dans l'ordre", () => {
    expect(parsePowerRange("2/3 à 1/3")).toEqual({ from: 1 / 3, to: 2 / 3 });
  });
  it("refuse ce qu'il ne sait pas lire", () => {
    expect(parsePowerRange("feu moyen")).toBe(null);
    expect(parsePowerRange("3/2")).toBe(null);
    expect(parsePowerRange("1/0")).toBe(null);
    expect(parsePowerRange("150 %")).toBe(null);
    expect(parsePowerRange("1/3 à 1/2 à 2/3")).toBe(null);
    expect(parsePowerRange("")).toBe(null);
    expect(parsePowerRange(undefined)).toBe(null);
  });
});

describe("toNotches", () => {
  it("place les plages de la poêle en inox sur un bouton à 6 crans", () => {
    expect(toNotches(parsePowerRange("1/5 à 1/3"))).toEqual({ from: 1, to: 2 });
    expect(toNotches(parsePowerRange("1/3 à 1/2"))).toEqual({ from: 2, to: 3 });
    expect(toNotches(parsePowerRange("1/2 à 2/3"))).toEqual({ from: 3, to: 4 });
    expect(toNotches(parsePowerRange("2/3 à fond"))).toEqual({ from: 4, to: 6 });
  });
  it("allume toujours au moins le premier cran", () => {
    expect(toNotches({ from: 0, to: 0.05 })).toEqual({ from: 1, to: 1 });
  });
});

describe("heatRows", () => {
  const description = "Puissance conseillée :\n\n| Usage | Puissance |\n| --- | --- |\n| Mijoter, maintenir | 1/5 à 1/3 |\n| Saisie très courte | 2/3 à fond |";

  it("reconnaît un tableau de chauffe et donne les crans de chaque usage", () => {
    const table = parsePrecautionDescription(description).find(b => b.kind === "table");
    expect(heatRows(table)).toEqual([
      { label: "Mijoter, maintenir", value: "1/5 à 1/3", notches: { from: 1, to: 2 } },
      { label: "Saisie très courte", value: "2/3 à fond", notches: { from: 4, to: 6 } },
    ]);
  });
  it("laisse en texte un tableau dont une valeur n'est pas une puissance", () => {
    expect(heatRows({ kind: "table", header: null, rows: [["Mijoter", "1/3"], ["Saisir", "feu vif"]] })).toBe(null);
    expect(heatRows({ kind: "table", header: null, rows: [["A", "1/3", "x"]] })).toBe(null);
    expect(heatRows({ kind: "table", header: null, rows: [] })).toBe(null);
  });
});

describe("notchAngle", () => {
  it("répartit les 6 crans sur 270° en laissant le bas libre", () => {
    expect(notchAngle(1)).toBe(-135);
    expect(notchAngle(6)).toBe(135);
    expect(notchAngle(2)).toBe(-81);
  });
  it("garde le cran unique au sommet", () => {
    expect(notchAngle(1, 1)).toBe(0);
  });
});

describe("notchLabel", () => {
  it("annonce un cran ou une plage", () => {
    expect(notchLabel({ from: 3, to: 3 })).toBe("Cran 3 sur 6");
    expect(notchLabel({ from: 4, to: 6 })).toBe("Crans 4 à 6 sur 6");
  });
});
