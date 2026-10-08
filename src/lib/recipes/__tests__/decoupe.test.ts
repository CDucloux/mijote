import { describe, it, expect } from "vitest";
import {
  parseCut, buildPostesDecoupe, findDecoupeStepIndex, posteLabel, sortPostesByStep,
} from "@/lib/recipes/decoupe.js";
import type { IngredientLine, Step } from "@/lib/types.js";

const ing = (over: Partial<IngredientLine> = {}): IngredientLine => ({
  id: "l1", name: "oignon", amount: 2, unit: "", ...over,
});
const step = (over: Partial<Step> = {}): Step => ({
  text: "", ingredients: [], utensils: [], ...over,
} as Step);

describe("parseCut", () => {
  it("narrowe une chaîne libre vers le vocabulaire fermé", () => {
    expect(parseCut("émincé")).toEqual({ forme: "emince" });
    expect(parseCut("en rondelles")).toEqual({ forme: "rondelle" });
  });
  it("accepte l'objet { forme, calibre } et rejette l'inconnu", () => {
    expect(parseCut({ forme: "hache", calibre: "fin" })).toEqual({ forme: "hache", calibre: "fin" });
    expect(parseCut("bidule")).toBeNull();
    expect(parseCut(null)).toBeNull();
    expect(parseCut(42)).toBeNull();
  });
});

describe("buildPostesDecoupe", () => {
  it("ne retient que les lignes portant une découpe reconnue", () => {
    const postes = buildPostesDecoupe([
      ing({ id: "a", name: "oignon", amount: 2, cut: { forme: "emince" } }),
      ing({ id: "b", name: "farine", amount: 250, unit: "g" }),
    ]);
    expect(postes.map((p) => p.name)).toEqual(["oignon"]);
  });

  it("écarte les ingrédients jamais taillés au couteau même si le LLM leur colle une découpe", () => {
    const postes = buildPostesDecoupe([
      ing({ id: "a", name: "beurre", amount: 90, unit: "g", cut: { forme: "emince" } }),
      ing({ id: "b", name: "sucre glace", amount: 120, unit: "g", cut: { forme: "rape" } }),
      ing({ id: "c", name: "carotte", amount: 2, cut: { forme: "rape" } }),
    ]);
    expect(postes.map((p) => p.name)).toEqual(["carotte"]);
  });

  it("regroupe par (légume, forme, calibre, unité) et somme les quantités homogènes", () => {
    const postes = buildPostesDecoupe([
      ing({ id: "a", dbId: "car", name: "carotte", amount: 100, unit: "g", cut: { forme: "rape" } }),
      ing({ id: "b", dbId: "car", name: "carotte", amount: 50, unit: "g", cut: { forme: "rape" } }),
    ]);
    expect(postes).toHaveLength(1);
    expect(postes[0].amount).toBe(150);
    expect(postes[0].ingredientIds).toEqual(["a", "b"]);
  });

  it("relègue les légumes salissants en fin de mise en place", () => {
    const postes = buildPostesDecoupe([
      ing({ id: "a", name: "ail", amount: 2, cut: { forme: "hache" } }),
      ing({ id: "b", name: "carotte", amount: 2, cut: { forme: "rape" } }),
    ]);
    expect(postes.map((p) => p.name)).toEqual(["carotte", "ail"]);
  });
});

