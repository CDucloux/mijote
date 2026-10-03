import { describe, it, expect } from "vitest";
import { parsePrecautionDescription, type TableBlock } from "@/lib/utensils/precautionLayout.js";

describe("parsePrecautionDescription", () => {
  it("texte sans tableau : un seul paragraphe", () => {
    expect(parsePrecautionDescription("Bien chaude, l'inox devient quasi antiadhésive.")).toEqual([
      { kind: "paragraph", text: "Bien chaude, l'inox devient quasi antiadhésive." },
    ]);
  });

  it("chaîne vide : aucun bloc", () => {
    expect(parsePrecautionDescription("")).toEqual([]);
    expect(parsePrecautionDescription("   \n  ")).toEqual([]);
  });

  it("lignes « label : valeur » : tableau 2 colonnes sans en-tête, intro gardée en paragraphe", () => {
    const desc = [
      "Puissance conseillée selon l'usage (en fraction du maximum) :",
      "Mijoter, maintenir : 1/5 à 1/3",
      "Cuisson douce : 1/3 à 1/2",
      "Saisie très courte : 2/3 à fond",
    ].join("\n");
    const blocks = parsePrecautionDescription(desc);
    expect(blocks[0]).toEqual({ kind: "paragraph", text: "Puissance conseillée selon l'usage (en fraction du maximum) :" });
    expect(blocks[1]).toEqual({
      kind: "table",
      header: null,
      rows: [
        ["Mijoter, maintenir", "1/5 à 1/3"],
        ["Cuisson douce", "1/3 à 1/2"],
        ["Saisie très courte", "2/3 à fond"],
      ],
    });
  });

  it("l'intro se terminant par deux-points sans valeur n'est PAS prise pour une paire", () => {
    const blocks = parsePrecautionDescription("Puissance conseillée (en fraction du maximum) :\na : 1\nb : 2");
    expect(blocks[0].kind).toBe("paragraph");
    expect((blocks[1] as TableBlock).rows).toHaveLength(2);
  });

  it("une seule ligne « label : valeur » isolée reste un paragraphe (pas un tableau d'une ligne)", () => {
    const blocks = parsePrecautionDescription("À éviter : chauffer à vide à pleine puissance");
    expect(blocks).toEqual([{ kind: "paragraph", text: "À éviter : chauffer à vide à pleine puissance" }]);
  });

  it("tableau Markdown à pipes avec séparation : en-tête + lignes", () => {
    const desc = [
      "| Usage | Puissance |",
      "| --- | --- |",
      "| Mijoter | 1/5 à 1/3 |",
      "| Saisie | 2/3 à fond |",
    ].join("\n");
    expect(parsePrecautionDescription(desc)).toEqual([
      { kind: "table", header: ["Usage", "Puissance"], rows: [["Mijoter", "1/5 à 1/3"], ["Saisie", "2/3 à fond"]] },
    ]);
  });

  it("tableau à pipes sans pipes de bord ni séparation : pas d'en-tête, toutes les lignes en corps", () => {
    const desc = ["Mijoter | 1/5 à 1/3", "Saisie | 2/3 à fond"].join("\n");
    expect(parsePrecautionDescription(desc)).toEqual([
      { kind: "table", header: null, rows: [["Mijoter", "1/5 à 1/3"], ["Saisie", "2/3 à fond"]] },
    ]);
  });

  it("paragraphe avant ET après un tableau : ordre préservé", () => {
    const desc = [
      "Bien chaude, l'inox devient quasi antiadhésive.",
      "Mijoter, maintenir : 1/5 à 1/3",
      "Saisie très courte : 2/3 à fond",
      "À éviter : chauffer à vide à pleine puissance",
    ].join("\n");
    const blocks = parsePrecautionDescription(desc);
    // intro (paragraphe) ; les 3 lignes « label : valeur » contiguës forment un seul tableau.
    expect(blocks.map(b => b.kind)).toEqual(["paragraph", "table"]);
    expect((blocks[1] as TableBlock).rows).toHaveLength(3);
  });

  it("ne perd aucune cellule : deux-points pleine chasse et valeurs à espaces multiples", () => {
    const blocks = parsePrecautionDescription("Cuisson douce ： 1/3 à 1/2\nSauté : 1/2 à 2/3");
    expect((blocks[0] as TableBlock).rows).toEqual([["Cuisson douce", "1/3 à 1/2"], ["Sauté", "1/2 à 2/3"]]);
  });

  it("colonnes irrégulières dans un tableau à pipes : chaque ligne garde ses cellules", () => {
    const desc = ["| a | b | c |", "| --- | --- | --- |", "| 1 | 2 | 3 |", "| x | y |"].join("\n");
    const table = parsePrecautionDescription(desc)[0] as TableBlock;
    expect(table.header).toEqual(["a", "b", "c"]);
    expect(table.rows).toEqual([["1", "2", "3"], ["x", "y"]]);
  });
});
