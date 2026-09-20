import { describe, it, expect } from "vitest";
import { landingPrimaryCta } from "@/lib/landing/cta.js";

describe("landingPrimaryCta", () => {
  it("garde un libellé unique « Découvrir Cardamome » quel que soit l'état d'auth", () => {
    expect(landingPrimaryCta({ uid: "abc123" }).label).toBe("Découvrir Cardamome");
    expect(landingPrimaryCta(null).label).toBe("Découvrir Cardamome");
    expect(landingPrimaryCta(undefined).label).toBe("Découvrir Cardamome");
    expect(landingPrimaryCta({}).label).toBe("Découvrir Cardamome");
  });

  it("route vers l'accueil de l'app quand l'utilisateur est connecté", () => {
    expect(landingPrimaryCta({ uid: "abc123" }).to).toBe("/home");
  });

  it("route vers la connexion quand l'utilisateur est déconnecté", () => {
    expect(landingPrimaryCta(null).to).toBe("/login");
  });

  it("traite l'auth non résolue (undefined) comme un visiteur déconnecté", () => {
    expect(landingPrimaryCta(undefined).to).toBe("/login");
  });

  it("ne prend pas un objet vide sans uid pour un utilisateur connecté", () => {
    expect(landingPrimaryCta({}).to).toBe("/login");
  });
});
