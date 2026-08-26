import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  parseTechniquesYaml, parseIngredientsYaml, parseUtensilsYaml,
  formatTechniquesMarkdown, formatTechniquesYaml, formatIngredientsYaml, formatUtensilsYaml,
  slugifyId, TECHNIQUE_CATEGORIES, UTENSIL_CATEGORIES, buildTechniqueFromDraft,
} from "@/lib/household/dataYaml.js";

describe("slugifyId", () => {
  it("slugs and strips accents", () => {
    expect(slugifyId("tech_", "Déglacer")).toBe("tech_deglacer");
    expect(slugifyId("tech_", "Tailler en julienne")).toBe("tech_tailler_en_julienne");
  });
});

describe("parseTechniquesYaml", () => {
  it("parses a valid list and generates ids from names", () => {
    const { items, errors } = parseTechniquesYaml(`
- name: Suer
  category: cuisson
  definition: Cuire doucement sans coloration.
  aliases: [suer, Faire Suer]
`);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("tech_suer");
    expect(items[0].aliases).toEqual(["suer", "faire suer"]); // lowercased + deduped
  });

  it("omits absent optional fields (no undefined → Firestore-safe)", () => {
    const { items } = parseTechniquesYaml(`
- name: Blanchir
  category: cuisson
  definition: Plonger dans l'eau bouillante.
`);
    expect(items[0]).not.toHaveProperty("source");
    expect(items[0]).not.toHaveProperty("aliases");
    expect(Object.values(items[0]).every(v => v !== undefined)).toBe(true);
  });

  it("rejects unknown category and reports the entry", () => {
    const { items, errors } = parseTechniquesYaml(`
- name: Truc
  category: magie
  definition: x
`);
    expect(items).toEqual([]); // all-or-nothing
    expect(errors.join(" ")).toMatch(/magie/);
  });

  it("requires name and definition", () => {
    const { errors } = parseTechniquesYaml(`
- category: cuisson
`);
    expect(errors.join(" ")).toMatch(/name/);
    expect(errors.join(" ")).toMatch(/definition/);
  });

  it("flags duplicate ids", () => {
    const { errors } = parseTechniquesYaml(`
- id: tech_x
  name: A
  category: cuisson
  definition: a
- id: tech_x
  name: B
  category: cuisson
  definition: b
`);
    expect(errors.join(" ")).toMatch(/double/);
  });

  it("errors on non-list documents", () => {
    expect(parseTechniquesYaml("name: x").errors.length).toBeGreaterThan(0);
    expect(parseTechniquesYaml("").errors.length).toBeGreaterThan(0);
  });

  it("errors on invalid YAML", () => {
    expect(parseTechniquesYaml("- name: [unclosed").errors[0]).toMatch(/YAML invalide/);
  });
});

describe("parseTechniquesYaml (schema v2)", () => {
  const v2 = `
schema_version: 2
techniques:
  - id: tech_grp_hachage
    name: Hachage
    category: decoupe
    definition: Réduire en petits morceaux.
    hierarchy: { parent: null, level: 0 }
    expected_result:
      summary: L'aliment est réduit en éléments menus.
      observable_indicators: [Petits morceaux, Non écrasé]
    common_errors: []
    not_to_be_confused_with: []
  - id: tech_ciseler
    name: Ciseler
    category: decoupe
    definition: Tailler en petits dés.
    hierarchy: { parent: tech_grp_hachage, level: 1 }
    expected_result:
      summary: Des dés menus et réguliers.
      observable_indicators: [Dés homogènes]
    common_errors: [Écraser l'aliment, Dés irréguliers]
    not_to_be_confused_with:
      - { technique_id: tech_hacher, distinction: Ciseler vise des dés réguliers. }
`;

  it("accepte la racine enrichie { schema_version, techniques }", () => {
    const { items, errors } = parseTechniquesYaml(v2);
    expect(errors).toEqual([]);
    expect(items.map(t => t.id)).toEqual(["tech_grp_hachage", "tech_ciseler"]);
  });

  it("porte les 4 dimensions (hiérarchie, résultat, erreurs, confusions)", () => {
    const { items } = parseTechniquesYaml(v2);
    const cis = items.find(t => t.id === "tech_ciseler");
    expect(cis.hierarchy).toEqual({ parent: "tech_grp_hachage", level: 1 });
    expect(cis.expected_result.summary).toBe("Des dés menus et réguliers.");
    expect(cis.expected_result.observable_indicators).toEqual(["Dés homogènes"]);
    expect(cis.common_errors).toEqual(["Écraser l'aliment", "Dés irréguliers"]);
    expect(cis.not_to_be_confused_with).toEqual([{ technique_id: "tech_hacher", distinction: "Ciseler vise des dés réguliers." }]);
  });

  it("conserve parent null et n'ajoute pas de listes vides", () => {
    const { items } = parseTechniquesYaml(v2);
    const grp = items.find(t => t.id === "tech_grp_hachage");
    expect(grp.hierarchy).toEqual({ parent: null, level: 0 });
    expect("common_errors" in grp).toBe(false); // liste vide non portée (pas d'undefined Firestore)
    expect("not_to_be_confused_with" in grp).toBe(false);
  });

  it("accepte toujours la liste plate historique (v1)", () => {
    const { items, errors } = parseTechniquesYaml("- name: Suer\n  category: cuisson\n  definition: Sans coloration.");
    expect(errors).toEqual([]);
    expect(items[0].name).toBe("Suer");
    expect("hierarchy" in items[0]).toBe(false);
  });

  it("signale un type invalide sur une dimension enrichie", () => {
    const { errors } = parseTechniquesYaml(`
schema_version: 2
techniques:
  - name: X
    category: cuisson
    definition: Y
    common_errors: "pas une liste"
`);
    expect(errors.some(e => /common_errors/.test(e))).toBe(true);
  });

  it("le glossaire canonique data/techniques.yaml se parse sans erreur (smoke)", () => {
    const { items, errors } = parseTechniquesYaml(readFileSync("data/techniques.yaml", "utf8"));
    expect(errors).toEqual([]);
    expect(items.length).toBeGreaterThanOrEqual(63);
    // au moins un geste rattaché à un parent, avec son résultat attendu.
    const child = items.find(t => t.hierarchy && t.hierarchy.parent && t.expected_result);
    expect(child).toBeTruthy();
  });
});

