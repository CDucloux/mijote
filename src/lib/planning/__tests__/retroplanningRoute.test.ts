import { describe, it, expect } from "vitest";
import { parseRetroplanningPath, retroplanningPath } from "../retroplanningRoute.js";

describe("retroplanningPath / parseRetroplanningPath", () => {
  it("expose le créneau en anglais et fait l'aller-retour", () => {
    expect(retroplanningPath({ date: "2026-11-04", slot: "matin", groupId: null })).toBe("/retroplanning/2026-11-04/breakfast");
    expect(retroplanningPath({ date: "2026-11-04", slot: "midi", groupId: null })).toBe("/retroplanning/2026-11-04/lunch");
    const target = { date: "2026-11-04", slot: "soir", groupId: null };
    expect(retroplanningPath(target)).toBe("/retroplanning/2026-11-04/dinner");
    expect(parseRetroplanningPath("/retroplanning/2026-11-04/dinner")).toEqual(target);
  });

  it("porte le repas visé en ?meal=, encodé", () => {
    const grouped = { date: "2026-11-04", slot: "midi", groupId: "g 1" };
    const [path, query] = retroplanningPath(grouped).split("?");
    expect(query).toBe("meal=g%201");
    expect(parseRetroplanningPath(path, `?${query}`)).toEqual(grouped);
  });

  it("tolère une barre finale et ignore un repas vide", () => {
    expect(parseRetroplanningPath("/retroplanning/2026-11-04/dinner/", "?meal=")).toEqual({ date: "2026-11-04", slot: "soir", groupId: null });
  });

  it("rejette tout autre chemin, un jour malformé ou un créneau en français", () => {
    expect(parseRetroplanningPath("/meal-plan")).toBeNull();
    expect(parseRetroplanningPath("/retroplanning")).toBeNull();
    expect(parseRetroplanningPath("/retroplanning/04-11-2026/dinner")).toBeNull();
    expect(parseRetroplanningPath("/retroplanning/2026-11-04/soir")).toBeNull();
    expect(parseRetroplanningPath("/retroplanning/2026-11-04/brunch")).toBeNull();
  });
});
