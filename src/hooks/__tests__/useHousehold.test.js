// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const USER = { uid: "u1", email: "a@b.c" };

vi.mock("../../context/AppShellContext.jsx", () => ({
  useAppShell: () => ({ user: USER, notify: vi.fn(), getSharedData: vi.fn() }),
}));

// Foyer courant simulé côté snapshot membre (null = aucun foyer, pour tester la création).
let memberDoc = { id: "h1", data: () => ({ name: "Mon foyer" }) };
// Invitations simulées côté snapshot invite (vide par défaut).
let inviteDocs = [];
// Pointeur de workspace simulé (`users/{uid}/meta/household`) : null = aucun.
let pointerVal = { id: "h1", migrated: true };
// Callbacks capturés pour rejouer des snapshots (séquences : effacement transitoire,
// retour du membre, changement de pointeur…).
let memberCb = null;
let pointerCb = null;

// Quand true, le snapshot membre n'est PAS livré au montage (simule une appartenance
// encore en cours de chargement : le pointeur peut arriver avant).
let memberSilent = false;

// onSnapshot livre synchronement un snapshot selon le type de requête (membre/invite).
vi.mock("firebase/firestore", () => ({
  onSnapshot: (q, onNext) => {
    if (q?.type === "member") { memberCb = onNext; if (!memberSilent) onNext({ docs: memberDoc ? [memberDoc] : [] }); }
    else onNext({ docs: inviteDocs });
    return () => {};
  },
}));

vi.mock("@/lib/firebase/households.js", () => ({
  householdMemberQuery: () => ({ type: "member" }),
  householdInviteQuery: () => ({ type: "invite" }),
  createHousehold: vi.fn(), inviteToHousehold: vi.fn(), acceptInvite: vi.fn(),
  declineInvite: vi.fn(), exitAllHouseholds: vi.fn(),
  clearHouseholdPointer: vi.fn(), setHouseholdPointer: vi.fn(),
  subscribeHouseholdPointer: (_uid, cb) => { pointerCb = cb; cb(pointerVal); return () => {}; },
}));

import { useHousehold } from "../useHousehold.js";
import { exitAllHouseholds, createHousehold, acceptInvite, setHouseholdPointer, clearHouseholdPointer } from "@/lib/firebase/households.js";
import { act } from "@testing-library/react";

// Rejoue un snapshot d'appartenance (docs du foyer, ou aucun) dans un act().
const emitMember = (doc) => act(() => { memberCb({ docs: doc ? [doc] : [] }); });
// Rejoue un snapshot de pointeur dans un act().
const emitPointer = (val) => act(() => { pointerCb(val); });

