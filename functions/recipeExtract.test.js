import { describe, it, expect } from "vitest";
import {
  matchCuisine, matchCategory, extractOgImage, assignIdsAndLink, collectUtensils, filterUtensilsToKnown, htmlToText, imageUrlsInText,
} from "./recipeExtract.js";

describe("collectUtensils", () => {
  it("réunit les ustensiles de tête ET ceux cités dans les étapes", () => {
    const d = {
      utensils: [{ name: "Four" }],
      steps: [
        { text: "…", utensils: ["Saladier", "Fouet"] },
        { text: "…", utensils: ["Four", "Saladier"] }, // doublons
      ],
    };
    const names = collectUtensils(d).map(u => u.name).sort();
    expect(names).toEqual(["Fouet", "Four", "Saladier"]);
  });
  it("récupère les ustensiles même si le tableau de tête est vide (modèle qui ne remplit que les étapes)", () => {
    const d = { utensils: [], steps: [{ text: "…", utensils: ["Moule à cake", "Batteur électrique"] }] };
    expect(collectUtensils(d).map(u => u.name).sort()).toEqual(["Batteur électrique", "Moule à cake"]);
  });
});

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
    const { recipe: r, components } = assignIdsAndLink(inter);
    expect(components).toEqual([]);
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
    const { recipe: r } = assignIdsAndLink(inter);
    expect(r.steps[0].ingredients).toEqual([]); // "sel" ⊄ "persil"
    expect(r.steps[0].image).toBe("https://x/s.jpg");
  });
  it("reconstruit _raw proprement à partir des champs", () => {
    const { recipe: r } = assignIdsAndLink({ ingredients: [{ name: "piment en poudre", amount: 1, unit: "pincée" }], utensils: [], steps: [] });
    expect(r.ingredients[0]._raw).toBe("1 pincée piment en poudre");
  });
});

describe("assignIdsAndLink — préparations de base (composants)", () => {
  const moussaka = {
    name: "Moussaka",
    components: [
      { name: "Kima", yield: { amount: 500, unit: "g" }, ingredients: [{ name: "bœuf haché", amount: 400, unit: "g" }, { name: "oignon", amount: 1 }], steps: [{ text: "Faire revenir le bœuf et l'oignon." }] },
      { name: "Béchamel", yield: { amount: 400, unit: "g" }, ingredients: [{ name: "beurre", amount: 40, unit: "g" }, { name: "farine", amount: 40, unit: "g" }, { name: "lait", amount: 400, unit: "ml" }], steps: [{ text: "Réaliser un roux puis délayer avec le lait." }] },
    ],
    ingredients: [
      { name: "aubergines", amount: 3 },
      { component: "Kima", amount: 500, unit: "g" },
      { component: "Béchamel", amount: 400, unit: "g" },
    ],
    utensils: [],
    steps: [{ text: "Monter la moussaka avec les aubergines, la kima et la béchamel, puis enfourner." }],
  };

  it("extrait les composants avec isComponent + yield + clé temporaire", () => {
    const { components } = assignIdsAndLink(moussaka);
    expect(components.map(c => c.name)).toEqual(["Kima", "Béchamel"]);
    expect(components.every(c => c.isComponent === true)).toBe(true);
    expect(components[0].yield).toEqual({ amount: 500, unit: "g" });
    expect(components.map(c => c._key)).toEqual(["cmp0", "cmp1"]);
    // Un composant ne contient que des ingrédients bruts (aucune ligne composant).
    expect(components[0].ingredients.every(i => !i.recipeId)).toBe(true);
  });

  it("résout les lignes composant de la principale (recipeId = clé temp, unité du rendement)", () => {
    const { recipe, components } = assignIdsAndLink(moussaka);
    const kima = recipe.ingredients.find(i => i.name === "Kima");
    const bech = recipe.ingredients.find(i => i.name === "Béchamel");
    expect(kima.recipeId).toBe(components[0]._key);
    expect(kima.dbId).toBeUndefined();      // ligne composant → pas de dbId
    expect(kima.unit).toBe("g");            // unité du rendement
    expect(bech.recipeId).toBe(components[1]._key);
    // L'ingrédient brut reste une ligne normale.
    expect(recipe.ingredients.find(i => i.name === "aubergines").dbId).toBe("");
  });

  it("défaut de rendement prudent si le LLM l'omet (> 0, sauvegardable)", () => {
    const { components } = assignIdsAndLink({
      name: "X", components: [{ name: "Sauce", ingredients: [{ name: "tomate", amount: 2 }], steps: [] }],
      ingredients: [{ component: "Sauce", amount: 1 }], steps: [],
    });
    expect(components[0].yield.amount).toBeGreaterThan(0);
  });

  it("retire des étapes principales les renvois « méta » à un composant", () => {
    const { recipe } = assignIdsAndLink({
      name: "Tarte au caramel",
      components: [{ name: "Caramel beurre salé", yield: { amount: 400, unit: "g" }, ingredients: [{ name: "sucre", amount: 200, unit: "g" }], steps: [{ text: "Faire un caramel à sec puis ajouter le beurre." }] }],
      ingredients: [{ component: "Caramel beurre salé", amount: 400, unit: "g" }],
      steps: [
        { text: "Préparer le caramel beurre salé selon la méthode décrite dans le composant." },
        { text: "Couler le caramel sur le fond de tarte et réserver au frais." },
      ],
    });
    expect(recipe.steps.map(s => s.text)).toEqual(["Couler le caramel sur le fond de tarte et réserver au frais."]);
  });

  it("ligne composant orpheline (composant introuvable) → repli en ligne brute inerte", () => {
    const { recipe } = assignIdsAndLink({
      name: "X", components: [], ingredients: [{ component: "Fantôme", amount: 100, unit: "g" }], steps: [],
    });
    expect(recipe.ingredients[0].recipeId).toBeUndefined();
    expect(recipe.ingredients[0].dbId).toBe("");
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
  it("rapproche sur un mot significatif commun", () => {
    const out = filterUtensilsToKnown([{ name: "Batteur électrique" }, { name: "Grand saladier" }], ["Batteur", "Saladier"]);
    expect(out.map(u => u.name)).toEqual(["Batteur électrique", "Grand saladier"]);
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
