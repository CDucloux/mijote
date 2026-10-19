import { describe, it, expect } from "vitest";
import { jarFillColor, jarVessel } from "@/lib/food/jarLook.js";
import { vesselColor } from "@/lib/food/vesselColor.js";

describe("jarVessel", () => {
  it("met huiles, vinaigres et alcools en bouteille, condiments en pot à épices", () => {
    expect(jarVessel("oil")?.kind).toBe("bottle");
    expect(jarVessel("acid")?.kind).toBe("bottle");
    expect(jarVessel("alcohol")?.kind).toBe("bottle");
    expect(jarVessel("condiment")?.kind).toBe("spice");
  });

  it("laisse le reste en bocal", () => {
    expect(jarVessel("legume")).toBeUndefined();
    expect(jarVessel("")).toBeUndefined();
  });
});

describe("jarFillColor", () => {
  it("prend d'abord la couleur déduite du nom sur les rayons à contenant", () => {
    const ing = { id: "x", name: "Vin rouge" };
    expect(jarFillColor(ing, "alcohol")).toBe(vesselColor("Vin rouge", "alcohol"));
  });

  it("retombe sur une couleur stable de la palette du rayon", () => {
    const ing = { id: "abc", name: "Liqueur mystère" };
    const color = jarFillColor(ing, "alcohol");
    expect(jarVessel("alcohol")?.fill).toContain(color);
    expect(jarFillColor({ ...ing }, "alcohol")).toBe(color);
  });

  it("teinte un bocal ordinaire depuis sa graine, dbId prioritaire", () => {
    const a = jarFillColor({ id: "local", dbId: "db1", name: "Riz" }, "feculent");
    expect(a).toBe(jarFillColor({ id: "autre", dbId: "db1" }, "feculent"));
    expect(a).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("tolère un ingrédient sans nom ni identifiant", () => {
    expect(jarFillColor({ id: "" }, "feculent")).toMatch(/^#[0-9a-f]{6}$/);
    expect(jarFillColor({ id: "" }, "oil")).toMatch(/^#[0-9a-f]{6}$/);
  });
});
