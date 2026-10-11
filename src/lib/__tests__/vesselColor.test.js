import { describe, it, expect } from "vitest";
import { vesselColor } from "@/lib/food/vesselColor.js";

describe("vesselColor", () => {
  it("colours wines by their name, case and accents ignored", () => {
    expect(vesselColor("Vin Rouge", "alcohol")).toBe("#6e1f2a");
    expect(vesselColor("Vin Blanc", "alcohol")).toBe("#e3cf86");
    expect(vesselColor("Vin rosé", "alcohol")).toBe("#e8a3a0");
    expect(vesselColor("Rhum ambré", "alcohol")).toBe("#b8742a");
  });

  it("lets the most specific rule win", () => {
    expect(vesselColor("Vinaigre de vin rouge", "acid")).toBe("#a8483a");
    expect(vesselColor("Vinaigre balsamique", "acid")).toBe("#3b1e14");
    expect(vesselColor("Vinaigre de Xérès", "acid")).toBe("#a8483a");
    expect(vesselColor("Porto rouge", "alcohol")).toBe("#6e1f2a");
  });

  it("handles oils and spices, hyphens included", () => {
    expect(vesselColor("Huile d'olive", "oil")).toBe("#b9a646");
    expect(vesselColor("Huile de sésame grillé", "oil")).toBe("#8a5a2a");
    expect(vesselColor("Piment d'Espelette", "condiment")).toBe("#b8432c");
    expect(vesselColor("Eau-de-vie de poire", "alcohol")).toBe("#e6e8e2");
    expect(vesselColor("Sauce soja", "condiment")).toBe("#3b2416");
  });

  it("returns null without a recognised word or name", () => {
    expect(vesselColor("Liqueur maison", "alcohol")).toBeNull();
    expect(vesselColor("", "oil")).toBeNull();
    expect(vesselColor(undefined, "condiment")).toBeNull();
  });

  it("matches whole words only", () => {
    expect(vesselColor("Selle d'agneau", "condiment")).toBeNull();
  });
});
