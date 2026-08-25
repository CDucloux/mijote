import { describe, it, expect } from "vitest";
import {
  detectRuntimeContext,
  isCapacitorContext,
  isAppContext,
  showsDiscoverLink,
} from "@/lib/ui/runtimeContext.js";

describe("detectRuntimeContext", () => {
  it("navigateur classique : ni natif ni standalone", () => {
    expect(detectRuntimeContext({ isNative: false, platform: "web", standalone: false })).toBe("browser");
  });

  it("PWA installée : standalone sans coquille native", () => {
    expect(detectRuntimeContext({ isNative: false, platform: "web", standalone: true })).toBe("pwa");
  });

  it("Capacitor iOS", () => {
    expect(detectRuntimeContext({ isNative: true, platform: "ios", standalone: false })).toBe("capacitor-ios");
  });

  it("Capacitor Android", () => {
    expect(detectRuntimeContext({ isNative: true, platform: "android", standalone: false })).toBe("capacitor-android");
  });

  it("le natif prime sur le standalone (une app Capacitor peut rapporter standalone)", () => {
    expect(detectRuntimeContext({ isNative: true, platform: "ios", standalone: true })).toBe("capacitor-ios");
    expect(detectRuntimeContext({ isNative: true, platform: "android", standalone: true })).toBe("capacitor-android");
  });
});

describe("helpers de contexte", () => {
  it("isCapacitorContext : vrai seulement pour les coquilles natives", () => {
    expect(isCapacitorContext("capacitor-ios")).toBe(true);
    expect(isCapacitorContext("capacitor-android")).toBe(true);
    expect(isCapacitorContext("pwa")).toBe(false);
    expect(isCapacitorContext("browser")).toBe(false);
  });

  it("isAppContext : tout sauf le navigateur", () => {
    expect(isAppContext("browser")).toBe(false);
    expect(isAppContext("pwa")).toBe(true);
    expect(isAppContext("capacitor-ios")).toBe(true);
    expect(isAppContext("capacitor-android")).toBe(true);
  });

  it("showsDiscoverLink : uniquement dans le navigateur (jamais dans l'app)", () => {
    expect(showsDiscoverLink("browser")).toBe(true);
    expect(showsDiscoverLink("pwa")).toBe(false);
    expect(showsDiscoverLink("capacitor-ios")).toBe(false);
    expect(showsDiscoverLink("capacitor-android")).toBe(false);
  });
});
