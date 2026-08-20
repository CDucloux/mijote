import { describe, it, expect } from "vitest";
import { clamp, fadeWindow, computeHeroFrame, rubberBand, stretchFactor } from "@/lib/ui/heroCollapse.js";

// Géométrie réelle de la fiche (HERO_H 300, BAR_H 52).
const PARAMS = { moveEnd: 248, barStart: 226, reduce: false };

describe("heroCollapse", () => {
  it("clamp bounds within [a, b]", () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(2)).toBe(1);
    expect(clamp(0.4)).toBe(0.4);
    expect(clamp(5, 1, 3)).toBe(3);
  });

  it("fadeWindow is 0 before a, 1 after b, linear between", () => {
    expect(fadeWindow(0, 0.2, 0.6)).toBe(0);
    expect(fadeWindow(0.2, 0.2, 0.6)).toBe(0);
    expect(fadeWindow(0.4, 0.2, 0.6)).toBeCloseTo(0.5, 5);
    expect(fadeWindow(0.6, 0.2, 0.6)).toBe(1);
    expect(fadeWindow(1, 0.2, 0.6)).toBe(1);
  });

  it("at scrollTop 0: hero fully expanded, bar hidden", () => {
    const f = computeHeroFrame(0, PARAMS);
    expect(f.pMove).toBe(0);
    expect(f.pBar).toBe(0);
    expect(f.img).toEqual({ translateY: 0, scale: 1 });
    expect(f.shadeOpacity).toBeCloseTo(0.55, 5);
    expect(f.badges.opacity).toBe(1);
    expect(f.loose.opacity).toBe(1);
    expect(f.title.opacity).toBe(1);
    expect(f.controls.opacity).toBe(1);
    expect(f.barInner.opacity).toBe(0); // contenu de barre invisible tant que le hero n'est pas replié
  });

  it("negative scrollTop (iOS overscroll) is clamped to the expanded frame", () => {
    expect(computeHeroFrame(-80, PARAMS)).toEqual(computeHeroFrame(0, PARAMS));
  });

  it("at scrollTop >= moveEnd: hero fully collapsed, bar opaque and visible", () => {
    const f = computeHeroFrame(248, PARAMS);
    expect(f.pMove).toBe(1);
    expect(f.pBar).toBe(1);
    expect(f.img.scale).toBeCloseTo(1.16, 5);
    expect(f.shadeOpacity).toBeCloseTo(1, 5);
    expect(f.badges.opacity).toBe(0);
    expect(f.title.opacity).toBe(0);
    expect(f.controls.opacity).toBe(0);
    expect(f.barInner.opacity).toBe(1);
  });

  it("staggered exit: badges fade before source, source before title", () => {
    // Tôt dans le repli (pMove ~0.24), l'ordre d'opacité reflète la chorégraphie étagée.
    const f = computeHeroFrame(60, PARAMS);
    expect(f.badges.opacity).toBeLessThan(f.loose.opacity);
    expect(f.loose.opacity).toBeLessThan(f.title.opacity);
  });

  it("reduce motion freezes the background image transform", () => {
    const f = computeHeroFrame(200, { ...PARAMS, reduce: true });
    expect(f.img).toEqual({ translateY: 0, scale: 1 });
    // Le texte continue de se replier même en mouvement réduit.
    expect(f.badges.opacity).toBeLessThan(1);
  });

  it("rubberBand tracks then resists, capped at maxPull", () => {
    expect(rubberBand(0, 800)).toBe(0);
    expect(rubberBand(10, 800)).toBeGreaterThan(0);
    expect(rubberBand(10, 800)).toBeLessThan(10 * 0.32); // résistance
    expect(rubberBand(100000, 800)).toBe(38); // plafond
  });

  it("stretchFactor stays subtle and caps at 2.5%", () => {
    expect(stretchFactor(0, 800)).toBe(1);
    expect(stretchFactor(-20, 800)).toBeCloseTo(stretchFactor(20, 800), 10); // signe indifférent
    expect(stretchFactor(100000, 800)).toBeCloseTo(1.025, 10);
  });
});
