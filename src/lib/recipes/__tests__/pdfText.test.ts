import { describe, it, expect } from "vitest";
import { normalizePdfText, hasUsablePdfText, MIN_PDF_TEXT_LEN } from "../pdfText.js";

describe("normalizePdfText", () => {
  it("réduit les espaces multiples et insécables", () => {
    expect(normalizePdfText(["Farine   T55 500 g"])).toBe("Farine T55 500 g");
  });
  it("nettoie les espaces autour des sauts de ligne et limite les lignes vides", () => {
    expect(normalizePdfText(["Titre \n\n\n  Étape 1  \n"])).toBe("Titre\n\nÉtape 1");
  });
  it("assemble plusieurs pages par une ligne vide et ignore les pages vides", () => {
    expect(normalizePdfText(["Page 1", "   ", "Page 2"])).toBe("Page 1\n\nPage 2");
  });
  it("renvoie une chaîne vide pour une entrée vide ou nulle", () => {
    expect(normalizePdfText([])).toBe("");
    expect(normalizePdfText(["", "   "])).toBe("");
  });
});

describe("hasUsablePdfText", () => {
  it("rejette un texte trop court (PDF scanné)", () => {
    expect(hasUsablePdfText("x".repeat(MIN_PDF_TEXT_LEN - 1))).toBe(false);
    expect(hasUsablePdfText("")).toBe(false);
  });
  it("accepte un texte assez fourni", () => {
    expect(hasUsablePdfText("x".repeat(MIN_PDF_TEXT_LEN))).toBe(true);
  });
});
