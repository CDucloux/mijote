import { describe, it, expect } from "vitest";
import { fillStepGroupGaps } from "../stepGroups.js";

describe("fillStepGroupGaps", () => {
  it("laisse intacte une liste vide, sans section ou entièrement sectionnée", () => {
    expect(fillStepGroupGaps([])).toEqual([]);
    expect(fillStepGroupGaps(["", "", ""])).toEqual(["", "", ""]);
    expect(fillStepGroupGaps(["Pâte", "Crème", "Montage"])).toEqual(["Pâte", "Crème", "Montage"]);
  });

  it("rattache une étape oubliée au milieu d'une section (non-régression : section coupée en deux)", () => {
    expect(fillStepGroupGaps(["Pâte", "Pâte", "", "Pâte"])).toEqual(["Pâte", "Pâte", "Pâte", "Pâte"]);
  });

  it("rattache plusieurs étapes consécutives encadrées par la même section", () => {
    expect(fillStepGroupGaps(["Crème", "", "", "Crème", "Pâte"])).toEqual(["Crème", "Crème", "Crème", "Crème", "Pâte"]);
  });

  it("laisse hors-section les étapes de tête, de fin ou entre deux sections différentes", () => {
    expect(fillStepGroupGaps(["", "Pâte", "", "Crème", ""])).toEqual(["", "Pâte", "", "Crème", ""]);
  });

  it("ne confond pas des libellés différents et normalise les espaces", () => {
    expect(fillStepGroupGaps([" Pâte ", "", "Pâte"])).toEqual(["Pâte", "Pâte", "Pâte"]);
    expect(fillStepGroupGaps(["Pâte", "", "La pâte"])).toEqual(["Pâte", "", "La pâte"]);
  });

  it("ne modifie pas le tableau d'entrée", () => {
    const input = ["A", "", "A"];
    fillStepGroupGaps(input);
    expect(input).toEqual(["A", "", "A"]);
  });
});
