import { describe, it, expect } from "vitest";
import {
  isoDurationToMinutes, parseIngredientLine, extractJsonLdRecipe,
  mapJsonLdToMijote, flattenInstructions, htmlToText,
  matchCuisine, extractOgImage, assignIdsAndLink, filterUtensilsToKnown, imageUrlsInText,
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
  it("sépare quantité, unité et nom + conserve _raw", () => {
    expect(parseIngredientLine("200 g de farine")).toEqual({ name: "farine", _raw: "200 g de farine", amount: 200, unit: "g" });
  });
  it("gère les fractions", () => {
    expect(parseIngredientLine("1/2 cuillère à café de cannelle")).toEqual({ name: "cannelle", _raw: "1/2 cuillère à café de cannelle", amount: 0.5, unit: "cuillère à café" });
  });
  it("sans quantité → nom seul", () => {
    expect(parseIngredientLine("sel")).toEqual({ name: "sel", _raw: "sel" });
  });
  it("nombre sans unité", () => {
    expect(parseIngredientLine("3 pommes")).toEqual({ name: "pommes", _raw: "3 pommes", amount: 3 });
  });
});

describe("matchCuisine", () => {
  it("rapproche du label canonique", () => {
    expect(matchCuisine("française")).toBe("Française");
    expect(matchCuisine("Cuisine grecque")).toBe("Grecque");
  });
  it("renvoie \"\" si aucune correspondance", () => {
    expect(matchCuisine("martienne")).toBe("");
    expect(matchCuisine("")).toBe("");
  });
});

describe("extractOgImage", () => {
  it("récupère l'og:image du head", () => {
    expect(extractOgImage('<meta property="og:image" content="https://x/p.jpg">')).toBe("https://x/p.jpg");
  });
  it("\"\" si absente", () => {
    expect(extractOgImage("<head></head>")).toBe("");
  });
});

describe("assignIdsAndLink", () => {
  it("assigne des ids et lie ingrédients/ustensiles aux étapes", () => {
    const inter = {
      name: "Test", prepTime: 10, cookTime: 20, servings: 4, cuisine: "Grecque",
      ingredients: [{ name: "pastèque", amount: 1, _raw: "1 pastèque" }, { name: "feta", amount: 200, unit: "g", _raw: "200 g de feta" }],
      utensils: [{ name: "saladier" }],
      steps: [
        { text: "Couper la pastèque en cubes.", tip: "", ingredients: [], utensils: [] },
        { text: "Mélanger le tout dans un saladier avec la feta.", tip: "", ingredients: ["feta"], utensils: [] },
      ],
    };
    const r = assignIdsAndLink(inter);
    expect(r.ingredients[0].id).toBe("i0");
    expect(r.ingredients[0]._raw).toBe("1 pastèque");
    expect(r.utensils[0].id).toBe("u0");
    // étape 1 : pastèque détectée dans le texte
    expect(r.steps[0].ingredients).toContain("i0");
    // étape 2 : feta (explicite) + saladier (texte)
    expect(r.steps[1].ingredients).toContain("i1");
    expect(r.steps[1].utensils).toContain("u0");
    expect(r.cuisine).toBe("Grecque");
  });
  it("ne lie pas par faux positif de sous-chaîne", () => {
    const inter = { ingredients: [{ name: "sel" }], utensils: [], steps: [{ text: "Ciseler le persil." }] };
    const r = assignIdsAndLink(inter);
    expect(r.steps[0].ingredients).toEqual([]); // "sel" ⊄ "persil"
  });
  it("reconstruit _raw proprement à partir des champs", () => {
    const r = assignIdsAndLink({ ingredients: [{ name: "piment en poudre", amount: 1, unit: "pincée" }], utensils: [], steps: [] });
    expect(r.ingredients[0]._raw).toBe("1 pincée piment en poudre");
  });
});

describe("filterUtensilsToKnown", () => {
  const known = ["Saladier", "Four", "Couteau", "Poêle"];
  it("ne garde que les ustensiles connus (accents/casse/singulier tolérés)", () => {
    const out = filterUtensilsToKnown([{ name: "saladier" }, { name: "récipient inconnu" }, { name: "Couteaux" }], known);
    expect(out.map(u => u.name)).toEqual(["saladier", "Couteaux"]);
  });
  it("ne filtre pas si aucune liste connue fournie", () => {
    const arr = [{ name: "truc" }];
    expect(filterUtensilsToKnown(arr, [])).toBe(arr);
  });
});

describe("flattenInstructions", () => {
  it("aplati les HowToStep (+ image d'étape éventuelle)", () => {
    const steps = flattenInstructions([{ "@type": "HowToStep", text: "A", image: "https://x/a.jpg" }, { "@type": "HowToStep", text: "B" }]);
    expect(steps).toEqual([{ text: "A", image: "https://x/a.jpg" }, { text: "B", image: "" }]);
  });
  it("aplati les HowToSection", () => {
    const steps = flattenInstructions([{ "@type": "HowToSection", itemListElement: [{ "@type": "HowToStep", text: "X" }] }]);
    expect(steps).toEqual([{ text: "X", image: "" }]);
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
    expect(draft.steps).toEqual([{ text: "Mélanger.", image: "" }]);
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
  it("garde les images de contenu en marqueurs, ignore le décoratif", () => {
    const t = htmlToText('<p>Étape</p><img src="https://x/step1.jpg"><img src="https://x/logo.svg"><img data-src="https://x/step2.jpg" src="https://x/placeholder.png">');
    expect(t).toContain("⟦IMG:https://x/step1.jpg⟧");
    expect(t).toContain("⟦IMG:https://x/step2.jpg⟧"); // préfère data-src au placeholder
    expect(t).not.toContain("logo.svg");
    expect(imageUrlsInText(t).has("https://x/step1.jpg")).toBe(true);
  });
});
