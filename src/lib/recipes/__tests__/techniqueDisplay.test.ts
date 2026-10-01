import { describe, it, expect } from "vitest";
import { techniqueVisual } from "../techniqueDisplay.js";

describe("techniqueVisual", () => {
  it("renvoie l'icône et la couleur de chaque catégorie connue", () => {
    expect(techniqueVisual("decoupe")).toEqual({ icon: "knife", color: "#e0894a" });
    expect(techniqueVisual("cuisson")).toEqual({ icon: "fire", color: "#e0524f" });
    expect(techniqueVisual("dressage")).toEqual({ icon: "dish", color: "#9b87f5" });
  });

  it("retombe sur le repli neutre pour une catégorie inconnue, vide ou absente", () => {
    const fallback = { icon: "utensils", color: "var(--accent)" };
    expect(techniqueVisual("inexistante")).toEqual(fallback);
    expect(techniqueVisual("")).toEqual(fallback);
    expect(techniqueVisual(null)).toEqual(fallback);
    expect(techniqueVisual(undefined)).toEqual(fallback);
  });
});
