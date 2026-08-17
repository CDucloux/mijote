import { describe, it, expect } from "vitest";
import { scrimThemeColor, overlayHex } from "@/lib/ui/themeColor.ts";

describe("scrimThemeColor", () => {
  it("compose exactement sur du noir (thème clair, voile sheet 0.7)", () => {
    // 245*0.3=73.5→74=0x4a, 240*0.3=72=0x48, 235*0.3=70.5→71=0x47
    expect(scrimThemeColor("#f5f0eb", 0.7)).toBe("#4a4847");
  });

  it("compose sur du noir (thème clair, voile dialog 0.55)", () => {
    // 245*0.45=110.25→110=0x6e, 240*0.45=108=0x6c, 235*0.45=105.75→106=0x6a
    expect(scrimThemeColor("#f5f0eb", 0.55)).toBe("#6e6c6a");
  });

  it("garde une couleur sombre quasi identique (le voile a peu d'effet visible)", () => {
    // #0e0e0f déjà quasi noir : 14*0.3=4.2→4=0x04, 15*0.3=4.5→5=0x05
    expect(scrimThemeColor("#0e0e0f", 0.7)).toBe("#040405");
  });

  it("alpha 0 laisse la couleur inchangée (normalisée en #rrggbb)", () => {
    expect(scrimThemeColor("#f5f0eb", 0)).toBe("#f5f0eb");
  });

  it("alpha 1 renvoie du noir", () => {
    expect(scrimThemeColor("#f5f0eb", 1)).toBe("#000000");
  });

  it("borne les alpha hors [0,1]", () => {
    expect(scrimThemeColor("#f5f0eb", -3)).toBe("#f5f0eb");
    expect(scrimThemeColor("#f5f0eb", 42)).toBe("#000000");
  });

  it("accepte la forme courte #rgb", () => {
    // #abc => #aabbcc = (170,187,204) ; voile 0.5 => (85,93.5→94,102) = 55,5e,66
    expect(scrimThemeColor("#abc", 0.5)).toBe("#555e66");
  });

  it("accepte l'hex sans dièse", () => {
    expect(scrimThemeColor("f5f0eb", 0)).toBe("#f5f0eb");
  });

  it("renvoie l'entrée telle quelle si elle n'est pas une couleur hex", () => {
    expect(scrimThemeColor("rebeccapurple", 0.5)).toBe("rebeccapurple");
    expect(scrimThemeColor("", 0.5)).toBe("");
    expect(scrimThemeColor("#12", 0.5)).toBe("#12");
  });

  it("reste équivalent à un calque noir via overlayHex", () => {
    expect(scrimThemeColor("#f5f0eb", 0.7)).toBe(overlayHex("#f5f0eb", "#000000", 0.7));
  });
});

describe("overlayHex", () => {
  it("teinte un fond sombre vers l'accent chaud (barre PWA landing, thème sombre)", () => {
    // #0e0e0f + accent #e8703a à 0.14 : lueur orange discrète sur du quasi-noir.
    expect(overlayHex("#0e0e0f", "#e8703a", 0.14)).toBe("#2d1c15");
  });

  it("teinte un fond clair vers l'accent chaud (barre PWA landing, thème clair)", () => {
    expect(overlayHex("#f5f0eb", "#e8703a", 0.1)).toBe("#f4e3d9");
  });

  it("compose au milieu (blanc sur noir à 0.5 = gris moyen)", () => {
    expect(overlayHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("alpha 0 renvoie le fond (normalisé), alpha 1 renvoie le calque", () => {
    expect(overlayHex("#f5f0eb", "#e8703a", 0)).toBe("#f5f0eb");
    expect(overlayHex("#f5f0eb", "#e8703a", 1)).toBe("#e8703a");
  });

  it("borne les alpha hors [0,1]", () => {
    expect(overlayHex("#f5f0eb", "#e8703a", -1)).toBe("#f5f0eb");
    expect(overlayHex("#f5f0eb", "#e8703a", 9)).toBe("#e8703a");
  });

  it("ignore un calque non parsable (renvoie le fond normalisé)", () => {
    expect(overlayHex("#f5f0eb", "nope", 0.5)).toBe("#f5f0eb");
    expect(overlayHex("#abc", "", 0.5)).toBe("#aabbcc");
  });

  it("renvoie le fond tel quel s'il n'est pas parsable", () => {
    expect(overlayHex("nope", "#000000", 0.5)).toBe("nope");
  });
});
