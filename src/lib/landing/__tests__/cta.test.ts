import { describe, it, expect } from "vitest";
import { landingPrimaryCta } from "@/lib/landing/cta.js";

describe("landingPrimaryCta", () => {
  it("propose d'ouvrir l'app quand l'utilisateur est connecté", () => {
    expect(landingPrimaryCta({ uid: "abc123" })).toEqual({
      label: "Ouvrir Cardamome",
      to: "/home",
    });
  });

  it("propose d'essayer l'app quand l'utilisateur est déconnecté", () => {
    expect(landingPrimaryCta(null)).toEqual({
      label: "Essayer Cardamome",
      to: "/login",
    });
  });

  it("traite l'auth non résolue (undefined) comme un visiteur déconnecté", () => {
    expect(landingPrimaryCta(undefined)).toEqual({
      label: "Essayer Cardamome",
      to: "/login",
    });
  });

  it("ne prend pas un objet vide sans uid pour un utilisateur connecté", () => {
    expect(landingPrimaryCta({})).toEqual({
      label: "Essayer Cardamome",
      to: "/login",
    });
  });
});
