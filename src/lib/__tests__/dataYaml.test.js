import { describe, it, expect } from "vitest";
import {
  parseTechniquesYaml, parseIngredientsYaml, parseUtensilsYaml,
  formatTechniquesMarkdown, formatTechniquesYaml, formatIngredientsYaml, formatUtensilsYaml,
  slugifyId, TECHNIQUE_CATEGORIES,
} from "../dataYaml.js";

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
    expect(out).toMatch(/\n\n- name: Bbb/);
    expect(out).not.toMatch(/- name: Aaa\n- name: Bbb/);
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
    expect(items[1].id).toBe("db_u_cass");
  });

  it("requires a name", () => {
    expect(parseUtensilsYaml(`- image: http://x`).errors.join(" ")).toMatch(/name/);
  });
});
