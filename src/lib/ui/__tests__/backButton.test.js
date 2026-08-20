import { describe, it, expect } from "vitest";
import { decideBackAction } from "@/lib/ui/backButton.js";

describe("decideBackAction", () => {
  it("recule d'un cran dès qu'un historique existe, quelle que soit la route", () => {
    expect(decideBackAction("/home", true)).toBe("back");
    expect(decideBackAction("/recipes/123", true)).toBe("back");
    expect(decideBackAction("/", true)).toBe("back");
  });

  it("quitte l'app depuis l'accueil quand la pile est vide", () => {
    expect(decideBackAction("/home", false)).toBe("exit");
  });

  it("quitte l'app depuis la racine « / » quand la pile est vide", () => {
    expect(decideBackAction("/", false)).toBe("exit");
  });

  it("rejoint l'accueil depuis une page profonde sans historique", () => {
    expect(decideBackAction("/recipes", false)).toBe("home");
    expect(decideBackAction("/recipes/123", false)).toBe("home");
    expect(decideBackAction("/profile", false)).toBe("home");
  });

  it("traite une route inconnue / vide comme une page profonde (pas une sortie)", () => {
    expect(decideBackAction("", false)).toBe("home");
    expect(decideBackAction("/unknown", false)).toBe("home");
  });
});
