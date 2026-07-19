import { describe, it, expect } from "vitest";
import {
  isoDurationToMinutes, parseIngredientLine, extractJsonLdRecipe,
  mapJsonLdToMijote, flattenInstructions, htmlToText,
} from "./recipeExtract.js";

describe("isoDurationToMinutes", () => {
  it("convertit PT#H#M", () => {
    expect(isoDurationToMinutes("PT30M")).toBe(30);
    expect(isoDurationToMinutes("PT1H30M")).toBe(90);
    expect(isoDurationToMinutes("PT2H")).toBe(120);
  });
  it("renvoie null si vide/invalide", () => {
    expect(isoDurationToMinutes("")).toBe(null);
    expect(isoDurationToMinutes(42)).toBe(null);
  });
});

describe("parseIngredientLine", () => {
  it("sépare quantité, unité et nom", () => {
    expect(parseIngredientLine("200 g de farine")).toEqual({ name: "farine", amount: 200, unit: "g" });
  });
  it("gère les fractions", () => {
    expect(parseIngredientLine("1/2 cuillère à café de cannelle")).toEqual({ name: "cannelle", amount: 0.5, unit: "cuillère à café" });
  });
  it("sans quantité → nom seul", () => {
    expect(parseIngredientLine("sel")).toEqual({ name: "sel" });
  });
  it("nombre sans unité", () => {
    expect(parseIngredientLine("3 pommes")).toEqual({ name: "pommes", amount: 3 });
  });
});

describe("flattenInstructions", () => {
  it("aplati les HowToStep", () => {
    const steps = flattenInstructions([{ "@type": "HowToStep", text: "A" }, { "@type": "HowToStep", text: "B" }]);
    expect(steps).toEqual([{ text: "A" }, { text: "B" }]);
  });
  it("aplati les HowToSection", () => {
    const steps = flattenInstructions([{ "@type": "HowToSection", itemListElement: [{ "@type": "HowToStep", text: "X" }] }]);
    expect(steps).toEqual([{ text: "X" }]);
  });
  it("gère une chaîne multi-lignes", () => {
    expect(flattenInstructions("Étape 1\nÉtape 2")).toEqual([{ text: "Étape 1" }, { text: "Étape 2" }]);
  });
});

describe("extractJsonLdRecipe + mapJsonLdToMijote", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", name: "page" },
      { "@type": "Recipe", name: "Crêpes", prepTime: "PT10M", cookTime: "PT20M", recipeYield: "4 personnes",
        recipeIngredient: ["250 g de farine", "3 œufs"], recipeInstructions: [{ "@type": "HowToStep", text: "Mélanger." }] },
    ],
  })}</script>`;

  it("trouve la recette dans un @graph", () => {
    const r = extractJsonLdRecipe(html);
    expect(r?.name).toBe("Crêpes");
  });
  it("mappe vers le schéma Mijoté", () => {
    const draft = mapJsonLdToMijote(extractJsonLdRecipe(html), "https://x");
    expect(draft.name).toBe("Crêpes");
    expect(draft.prepTime).toBe(10);
    expect(draft.cookTime).toBe(20);
    expect(draft.servings).toBe(4);
    expect(draft.source).toBe("https://x");
    expect(draft.ingredients).toHaveLength(2);
    expect(draft.steps).toEqual([{ text: "Mélanger." }]);
  });
  it("renvoie null sans bloc Recipe", () => {
    expect(extractJsonLdRecipe("<html>rien</html>")).toBe(null);
  });
});

describe("htmlToText", () => {
  it("retire scripts, styles et balises", () => {
    const t = htmlToText("<style>a{}</style><script>x()</script><p>Bonjour</p><div>Monde</div>");
    expect(t).toContain("Bonjour");
    expect(t).toContain("Monde");
    expect(t).not.toContain("x()");
  });
});
