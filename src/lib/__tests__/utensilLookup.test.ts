import { describe, it, expect } from "vitest";
import { findUtensilEntry } from "@/lib/utensils/utensilLookup.js";
import type { UtensilDbItem } from "@/lib/types.js";

const DB: UtensilDbItem[] = [
  { id: "u1", name: "Poêle", image: "poele.png" },
  { id: "u2", name: "Fouet" },
  { id: "u3" },
];

describe("findUtensilEntry", () => {
  it("résout par dbId en priorité", () => {
    expect(findUtensilEntry(DB, "u2", "Poêle")?.id).toBe("u2");
  });

  it("se replie sur le nom normalisé quand le dbId est absent ou inconnu", () => {
    expect(findUtensilEntry(DB, undefined, "  poele ")?.id).toBe("u1");
    expect(findUtensilEntry(DB, "inconnu", "FOUET")?.id).toBe("u2");
  });

  it("renvoie undefined sans correspondance ni nom", () => {
    expect(findUtensilEntry(DB, "inconnu", undefined)).toBeUndefined();
    expect(findUtensilEntry(DB, null, "Casserole")).toBeUndefined();
  });

  it("tolère une base absente ou vide", () => {
    expect(findUtensilEntry(undefined, "u1", "Poêle")).toBeUndefined();
    expect(findUtensilEntry([], "u1", "Poêle")).toBeUndefined();
  });

  it("ignore les fiches sans nom lors du repli par nom", () => {
    expect(findUtensilEntry([{ id: "x" }], undefined, "")).toBeUndefined();
    expect(findUtensilEntry([{ id: "x" }], undefined, "Poêle")).toBeUndefined();
  });
});
