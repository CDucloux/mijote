import { describe, it, expect } from "vitest";
import { parseCut, FORMES, FORME_LABEL } from "@/lib/recipes/decoupe.js";
import { CUT_FAMILIES, CUT_GUIDE, cutShortlist, familyOf } from "@/lib/recipes/cutGuide.js";

describe("découpe « concassé »", () => {
  it("fait partie du vocabulaire, avec libellé et fiche", () => {
    expect(FORMES).toContain("concasse");
    expect(FORME_LABEL.concasse).toBe("Concasser");
    expect(CUT_GUIDE.concasse.name).toBe("Concassé");
  });
  it("se range avec les hachés (éclats irréguliers), une seule famille par forme", () => {
    expect(familyOf("concasse")).toBe("fin");
    expect(CUT_FAMILIES.flatMap(f => f.formes).filter(f => f === "concasse")).toHaveLength(1);
  });
  it("ramène les formulations libres au vocabulaire fermé", () => {
    expect(parseCut("concassées")).toEqual({ forme: "concasse" });
    expect(parseCut("grossièrement haché")).toEqual({ forme: "concasse" });
    expect(parseCut({ forme: "concasse", calibre: "gros" })).toEqual({ forme: "concasse", calibre: "gros" });
  });
  it("est proposée en premier pour les fruits à coque, nom ou catégorie", () => {
    expect(cutShortlist("noisettes")[0]).toBe("concasse");
    expect(cutShortlist("cerneaux de noix")[0]).toBe("concasse");
    expect(cutShortlist("graines", "nuts_seeds")[0]).toBe("concasse");
    expect(cutShortlist("noix de coco")[0]).toBe("rape");
  });
});
