// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const USER = { uid: "u1", email: "a@b.c" };

vi.mock("../../context/AppShellContext.jsx", () => ({
  useAppShell: () => ({ user: USER, notify: vi.fn(), getSharedData: vi.fn() }),
}));

// Foyer courant simulé côté snapshot membre (null = aucun foyer, pour tester la création).
let memberDoc = { id: "h1", data: () => ({ name: "Mon foyer" }) };

// onSnapshot livre synchronement un snapshot selon le type de requête (membre/invite).
vi.mock("firebase/firestore", () => ({
  onSnapshot: (q, onNext) => {
    if (q?.type === "member") onNext({ docs: memberDoc ? [memberDoc] : [] });
    else onNext({ docs: [] });
    return () => {};
  },
}));

vi.mock("@/lib/firebase/firestore.js", () => ({
  householdMemberQuery: () => ({ type: "member" }),
  householdInviteQuery: () => ({ type: "invite" }),
  createHousehold: vi.fn(), inviteToHousehold: vi.fn(), acceptInvite: vi.fn(),
  declineInvite: vi.fn(), exitAllHouseholds: vi.fn(),
  clearHouseholdPointer: vi.fn(),
}));

import { useHousehold } from "../useHousehold.js";
import { exitAllHouseholds, createHousehold } from "@/lib/firebase/firestore.js";
import { act } from "@testing-library/react";

describe("useHousehold", () => {
  beforeEach(() => { memberDoc = { id: "h1", data: () => ({ name: "Mon foyer" }) }; vi.clearAllMocks(); });

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

  it("ignore les créations concurrentes (verrou en vol) : un seul appel serveur", async () => {
    memberDoc = null; // aucun foyer : la création est autorisée
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
});