describe("buildTechniqueFromDraft", () => {
  it("dérive l'id du nom et applique les valeurs par défaut", () => {
    const item = buildTechniqueFromDraft({ name: "Émulsionner", definition: "Lier deux liquides." });
    expect(item.id).toBe("tech_emulsionner");
    expect(item.category).toBe("preparation");
    expect("aliases" in item).toBe(false);
    expect("difficulty" in item).toBe(false);
    expect("hierarchy" in item).toBe(false);
    expect("expected_result" in item).toBe(false);
  });

  it("conserve l'id existant et normalise les alias (minuscules, dédoublonnés, vides retirés)", () => {
    const item = buildTechniqueFromDraft({
      id: "tech_ciseler", name: "Ciseler", category: "decoupe", definition: "Tailler fin.",
      aliases: ["  Émincer ", "émincer", "", "Hacher"],
    });
    expect(item.id).toBe("tech_ciseler");
    expect(item.aliases).toEqual(["émincer", "hacher"]);
  });

  it("ne porte la difficulté que si c'est un entier de 1 à 5", () => {
    expect("difficulty" in buildTechniqueFromDraft({ name: "A", definition: "d", difficulty: 0 })).toBe(false);
    expect("difficulty" in buildTechniqueFromDraft({ name: "A", definition: "d", difficulty: 6 })).toBe(false);
    expect(buildTechniqueFromDraft({ name: "A", definition: "d", difficulty: 3 }).difficulty).toBe(3);
  });

  it("porte les 4 dimensions v2 saisies", () => {
    const item = buildTechniqueFromDraft({
      name: "Ciseler", category: "decoupe", definition: "Tailler en dés.",
      hierarchy: { parent: "tech_grp_hachage", level: 1 },
      expected_result: { summary: "Des dés réguliers.", observable_indicators: ["Dés homogènes"] },
      common_errors: ["Écraser l'aliment"],
      not_to_be_confused_with: [{ technique_id: "tech_hacher", distinction: "plus grossier" }],
    });
    expect(item.hierarchy).toEqual({ parent: "tech_grp_hachage", level: 1 });
    expect(item.expected_result).toEqual({ summary: "Des dés réguliers.", observable_indicators: ["Dés homogènes"] });
    expect(item.common_errors).toEqual(["Écraser l'aliment"]);
    expect(item.not_to_be_confused_with).toEqual([{ technique_id: "tech_hacher", distinction: "plus grossier" }]);
  });

  it("omet la hiérarchie quand aucun parent n'est choisi", () => {
    expect("hierarchy" in buildTechniqueFromDraft({ name: "A", definition: "d", hierarchy: { parent: "" } })).toBe(false);
    expect("hierarchy" in buildTechniqueFromDraft({ name: "A", definition: "d", hierarchy: undefined })).toBe(false);
  });

  it("n'émet pas les listes/objets vides (Firestore refuse undefined)", () => {
    const item = buildTechniqueFromDraft({
      name: "A", definition: "d",
      expected_result: { summary: "", observable_indicators: [] },
      common_errors: ["", "  "],
      not_to_be_confused_with: [{ technique_id: "", distinction: "x" }],
    });
    expect("expected_result" in item).toBe(false);
    expect("common_errors" in item).toBe(false);
    expect("not_to_be_confused_with" in item).toBe(false);
  });

  it("round-trip : un brouillon complet ressort identique par le YAML", () => {
    const item = buildTechniqueFromDraft({
      name: "Ciseler", category: "decoupe", definition: "Tailler en dés.", difficulty: 2, source: "Escoffier",
      hierarchy: { parent: "tech_grp_hachage" },
      expected_result: { summary: "Des dés réguliers.", observable_indicators: ["Dés homogènes"] },
      common_errors: ["Écraser l'aliment"],
      not_to_be_confused_with: [{ technique_id: "tech_hacher", distinction: "plus grossier" }],
    });
    const { items, errors } = parseTechniquesYaml(formatTechniquesYaml([item]));
    expect(errors).toEqual([]);
    expect(items[0]).toEqual(item);
  });
});

