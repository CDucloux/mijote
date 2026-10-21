import { describe, it, expect } from "vitest";
import { normalizeName, findIngredientMatch, buildNameMatcher, createIngredientResolver, resolveLineEntry } from "@/lib/food/nameMatcher.js";

const db = [
  { id: "ail", name: "Ail" },
  { id: "huile-olive", name: "Huile d'olive" },
  { id: "tomate", name: "Tomate" },
  { id: "oignon", name: "Oignon", aliases: ["échalote grise"] },
  { id: "poivre-noir", name: "Poivre noir" },
];

describe("normalizeName", () => {
  it("lowercases, strips accents and punctuation, compacts spaces", () => {
    expect(normalizeName("Huile d'olive")).toBe("huile d olive");
    expect(normalizeName("  Crème   Fraîche ")).toBe("creme fraiche");
  });
});

describe("findIngredientMatch", () => {
  it("A – exact normalized match", () => {
    expect(findIngredientMatch("ail", db).id).toBe("ail");
    expect(findIngredientMatch("Huile d'olive", db).id).toBe("huile-olive");
  });

  it("B – singular/plural match", () => {
    expect(findIngredientMatch("Tomates", db).id).toBe("tomate");
  });

  it("C – canonical match strips preparation qualifiers and word order", () => {
    // "tomate" + qualifier "concassée" → still matches tomate
    expect(findIngredientMatch("tomates concassées", db).id).toBe("tomate");
    // word order indifferent on "ail" with qualifier
    expect(findIngredientMatch("ail émincé", db).id).toBe("ail");
  });

  it("matches via aliases", () => {
    expect(findIngredientMatch("échalote grise", db).id).toBe("oignon");
  });

  it("does NOT strip variety words (noir) – keeps distinct ingredients", () => {
    expect(findIngredientMatch("poivre noir", db).id).toBe("poivre-noir");
  });

  it("returns null on no match", () => {
    expect(findIngredientMatch("safran", db)).toBeNull();
  });

  it("returns null on empty inputs", () => {
    expect(findIngredientMatch("", db)).toBeNull();
    expect(findIngredientMatch("ail", [])).toBeNull();
  });
});

describe("buildNameMatcher", () => {
  it("returns a resolver mapping name → id (or empty string)", () => {
    const match = buildNameMatcher(db);
    expect(match("Tomates")).toBe("tomate");
    expect(match("inconnu")).toBe("");
  });
});

describe("createIngredientResolver", () => {
  it("returns the resolved item object or null", () => {
    const resolve = createIngredientResolver(db);
    expect(resolve("ail")).toMatchObject({ id: "ail" });
    expect(resolve("")).toBeNull();
  });
});

describe("resolveLineEntry", () => {
  const db = [
    { id: "egg", name: "Oeuf", aliases: ["œuf"] },
    { id: "yolk", name: "Jaune d'oeuf", aliases: ["jaune d'œuf", "jaunes d'œufs"], image: "yolk.png" },
  ];

  it("privilégie le dbId figé quand il existe dans la base", () => {
    expect(resolveLineEntry("egg", "Jaune d'œuf", db)?.id).toBe("egg");
  });
  it("rattache par le nom une ligne enregistrée avant l'ajout de l'ingrédient (non-régression)", () => {
    expect(resolveLineEntry("", "Jaunes d'œuf", db)?.image).toBe("yolk.png");
    expect(resolveLineEntry(undefined, "Jaunes d'œuf", db)?.id).toBe("yolk");
  });
  it("ignore un dbId orphelin et retombe sur le nom", () => {
    expect(resolveLineEntry("deleted", "jaune d'oeuf", db)?.id).toBe("yolk");
  });
  it("utilise le résolveur fourni", () => {
    expect(resolveLineEntry("", "x", db, () => db[0])?.id).toBe("egg");
  });
  it("null sans nom ni dbId valide, ou base vide", () => {
    expect(resolveLineEntry("", "", db)).toBeNull();
    expect(resolveLineEntry("deleted", null, db)).toBeNull();
    expect(resolveLineEntry("", "Oeuf", null)).toBeNull();
    expect(resolveLineEntry("", "Inconnu", db)).toBeNull();
  });
});

describe("qualificatif « fin/fine » ignoré", () => {
  const db = [{ id: "chap", name: "Chapelure" }, { id: "sel", name: "Sel" }];
  it("« Chapelure fine » se rattache à Chapelure (non-régression)", () => {
    expect(findIngredientMatch("Chapelure fine", db)?.id).toBe("chap");
    expect(findIngredientMatch("sel fin", db)?.id).toBe("sel");
  });
  it("une entrée nommée avec « fine » reste prioritaire au palier exact", () => {
    const withFine = [...db, { id: "chapf", name: "Chapelure fine" }];
    expect(findIngredientMatch("Chapelure fine", withFine)?.id).toBe("chapf");
  });
});

describe("qualificatif « entier/entière » ignoré", () => {
  const db = [
    { id: "lait", name: "Lait entier", aliases: ["lait"] },
    { id: "laitde", name: "Lait demi-écrémé" },
    { id: "poulet", name: "Poulet" },
    { id: "noisette", name: "Noisette" },
  ];
  it("« poulet entier », « noisettes entières » se rattachent à l'ingrédient de base", () => {
    expect(findIngredientMatch("poulet entier", db)?.id).toBe("poulet");
    expect(findIngredientMatch("noisettes entières", db)?.id).toBe("noisette");
  });
  it("« Lait entier » reste distinct du demi-écrémé", () => {
    expect(findIngredientMatch("lait entier", db)?.id).toBe("lait");
    expect(findIngredientMatch("lait demi-écrémé", db)?.id).toBe("laitde");
  });
});

describe("contrat générique du rapprochement", () => {
  it("rend l'entrée de la base telle quelle (mêmes champs, même instance)", () => {
    const tomate = { id: "tomate", name: "Tomate", category: "vegetable", months: [7, 8] };
    expect(createIngredientResolver([tomate])("tomates")).toBe(tomate);
    expect(findIngredientMatch("Tomate", [tomate])).toBe(tomate);
  });
  it("ignore une entrée sans nom au lieu de la rendre", () => {
    expect(findIngredientMatch("tomate", [{ id: "x" }])).toBeNull();
    expect(resolveLineEntry(undefined, "tomate", [{ id: "x" }])).toBeNull();
  });
});
