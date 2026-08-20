// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { NATIVE_FEEL_CLASS, shouldUseNativeFeel, markNativeFeel } from "@/lib/ui/nativeFeel.js";

describe("shouldUseNativeFeel", () => {
  it("actif dans la coquille Capacitor", () => {
    expect(shouldUseNativeFeel(true, false)).toBe(true);
  });
  it("actif en PWA installée (standalone)", () => {
    expect(shouldUseNativeFeel(false, true)).toBe(true);
  });
  it("actif si les deux (native + standalone)", () => {
    expect(shouldUseNativeFeel(true, true)).toBe(true);
  });
  it("inactif dans un onglet de navigateur classique", () => {
    expect(shouldUseNativeFeel(false, false)).toBe(false);
  });
});

describe("markNativeFeel", () => {
  afterEach(() => { document.documentElement.classList.remove(NATIVE_FEEL_CLASS); });

  it("pose la classe quand le feel natif est requis", () => {
    const el = document.createElement("html");
    markNativeFeel(el, true, false);
    expect(el.classList.contains(NATIVE_FEEL_CLASS)).toBe(true);
  });

  it("retire la classe dans un navigateur classique (idempotent)", () => {
    const el = document.createElement("html");
    el.classList.add(NATIVE_FEEL_CLASS);
    markNativeFeel(el, false, false);
    expect(el.classList.contains(NATIVE_FEEL_CLASS)).toBe(false);
  });

  it("ne plante pas sans racine (SSR / DOM absent)", () => {
    expect(() => markNativeFeel(null, true, true)).not.toThrow();
    expect(() => markNativeFeel(undefined, false, false)).not.toThrow();
  });
});
