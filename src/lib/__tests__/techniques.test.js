import { describe, it, expect } from "vitest";
import { buildTechniqueIndex, annotateText, hasTechnique } from "../techniques.js";

const TECHS = [
  { id: "tech_suer", name: "Suer", aliases: ["suer", "faire suer"], definition: "Cuire doux." },
  { id: "tech_deglacer", name: "Déglacer", aliases: ["déglacer"], definition: "Dissoudre les sucs." },
  { id: "tech_julienne", name: "Tailler en julienne", aliases: ["julienne", "tailler en julienne"], definition: "Bâtonnets fins." },
];
const idx = buildTechniqueIndex(TECHS);

const plain = (segs) => segs.map(s => s.text).join("");
const hits = (segs) => segs.filter(s => s.tech).map(s => s.text);

describe("buildTechniqueIndex", () => {
  it("indexes names + aliases and tracks the longest phrase", () => {
    expect(idx.phrases.get("suer").id).toBe("tech_suer");
    expect(idx.phrases.get("deglacer").id).toBe("tech_deglacer");      // accent-insensitive
    expect(idx.phrases.get("tailler en julienne").id).toBe("tech_julienne");
    expect(idx.maxWords).toBe(3);
  });
});

describe("annotateText", () => {
  it("preserves the original text exactly (concatenation = input)", () => {
    const text = "Faire suer les oignons, puis déglacer au vin.";
    expect(plain(annotateText(text, idx))).toBe(text);
  });

  it("highlights a single technique, case/accent-insensitive", () => {
    const segs = annotateText("Déglacez la sauteuse.", buildTechniqueIndex([
      { id: "d", name: "Déglacer", aliases: ["déglacer", "déglacez"], definition: "x" },
    ]));
    expect(hits(segs)).toEqual(["Déglacez"]);
  });

  it("prefers the longest phrase (greedy)", () => {
    const segs = annotateText("Tailler en julienne les carottes.", idx);
    // doit surligner toute l'expression, pas seulement « julienne »
    expect(hits(segs)).toEqual(["Tailler en julienne"]);
  });

  it("catches multiple techniques in one step and keeps the original casing", () => {
    const segs = annotateText("Faire suer, puis déglacer.", idx);
    expect(hits(segs)).toEqual(["Faire suer", "déglacer"]);
  });

  it("returns the whole text as one plain segment when nothing matches", () => {
    const segs = annotateText("Mélanger doucement.", idx);
    expect(segs).toEqual([{ text: "Mélanger doucement.", tech: null }]);
  });

  it("is a no-op without an index or text", () => {
    expect(annotateText("abc", { phrases: new Map(), maxWords: 1 })).toEqual([{ text: "abc", tech: null }]);
    expect(annotateText("", idx)).toEqual([{ text: "", tech: null }]);
  });

  it("attaches the technique object to the matched segment", () => {
    const segs = annotateText("On va suer.", idx);
    const hit = segs.find(s => s.tech);
    expect(hit.tech.definition).toBe("Cuire doux.");
  });
});

describe("hasTechnique", () => {
  it("reports whether any technique is present", () => {
    expect(hasTechnique("Faire suer.", idx)).toBe(true);
    expect(hasTechnique("Touiller.", idx)).toBe(false);
  });
});
