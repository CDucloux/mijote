import { describe, it, expect } from "vitest";
import { computeTooltipPosition } from "@/lib/ui/tooltipPosition.js";

const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
const vp = { width: 1000, height: 800 };

describe("computeTooltipPosition", () => {
  it("se pose au-dessus et centré quand il y a la place", () => {
    const pos = computeTooltipPosition(rect(480, 400, 40, 40), { width: 120, height: 30 }, vp);
    expect(pos.placement).toBe("top");
    expect(pos.top).toBe(400 - 8 - 30);
    expect(pos.left).toBe(500 - 60); // centre 500, demi-largeur 60
    expect(pos.caretLeft).toBe(60);  // caret au centre de la bulle
  });

  it("bascule en dessous quand le haut est trop serré", () => {
    const pos = computeTooltipPosition(rect(480, 4, 40, 40), { width: 120, height: 30 }, vp);
    expect(pos.placement).toBe("bottom");
    expect(pos.top).toBe(44 + 8);
  });

  it("clampe à gauche sans laisser le caret sortir de la bulle", () => {
    const pos = computeTooltipPosition(rect(0, 400, 30, 30), { width: 200, height: 30 }, vp);
    expect(pos.left).toBe(8); // marge gauche
    expect(pos.caretLeft).toBe(12); // caret ramené au coin arrondi
  });

  it("clampe à droite", () => {
    const pos = computeTooltipPosition(rect(980, 400, 20, 30), { width: 200, height: 30 }, vp);
    expect(pos.left).toBe(vp.width - 200 - 8);
    expect(pos.caretLeft).toBe(200 - 12);
  });

  it("choisit le côté le plus dégagé quand aucun ne tient pleinement", () => {
    const tall = { width: 100, height: 500 };
    // ancre près du bas : plus d'espace au-dessus qu'en dessous -> top
    expect(computeTooltipPosition(rect(450, 700, 40, 40), tall, vp).placement).toBe("top");
    // ancre près du haut : plus d'espace en dessous -> bottom
    expect(computeTooltipPosition(rect(450, 60, 40, 40), tall, vp).placement).toBe("bottom");
  });
});
