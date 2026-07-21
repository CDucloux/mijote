import { describe, it, expect } from "vitest";
import {
  matchCuisine, matchCategory, extractOgImage, assignIdsAndLink, filterUtensilsToKnown, htmlToText, imageUrlsInText,
} from "./recipeExtract.js";

describe("matchCategory", () => {
  it("ne garde qu'un id de catégorie valide", () => {
    expect(matchCategory("dessert")).toBe("dessert");
    expect(matchCategory("Dessert")).toBe("dessert");
    expect(matchCategory("plat principal")).toBe("");
    expect(matchCategory("")).toBe("");
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
      ingredients: [{ name: "pastèque", amount: 1 }, { name: "feta", amount: 200, unit: "g" }],
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
    expect(r.steps[0].ingredients).toContain("i0"); // pastèque détectée dans le texte
    expect(r.steps[1].ingredients).toContain("i1"); // feta (explicite)
    expect(r.steps[1].utensils).toContain("u0");    // saladier (texte)
    expect(r.cuisine).toBe("Grecque");
  });
  it("porte l'image d'étape et ne lie pas par faux positif de sous-chaîne", () => {
    const inter = { ingredients: [{ name: "sel" }], utensils: [], steps: [{ text: "Ciseler le persil.", image: "https://x/s.jpg" }] };
    const r = assignIdsAndLink(inter);
    expect(r.steps[0].ingredients).toEqual([]); // "sel" ⊄ "persil"
    expect(r.steps[0].image).toBe("https://x/s.jpg");
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
