import { describe, it, expect } from "vitest";
import { buildEnvelope, readEnvelope } from "@/lib/household/dataEnvelope.js";

const NOW = new Date("2026-10-09T06:26:00.000Z");

describe("buildEnvelope", () => {
  it("place version, date d'export et nombre avant la liste", () => {
    const env = buildEnvelope("ingredients", [{ name: "Ail" }, { name: "Oignon" }], 1, NOW);
    expect(env).toEqual({ schema_version: 1, exported_at: "2026-10-09T06:26:00.000Z", count: 2, ingredients: [{ name: "Ail" }, { name: "Oignon" }] });
    expect(Object.keys(env)).toEqual(["schema_version", "exported_at", "count", "ingredients"]);
  });
});

describe("readEnvelope", () => {
  const ok = { schema_version: 1, exported_at: "2026-10-09T06:26:00.000Z", count: 1, ingredients: [{ name: "Ail" }] };

  it("lit une enveloppe valide et ses métadonnées", () => {
    expect(readEnvelope(ok, "ingredients", 1)).toEqual({
      list: [{ name: "Ail" }], meta: { schemaVersion: 1, exportedAt: "2026-10-09T06:26:00.000Z", count: 1 }, error: null,
    });
  });
  it("accepte une date déjà convertie par le parseur YAML", () => {
    expect(readEnvelope({ ...ok, exported_at: NOW }, "ingredients", 1).meta.exportedAt).toBe("2026-10-09T06:26:00.000Z");
  });
  it("reste compatible avec les anciens exports en liste nue", () => {
    expect(readEnvelope([{ name: "Ail" }], "ingredients", 1)).toEqual({ list: [{ name: "Ail" }], meta: null, error: null });
  });
  it("tolère l'absence de date et de nombre", () => {
    expect(readEnvelope({ schema_version: 1, ingredients: [] }, "ingredients", 1)).toEqual({ list: [], meta: { schemaVersion: 1 }, error: null });
  });
  it("refuse un schéma plus récent que l'app", () => {
    expect(readEnvelope({ ...ok, schema_version: 2 }, "ingredients", 1).error).toMatch(/schéma v2.*v1 au plus/);
  });
  it("refuse une version absente ou invalide", () => {
    expect(readEnvelope({ ingredients: [] }, "ingredients", 1).error).toMatch(/schema_version/);
    expect(readEnvelope({ schema_version: "1", ingredients: [] }, "ingredients", 1).error).toMatch(/schema_version/);
    expect(readEnvelope({ schema_version: 0, ingredients: [] }, "ingredients", 1).error).toMatch(/schema_version/);
  });
  it("refuse une date illisible et un nombre qui ne correspond pas", () => {
    expect(readEnvelope({ ...ok, exported_at: "hier" }, "ingredients", 1).error).toMatch(/exported_at/);
    expect(readEnvelope({ ...ok, count: 3 }, "ingredients", 1).error).toMatch(/annonce 3 entrées.*contient 1/);
  });
  it("refuse une liste absente, mal nommée ou un document vide", () => {
    expect(readEnvelope({ schema_version: 1, utensils: [] }, "ingredients", 1).error).toMatch(/« ingredients » absente/);
    expect(readEnvelope(null, "ingredients", 1).error).toBe("Fichier vide.");
    expect(readEnvelope("texte", "ingredients", 1).error).toMatch(/liste d'entrées/);
  });
});
