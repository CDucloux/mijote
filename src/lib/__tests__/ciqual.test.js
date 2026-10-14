import { describe, it, expect } from "vitest";
import { parseCiqualRef, ciqualSlug, ciqualUrl, CIQUAL_HOME } from "@/lib/food/ciqual.js";

describe("parseCiqualRef", () => {
  it("accepte un code numérique ou en chaîne de chiffres, nom facultatif", () => {
    expect(parseCiqualRef({ code: 11075, name: " Cardamome, poudre " })).toEqual({ ref: { code: 11075, name: "Cardamome, poudre" } });
    expect(parseCiqualRef({ code: "1003" })).toEqual({ ref: { code: 1003 } });
    expect(parseCiqualRef({ code: 18066, name: "" })).toEqual({ ref: { code: 18066 } });
  });
  it("refuse un code absent, non entier, négatif ou non numérique", () => {
    for (const code of [undefined, 0, -3, 12.5, "12a", "", 1_000_000]) expect(parseCiqualRef({ code }).error).toMatch(/code Ciqual invalide/);
  });
  it("refuse une forme qui n'est pas un objet, ou un nom non textuel / trop long", () => {
    expect(parseCiqualRef(11075).error).toMatch(/doit être un objet/);
    expect(parseCiqualRef([11075]).error).toMatch(/doit être un objet/);
    expect(parseCiqualRef(null).error).toMatch(/doit être un objet/);
    expect(parseCiqualRef({ code: 1, name: 42 }).error).toMatch(/chaîne/);
    expect(parseCiqualRef({ code: 1, name: "x".repeat(201) }).error).toMatch(/trop long/);
  });
});

describe("ciqualUrl", () => {
  it("pointe la fiche de l'aliment, avec le segment lisible du site", () => {
    expect(ciqualUrl({ code: 11075, name: "Cardamome, poudre" })).toBe("https://ciqual.anses.fr/#/aliments/11075/cardamome-poudre");
  });
  it("se contente du code quand le nom manque", () => {
    expect(ciqualUrl({ code: 18066 })).toBe("https://ciqual.anses.fr/#/aliments/18066");
  });
  it("retombe sur l'accueil de la table sans référence valide", () => {
    expect(ciqualUrl(undefined)).toBe(CIQUAL_HOME);
    expect(ciqualUrl(null)).toBe(CIQUAL_HOME);
    expect(ciqualUrl({ code: 0 })).toBe(CIQUAL_HOME);
  });
});

describe("ciqualSlug", () => {
  it("retire accents, ponctuation et ligatures", () => {
    expect(ciqualSlug("Oeuf, jaune (jaune d'oeuf), cru")).toBe("oeuf-jaune-jaune-d-oeuf-cru");
    expect(ciqualSlug("Échalote, crue")).toBe("echalote-crue");
    expect(ciqualSlug("Bœuf, 5% MG")).toBe("boeuf-5-mg");
    expect(ciqualSlug("!!!")).toBe("");
  });
});