describe("formatTechniquesMarkdown", () => {
  it("renders a sorted table with the human category label", () => {
    const md = formatTechniquesMarkdown([
      { name: "Napper", category: "dressage", definition: "Recouvrir de sauce." },
      { name: "Suer", category: "cuisson", definition: "Cuire doux." },
    ]);
    expect(md).toContain("| Technique | Catégorie |");
    expect(md).toContain(TECHNIQUE_CATEGORIES.cuisson);
    // cuisson sorts before dressage → Suer row appears before Napper row
    expect(md.indexOf("Suer")).toBeLessThan(md.indexOf("Napper"));
  });

  it("escapes pipes and newlines in cells", () => {
    const md = formatTechniquesMarkdown([
      { name: "X", category: "cuisson", definition: "a | b\nc" },
    ]);
    expect(md).toContain("a \\| b c");
  });
});

describe("parseIngredientsYaml", () => {
  it("parses, recomputes isVegetable, and keeps known nutrients", () => {
    const { items, errors } = parseIngredientsYaml(`
- name: Carotte
  category: vegetable
  months: [12, 1, 1, 2]
  nutrition: { calories: 41, protein: 0.9, unknownField: 5 }
`, { validCategories: ["vegetable"] });
    expect(errors).toEqual([]);
    expect(items[0].months).toEqual([1, 2, 12]); // deduped + sorted
    expect(items[0].nutrition.isVegetable).toBe(true);
    expect(items[0].nutrition.calories).toBe(41);
    expect(items[0].nutrition).not.toHaveProperty("unknownField");
  });

  it("rejects unknown categories and out-of-bounds nutrition", () => {
    expect(parseIngredientsYaml(`
- name: X
  category: nope
`, { validCategories: ["vegetable"] }).errors.join(" ")).toMatch(/inconnue/);

    expect(parseIngredientsYaml(`
- name: X
  nutrition: { calories: 99999 }
`).errors.join(" ")).toMatch(/hors bornes/);
  });

  it("rejects months outside 1..12", () => {
    expect(parseIngredientsYaml(`
- name: X
  months: [0, 13]
`).errors.join(" ")).toMatch(/months/);
  });

  it("skips items without a name", () => {
    const { errors } = parseIngredientsYaml(`
- aliases: [x]
`);
    expect(errors.join(" ")).toMatch(/name/);
  });
});

