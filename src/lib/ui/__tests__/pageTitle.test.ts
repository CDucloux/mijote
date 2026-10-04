import { describe, it, expect } from "vitest";
import { pageTitle } from "../pageTitle.js";

describe("pageTitle", () => {
  it("nomme l'onglet courant", () => {
    expect(pageTitle({ tab: "recipes", editing: false })).toBe("Cardamome | Recettes");
  });
  it("replie sur Accueil pour un onglet inconnu", () => {
    expect(pageTitle({ tab: "nope", editing: false })).toBe("Cardamome | Accueil");
  });
  it("affiche « Nouvelle recette » pour un éditeur sans nom (vide ou blanc)", () => {
    expect(pageTitle({ tab: "recipes", editing: true, editedName: "  " })).toBe("Cardamome | Nouvelle recette");
    expect(pageTitle({ tab: "recipes", editing: true, editedName: null })).toBe("Cardamome | Nouvelle recette");
  });
  it("l'éditeur prime sur la recette consultée", () => {
    expect(pageTitle({ tab: "recipes", editing: true, editedName: "Tarte", viewedName: "Autre" })).toBe("Cardamome | Tarte");
  });
  it("priorité recette consultée > ingrédient > écran hors onglets > onglet", () => {
    expect(pageTitle({ tab: "home", editing: false, viewedName: "Fond brun", ingredientName: "Veau", routeName: "Abonnement" })).toBe("Cardamome | Fond brun");
    expect(pageTitle({ tab: "admin", editing: false, ingredientName: "Veau", routeName: "Abonnement" })).toBe("Cardamome | Veau");
    expect(pageTitle({ tab: "home", editing: false, routeName: "Abonnement" })).toBe("Cardamome | Abonnement");
  });
});
