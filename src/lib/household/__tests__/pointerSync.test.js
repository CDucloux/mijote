import { describe, it, expect } from "vitest";
import { reconcileHouseholdPointer } from "../pointerSync.js";

describe("reconcileHouseholdPointer", () => {
  it("ne fait rien quand on n'est membre d'aucun foyer et qu'aucun pointeur n'existe", () => {
    expect(reconcileHouseholdPointer(null, null)).toEqual({ kind: "none" });
  });

  it("ne fait rien quand le pointeur vise déjà le foyer dont on est membre (migrated:true préservé)", () => {
    expect(reconcileHouseholdPointer("h1", { id: "h1", migrated: true })).toEqual({ kind: "none" });
  });

  it("ne fait rien non plus quand le pointeur vise le bon foyer mais pas encore migré", () => {
    expect(reconcileHouseholdPointer("h1", { id: "h1", migrated: false })).toEqual({ kind: "none" });
  });

  it("pose le pointeur (migrated:false) quand on est membre mais sans pointeur : correctif du membre coincé en solo", () => {
    expect(reconcileHouseholdPointer("h1", null)).toEqual({ kind: "set", hid: "h1", migrated: false });
  });

  it("réaligne le pointeur quand il vise un AUTRE foyer que celui dont on est membre", () => {
    expect(reconcileHouseholdPointer("h1", { id: "h2", migrated: true })).toEqual({ kind: "set", hid: "h1", migrated: false });
  });

  it("efface le pointeur quand on n'est plus membre d'aucun foyer (dissous par autrui)", () => {
    expect(reconcileHouseholdPointer(null, { id: "h1", migrated: true })).toEqual({ kind: "clear" });
  });
});