describe("YAML export round-trips (parse ∘ format = identity)", () => {
  it("techniques survive format → parse", () => {
    const src = parseTechniquesYaml(`
- name: Suer
  category: cuisson
  definition: Cuire doucement sans coloration.
  aliases: [suer, faire suer]
  source: Escoffier
`).items;
    const back = parseTechniquesYaml(formatTechniquesYaml(src));
    expect(back.errors).toEqual([]);
    expect(back.items).toEqual(src);
  });

  it("ingredients (with tips + nutrition) survive format → parse", () => {
    const src = parseIngredientsYaml(`
- name: Carotte
  category: vegetable
  months: [1, 2, 12]
  gramsPerPiece: 120
  tips:
    - { type: prep, text: Éplucher au économe. }
  nutrition: { calories: 41, protein: 0.9 }
`, { validCategories: ["vegetable"] }).items;
    const back = parseIngredientsYaml(formatIngredientsYaml(src), { validCategories: ["vegetable"] });
    expect(back.errors).toEqual([]);
    expect(back.items).toEqual(src);
    expect(back.items[0].tips).toEqual([{ type: "prep", text: "Éplucher au économe." }]);
    expect(back.items[0].nutrition.isVegetable).toBe(true);
  });

  it("separates top-level entries with a blank line for readability", () => {
    const src = parseUtensilsYaml(`
- name: Aaa
- name: Bbb
`).items;
    const out = formatUtensilsYaml(src);
    // un saut de ligne vide avant chaque entrée suivante, pas avant la première
    // (les entrées commencent désormais par `- id:` : l'id est généré si absent)
    expect(out).toMatch(/\n\n- id: db_u_bbb/);
    expect(out).not.toMatch(/name: Aaa\n- id:/);
    // toujours réimportable malgré les lignes vides
    expect(parseUtensilsYaml(out).errors).toEqual([]);
  });

  it("utensils survive format → parse (export sorts by name)", () => {
    const src = parseUtensilsYaml(`
- name: Fouet
  id: db_u_fouet
- name: Casserole
`).items;
    const back = parseUtensilsYaml(formatUtensilsYaml(src));
    expect(back.errors).toEqual([]);
    const byName = arr => [...arr].sort((a, b) => a.name.localeCompare(b.name));
    expect(byName(back.items)).toEqual(byName(src));
  });

  it("rejects an unknown tip type on import", () => {
    expect(parseIngredientsYaml(`
- name: X
  tips:
    - { type: bogus, text: hello }
`).errors.join(" ")).toMatch(/conseil inconnu/);
  });
});

describe("parseUtensilsYaml", () => {
  it("parses name + optional id/image", () => {
    const { items, errors } = parseUtensilsYaml(`
- name: Fouet
- name: Casserole
  id: db_u_cass
`);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(2);
    expect(items[1].id).toBe("db_u_cass"); // id explicite conservé
  });

  it("génère un id à partir du nom quand il est absent", () => {
    const { items, errors } = parseUtensilsYaml(`- name: Économe`);
    expect(errors).toEqual([]);
    expect(items[0].id).toBe("db_u_econome");
  });

  it("rejette deux entrées avec le même id (généré ou explicite)", () => {
    // deux noms identiques → même id généré → conflit signalé
    expect(parseUtensilsYaml(`
- name: Fouet
- name: Fouet
`).errors.join(" ")).toMatch(/double/);
  });

  it("requires a name", () => {
    expect(parseUtensilsYaml(`- image: http://x`).errors.join(" ")).toMatch(/name/);
  });

  it("round-trips a valid category", () => {
    const { items, errors } = parseUtensilsYaml(`
- name: Blender
  category: appareils
`);
    expect(errors).toEqual([]);
    expect(items[0].category).toBe("appareils");
    expect(items[0].category in UTENSIL_CATEGORIES).toBe(true);
  });

  it("defaults a missing category to « divers »", () => {
    const { items } = parseUtensilsYaml(`- name: Louche`);
    expect(items[0].category).toBe("divers");
  });

  it("rejects an unknown category", () => {
    const { items, errors } = parseUtensilsYaml(`
- name: Blender
  category: bogus
`);
    expect(items).toEqual([]);
    expect(errors.join(" ")).toMatch(/catégorie inconnue/);
  });

  it("serializes category in the export (after name)", () => {
    const src = parseUtensilsYaml(`
- name: Blender
  category: appareils
`).items;
    const out = formatUtensilsYaml(src);
    expect(out).toMatch(/name: Blender\n {2}category: appareils/);
    // survit au ré-import
    expect(parseUtensilsYaml(out).items[0].category).toBe("appareils");
  });

  it("round-trips a known appliance", () => {
    const { items, errors } = parseUtensilsYaml(`
- name: Four
  category: appareils
  appliance: four
`);
    expect(errors).toEqual([]);
    expect(items[0].appliance).toBe("four");
    // sérialisé puis réimporté à l'identique
    expect(parseUtensilsYaml(formatUtensilsYaml(items)).items[0].appliance).toBe("four");
  });

  it("omits appliance when absent (ustensile simple)", () => {
    const { items } = parseUtensilsYaml(`- name: Louche`);
    expect(items[0]).not.toHaveProperty("appliance");
  });

  it("rejects an unknown appliance", () => {
    const { items, errors } = parseUtensilsYaml(`
- name: Truc
  appliance: teleporteur
`);
    expect(items).toEqual([]);
    expect(errors.join(" ")).toMatch(/appareil inconnu/);
  });
});
