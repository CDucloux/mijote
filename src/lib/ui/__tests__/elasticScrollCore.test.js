// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { rubberBand, stretchFactor, RUBBER_C, attachElasticScroll } from "@/lib/ui/elasticScrollCore.js";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

/** Stub matchMedia : `reduce` contrôle prefers-reduced-motion. */
function mockMedia({ reduce }) {
  vi.stubGlobal("matchMedia", (q) => ({ matches: q.includes("reduce") ? reduce : false, media: q, addEventListener() {}, removeEventListener() {} }));
}

describe("rubberBand", () => {
  it("est nul (ou moins) pour un tirage ou une dimension non positifs", () => {
    expect(rubberBand(0, 800, 38)).toBe(0);
    expect(rubberBand(-10, 800, 38)).toBe(0);
    expect(rubberBand(50, 0, 38)).toBe(0);
  });

  it("reste borné à `max` même pour un très grand tirage", () => {
    expect(rubberBand(100000, 800, 38)).toBe(38);
    expect(rubberBand(100000, 800, 64)).toBe(64);
  });

  it("croît avec le tirage mais avec une résistance décroissante (sous la droite y=x)", () => {
    const a = rubberBand(20, 800, 200);
    const b = rubberBand(60, 800, 200);
    expect(b).toBeGreaterThan(a); // monotone croissant
    expect(a).toBeLessThan(20);   // résisté : rendu < tiré
    expect(b).toBeLessThan(60);
  });

  it("suit la formule rubber-band iOS pour une valeur connue", () => {
    // b = (c·x·d) / (d + c·x), x=100, d=800, c=RUBBER_C
    const x = 100, d = 800;
    const expected = (RUBBER_C * x * d) / (d + RUBBER_C * x);
    expect(rubberBand(x, d, 999)).toBeCloseTo(expected, 6);
  });
});

describe("stretchFactor", () => {
  it("vaut 1 sans tirage ou sans hauteur", () => {
    expect(stretchFactor(0, 800)).toBe(1);
    expect(stretchFactor(40, 0)).toBe(1);
  });

  it("est plafonné à ~2,5 % d'étirement", () => {
    expect(stretchFactor(100000, 800)).toBeCloseTo(1.025, 6);
  });

  it("ignore le signe du décalage (|px|)", () => {
    expect(stretchFactor(-30, 800)).toBe(stretchFactor(30, 800));
  });

  it("croît avec le tirage tant que le plafond n'est pas atteint", () => {
    expect(stretchFactor(20, 2000)).toBeLessThan(stretchFactor(60, 2000));
  });
});

describe("attachElasticScroll", () => {
  it("n'attache rien et rend un nettoyage inerte en prefers-reduced-motion", () => {
    mockMedia({ reduce: true });
    const el = document.createElement("div");
    const inner = document.createElement("div");
    const add = vi.spyOn(el, "addEventListener");
    const off = attachElasticScroll(el, inner);
    expect(add).not.toHaveBeenCalled();
    expect(() => off()).not.toThrow();
  });

  it("attache les listeners de geste et les retire au nettoyage", () => {
    mockMedia({ reduce: false });
    const el = document.createElement("div");
    const inner = document.createElement("div");
    const add = vi.spyOn(el, "addEventListener");
    const remove = vi.spyOn(el, "removeEventListener");
    const off = attachElasticScroll(el, inner, { max: 64 });
    const events = add.mock.calls.map((c) => c[0]);
    expect(events).toEqual(expect.arrayContaining(["touchstart", "touchmove", "touchend", "touchcancel", "scroll"]));
    off();
    const removed = remove.mock.calls.map((c) => c[0]);
    expect(removed).toEqual(expect.arrayContaining(["touchstart", "touchmove", "touchend", "touchcancel", "scroll"]));
  });
});
