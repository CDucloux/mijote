// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const USER = { uid: "u1", email: "a@b.c" };

vi.mock("../../context/AppShellContext.jsx", () => ({
  useAppShell: () => ({ user: USER, notify: vi.fn(), getSharedData: vi.fn() }),
}));

// onSnapshot livre synchronement un snapshot selon le type de requête (membre/invite).
vi.mock("firebase/firestore", () => ({
  onSnapshot: (q, onNext) => {
    if (q?.type === "member") onNext({ docs: [{ data: () => ({ id: "h1", name: "Mon foyer" }) }] });
    else onNext({ docs: [] });
    return () => {};
  },
}));

vi.mock("../../lib/firestore.js", () => ({
  householdMemberQuery: () => ({ type: "member" }),
  householdInviteQuery: () => ({ type: "invite" }),
  createHousehold: vi.fn(), inviteToHousehold: vi.fn(), acceptInvite: vi.fn(),
  declineInvite: vi.fn(), leaveHousehold: vi.fn(), dissolveHousehold: vi.fn(),
  clearHouseholdPointer: vi.fn(),
}));

import { useHousehold } from "../useHousehold.js";

describe("useHousehold", () => {
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
});
