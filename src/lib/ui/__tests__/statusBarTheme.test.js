import { describe, it, expect } from "vitest";
import { barColorFor, BAR_COLOR } from "@/lib/ui/statusBarTheme.js";

describe("barColorFor", () => {
  it("renvoie la couleur sombre en thème sombre", () => {
    expect(barColorFor(true)).toBe(BAR_COLOR.dark);
    expect(barColorFor(true)).toBe("#0f110d");
  });

  it("renvoie la couleur claire en thème clair", () => {
    expect(barColorFor(false)).toBe(BAR_COLOR.light);
    expect(barColorFor(false)).toBe("#f3f4ec");
  });
});
