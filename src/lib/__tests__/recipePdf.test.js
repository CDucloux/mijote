import { describe, it, expect } from "vitest";
import { buildRecipePdfHtml, pdfFileName } from "../recipePdf.js";

const DB = [
  { id: "courgette", name: "Courgette", category: "vegetable" },
  { id: "boeuf", name: "Bœuf", category: "meat" },
];

describe("pdfFileName", () => {
  it("génère un nom de fichier .pdf sans accents ni espaces", () => {
    expect(pdfFileName({ name: "Soupe à la tomate d'Ottolenghi" })).toBe("soupe-a-la-tomate-d-ottolenghi.pdf");
  });
  it("retombe sur un nom par défaut si le titre est vide", () => {
    expect(pdfFileName({})).toBe("recette.pdf");
  });
});

describe("buildRecipePdfHtml – tags de tête", () => {
  it("affiche le type de recette et la cuisine", () => {
    const html = buildRecipePdfHtml(
      { name: "Pizza", category: "pizza", cuisine: "Italienne", ingredients: [{ name: "Courgette" }] },
      { ingredientDB: DB }
    );
    expect(html).toContain("Pizza");
    expect(html).toContain("Italienne");
  });

  it("ajoute le tag Vegan quand la recette est vegan", () => {
    const html = buildRecipePdfHtml(
      { name: "Poêlée", ingredients: [{ name: "Courgette" }] },
      { ingredientDB: DB }
    );
    expect(html).toContain("Vegan");
  });

  it("n'affiche pas le tag Vegan quand un ingrédient est d'origine animale", () => {
    const html = buildRecipePdfHtml(
      { name: "Bœuf braisé", ingredients: [{ name: "Bœuf" }] },
      { ingredientDB: DB }
    );
    expect(html).not.toContain(">Vegan<");
  });
});