describe("useHousehold", () => {
  beforeEach(() => {
    memberDoc = { id: "h1", data: () => ({ name: "Mon foyer" }) };
    inviteDocs = [];
    pointerVal = { id: "h1", migrated: true };
    memberCb = null; pointerCb = null;
    memberSilent = false;
    vi.clearAllMocks();
  });

  it("expose le foyer et sort de l'état loading après le 1er snapshot", () => {
    const { result } = renderHook(() => useHousehold());
    expect(result.current.household).toEqual({ id: "h1", name: "Mon foyer" });
    expect(result.current.loading).toBe(false);
  });

  it("réhydrate le foyer depuis le cache au remontage sans repasser par loading (fix flicker)", () => {
    renderHook(() => useHousehold()).unmount(); // amorce le cache
    const { result } = renderHook(() => useHousehold());
    // Dès le tout premier rendu, loading est déjà false et le foyer est présent.
    expect(result.current.loading).toBe(false);
    expect(result.current.household).toEqual({ id: "h1", name: "Mon foyer" });
  });

  it("expose des actions d'appartenance", () => {
    const { result } = renderHook(() => useHousehold());
    expect(typeof result.current.actions.create).toBe("function");
    expect(typeof result.current.actions.leave).toBe("function");
  });

  // Dissoudre sort l'utilisateur de TOUS ses foyers (robuste aux doublons fantômes),
  // via exitAllHouseholds, plutôt que d'agir sur le seul foyer affiché.
  it("dissout en sortant de tous les foyers de l'utilisateur", async () => {
    const { result } = renderHook(() => useHousehold());
    await result.current.actions.dissolve();
    expect(exitAllHouseholds).toHaveBeenCalledWith(USER);
  });

  it("quitter passe aussi par exitAllHouseholds", async () => {
    const { result } = renderHook(() => useHousehold());
    await result.current.actions.leave();
    expect(exitAllHouseholds).toHaveBeenCalledWith(USER);
  });

  // Anti-foyer-fantôme : un clic répété ne doit semer qu'un seul foyer.
  it("ne crée pas un second foyer quand on en a déjà un", async () => {
    const { result } = renderHook(() => useHousehold());
    const ok = await result.current.actions.create("Autre");
    expect(ok).toBe(false);
    expect(createHousehold).not.toHaveBeenCalled();
  });

  // Non-régression : `.data()` ne porte pas l'id du document. Sans le rattacher,
  // `actions.accept(inv.id)` partait avec `hid = undefined` et l'adhésion plantait
  // au premier accès Firestore (« can't access property indexOf »).
  it("rattache l'id du document aux invitations et l'utilise pour l'adhésion", async () => {
    inviteDocs = [{ id: "h9", data: () => ({ name: "Maison de test" }) }];
    const { result } = renderHook(() => useHousehold());
    expect(result.current.invites).toEqual([{ id: "h9", name: "Maison de test" }]);
    await result.current.actions.accept(result.current.invites[0].id);
    expect(acceptInvite).toHaveBeenCalledWith("h9", USER);
  });

  it("ignore les créations concurrentes (verrou en vol) : un seul appel serveur", async () => {
    memberDoc = null; // aucun foyer : la création est autorisée
    pointerVal = null;
    const { result } = renderHook(() => useHousehold());
    await act(async () => {
      const [a, b] = await Promise.all([
        result.current.actions.create("Maison"),
        result.current.actions.create("Maison"),
      ]);
      expect(a).toBe(true);
      expect(b).toBe(false);
    });
    expect(createHousehold).toHaveBeenCalledTimes(1);
  });

  // ── Réconciliation du pointeur de workspace avec l'appartenance autoritaire ────
  // Cœur du correctif foyer : un membre dont le pointeur diverge de son appartenance
  // réelle lit/écrit le mauvais namespace Firestore et ne partage plus rien.
  describe("réconciliation pointeur ↔ appartenance", () => {
    it("membre d'un foyer SANS pointeur : pose le pointeur (migrated:false) pour fusion additive", () => {
      memberDoc = { id: "h1", data: () => ({ name: "Mon foyer" }) };
      pointerVal = null; // le membre était coincé en solo
      renderHook(() => useHousehold());
      expect(setHouseholdPointer).toHaveBeenCalledWith("u1", "h1", false);
      expect(clearHouseholdPointer).not.toHaveBeenCalled();
    });

    it("membre d'un foyer avec pointeur déjà aligné (migrated:true) : AUCUNE écriture (anti-boucle)", () => {
      memberDoc = { id: "h1", data: () => ({ name: "Mon foyer" }) };
      pointerVal = { id: "h1", migrated: true };
      renderHook(() => useHousehold());
      expect(setHouseholdPointer).not.toHaveBeenCalled();
      expect(clearHouseholdPointer).not.toHaveBeenCalled();
    });

    it("pointeur visant un AUTRE foyer que l'appartenance : réaligne sur le bon foyer", () => {
      memberDoc = { id: "h1", data: () => ({ name: "Mon foyer" }) };
      pointerVal = { id: "h2", migrated: true }; // périmé sur un ancien foyer
      renderHook(() => useHousehold());
      expect(setHouseholdPointer).toHaveBeenCalledWith("u1", "h1", false);
    });

    it("plus membre d'aucun foyer (dissous par autrui) mais pointeur encore posé : efface le pointeur", () => {
      memberDoc = null;
      pointerVal = { id: "h1", migrated: true };
      renderHook(() => useHousehold());
      expect(clearHouseholdPointer).toHaveBeenCalledWith("u1");
      expect(setHouseholdPointer).not.toHaveBeenCalled();
    });

    it("ni membre ni pointeur (vrai solo) : aucune écriture", () => {
      memberDoc = null;
      pointerVal = null;
      renderHook(() => useHousehold());
      expect(setHouseholdPointer).not.toHaveBeenCalled();
      expect(clearHouseholdPointer).not.toHaveBeenCalled();
    });

    it("auto-réparation : pointeur effacé transitoirement puis membre confirmé → repose le pointeur", () => {
      memberDoc = { id: "h1", data: () => ({ name: "Mon foyer" }) };
      pointerVal = { id: "h1", migrated: true };
      renderHook(() => useHousehold());
      expect(setHouseholdPointer).not.toHaveBeenCalled();
      // Le pointeur disparaît (blip), puis un snapshot membre confirme l'appartenance.
      emitPointer(null);
      emitMember({ id: "h1", data: () => ({ name: "Mon foyer" }) });
      expect(setHouseholdPointer).toHaveBeenCalledWith("u1", "h1", false);
    });

    it("appartenance pas encore chargée : un pointeur divergent n'est NI effacé NI réécrit (pas de cycle parasite au chargement)", () => {
      memberSilent = true; // le snapshot membre n'arrive pas encore
      pointerVal = { id: "h2", migrated: true }; // pointeur présent, appartenance inconnue
      renderHook(() => useHousehold());
      expect(clearHouseholdPointer).not.toHaveBeenCalled();
      expect(setHouseholdPointer).not.toHaveBeenCalled();
      // L'appartenance se confirme ensuite → là seulement le pointeur est réaligné.
      emitMember({ id: "h1", data: () => ({ name: "Mon foyer" }) });
      expect(setHouseholdPointer).toHaveBeenCalledWith("u1", "h1", false);
    });

    it("ne boucle pas : une fois le pointeur aligné (migrated:true), de nouveaux snapshots membres n'écrivent rien", () => {
      memberDoc = { id: "h1", data: () => ({ name: "Mon foyer" }) };
      pointerVal = { id: "h1", migrated: true };
      renderHook(() => useHousehold());
      emitMember({ id: "h1", data: () => ({ name: "Mon foyer" }) });
      emitMember({ id: "h1", data: () => ({ name: "Mon foyer (renommé)" }) });
      expect(setHouseholdPointer).not.toHaveBeenCalled();
      expect(clearHouseholdPointer).not.toHaveBeenCalled();
    });
  });
});
