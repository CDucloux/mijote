import { describe, it, expect } from "vitest";
import { internalNavPath } from "../internalLink";

describe("internalNavPath", () => {
  it("prend en charge un chemin interne absolu", () => {
    expect(internalNavPath({ href: "/guide/recettes" })).toBe("/guide/recettes");
    expect(internalNavPath({ href: "/legal/privacy" })).toBe("/legal/privacy");
  });

  it("ignore les liens externes", () => {
    expect(internalNavPath({ href: "https://vercel.com" })).toBeNull();
    expect(internalNavPath({ href: "//cdn.example.com/x" })).toBeNull();
    expect(internalNavPath({ href: "mailto:a@b.c" })).toBeNull();
    expect(internalNavPath({ href: "tel:+33" })).toBeNull();
  });

  it("ignore les ancres et chemins relatifs", () => {
    expect(internalNavPath({ href: "#section" })).toBeNull();
    expect(internalNavPath({ href: "recettes" })).toBeNull();
  });

  it("laisse au navigateur les clics modifiés ou à ouverture externe", () => {
    expect(internalNavPath({ href: "/guide/recettes", modified: true })).toBeNull();
    expect(internalNavPath({ href: "/guide/recettes", target: "_blank" })).toBeNull();
  });

  it("accepte target vide ou _self", () => {
    expect(internalNavPath({ href: "/guide/recettes", target: "" })).toBe("/guide/recettes");
    expect(internalNavPath({ href: "/guide/recettes", target: "_self" })).toBe("/guide/recettes");
  });

  it("retourne null quand href est absent", () => {
    expect(internalNavPath({ href: null })).toBeNull();
    expect(internalNavPath({ href: "" })).toBeNull();
  });
});
