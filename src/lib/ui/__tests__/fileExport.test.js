import { describe, it, expect } from "vitest";
import { chooseExportStrategy, safeFileName, isShareCancel } from "@/lib/ui/fileExport.js";

describe("chooseExportStrategy", () => {
  // Non-régression : la WebView Android ignore <a download> sur un blob, les
  // exports de l'app native ne produisaient aucun fichier.
  it("feuille de partage dans la coquille native", () => {
    expect(chooseExportStrategy(true)).toBe("share");
  });
  it("téléchargement direct sur le web", () => {
    expect(chooseExportStrategy(false)).toBe("download");
  });
});

describe("safeFileName", () => {
  it("garde un nom déjà sûr, espaces et accents compris", () => {
    expect(safeFileName("Cardamome - Planning repas.ics")).toBe("Cardamome - Planning repas.ics");
    expect(safeFileName("Bœuf_braisé.json")).toBe("Bœuf_braisé.json");
  });
  it("neutralise les séparateurs de chemin et caractères interdits", () => {
    expect(safeFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(safeFileName('a:b*c?"d<e>f|g\\h.yaml')).toBe("a_b_c__d_e_f_g_h.yaml");
  });
  it("retire les contrôles et les espaces de bord", () => {
    expect(safeFileName("  menu\n.md  ")).toBe("menu_.md");
  });
  it("retombe sur export.txt pour un nom vide ou fait de points", () => {
    expect(safeFileName("")).toBe("export.txt");
    expect(safeFileName("   ")).toBe("export.txt");
    expect(safeFileName("..")).toBe("export.txt");
  });
});

describe("isShareCancel", () => {
  it("reconnaît l'abandon de la feuille de partage", () => {
    expect(isShareCancel(new Error("Share canceled"))).toBe(true);
    expect(isShareCancel("Share cancelled")).toBe(true);
  });
  it("laisse remonter les vraies erreurs", () => {
    expect(isShareCancel(new Error("Unable to write file"))).toBe(false);
    expect(isShareCancel(null)).toBe(false);
    expect(isShareCancel({ code: 1 })).toBe(false);
  });
});
