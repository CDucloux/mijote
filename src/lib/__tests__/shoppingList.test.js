import { describe, it, expect } from "vitest";
import {
  buildShoppingSections,
  stockMatchesFromChecked,
  stripShoppingBullet,
  splitBulletLines,
} from "@/lib/food/shoppingList.ts";
import { DEFAULT_CATEGORIES } from "@/constants/categories.js";

const DB = [
  { id: "farine", name: "Farine", category: "baking", image: "f.png" },
  { id: "tomate", name: "Tomate", category: "vegetable", image: "t.png" },
  { id: "huile", name: "Huile d'olive", category: "oil", image: "h.png" },
  { id: "lait", name: "Lait", category: "dairy", image: "l.png" },
];

describe("buildShoppingSections", () => {
  const catOf = it => DB.find(d => d.name.toLowerCase() === it.name.toLowerCase())?.category || "other";

  it("regroupe par catégorie dans l'ordre des catégories, alpha dans le groupe", () => {
    const items = [
      { name: "Tomate", checked: false },
      { name: "Farine", checked: false },
      { name: "Ail", checked: false }, // inconnu -> other
    ];
    const { sections, done } = buildShoppingSections(items, DEFAULT_CATEGORIES, catOf);
    expect(done).toEqual([]);
    // vegetable (order 0) avant baking (15) avant other (17)
    expect(sections.map(s => s.key)).toEqual(["vegetable", "baking", "other"]);
    expect(sections[0].label).toBe("Légumes");
    expect(sections[0].items.map(i => i.name)).toEqual(["Tomate"]);
  });

  it("trie alphabétiquement (fr) au sein d'un même groupe", () => {
    const items = [
      { name: "Courgette", checked: false },
      { name: "Ail", checked: false },
      { name: "Épinard", checked: false },
    ];
    const { sections } = buildShoppingSections(items, DEFAULT_CATEGORIES, () => "vegetable");
    expect(sections[0].items.map(i => i.name)).toEqual(["Ail", "Courgette", "Épinard"]);
  });

  it("isole et trie les articles cochés dans done", () => {
    const items = [
      { name: "Tomate", checked: true },
      { name: "Farine", checked: false },
      { name: "Ail", checked: true },
    ];
    const { sections, done } = buildShoppingSections(items, DEFAULT_CATEGORIES, catOf);
    expect(done.map(i => i.name)).toEqual(["Ail", "Tomate"]);
    // seul Farine reste à acheter
    expect(sections.flatMap(s => s.items.map(i => i.name))).toEqual(["Farine"]);
  });

  it("catégorie vide/inconnue retombe sur other", () => {
    const { sections } = buildShoppingSections([{ name: "X" }], DEFAULT_CATEGORIES, () => "");
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe("other");
  });

  it("liste vide / null -> aucune section, done vide", () => {
    expect(buildShoppingSections([], DEFAULT_CATEGORIES, catOf)).toEqual({ sections: [], done: [] });
    expect(buildShoppingSections(null, DEFAULT_CATEGORIES, catOf)).toEqual({ sections: [], done: [] });
  });
});

describe("stockMatchesFromChecked", () => {
  it("ne garde que les produits de placard cochés, doublons conservés dans l'ordre", () => {
    const items = [
      { name: "Farine", checked: true },   // baking -> placard
      { name: "Farine", checked: true },   // doublon -> conservé (dédup au point d'usage)
      { name: "Tomate", checked: true },   // vegetable -> frais, exclu
      { name: "Huile d'olive", checked: true }, // oil -> placard
      { name: "Farine", checked: false },  // non coché -> ignoré
    ];
    const out = stockMatchesFromChecked(items, DB);
    expect(out.map(m => m.id)).toEqual(["farine", "farine", "huile"]);
  });

  it("article non reconnu par la Master DB est ignoré", () => {
    const out = stockMatchesFromChecked([{ name: "Truc inconnu", checked: true }], DB);
    expect(out).toEqual([]);
  });

  it("aucun coché / liste vide -> tableau vide", () => {
    expect(stockMatchesFromChecked([{ name: "Farine", checked: false }], DB)).toEqual([]);
    expect(stockMatchesFromChecked([], DB)).toEqual([]);
    expect(stockMatchesFromChecked(null, DB)).toEqual([]);
  });
});

describe("stripShoppingBullet", () => {
  it("retire tirets, puces, numéros de tête et espaces", () => {
    expect(stripShoppingBullet("- 500g farine")).toBe("500g farine");
    expect(stripShoppingBullet("* 2 oeufs")).toBe("2 oeufs");
    expect(stripShoppingBullet("• lait")).toBe("lait");
    expect(stripShoppingBullet("1. sucre")).toBe("sucre");
    expect(stripShoppingBullet("3) beurre")).toBe("beurre");
    expect(stripShoppingBullet("   sel  ")).toBe("sel");
  });

  it("laisse intact un texte sans puce", () => {
    expect(stripShoppingBullet("farine T55")).toBe("farine T55");
  });
});

describe("splitBulletLines", () => {
  it("une ligne = un article, lignes vides écartées, ne tronque pas", () => {
    const text = "500g farine\n\n- 2 oeufs\n1) levure\n   \n";
    expect(splitBulletLines(text)).toEqual(["500g farine", "2 oeufs", "levure"]);
  });

  it("texte vide -> tableau vide", () => {
    expect(splitBulletLines("")).toEqual([]);
    expect(splitBulletLines("\n\n")).toEqual([]);
  });
});
