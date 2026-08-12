import { describe, it, expect } from "vitest";
import {
  matchCuisine, matchCategory, extractOgImage, assignIdsAndLink, collectUtensils, filterUtensilsToKnown, htmlToText, imageUrlsInText,
} from "../recipeExtract.js";

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
    const r = assignIdsAndLink(inter);
    expect(r.ingredients[0].id).toBe("i0");
    expect(r.ingredients[0]._raw).toBe("1 pastèque");
    expect(r.utensils[0].id).toBe("u0");
    expect(r.steps[0].ingredients).toContain("i0"); // pastèque détectée dans le texte
    expect(r.steps[1].ingredients).toContain("i1"); // feta (explicite)
    expect(r.steps[1].utensils).toContain("u0");    // saladier (texte)
    expect(r.cuisine).toBe("Grecque");
  });
  it("cloisonne le linkage par section : une étape d'un groupe ne lie pas l'homonyme d'un autre groupe", () => {
    // « huile d'olive » et « sel » existent dans DEUX sous-préparations. Une étape du
    // groupe « Croûtons » ne doit relier QUE l'huile/sel de sa propre section.
    const inter = {
      ingredients: [
        { name: "huile d'olive", amount: 50, unit: "g", group: "Vinaigrette" }, // i0
        { name: "sel", amount: 3, unit: "g", group: "Vinaigrette" },            // i1
        { name: "pain", amount: 75, unit: "g", group: "Croûtons" },             // i2
        { name: "huile d'olive", amount: 15, unit: "g", group: "Croûtons" },    // i3
        { name: "sel", amount: 2, unit: "g", group: "Croûtons" },               // i4
      ],
      utensils: [],
      steps: [
        { text: "Verser le vinaigre, ajouter le sel puis l'huile d'olive.", group: "Vinaigrette", ingredients: ["sel", "huile d'olive"], utensils: [] },
        { text: "Arroser le pain d'huile d'olive et de sel, enfourner.", group: "Croûtons", ingredients: ["pain", "huile d'olive", "sel"], utensils: [] },
      ],
    };
    const r = assignIdsAndLink(inter);
    // Étape Vinaigrette : sel + huile de la vinaigrette uniquement.
    expect([...r.steps[0].ingredients].sort()).toEqual(["i0", "i1"]);
    // Étape Croûtons : pain + huile + sel de la section Croûtons uniquement (jamais i0/i1).
    expect([...r.steps[1].ingredients].sort()).toEqual(["i2", "i3", "i4"]);
  });
  it("une étape hors-section peut lier des ingrédients de n'importe quel groupe (montage)", () => {
    const inter = {
      ingredients: [
        { name: "pâte", amount: 1, group: "La pâte" },      // i0
        { name: "crème", amount: 1, group: "La crème" },    // i1
      ],
      utensils: [],
      steps: [{ text: "Garnir la pâte de crème et servir.", group: "", ingredients: ["pâte", "crème"], utensils: [] }],
    };
    const r = assignIdsAndLink(inter);
    expect([...r.steps[0].ingredients].sort()).toEqual(["i0", "i1"]);
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
  it("accorde l'unité au pluriel dans _raw (stockage reste au singulier)", () => {
    const r = assignIdsAndLink({ ingredients: [
      { name: "ail", amount: 2, unit: "gousse" },
      { name: "huile d'olive", amount: 3, unit: "cuillère à soupe" },
    ], utensils: [], steps: [] });
    expect(r.ingredients[0]._raw).toBe("2 gousses ail");
    expect(r.ingredients[0].unit).toBe("gousse");
    expect(r.ingredients[1]._raw).toBe("3 cuillères à soupe huile d'olive");
  });
  it("retire l'unité implicite « pièce » (« 1 oignon », pas « 1 pièce oignon »)", () => {
    const r = assignIdsAndLink({ ingredients: [{ name: "oignon", amount: 1, unit: "pièce" }], utensils: [], steps: [] });
    expect(r.ingredients[0]._raw).toBe("1 oignon");
    expect(r.ingredients[0].unit).toBeUndefined();
  });
  it("retire le mot de mesure resté dans le nom (« gousse d'ail » → « ail »)", () => {
    // unité déjà « gousse » ET nom « gousse d'ail » → pas de doublon, nom nettoyé.
    const withUnit = assignIdsAndLink({ ingredients: [{ name: "gousse d'ail", amount: 2, unit: "gousse" }], utensils: [], steps: [] });
    expect(withUnit.ingredients[0].name).toBe("ail");
    expect(withUnit.ingredients[0].unit).toBe("gousse");
    expect(withUnit.ingredients[0]._raw).toBe("2 gousses ail");
    // unité absente → promue depuis le mot de mesure du nom.
    const noUnit = assignIdsAndLink({ ingredients: [{ name: "tranche de pain", amount: 3 }], utensils: [], steps: [] });
    expect(noUnit.ingredients[0].name).toBe("pain");
    expect(noUnit.ingredients[0].unit).toBe("tranche");
    expect(noUnit.ingredients[0]._raw).toBe("3 tranches pain");
    // faux positif à éviter : « blanc de poulet » n'est pas une mesure.
    const keep = assignIdsAndLink({ ingredients: [{ name: "blanc de poulet", amount: 2 }], utensils: [], steps: [] });
    expect(keep.ingredients[0].name).toBe("blanc de poulet");
  });
  it("accorde le NOM au pluriel quand l'ingrédient est comptable (sans unité)", () => {
    const r = assignIdsAndLink({ ingredients: [
      { name: "oignon", amount: 2, unit: "pièce" },  // pièce retirée → comptable
      { name: "œuf", amount: 4 },
      { name: "poireau", amount: 3 },
      { name: "tomate", amount: 800, unit: "g" },    // masse → nom au singulier
    ], utensils: [], steps: [] });
    expect(r.ingredients[0]._raw).toBe("2 oignons");
    expect(r.ingredients[0].name).toBe("oignon");    // stockage singulier
    expect(r.ingredients[1]._raw).toBe("4 œufs");
    expect(r.ingredients[2]._raw).toBe("3 poireaux");
    expect(r.ingredients[3]._raw).toBe("800 g tomate");
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
