import { describe, it, expect } from "vitest";
import { imgAlreadyLoaded } from "../imageLoad";

describe("imgAlreadyLoaded", () => {
  it("vrai quand l'image est complete et decodee", () => {
    expect(imgAlreadyLoaded({ complete: true, naturalWidth: 640 })).toBe(true);
  });

  it("faux quand l'image n'a pas fini de charger", () => {
    expect(imgAlreadyLoaded({ complete: false, naturalWidth: 0 })).toBe(false);
  });

  it("faux quand complete mais echec de decodage (naturalWidth 0)", () => {
    expect(imgAlreadyLoaded({ complete: true, naturalWidth: 0 })).toBe(false);
  });

  it("faux quand l'element n'est pas monte", () => {
    expect(imgAlreadyLoaded(null)).toBe(false);
    expect(imgAlreadyLoaded(undefined)).toBe(false);
  });
});
