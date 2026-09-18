import { describe, it, expect } from "vitest";
import { tabForPath } from "@/constants/tabs.js";

describe("tabForPath", () => {
  it("mappe les chemins exacts des onglets", () => {
    expect(tabForPath("/home")).toBe("home");
    expect(tabForPath("/recipes")).toBe("recipes");
    expect(tabForPath("/meal-plan")).toBe("meal-plan");
    expect(tabForPath("/shopping-lists")).toBe("shopping");
    expect(tabForPath("/stock")).toBe("stock");
  });

  it("retombe sur l'onglet parent par préfixe", () => {
    // Une fiche recette reste rattachée à l'onglet Recettes.
    expect(tabForPath("/recipes/guacamole")).toBe("recipes");
    expect(tabForPath("/recipes/guacamole/cookmode")).toBe("recipes");
    expect(tabForPath("/admin/dashboard")).toBe("admin");
    expect(tabForPath("/profile")).toBe("profile");
    expect(tabForPath("/legal")).toBe("legal");
    expect(tabForPath("/guide")).toBe("guide");
    expect(tabForPath("/notifications")).toBe("notifications");
  });

  it("retombe sur home pour un chemin vide, nul ou inconnu", () => {
    expect(tabForPath("")).toBe("home");
    expect(tabForPath(null)).toBe("home");
    expect(tabForPath(undefined)).toBe("home");
    expect(tabForPath("/discover")).toBe("home");
  });
});
