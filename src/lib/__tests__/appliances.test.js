import { describe, it, expect } from "vitest";
import {
  APPLIANCE_LABELS, APPLIANCE_SCHEMAS,
  isApplianceKey, getApplianceSchema, validateParamValues, formatParamSummary,
} from "@/lib/utensils/appliances.js";

describe("schémas d'appareils", () => {
  it("chaque appareil étiqueté a un schéma non vide et cohérent", () => {
    for (const key of Object.keys(APPLIANCE_LABELS)) {
      const schema = APPLIANCE_SCHEMAS[key];
      expect(Array.isArray(schema)).toBe(true);
      expect(schema.length).toBeGreaterThan(0);
      for (const f of schema) {
        expect(["number", "enum", "bool"]).toContain(f.kind);
        if (f.kind === "enum") expect(f.options?.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("isApplianceKey / getApplianceSchema", () => {
  it("reconnaît une clé connue et rejette le reste", () => {
    expect(isApplianceKey("four")).toBe(true);
    expect(isApplianceKey("inconnu")).toBe(false);
    expect(isApplianceKey(undefined)).toBe(false);
    expect(isApplianceKey(42)).toBe(false);
  });

  it("retourne un tableau vide (jamais undefined) pour un appareil absent/inconnu", () => {
    expect(getApplianceSchema(undefined)).toEqual([]);
    expect(getApplianceSchema("nope")).toEqual([]);
    expect(getApplianceSchema("four").length).toBeGreaterThan(0);
  });
});

describe("validateParamValues", () => {
  it("garde les valeurs valides et coerce une chaîne numérique", () => {
    const { values, errors } = validateParamValues("four", {
      prechauffage: true, temperature: "180", mode: "tournante",
    });
    expect(errors).toEqual([]);
    expect(values).toEqual({ prechauffage: true, temperature: 180, mode: "tournante" });
  });

  it("ignore les réglages vides/absents (tous optionnels)", () => {
    const { values, errors } = validateParamValues("four", { temperature: "", mode: null, duree: undefined });
    expect(errors).toEqual([]);
    expect(values).toEqual({});
  });

  it("écarte les clés hors schéma", () => {
    const { values } = validateParamValues("blender", { vitesse: "max", bidon: 5 });
    expect(values).toEqual({ vitesse: "max" });
  });

  it("signale un nombre hors bornes et l'exclut", () => {
    const { values, errors } = validateParamValues("four", { temperature: 999 });
    expect(values).toEqual({});
    expect(errors.join(" ")).toMatch(/maximum/);
  });

  it("signale un choix enum inconnu", () => {
    const { values, errors } = validateParamValues("four", { mode: "plasma" });
    expect(values).toEqual({});
    expect(errors.join(" ")).toMatch(/choix inconnu/);
  });

  it("n'enregistre un booléen que s'il est vrai", () => {
    expect(validateParamValues("four", { prechauffage: false }).values).toEqual({});
    expect(validateParamValues("four", { prechauffage: true }).values).toEqual({ prechauffage: true });
  });

  it("tolère un appareil inconnu ou des valeurs nulles sans planter", () => {
    expect(validateParamValues("nope", { x: 1 })).toEqual({ values: {}, errors: [] });
    expect(validateParamValues("four", null)).toEqual({ values: {}, errors: [] });
    expect(validateParamValues("four", undefined)).toEqual({ values: {}, errors: [] });
  });
});

describe("formatParamSummary", () => {
  it("compose un résumé ordonné selon le schéma", () => {
    const s = formatParamSummary("four", { mode: "tournante", temperature: 180, prechauffage: true });
    expect(s).toBe("Préchauffage · 180 °C · Chaleur tournante");
  });

  it("formate une durée avec son unité", () => {
    expect(formatParamSummary("blender", { vitesse: "max", duree: 30 })).toBe("Vitesse max · 30 s");
  });

  it("ignore les valeurs invalides dans le résumé", () => {
    expect(formatParamSummary("four", { temperature: 999, mode: "gril" })).toBe("Gril");
  });

  it("chaîne vide quand aucun réglage n'est posé ou appareil inconnu", () => {
    expect(formatParamSummary("four", {})).toBe("");
    expect(formatParamSummary("four", null)).toBe("");
    expect(formatParamSummary("nope", { x: 1 })).toBe("");
  });
});
