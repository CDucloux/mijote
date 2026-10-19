import { describe, it, expect } from "vitest";
import { pullIndicatorFrame, PULL_ARC_CIRCUMFERENCE, PULL_ARC_MAX, PULL_ARC_RADIUS, PULL_HEAD_LENGTH, PULL_HEAD_PATH } from "@/lib/ui/pullIndicator.js";

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

  it("pose la base de la pointe au bout de l'arc", () => {
    const { head } = pullIndicatorFrame(0.6);
    expect(Math.hypot(head.x - 12, head.y - 12)).toBeCloseTo(PULL_ARC_RADIUS);
    const start = pullIndicatorFrame(0).head;
    expect([start.x, start.y]).toEqual([12, 12 - PULL_ARC_RADIUS]);
  });

  it("incline la pointe pour que son sommet retombe sur le cercle (non-régression pointe cassée)", () => {
    [0.2, 0.5, 0.8, 1].forEach(p => {
      const { head } = pullIndicatorFrame(p);
      const a = (head.angle * Math.PI) / 180;
      const tip = { x: head.x + PULL_HEAD_LENGTH * Math.cos(a), y: head.y + PULL_HEAD_LENGTH * Math.sin(a) };
      expect(Math.hypot(tip.x - 12, tip.y - 12)).toBeCloseTo(PULL_ARC_RADIUS, 5);
    });
    // Au départ (midi), la tangente horaire vaut 0° : la pointe plonge légèrement vers l'intérieur.
    const start = pullIndicatorFrame(0).head.angle;
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThan(20);
  });

  it("dessine une pointe nettement plus large que le trait", () => {
    const ys = [...PULL_HEAD_PATH.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => Number(m[2]));
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(3 * 2.2);
  });

  it("borne les entrées hors plage ou invalides", () => {
    expect(pullIndicatorFrame(3)).toEqual(pullIndicatorFrame(1));
    expect(pullIndicatorFrame(-1)).toEqual(pullIndicatorFrame(0));
    expect(pullIndicatorFrame(Number.NaN)).toEqual(pullIndicatorFrame(0));
  });
});
