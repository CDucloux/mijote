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

  it("toute pose de pointeur se fait en migrated:false (fusion additive) : jamais de perte silencieuse de données", () => {
    // Un `set` qui poserait migrated:true ferait sauter la fusion des données solo
    // résiduelles du membre dans le foyer. On s'assure qu'une pose implique toujours
    // le chemin de fusion, quel que soit l'état de départ du pointeur.
    for (const pointer of [null, { id: "autre", migrated: true }, { id: "autre", migrated: false }]) {
      const action = reconcileHouseholdPointer("h1", pointer);
      expect(action.kind).toBe("set");
      if (action.kind === "set") expect(action.migrated).toBe(false);
    }
  });

  // ── Invariants balayés sur toute la matrice d'états (anti-boucle, convergence) ──
  const MEMBERSHIPS = [null, "h1", "h2"];
  const POINTERS = [
    null,
    { id: "h1", migrated: true },
    { id: "h1", migrated: false },
    { id: "h2", migrated: true },
    { id: "h2", migrated: false },
  ];
  // Applique l'action décidée pour obtenir l'état de pointeur résultant (hors "none",
  // traité à part par l'appelant qui conserve alors le pointeur inchangé).
  const applyAction = (action) => {
    if (action.kind === "set") return { id: action.hid, migrated: action.migrated };
    return null; // "clear"
  };

  it("converge en une passe : après avoir appliqué l'action, une 2ᵉ réconciliation ne fait plus rien", () => {
    for (const membershipHid of MEMBERSHIPS) {
      for (const pointer of POINTERS) {
        const action = reconcileHouseholdPointer(membershipHid, pointer);
        // État du pointeur une fois l'action appliquée (ou inchangé si "none").
        const nextPointer = action.kind === "none" ? pointer : applyAction(action);
        const secondPass = reconcileHouseholdPointer(membershipHid, nextPointer);
        expect(secondPass).toEqual({ kind: "none" });
      }
    }
  });

  it("idempotence : réconcilier deux fois le même état donne la même décision (aucun effet de bord caché)", () => {
    for (const membershipHid of MEMBERSHIPS) {
      for (const pointer of POINTERS) {
        const a = reconcileHouseholdPointer(membershipHid, pointer);
        const b = reconcileHouseholdPointer(membershipHid, pointer);
        expect(a).toEqual(b);
      }
    }
  });

  it("une action aboutit TOUJOURS à un pointeur cohérent avec l'appartenance", () => {
    for (const membershipHid of MEMBERSHIPS) {
      for (const pointer of POINTERS) {
        const action = reconcileHouseholdPointer(membershipHid, pointer);
        const nextPointer = action.kind === "none" ? pointer : applyAction(action);
        // Membre d'un foyer → le pointeur final doit viser CE foyer.
        if (membershipHid) expect(nextPointer?.id).toBe(membershipHid);
        // Aucun foyer → le pointeur final doit être nul.
        else expect(nextPointer).toBeNull();
      }
    }
  });
});
