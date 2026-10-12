import { describe, it, expect } from "vitest";
import { pullIndicatorFrame, PULL_ARC_CIRCUMFERENCE, PULL_ARC_MAX, PULL_ARC_RADIUS } from "@/lib/ui/pullIndicator.js";

describe("pullIndicatorFrame", () => {
  it("ne trace rien au repos", () => {
    const frame = pullIndicatorFrame(0);
    expect(frame.arc).toBe(0);
    expect(frame.dash).toBe(0);
    expect(frame.head.scale).toBe(0);
    expect(frame.armed).toBe(false);
  });

  it("trace l'arc à mesure du geste, sans jamais reculer", () => {
    const arcs = [0.1, 0.3, 0.5, 0.7, 0.9, 1].map(p => pullIndicatorFrame(p).arc);
    arcs.slice(1).forEach((arc, i) => expect(arc).toBeGreaterThan(arcs[i]));
  });

  it("arme l'actualisation au seuil, arc ouvert au maximum", () => {
    const frame = pullIndicatorFrame(1);
    expect(frame.armed).toBe(true);
    expect(frame.arc).toBeCloseTo(PULL_ARC_MAX);
    expect(frame.dash).toBeCloseTo(PULL_ARC_MAX * PULL_ARC_CIRCUMFERENCE);
    expect(frame.head.scale).toBe(1);
  });

  it("pose la pointe au bout de l'arc, tangente au cercle", () => {
    const { head } = pullIndicatorFrame(0.6);
    expect(Math.hypot(head.x - 12, head.y - 12)).toBeCloseTo(PULL_ARC_RADIUS);
    const start = pullIndicatorFrame(0).head;
    // Au départ (midi), la tangente horaire pointe vers la droite : 0°.
    expect([start.x, start.y]).toEqual([12, 12 - PULL_ARC_RADIUS]);
    expect(start.angle).toBeCloseTo(0, 0);
  });

  it("borne les entrées hors plage ou invalides", () => {
    expect(pullIndicatorFrame(3)).toEqual(pullIndicatorFrame(1));
    expect(pullIndicatorFrame(-1)).toEqual(pullIndicatorFrame(0));
    expect(pullIndicatorFrame(Number.NaN)).toEqual(pullIndicatorFrame(0));
  });
});
