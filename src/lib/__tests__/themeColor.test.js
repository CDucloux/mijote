import { describe, it, expect } from "vitest";
import { scrimThemeColor, overlayHex, nudgeThemeColor } from "@/lib/ui/themeColor.ts";

describe("scrimThemeColor", () => {
  it("compose exactement sur du noir (thème clair, voile sheet 0.7)", () => {
    // 243*0.3=72.9→73=0x49, 244*0.3=73.2→73=0x49, 236*0.3=70.8→71=0x47
    expect(scrimThemeColor("#f3f4ec", 0.7)).toBe("#494947");
  });

  it("compose sur du noir (thème clair, voile dialog 0.55)", () => {
    // 243*0.45=109.35→109=0x6d, 244*0.45=109.8→110=0x6e, 236*0.45=106.2→106=0x6a
    expect(scrimThemeColor("#f3f4ec", 0.55)).toBe("#6d6e6a");
  });

  it("garde une couleur sombre quasi identique (le voile a peu d'effet visible)", () => {
    // #10120e déjà quasi noir : 16*0.3=4.8→5=0x05, 18*0.3=5.4→5=0x05, 14*0.3=4.2→4=0x04
    expect(scrimThemeColor("#10120e", 0.7)).toBe("#050504");
  });

  it("alpha 0 laisse la couleur inchangée (normalisée en #rrggbb)", () => {
    expect(scrimThemeColor("#f3f4ec", 0)).toBe("#f3f4ec");
  });

  it("alpha 1 renvoie du noir", () => {
    expect(scrimThemeColor("#f3f4ec", 1)).toBe("#000000");
  });

  it("borne les alpha hors [0,1]", () => {
    expect(scrimThemeColor("#f3f4ec", -3)).toBe("#f3f4ec");
    expect(scrimThemeColor("#f3f4ec", 42)).toBe("#000000");
  });

  it("accepte la forme courte #rgb", () => {
    // #abc => #aabbcc = (170,187,204) ; voile 0.5 => (85,93.5→94,102) = 55,5e,66
    expect(scrimThemeColor("#abc", 0.5)).toBe("#555e66");
  });

  it("accepte l'hex sans dièse", () => {
    expect(scrimThemeColor("f3f4ec", 0)).toBe("#f3f4ec");
  });

  it("renvoie l'entrée telle quelle si elle n'est pas une couleur hex", () => {
    expect(scrimThemeColor("rebeccapurple", 0.5)).toBe("rebeccapurple");
    expect(scrimThemeColor("", 0.5)).toBe("");
    expect(scrimThemeColor("#12", 0.5)).toBe("#12");
  });

  it("reste équivalent à un calque noir via overlayHex", () => {
    expect(scrimThemeColor("#f3f4ec", 0.7)).toBe(overlayHex("#f3f4ec", "#000000", 0.7));
  });
});

describe("overlayHex", () => {
  it("teinte un fond sombre vers l'accent gousse (barre PWA landing, thème sombre)", () => {
    // #10120e + accent #a7c97c à 0.14 : lueur verte discrète sur du quasi-noir.
    expect(overlayHex("#10120e", "#a7c97c", 0.14)).toBe("#252c1d");
  });

  it("teinte un fond clair vers l'accent gousse (barre PWA landing, thème clair)", () => {
    expect(overlayHex("#f3f4ec", "#6e9a3f", 0.1)).toBe("#e6ebdb");
  });

  it("compose au milieu (blanc sur noir à 0.5 = gris moyen)", () => {
    expect(overlayHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("alpha 0 renvoie le fond (normalisé), alpha 1 renvoie le calque", () => {
    expect(overlayHex("#f3f4ec", "#a7c97c", 0)).toBe("#f3f4ec");
    expect(overlayHex("#f3f4ec", "#a7c97c", 1)).toBe("#a7c97c");
  });

  it("borne les alpha hors [0,1]", () => {
    expect(overlayHex("#f3f4ec", "#a7c97c", -1)).toBe("#f3f4ec");
    expect(overlayHex("#f3f4ec", "#a7c97c", 9)).toBe("#a7c97c");
  });

  it("ignore un calque non parsable (renvoie le fond normalisé)", () => {
    expect(overlayHex("#f3f4ec", "nope", 0.5)).toBe("#f3f4ec");
    expect(overlayHex("#abc", "", 0.5)).toBe("#aabbcc");
  });

  it("renvoie le fond tel quel s'il n'est pas parsable", () => {
    expect(overlayHex("nope", "#000000", 0.5)).toBe("nope");
  });
});

describe("nudgeThemeColor", () => {
  it("décale le bleu de 1/255 (thème clair)", () => {
    expect(nudgeThemeColor("#f3f4ec")).toBe("#f3f4eb");
  });

  it("décale le bleu de 1/255 (thème sombre)", () => {
    expect(nudgeThemeColor("#10120e")).toBe("#10120d");
  });

  it("renvoie TOUJOURS une valeur distincte de l'entrée (sinon aucun repaint forcé)", () => {
    for (const c of ["#f3f4ec", "#10120e", "#494947", "#000000", "#ffffff"]) {
      expect(nudgeThemeColor(c)).not.toBe(c);
    }
  });

  it("rebondit en +1 quand le bleu est déjà à 0", () => {
    expect(nudgeThemeColor("#000000")).toBe("#000001");
  });

  it("normalise la forme courte et l'hex sans dièse", () => {
    expect(nudgeThemeColor("#abc")).toBe("#aabbcb"); // #aabbcc -> bleu 204 -> 203 = 0xcb
    expect(nudgeThemeColor("f3f4ec")).toBe("#f3f4eb");
  });

  it("renvoie l'entrée telle quelle si elle n'est pas une couleur hex", () => {
    expect(nudgeThemeColor("rebeccapurple")).toBe("rebeccapurple");
    expect(nudgeThemeColor("")).toBe("");
    expect(nudgeThemeColor("#12")).toBe("#12");
  });
});
