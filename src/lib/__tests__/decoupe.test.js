import { describe, it, expect } from "vitest";
import { parseCut, buildPostesDecoupe, posteLabel, FORMES, FORME_LABEL } from "@/lib/recipes/decoupe.js";
import { buildTechniqueIndex } from "@/lib/recipes/techniques.js";

describe("FORME_LABEL", () => {
  it("couvre exhaustivement le vocabulaire (un libellé par forme)", () => {
    for (const f of FORMES) expect(typeof FORME_LABEL[f]).toBe("string");
    expect(Object.keys(FORME_LABEL).length).toBe(FORMES.length);
  });
});

describe("parseCut", () => {
  it("accepte une forme canonique en chaîne", () => {
    expect(parseCut("emince")).toEqual({ forme: "emince" });
  });

  it("ramène les formulations libres (accents/casse ignorés) au vocabulaire fermé", () => {
    expect(parseCut("Émincé")).toEqual({ forme: "emince" });
    expect(parseCut("en fines lamelles")).toEqual({ forme: "emince" });
    expect(parseCut("petits dés")).toEqual({ forme: "des" });
    expect(parseCut("en brunoise")).toEqual({ forme: "brunoise" });
    expect(parseCut("râpé")).toEqual({ forme: "rape" });
    expect(parseCut("en rondelles")).toEqual({ forme: "rondelle" });
  });

  it("accepte l'objet { forme, calibre } et normalise le calibre", () => {
    expect(parseCut({ forme: "cisele", calibre: "fin" })).toEqual({ forme: "cisele", calibre: "fin" });
    expect(parseCut({ forme: "des", calibre: "petit" })).toEqual({ forme: "des", calibre: "fin" });
    expect(parseCut({ forme: "des", calibre: "grosse" })).toEqual({ forme: "des", calibre: "gros" });
  });

  it("ignore un calibre inconnu sans perdre la forme", () => {
    expect(parseCut({ forme: "julienne", calibre: "3mm" })).toEqual({ forme: "julienne" });
  });

  it("n'invente rien : forme inconnue ou payload malformé → null", () => {
    expect(parseCut("spiralé")).toBeNull();
    expect(parseCut({ forme: "spiralé" })).toBeNull();
    expect(parseCut({ forme: 42 })).toBeNull();
    expect(parseCut(null)).toBeNull();
    expect(parseCut(undefined)).toBeNull();
    expect(parseCut(12)).toBeNull();
    expect(parseCut({})).toBeNull();
  });
});

describe("buildPostesDecoupe", () => {
  it("ne retient que les lignes taillées et nommées", () => {
    const postes = buildPostesDecoupe([
      { id: "a", name: "oignon", cut: "cisele" },
      { id: "b", name: "sel" }, // pas de découpe
      { id: "c", cut: "hache" }, // pas de nom
    ]);
    expect(postes).toHaveLength(1);
    expect(postes[0].name).toBe("oignon");
    expect(postes[0].forme).toBe("cisele");
    expect(postes[0].ingredientIds).toEqual(["a"]);
  });

  it("agrège même légume + forme + unité en sommant les quantités", () => {
    const postes = buildPostesDecoupe([
      { id: "a", name: "carotte", dbId: "carotte", amount: 2, cut: "des" },
      { id: "b", name: "carotte", dbId: "carotte", amount: 3, cut: "des" },
    ]);
    expect(postes).toHaveLength(1);
    expect(postes[0].amount).toBe(5);
    expect(postes[0].ingredientIds).toEqual(["a", "b"]);
  });

  it("regroupe par dbId même si les libellés diffèrent", () => {
    const postes = buildPostesDecoupe([
      { id: "a", name: "Oignon jaune", dbId: "oignon", amount: 1, cut: "cisele" },
      { id: "b", name: "oignon", dbId: "oignon", amount: 2, cut: "cisele" },
    ]);
    expect(postes).toHaveLength(1);
    expect(postes[0].amount).toBe(3);
  });

  it("ne fusionne pas des unités ou des calibres différents", () => {
    const postes = buildPostesDecoupe([
      { id: "a", name: "carotte", dbId: "carotte", amount: 100, unit: "g", cut: "rape" },
      { id: "b", name: "carotte", dbId: "carotte", amount: 2, cut: "rape" },
      { id: "c", name: "carotte", dbId: "carotte", amount: 1, cut: { forme: "rape", calibre: "gros" } },
    ]);
    expect(postes).toHaveLength(3);
  });

  it("ne somme pas quand une ligne du groupe n'a pas de quantité chiffrée", () => {
    const postes = buildPostesDecoupe([
      { id: "a", name: "oignon", dbId: "oignon", amount: 2, cut: "cisele" },
      { id: "b", name: "oignon", dbId: "oignon", cut: "cisele" }, // amount absent
    ]);
    expect(postes).toHaveLength(1);
    expect(postes[0].amount).toBeNull();
  });

  it("ordonne : gestes regroupés, légumes salissants (ail) en dernier", () => {
    const postes = buildPostesDecoupe([
      { id: "a", name: "ail", cut: "hache" },
      { id: "b", name: "carotte", cut: "rondelle" },
      { id: "c", name: "poireau", cut: "emince" },
    ]);
    expect(postes.map((p) => p.name)).toEqual(["poireau", "carotte", "ail"]);
  });

  it("relie chaque poste à son geste quand un index de techniques est fourni", () => {
    const index = buildTechniqueIndex([
      { id: "g_cisele", name: "Ciseler", aliases: ["ciseler"], definition: "Petits dés d'oignon." },
    ]);
    const [poste] = buildPostesDecoupe([{ id: "a", name: "oignon", cut: "cisele" }], index);
    expect(poste.technique?.id).toBe("g_cisele");
  });

  it("technique nulle si le geste est absent de l'index ou l'index absent", () => {
    const index = buildTechniqueIndex([{ id: "g_cisele", name: "Ciseler", aliases: ["ciseler"] }]);
    const [emince] = buildPostesDecoupe([{ id: "a", name: "poireau", cut: "emince" }], index);
    expect(emince.technique).toBeNull();
    const [sansIndex] = buildPostesDecoupe([{ id: "a", name: "oignon", cut: "cisele" }]);
    expect(sansIndex.technique).toBeNull();
  });

  it("entrée vide ou nulle → aucun poste", () => {
    expect(buildPostesDecoupe([])).toEqual([]);
    expect(buildPostesDecoupe(null)).toEqual([]);
    expect(buildPostesDecoupe(undefined)).toEqual([]);
  });
});

describe("posteLabel", () => {
  const poste = (over) => ({ key: "k", forme: "cisele", calibre: null, name: "oignon", amount: null, unit: "", ingredientIds: [], technique: null, ...over });

  it("compte et accorde les légumes à la pièce", () => {
    expect(posteLabel(poste({ forme: "cisele", amount: 3 }))).toBe("Ciseler : 3 oignons");
  });

  it("garde le nom au singulier avec une unité de masse", () => {
    expect(posteLabel(poste({ forme: "rape", name: "carotte", amount: 200, unit: "g" }))).toBe("Râper : 200g carotte");
  });

  it("mentionne le calibre entre parenthèses", () => {
    expect(posteLabel(poste({ forme: "des", calibre: "fin", name: "carotte", amount: 2 }))).toBe("Tailler en dés (fin) : 2 carottes");
  });

  it("se contente du légume quand la quantité n'est pas sommable", () => {
    expect(posteLabel(poste({ forme: "emince", name: "poireau", amount: null }))).toBe("Émincer : poireau");
  });
});
