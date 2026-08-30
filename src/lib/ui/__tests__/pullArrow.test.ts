import { describe, it, expect } from "vitest";
import { pullArrowGeometry } from "../pullArrow.js";

/** Extrait les nombres d'un chemin/points SVG, pour des assertions robustes. */
const nums = (s: string): number[] => (s.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("pullArrowGeometry", () => {
  it("progression nulle → aucun tracé (arc et pointe vides)", () => {
    expect(pullArrowGeometry(0)).toEqual({ arc: "", head: "" });
  });

  it("clampe les valeurs hors [0, 1]", () => {
    expect(pullArrowGeometry(-3)).toEqual(pullArrowGeometry(0));
    expect(pullArrowGeometry(5)).toEqual(pullArrowGeometry(1));
  });

  it("part toujours du haut du cercle (12, 5)", () => {
    const { arc } = pullArrowGeometry(0.5);
    expect(arc.startsWith("M12 5 ")).toBe(true);
  });

  it("bascule le flag large-arc une fois le demi-cercle dépassé", () => {
    // MAX_SWEEP ~= 295°, le demi-cercle (180°) est franchi vers p = 0.61.
    // Format: `M x0 y0 A r r xRot largeArc sweep x1 y1` → le flag large-arc est le 6e token.
    const flag = (p: number) => pullArrowGeometry(p).arc.split(/\s+/)[5];
    expect(flag(0.4)).toBe("0");
    expect(flag(1)).toBe("1");
  });

  it("l'arc grandit avec la progression (extrémité qui avance)", () => {
    const endOf = (p: number) => pullArrowGeometry(p).arc.split(/\s+/).slice(-2).join(",");
    expect(endOf(0.3)).not.toBe(endOf(0.6));
  });

  it("la pointe est un chevron de trois points, ancré au bout de l'arc", () => {
    const { arc, head } = pullArrowGeometry(0.7);
    const headPts = nums(head);
    expect(headPts).toHaveLength(6);
    const arcNums = nums(arc);
    const [ex, ey] = [arcNums[arcNums.length - 2], arcNums[arcNums.length - 1]];
    // Le point central du chevron coïncide avec l'extrémité de l'arc.
    expect(headPts[2]).toBeCloseTo(ex, 5);
    expect(headPts[3]).toBeCloseTo(ey, 5);
  });
});