describe("findDecoupeStepIndex", () => {
  const poste = (name: string, id: string) =>
    buildPostesDecoupe([ing({ id, name, amount: 1, cut: { forme: "rape" } })])[0];

  it("relie le poste à la première étape qui le cite ET mentionne un geste de découpe", () => {
    const ings = [ing({ id: "g", name: "gingembre frais", amount: 15, unit: "g", cut: { forme: "rape" } })];
    const p = buildPostesDecoupe(ings)[0];
    const steps = [
      step({ text: "Faire fondre le beurre à feu doux." }),
      step({ text: "Éplucher le gingembre, puis le râper à la microplane." }),
    ];
    // Le nom « gingembre frais » n'apparaît pas verbatim : l'étape dit « gingembre » seul.
    expect(findDecoupeStepIndex(p, ings, steps)).toBe(1);
  });

  it("tolère le qualificatif absent de l'étape (nom-tête suffisant)", () => {
    const ings = [ing({ id: "c", name: "citron vert", amount: 2, cut: { forme: "rape" } })];
    const p = buildPostesDecoupe(ings)[0];
    const steps = [step({ text: "Zester les deux citrons à la microplane." })];
    expect(findDecoupeStepIndex(p, ings, steps)).toBe(0);
  });

  it("à défaut de geste, renvoie la première étape qui cite simplement le légume", () => {
    const ings = [ing({ id: "o", name: "oignon", amount: 1, cut: { forme: "emince" } })];
    const p = buildPostesDecoupe(ings)[0];
    const steps = [step({ text: "Ajouter l'oignon dans la marmite." })];
    expect(findDecoupeStepIndex(p, ings, steps)).toBe(0);
  });

  it("renvoie -1 quand aucune étape ne relie le poste", () => {
    const p = poste("carotte", "c");
    expect(findDecoupeStepIndex(p, [ing({ id: "c", name: "carotte", cut: { forme: "rape" } })], [
      step({ text: "Préchauffer le four." }),
    ])).toBe(-1);
  });
});

describe("posteLabel", () => {
  it("compose geste impératif, quantité et légume accordés", () => {
    const [p] = buildPostesDecoupe([ing({ id: "a", name: "carotte", amount: 200, unit: "g", cut: { forme: "rape" } })]);
    expect(posteLabel(p)).toBe("Râper : 200g carotte");
  });
});

describe("sortPostesByStep", () => {
  // Bœuf bourguignon : le lard part à l'étape 1, l'oignon à la 3, la carotte à la 8.
  const lines: IngredientLine[] = [
    ing({ id: "c", name: "carotte", amount: 1, cut: { forme: "des", calibre: "gros" } }),
    ing({ id: "o", name: "oignon", amount: 1, cut: { forme: "des", calibre: "gros" } }),
    ing({ id: "l", name: "lard", amount: 200, unit: "g", cut: { forme: "des", calibre: "gros" } }),
  ];
  const steps: Step[] = [
    step({ text: "Faire rissoler le lard coupé en dés jusqu'à ce qu'il soit croustillant." }),
    step({ text: "Saisir la viande." }),
    step({ text: "Tailler l'oignon en dés et le faire revenir." }),
    step({ text: "Mouiller au vin." }),
    step({ text: "Laisser mijoter." }),
    step({ text: "Réduire." }),
    step({ text: "Goûter." }),
    step({ text: "Ajouter la carotte coupée en gros dés." }),
  ];

  it("suit l'ordre des étapes plutôt que l'ordre alphabétique", () => {
    const postes = buildPostesDecoupe(lines);
    expect(postes.map(p => p.name)).toEqual(["carotte", "lard", "oignon"]);
    const byKey = new Map(postes.map(p => [p.key, findDecoupeStepIndex(p, lines, steps)]));
    expect(sortPostesByStep(postes, byKey).map(p => p.name)).toEqual(["lard", "oignon", "carotte"]);
  });

  it("place en fin les postes rattachés à aucune étape, sans perturber les autres", () => {
    const postes = buildPostesDecoupe(lines);
    const keyOf = (name: string) => postes.find(p => p.name === name)!.key;
    const byKey = new Map([[keyOf("carotte"), -1], [keyOf("oignon"), 2]]);
    expect(sortPostesByStep(postes, byKey).map(p => p.name)).toEqual(["oignon", "carotte", "lard"]);
  });

  it("garde l'ordre d'origine à étape égale et ne modifie pas l'entrée", () => {
    const postes = buildPostesDecoupe(lines);
    const byKey = new Map(postes.map(p => [p.key, 0]));
    const sorted = sortPostesByStep(postes, byKey);
    expect(sorted.map(p => p.name)).toEqual(postes.map(p => p.name));
    expect(sorted).not.toBe(postes);
    expect(sortPostesByStep([], new Map())).toEqual([]);
  });
});
