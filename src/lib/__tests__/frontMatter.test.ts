import { describe, it, expect } from "vitest";
import { parseFrontMatter, metaString, metaNumber } from "@/lib/data/frontMatter.js";

describe("parseFrontMatter", () => {
  it("sépare le front-matter YAML du corps", () => {
    const { meta, body } = parseFrontMatter("---\ntitle: Démarrer\norder: 2\n---\n# Corps\n");
    expect(meta).toEqual({ title: "Démarrer", order: 2 });
    expect(body).toBe("# Corps\n");
  });

  it("renvoie le texte entier comme corps sans front-matter", () => {
    expect(parseFrontMatter("# Juste du texte")).toEqual({ meta: {}, body: "# Juste du texte" });
  });

  it("gère un texte vide", () => {
    expect(parseFrontMatter("")).toEqual({ meta: {}, body: "" });
  });

  it("ignore un front-matter vide ou non-objet", () => {
    expect(parseFrontMatter("---\n\n---\nCorps").meta).toEqual({});
    expect(parseFrontMatter("---\n- a\n- b\n---\nCorps").meta).toEqual({});
    expect(parseFrontMatter("---\njuste un texte\n---\nCorps").meta).toEqual({});
  });
});

describe("metaString", () => {
  it("lit une chaîne non vide", () => {
    expect(metaString({ title: "Guide" }, "title")).toBe("Guide");
  });

  it("renvoie undefined pour une chaîne vide, absente ou d'un autre type", () => {
    expect(metaString({ title: "" }, "title")).toBeUndefined();
    expect(metaString({}, "title")).toBeUndefined();
    expect(metaString({ title: 3 }, "title")).toBeUndefined();
  });
});

describe("metaNumber", () => {
  it("lit un nombre fini, y compris 0", () => {
    expect(metaNumber({ order: 0 }, "order")).toBe(0);
    expect(metaNumber({ order: 4 }, "order")).toBe(4);
  });

  it("renvoie undefined pour une valeur absente, non numérique ou non finie", () => {
    expect(metaNumber({}, "order")).toBeUndefined();
    expect(metaNumber({ order: "3" }, "order")).toBeUndefined();
    expect(metaNumber({ order: Infinity }, "order")).toBeUndefined();
  });
});
