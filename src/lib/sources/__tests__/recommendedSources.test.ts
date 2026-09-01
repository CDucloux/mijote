import { describe, it, expect } from "vitest";
import {
  SOURCE_TINTS, tintOf, monogramOf, prettyHost,
  normalizeSource, sanitizeSources, visibleSources,
} from "../recommendedSources.js";

describe("tintOf", () => {
  it("résout une clé connue", () => {
    expect(tintOf("spice").color).toBe("var(--spice)");
  });
  it("retombe sur la première teinte (accent) si inconnue ou absente", () => {
    expect(tintOf("nope").key).toBe(SOURCE_TINTS[0].key);
    expect(tintOf(undefined).key).toBe("accent");
  });
});

describe("monogramOf", () => {
  it("préfère le champ mono explicite", () => {
    expect(monogramOf({ name: "Cuisine à la grecque", mono: "Γ" })).toBe("Γ");
    expect(monogramOf({ name: "Whatever", mono: "ab" })).toBe("AB");
  });
  it("ignore les articles pour choisir le premier mot signifiant", () => {
    expect(monogramOf({ name: "La Pistache" })).toBe("P");
    expect(monogramOf({ name: "Un déjeuner de soleil" })).toBe("D");
  });
  it("prend la première lettre à défaut, en capitale", () => {
    expect(monogramOf({ name: "cestmafournee" })).toBe("C");
  });
  it("ne casse pas sur un nom vide", () => {
    expect(monogramOf({ name: "" })).toBe("?");
  });
});

describe("prettyHost", () => {
  it("retire protocole, www et slash final", () => {
    expect(prettyHost("https://www.cestmafournee.com/")).toBe("cestmafournee.com");
    expect(prettyHost("http://exemple.fr/recette")).toBe("exemple.fr/recette");
  });
});

describe("normalizeSource", () => {
  it("rejette les entrées sans nom ou sans URL http(s)", () => {
    expect(normalizeSource(null)).toBeNull();
    expect(normalizeSource({ name: "X" })).toBeNull();
    expect(normalizeSource({ name: "X", url: "ftp://x" })).toBeNull();
    expect(normalizeSource({ url: "https://x.fr" })).toBeNull();
  });
  it("normalise et borne une entrée valide", () => {
    const s = normalizeSource({ name: "  Blog  ", url: "https://blog.fr/", category: "Végétal", net: true });
    expect(s).toMatchObject({ name: "Blog", url: "https://blog.fr/", category: "Végétal", net: true });
    expect(s?.id).toMatch(/^src_/);
  });
  it("génère un id si absent, conserve l'id fourni", () => {
    expect(normalizeSource({ name: "A", url: "https://a.fr", id: "keep" })?.id).toBe("keep");
  });
  it("ne garde une teinte que si elle existe dans la palette", () => {
    expect(normalizeSource({ name: "A", url: "https://a.fr", tint: "spice" })?.tint).toBe("spice");
    expect(normalizeSource({ name: "A", url: "https://a.fr", tint: "fuchsia" })?.tint).toBeUndefined();
  });
  it("n'inclut enabled que lorsqu'il vaut false", () => {
    expect(normalizeSource({ name: "A", url: "https://a.fr" })).not.toHaveProperty("enabled");
    expect(normalizeSource({ name: "A", url: "https://a.fr", enabled: false })?.enabled).toBe(false);
  });
});

describe("sanitizeSources", () => {
  it("écarte les invalides et trie par order puis nom", () => {
    const out = sanitizeSources([
      { name: "Zèbre", url: "https://z.fr", order: 5 },
      { name: "bad" },
      { name: "Alpha", url: "https://a.fr", order: 1 },
      { name: "Beta", url: "https://b.fr" }, // pas d'order -> après ceux ordonnés
    ]);
    expect(out.map(s => s.name)).toEqual(["Alpha", "Zèbre", "Beta"]);
  });
  it("tolère une entrée non-tableau", () => {
    expect(sanitizeSources(null)).toEqual([]);
    expect(sanitizeSources("nope")).toEqual([]);
  });
});

describe("visibleSources", () => {
  it("masque les sources désactivées", () => {
    const out = visibleSources([
      { name: "On", url: "https://on.fr", order: 0 },
      { name: "Off", url: "https://off.fr", order: 1, enabled: false },
    ]);
    expect(out.map(s => s.name)).toEqual(["On"]);
  });
});
