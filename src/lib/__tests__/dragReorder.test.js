import { describe, it, expect } from "vitest";
import { dropTargetIndex, edgeScrollSpeed } from "../ui/dragReorder.js";

// Trois lignes de 40 px séparées par une gouttière de 10 px.
const ROWS = [
  { index: 0, top: 100, bottom: 140 },
  { index: 1, top: 150, bottom: 190 },
  { index: 2, top: 200, bottom: 240 },
];

describe("dropTargetIndex", () => {
  it("vise la ligne dont la bande contient le pointeur", () => {
    expect(dropTargetIndex(ROWS, 120, 0)).toBe(0);
    expect(dropTargetIndex(ROWS, 160, 0)).toBe(1);
    expect(dropTargetIndex(ROWS, 239, 0)).toBe(2);
  });
  it("colle à la première ligne au-dessus de la liste, à la dernière en dessous", () => {
    expect(dropTargetIndex(ROWS, 0, 1)).toBe(0);
    expect(dropTargetIndex(ROWS, 100, 1)).toBe(0);   // pile sur le bord haut
    expect(dropTargetIndex(ROWS, 9999, 1)).toBe(2);
    expect(dropTargetIndex(ROWS, 240, 1)).toBe(2);   // pile sur le bord bas
  });
  it("retient la ligne la plus proche dans une gouttière", () => {
    expect(dropTargetIndex(ROWS, 142, 0)).toBe(0);   // 2 px sous la ligne 0
    expect(dropTargetIndex(ROWS, 148, 0)).toBe(1);   // 2 px au-dessus de la ligne 1
  });
  it("respecte les index réels (liste partielle, index non contigus)", () => {
    const rows = [{ index: 5, top: 0, bottom: 20 }, { index: 9, top: 30, bottom: 50 }];
    expect(dropTargetIndex(rows, 10, 0)).toBe(5);
    expect(dropTargetIndex(rows, 40, 0)).toBe(9);
  });
  it("renvoie le repli quand rien n'est mesurable (dépôt sans effet)", () => {
    expect(dropTargetIndex([], 120, 3)).toBe(3);
  });
});

describe("edgeScrollSpeed", () => {
  const TOP = 100, BOTTOM = 700; // conteneur de 600 px

  it("ne défile pas au centre", () => {
    expect(edgeScrollSpeed(400, TOP, BOTTOM)).toBe(0);
  });
  it("remonte près du bord haut, descend près du bord bas", () => {
    expect(edgeScrollSpeed(TOP + 10, TOP, BOTTOM)).toBeLessThan(0);
    expect(edgeScrollSpeed(BOTTOM - 10, TOP, BOTTOM)).toBeGreaterThan(0);
  });
  it("accélère à mesure qu'on approche du bord", () => {
    const loin = Math.abs(edgeScrollSpeed(TOP + 60, TOP, BOTTOM));
    const pres = Math.abs(edgeScrollSpeed(TOP + 10, TOP, BOTTOM));
    expect(pres).toBeGreaterThan(loin);
  });
  it("plafonne à `max`, y compris très au-delà du bord", () => {
    expect(edgeScrollSpeed(TOP, TOP, BOTTOM, 72, 16)).toBe(-16);
    expect(edgeScrollSpeed(-5000, TOP, BOTTOM, 72, 16)).toBe(-16);
    expect(edgeScrollSpeed(5000, TOP, BOTTOM, 72, 16)).toBe(16);
  });
  it("ne défile pas dans un conteneur trop court pour une zone neutre", () => {
    expect(edgeScrollSpeed(110, 100, 200, 72, 16)).toBe(0);
  });
  it("gère des réglages dégénérés sans défiler", () => {
    expect(edgeScrollSpeed(110, TOP, BOTTOM, 0, 16)).toBe(0);
    expect(edgeScrollSpeed(110, TOP, BOTTOM, 72, 0)).toBe(0);
  });
});
