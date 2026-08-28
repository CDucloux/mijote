import { describe, it, expect } from "vitest";
import { shouldAnimateDismiss, DETAIL_DISMISS_MS } from "@/lib/ui/screenTransition.js";

const base = { ctx: "capacitor-android", isDesktop: false, onDetail: true, reducedMotion: false };

describe("shouldAnimateDismiss", () => {
  it("anime la sortie dans la coquille native mobile, fiche affichée", () => {
    expect(shouldAnimateDismiss({ ...base, ctx: "capacitor-android" })).toBe(true);
    expect(shouldAnimateDismiss({ ...base, ctx: "capacitor-ios" })).toBe(true);
  });

  it("n'anime pas hors coquille native (navigateur, PWA)", () => {
    expect(shouldAnimateDismiss({ ...base, ctx: "browser" })).toBe(false);
    expect(shouldAnimateDismiss({ ...base, ctx: "pwa" })).toBe(false);
  });

  it("n'anime pas en disposition desktop", () => {
    expect(shouldAnimateDismiss({ ...base, isDesktop: true })).toBe(false);
  });

  it("n'anime rien s'il n'y a pas de fiche affichée", () => {
    expect(shouldAnimateDismiss({ ...base, onDetail: false })).toBe(false);
  });

  it("respecte la réduction des animations (accessibilité)", () => {
    expect(shouldAnimateDismiss({ ...base, reducedMotion: true })).toBe(false);
  });

  it("expose une durée de sortie positive alignée sur le CSS", () => {
    expect(DETAIL_DISMISS_MS).toBeGreaterThan(0);
  });
});
