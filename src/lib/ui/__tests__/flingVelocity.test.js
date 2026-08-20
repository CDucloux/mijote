import { describe, it, expect } from "vitest";
import { trackFlingPeak, bounceImpact } from "../flingVelocity.ts";

describe("trackFlingPeak", () => {
  it("retient la vitesse montante telle quelle", () => {
    expect(trackFlingPeak(0.3, 0.9)).toBe(0.9);
  });

  it("survit au frame de contact (instantané ~0) en gardant le pic amorti", () => {
    // Élan à 1.0, puis butée : l'instantané tombe à 0, le pic reste bien au-dessus.
    const peak = trackFlingPeak(1.0, 0);
    expect(peak).toBeGreaterThan(0.5);
    expect(peak).toBeCloseTo(0.72, 5);
  });

  it("décroît frame après frame quand la vitesse ne remonte pas", () => {
    let p = 1.0;
    p = trackFlingPeak(p, 0); // 0.72
    p = trackFlingPeak(p, 0); // 0.5184
    expect(p).toBeCloseTo(0.5184, 4);
  });

  it("ignore une vitesse négative (défilement vers le haut)", () => {
    expect(trackFlingPeak(0.8, -2)).toBeCloseTo(0.576, 5);
  });

  it("part de zéro proprement", () => {
    expect(trackFlingPeak(0, 0)).toBe(0);
    expect(trackFlingPeak(0, -1)).toBe(0);
  });

  it("respecte un facteur de décroissance personnalisé", () => {
    expect(trackFlingPeak(1, 0, 0.5)).toBe(0.5);
  });
});

describe("bounceImpact", () => {
  it("convertit la vitesse en pixels via le gain", () => {
    expect(bounceImpact(1, 100, 13)).toBe(13);
  });

  it("borne l'amplitude au maximum", () => {
    expect(bounceImpact(10, 38)).toBe(38);
  });

  it("ne renvoie jamais de valeur négative", () => {
    expect(bounceImpact(-5, 38)).toBe(0);
  });

  it("renvoie 0 pour une vitesse nulle", () => {
    expect(bounceImpact(0, 38)).toBe(0);
  });
});
