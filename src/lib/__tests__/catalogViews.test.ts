import { describe, it, expect } from "vitest";
import {
  matchesUtensilFilter, matchesTechniqueFilter, groupAdminUtensils, groupAdminTechniques,
  countUtensilsByCategory, countTechniquesByCategory, utensilCategory,
} from "@/lib/admin/catalogViews.js";

const utensils = [
  { id: "u1", name: "Fouet", category: "patisserie", image: "f.jpg" },
  { id: "u2", name: "Bol" },
  { id: "u3", name: "Couteau", category: "decoupe", image: "" },
];
const techniques = [
  { id: "t1", name: "Ciseler", category: "decoupe", difficulty: 2, aliases: ["émincer fin"] },
  { id: "t2", name: "Blanchir", category: "cuisson" },
  { id: "t3", name: "Lier", category: "liaison", difficulty: 9 },
];

describe("ustensiles", () => {
  it("range un ustensile sans famille dans « divers »", () => {
    expect(utensilCategory({})).toBe("divers");
    expect(groupAdminUtensils(utensils, ["decoupe", "divers"], { category: "divers", search: "", filter: null })[0].items).toEqual([utensils[1]]);
  });
  it("filtre les ustensiles sans photo, chaîne vide comprise", () => {
    expect(matchesUtensilFilter(utensils[0], "no-image")).toBe(false);
    expect(matchesUtensilFilter(utensils[2], "no-image")).toBe(true);
    expect(matchesUtensilFilter(utensils[0], null)).toBe(true);
    expect(countUtensilsByCategory(utensils, "no-image")).toEqual({ divers: 1, decoupe: 1 });
  });
});

describe("gestes", () => {
  it("compte un niveau hors 1 à 5 comme absent", () => {
    expect(matchesTechniqueFilter(techniques[0], "no-difficulty")).toBe(false);
    expect(matchesTechniqueFilter(techniques[1], "no-difficulty")).toBe(true);
    expect(matchesTechniqueFilter(techniques[2], "no-difficulty")).toBe(true);
    expect(countTechniquesByCategory(techniques, "no-difficulty")).toEqual({ cuisson: 1, liaison: 1 });
  });
  it("cherche aussi dans les alias", () => {
    const groups = groupAdminTechniques(techniques, ["decoupe", "cuisson"], { category: null, search: "emincer", filter: null });
    expect(groups.flatMap(g => g.items)).toEqual([techniques[0]]);
  });
});
