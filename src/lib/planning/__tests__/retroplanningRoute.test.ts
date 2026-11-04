import { describe, it, expect } from "vitest";
import { parseRetroplanningPath, retroplanningPath } from "../retroplanningRoute.js";

describe("retroplanningPath / parseRetroplanningPath", () => {
  it("fait l'aller-retour, avec ou sans repas visé", () => {
    const target = { date: "2026-11-04", slot: "soir", groupId: null };
    expect(retroplanningPath(target)).toBe("/retroplanning/2026-11-04/soir");
    expect(parseRetroplanningPath("/retroplanning/2026-11-04/soir")).toEqual(target);
    const grouped = { date: "2026-11-04", slot: "midi", groupId: "g 1" };
    const [path, query] = retroplanningPath(grouped).split("?");
    expect(parseRetroplanningPath(path, `?${query}`)).toEqual(grouped);
  });

  it("tolère une barre finale et ignore un repas vide", () => {
    expect(parseRetroplanningPath("/retroplanning/2026-11-04/soir/", "?repas=")).toEqual({ date: "2026-11-04", slot: "soir", groupId: null });
  });

  it("rejette tout autre chemin ou un jour malformé", () => {
    expect(parseRetroplanningPath("/meal-plan")).toBeNull();
    expect(parseRetroplanningPath("/retroplanning")).toBeNull();
    expect(parseRetroplanningPath("/retroplanning/04-11-2026/soir")).toBeNull();
    expect(parseRetroplanningPath("/retroplanning/2026-11-04/%E0%A4%A")).toBeNull();
  });
});
