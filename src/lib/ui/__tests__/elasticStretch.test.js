import { describe, it, expect } from "vitest";
import { canArmBottomStretch } from "@/lib/ui/elasticStretch.js";

describe("canArmBottomStretch", () => {
  it("sur un conteneur défilant, arme seulement à la butée basse", () => {
    expect(canArmBottomStretch(true, true, false)).toBe(true);
    expect(canArmBottomStretch(true, false, false)).toBe(false);
  });

  it("ignore `armWhenUnscrollable` dès que le contenu défile réellement", () => {
    expect(canArmBottomStretch(true, false, true)).toBe(false);
    expect(canArmBottomStretch(true, true, true)).toBe(true);
  });

  it("sur un contenu qui tient à l'écran, n'arme que si on l'autorise", () => {
    expect(canArmBottomStretch(false, true, false)).toBe(false);
    expect(canArmBottomStretch(false, true, true)).toBe(true);
  });
});
