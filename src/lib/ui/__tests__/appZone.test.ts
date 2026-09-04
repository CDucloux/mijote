import { describe, it, expect } from "vitest";
import { APP_BASE, isAppZone, toAppPath, stripAppBase } from "../appZone.js";

describe("isAppZone", () => {
  it("contexte app (PWA/Capacitor) → toujours zone app, quel que soit le chemin", () => {
    expect(isAppZone("/", true)).toBe(true);
    expect(isAppZone("/home", true)).toBe(true);
    expect(isAppZone("/legal/terms", true)).toBe(true);
  });

  it("navigateur : sous /app → zone app", () => {
    expect(isAppZone(APP_BASE, false)).toBe(true);
    expect(isAppZone("/app/home", false)).toBe(true);
    expect(isAppZone("/app/recipes/abc", false)).toBe(true);
  });

  it("navigateur : racine et chemins publics → zone publique", () => {
    expect(isAppZone("/", false)).toBe(false);
    expect(isAppZone("/legal", false)).toBe(false);
    expect(isAppZone("/legal/privacy", false)).toBe(false);
    expect(isAppZone("/discover/xyz", false)).toBe(false);
  });

  it("navigateur : ancienne URL plate d'app → zone publique (sera redirigée vers /app)", () => {
    expect(isAppZone("/home", false)).toBe(false);
    expect(isAppZone("/plan", false)).toBe(false);
  });

  it("ne confond pas un préfixe ressemblant (/application) avec /app", () => {
    expect(isAppZone("/application", false)).toBe(false);
    expect(isAppZone("/appointments", false)).toBe(false);
  });
});

describe("toAppPath", () => {
  it("laisse un chemin déjà sous /app intact", () => {
    expect(toAppPath("/app")).toBe("/app");
    expect(toAppPath("/app/home")).toBe("/app/home");
    expect(toAppPath("/app/recipes/abc")).toBe("/app/recipes/abc");
  });

  it("mappe la racine sur l'accueil de l'app", () => {
    expect(toAppPath("/")).toBe("/app/home");
  });

  it("préfixe une ancienne URL plate", () => {
    expect(toAppPath("/home")).toBe("/app/home");
    expect(toAppPath("/recipes/abc")).toBe("/app/recipes/abc");
    expect(toAppPath("/discover/xyz")).toBe("/app/discover/xyz");
    expect(toAppPath("/login")).toBe("/app/login");
  });
});

describe("stripAppBase", () => {
  it("retire le préfixe /app", () => {
    expect(stripAppBase("/app/home")).toBe("/home");
    expect(stripAppBase("/app/recipes/abc")).toBe("/recipes/abc");
  });
  it("/app seul devient la racine", () => {
    expect(stripAppBase("/app")).toBe("/");
  });
  it("laisse intact un chemin hors /app", () => {
    expect(stripAppBase("/home")).toBe("/home");
    expect(stripAppBase("/")).toBe("/");
    expect(stripAppBase("/application")).toBe("/application");
  });
  it("est l'inverse de toAppPath pour les chemins app", () => {
    for (const p of ["/home", "/recipes/abc", "/discover/xyz", "/login"]) {
      expect(stripAppBase(toAppPath(p))).toBe(p);
    }
  });
});
