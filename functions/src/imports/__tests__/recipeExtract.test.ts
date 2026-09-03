import { describe, it, expect } from "vitest";
import {
  matchCuisine, matchCategory, matchBaseCategory, validateYield, extractOgImage, assignIdsAndLink, collectUtensils, filterUtensilsToKnown, htmlToText, imageUrlsInText, stripComments,
  parseApplianceInfos, formatAppliancesForPrompt, canonicalizeUnit, sanitizeCut,
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

describe("matchBaseCategory", () => {
  it("ne garde qu'une famille de base valide, accents/casse tolérés", () => {
    expect(matchBaseCategory("appareil")).toBe("appareil");
    expect(matchBaseCategory("Pâte")).toBe("pate"); // accent retiré → id sans accent
    expect(matchBaseCategory("sauce")).toBe("sauce");
    expect(matchBaseCategory("dessert")).toBe(""); // rôle dans le repas, pas une base
    expect(matchBaseCategory("")).toBe("");
  });
});

describe("validateYield", () => {
  it("normalise un rendement exploitable (montant entier, unité fermée)", () => {
    expect(validateYield({ amount: "400", unit: "g" })).toEqual({ amount: 400, unit: "g" });
    expect(validateYield({ amount: 1, unit: "pièce" })).toEqual({ amount: 1, unit: "pièce" });
    expect(validateYield({ amount: "250,5", unit: "ml" })).toEqual({ amount: 251, unit: "ml" });
  });
  it("retombe sur { 0, g } quand le rendement est inexploitable", () => {
    expect(validateYield({ amount: 0, unit: "g" })).toEqual({ amount: 0, unit: "g" });
    expect(validateYield({ amount: "abc", unit: "cuillère" })).toEqual({ amount: 0, unit: "g" });
    expect(validateYield(null)).toEqual({ amount: 0, unit: "g" });
    expect(validateYield({ amount: 5 })).toEqual({ amount: 5, unit: "g" }); // unité absente → g
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
  it("classe une base (isComponent) : catégorie de la famille de base, yield validé, pas de rôle repas", () => {
    const r = assignIdsAndLink({
      name: "Caramel beurre salé", isComponent: true, baseCategory: "appareil",
      yield: { amount: "300", unit: "g" }, category: "dessert", // category (rôle repas) ignorée pour une base
      ingredients: [{ name: "sucre", amount: 200, unit: "g" }, { name: "beurre", amount: 100, unit: "g" }],
      utensils: [], steps: [],
    });
    expect(r.isComponent).toBe(true);
    expect(r.category).toBe("appareil");
    expect(r.yield).toEqual({ amount: 300, unit: "g" });
  });
  it("base à famille inconnue : reste une base sans catégorie (utilisateur choisit)", () => {
    const r = assignIdsAndLink({ name: "Base", isComponent: true, baseCategory: "truc", yield: { amount: 0, unit: "g" }, ingredients: [{ name: "eau", amount: 1 }], utensils: [], steps: [] });
    expect(r.isComponent).toBe(true);
    expect(r.category).toBe("");
    expect(r.yield).toEqual({ amount: 0, unit: "g" });
  });
  it("recette normale (isBase absent) : pas de isComponent ni yield, catégorie de plat", () => {
    const r = assignIdsAndLink({ name: "Tarte au citron", category: "tarte", ingredients: [{ name: "citron", amount: 3 }], utensils: [], steps: [] });
    expect(r.isComponent).toBeUndefined();
    expect(r.yield).toBeUndefined();
    expect(r.category).toBe("tarte");
  });
  it("sauce mère (base) vs sauce d'accompagnement (plat) : isComponent tranche", () => {
    const base = assignIdsAndLink({ name: "Béchamel", isComponent: true, baseCategory: "sauce", yield: { amount: 500, unit: "ml" }, ingredients: [{ name: "lait", amount: 500, unit: "ml" }], utensils: [], steps: [] });
    expect(base.isComponent).toBe(true);
    expect(base.category).toBe("sauce");
    const plat = assignIdsAndLink({ name: "Sauce tomate express", category: "sauce", ingredients: [{ name: "tomate", amount: 400, unit: "g" }], utensils: [], steps: [] });
    expect(plat.isComponent).toBeUndefined();
    expect(plat.category).toBe("sauce");
  });
  it("re-clé les réglages d'appareils par nom → id d'ustensile, borné aux ustensiles liés à l'étape", () => {
    const inter = {
      ingredients: [], utensils: [{ name: "Four" }, { name: "Saladier" }],
      steps: [
        { text: "Enfourner le gratin.", utensils: ["Four"], utensilParams: { Four: { temperature: 210, mode: "tournante" } } },
        { text: "Mélanger dans le saladier.", utensils: ["Saladier"], utensilParams: { Four: { temperature: 180 } } },
      ],
    };
    const r = assignIdsAndLink(inter);
    // u0 = Four, u1 = Saladier
    expect(r.steps[0].utensilParams).toEqual({ u0: { temperature: 210, mode: "tournante" } });
    // Le Four n'est pas lié à l'étape 2 : ses réglages y sont ignorés.
    expect(r.steps[1].utensilParams).toBeUndefined();
  });
  it("nom d'appareil rapproché malgré accents/casse ; aucun réglage → pas de champ", () => {
    const inter = {
      ingredients: [], utensils: [{ name: "Air fryer" }],
      steps: [
        { text: "Cuire.", utensils: ["Air fryer"], utensilParams: { "air fryer": { temperature: 200 } } },
        { text: "Servir.", utensils: ["Air fryer"], utensilParams: { "Air fryer": {} } },
      ],
    };
    const r = assignIdsAndLink(inter);
    expect(r.steps[0].utensilParams).toEqual({ u0: { temperature: 200 } });
    expect(r.steps[1].utensilParams).toBeUndefined();
  });
});

describe("parseApplianceInfos", () => {
  it("valide et borne les descripteurs d'appareils, écarte le vide", () => {
    const out = parseApplianceInfos([
      { name: "Four", fields: [{ key: "temperature", label: "Température", kind: "number", unit: "°C" }, { key: "", label: "x", kind: "number" }] },
      { name: "", fields: [{ key: "vitesse", label: "V", kind: "enum", options: ["max"] }] }, // sans nom → écarté
      { name: "Blender", fields: [] }, // sans réglage → écarté
    ]);
    expect(out).toEqual([{ name: "Four", fields: [{ key: "temperature", label: "Température", kind: "number", unit: "°C" }] }]);
  });
  it("retourne un tableau vide pour une valeur non-tableau", () => {
    expect(parseApplianceInfos(undefined)).toEqual([]);
    expect(parseApplianceInfos("x")).toEqual([]);
    expect(parseApplianceInfos({})).toEqual([]);
  });
});

describe("formatAppliancesForPrompt", () => {
  it("rend une ligne par appareil, avec type/valeurs des réglages", () => {
    const out = formatAppliancesForPrompt([
      { name: "Four", fields: [
        { key: "prechauffage", label: "Préchauffage", kind: "bool" },
        { key: "temperature", label: "Température", kind: "number", unit: "°C" },
        { key: "mode", label: "Mode", kind: "enum", options: ["tournante", "statique"] },
      ] },
    ]);
    expect(out).toContain("- Four : prechauffage (true/false) ; temperature (nombre, °C) ; mode (tournante|statique)");
  });
  it("(aucun) quand la base ne contient aucun appareil", () => {
    expect(formatAppliancesForPrompt([])).toBe("(aucun)");
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

describe("stripComments", () => {
  const recipe = "<article><p>Faire mijoter 4 heures.</p></article>";
  const comments = "<p>Super recette, testée et approuvée !</p><p>Merci Valérie.</p>";

  it("coupe la section commentaires Blogger (guillemets simples)", () => {
    const out = stripComments(`${recipe}<div class='comments' id='comments'>${comments}</div>`);
    expect(out).toContain("mijoter 4 heures");
    expect(out).not.toContain("Super recette");
  });
  it("coupe la section commentaires WordPress (id=comments, guillemets doubles)", () => {
    const out = stripComments(`${recipe}<div id="comments" class="comments-area">${comments}</div>`);
    expect(out).toContain("mijoter 4 heures");
    expect(out).not.toContain("Merci Valérie");
  });
  it("coupe un fil Disqus", () => {
    const out = stripComments(`${recipe}<div id="disqus_thread">${comments}</div>`);
    expect(out).not.toContain("Super recette");
  });
  it("coupe une liste de commentaires WordPress (ol.comment-list) sans conteneur id", () => {
    const out = stripComments(`${recipe}<ol class="comment-list">${comments}</ol>`);
    expect(out).not.toContain("Super recette");
  });
  it("ne touche à rien quand il n'y a pas de section commentaires connue", () => {
    const html = `${recipe}<footer>Mentions légales</footer>`;
    expect(stripComments(html)).toBe(html);
  });
  it("ne tronque PAS sur un lien « 23 commentaires » en tête d'article", () => {
    // Piège classique : un lien vers les commentaires placé AVANT la recette. Sa
    // valeur de classe n'est pas exactement « comments », il ne doit rien couper.
    const out = stripComments(`<a href="#comments" class="comment-link">23 commentaires</a>${recipe}`);
    expect(out).toContain("mijoter 4 heures");
  });
});

describe("htmlToText", () => {
  it("laisse tomber les commentaires de lecteurs (bruit coûteux)", () => {
    const t = htmlToText("<article><p>Étape unique.</p></article><div id='comments'><p>Trop bon merci !</p></div>");
    expect(t).toContain("Étape unique");
    expect(t).not.toContain("Trop bon merci");
  });
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

describe("canonicalizeUnit", () => {
  it("rabat les cuillères impériales sur l'unité fermée (1:1)", () => {
    expect(canonicalizeUnit("tsp")).toBe("cuillère à café");
    expect(canonicalizeUnit("teaspoon")).toBe("cuillère à café");
    expect(canonicalizeUnit("tbsp")).toBe("cuillère à soupe");
    expect(canonicalizeUnit("tablespoons")).toBe("cuillère à soupe");
  });
  it("rabat les abréviations françaises (accents, points, casse)", () => {
    expect(canonicalizeUnit("c. à c.")).toBe("cuillère à café");
    expect(canonicalizeUnit("càc")).toBe("cuillère à café");
    expect(canonicalizeUnit("C. À S.")).toBe("cuillère à soupe");
    expect(canonicalizeUnit("cas")).toBe("cuillère à soupe");
  });
  it("laisse passer les unités déjà valides et l'unité vide", () => {
    expect(canonicalizeUnit("g")).toBe("g");
    expect(canonicalizeUnit("ml")).toBe("ml"); // on ne devine pas la cuillère depuis un volume
    expect(canonicalizeUnit("cuillère à soupe")).toBe("cuillère à soupe");
    expect(canonicalizeUnit("")).toBe("");
    expect(canonicalizeUnit(undefined)).toBe("");
  });
  it("est appliqué à l'assemblage : un tsp du LLM ressort en cuillère à café", () => {
    const r = assignIdsAndLink({ ingredients: [{ name: "cumin", amount: 1, unit: "tsp" }], utensils: [], steps: [] });
    expect(r.ingredients[0].unit).toBe("cuillère à café");
  });
});

describe("sanitizeCut", () => {
  it("borne une chaîne en objet { forme }", () => {
    expect(sanitizeCut("émincé")).toEqual({ forme: "émincé" });
  });
  it("borne un objet { forme, calibre } sans les inventer", () => {
    expect(sanitizeCut({ forme: "brunoise", calibre: "fin" })).toEqual({ forme: "brunoise", calibre: "fin" });
    expect(sanitizeCut({ forme: "des" })).toEqual({ forme: "des" });
  });
  it("écarte le calibre non textuel et tronque les longueurs", () => {
    expect(sanitizeCut({ forme: "hache", calibre: 3 })).toEqual({ forme: "hache" });
    expect(sanitizeCut("x".repeat(80)).forme).toHaveLength(40);
  });
  it("→ undefined si pas de forme exploitable", () => {
    expect(sanitizeCut("")).toBeUndefined();
    expect(sanitizeCut(null)).toBeUndefined();
    expect(sanitizeCut({ calibre: "fin" })).toBeUndefined();
    expect(sanitizeCut(["emince"])).toBeUndefined();
  });
});

describe("assignIdsAndLink : découpe (cut)", () => {
  it("transporte la découpe brute de l'ingrédient (narrowing fait côté client)", () => {
    const r = assignIdsAndLink({ ingredients: [{ name: "oignon", amount: 2, cut: { forme: "emince" } }], utensils: [], steps: [] });
    expect(r.ingredients[0].cut).toEqual({ forme: "emince" });
  });
  it("pas de découpe → pas de champ cut", () => {
    const r = assignIdsAndLink({ ingredients: [{ name: "farine", amount: 250, unit: "g" }], utensils: [], steps: [] });
    expect(r.ingredients[0].cut).toBeUndefined();
  });
});
