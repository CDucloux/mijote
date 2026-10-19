import { describe, it, expect } from "vitest";
import { nearestScrollLeft } from "@/lib/ui/scrollNearest.js";

describe("nearestScrollLeft", () => {
  it("ne bouge pas si l'élément est déjà entièrement visible", () => {
    expect(nearestScrollLeft(40, 300, 100, 80)).toBe(40);
  });
  it("recule jusqu'au bord gauche d'un élément masqué à gauche", () => {
    expect(nearestScrollLeft(200, 300, 120, 80)).toBe(120);
  });
  it("avance juste assez pour révéler un élément masqué à droite", () => {
    expect(nearestScrollLeft(0, 300, 280, 80)).toBe(60);
  });
  it("aligne à gauche un élément plus large que la rangée", () => {
    expect(nearestScrollLeft(0, 100, 150, 240)).toBe(150);
  });
  it("ne renvoie jamais de défilement négatif", () => {
    expect(nearestScrollLeft(30, 300, -10, 50)).toBe(0);
  });
});
