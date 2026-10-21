import { describe, it, expect } from "vitest";
import { escapeMdCell, formatIngredientsMarkdown, formatUtensilsMarkdown, ING_MD_COLUMNS } from "@/lib/food/ingredientsMarkdown.js";

describe("escapeMdCell", () => {
  it("échappe les barres et aplatit les sauts de ligne", () => {
    expect(escapeMdCell(" a|b\r\nc ")).toBe("a\\|b c");
  });

  it("rend une cellule vide pour une valeur absente", () => {
    expect(escapeMdCell(undefined)).toBe("");
    expect(escapeMdCell(null)).toBe("");
    expect(escapeMdCell(0)).toBe("0");
  });
});

describe("formatIngredientsMarkdown", () => {
  const lines = (md: string) => md.trim().split("\n");

  it("trie par ordre de catégorie puis par nom", () => {
    const md = formatIngredientsMarkdown([
      { id: "3", name: "Thym", category: "herbs" },
      { id: "2", name: "Poireau", category: "vegetable" },
      { id: "1", name: "Ail", category: "vegetable" },
    ], ["vegetable", "herbs"]);
    const rows = lines(md).slice(-3).map(l => l.split(" | ")[0]);
    expect(rows).toEqual(["| Ail", "| Poireau", "| Thym"]);
    expect(md).toContain("# Base d'ingrédients Cardamome (3)");
  });

  it("remplit une colonne par entrée de la spec", () => {
    const md = formatIngredientsMarkdown([{
      id: "i1", name: "Ail", aliases: ["ail rose", "ail blanc"], months: [7, 8],
      nutrition: { calories: 131, protein: 0, fat: undefined }, tips: [{ type: "usage", text: "Dégermer" }],
    }], []);
    const cells = lines(md).at(-1)!.slice(2, -2).split(" | ");
    expect(cells).toHaveLength(ING_MD_COLUMNS.length);
    const at = (key: string) => cells[ING_MD_COLUMNS.findIndex(c => c.key === key)];
    expect(at("aliases")).toBe("ail rose, ail blanc");
    expect(at("category")).toBe("other");
    expect(at("calories")).toBe("131");
    expect(at("protein")).toBe("0");
    expect(at("fat")).toBe("");
    expect(at("tips")).toBe("usage: Dégermer");
  });

  it("produit un tableau vide sans ingrédient", () => {
    expect(formatIngredientsMarkdown([], [])).toContain("(0)");
  });
});

describe("formatUtensilsMarkdown", () => {
  it("trie par nom et échappe les cellules", () => {
    const md = formatUtensilsMarkdown([{ id: "u2", name: "Wok" }, { id: "u1", name: "Fouet|x", image: "f.png" }]);
    expect(md.trim().split("\n").slice(-2)).toEqual(["| Fouet\\|x | u1 | f.png |", "| Wok | u2 |  |"]);
  });
});
