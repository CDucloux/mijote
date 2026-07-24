import { describe, it, expect } from "vitest";
import { buildRecipePdfHtml } from "../recipePdf.js";

const DB = [
  { id: "courgette", name: "Courgette", category: "vegetable" },
  { id: "boeuf", name: "Bœuf", category: "meat" },
];

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
    expect(html).not.toContain("Vegan");
  });

  it("superpose les badges sur l'image quand il y en a une", () => {
    const html = buildRecipePdfHtml(
      { name: "Pizza", category: "pizza", cuisine: "Italienne", image: "http://x/img.jpg", ingredients: [{ name: "Courgette" }] },
      { ingredientDB: DB }
    );
    expect(html).toContain("hero-badges");     // conteneur superposé sur l'image
    expect(html).toContain("hbadge-vegan");    // badge vegan style app
    expect(html).toContain("Italienne");
    expect(html).not.toContain('<div class="tags">'); // pas de repli sous le titre
  });
});
