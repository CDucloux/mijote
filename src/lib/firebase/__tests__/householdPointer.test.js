// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// On capture les callbacks (succès + erreur) passés à onSnapshot pour piloter le test.
let successCb = null;
let errorCb = null;
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  collection: vi.fn(() => ({})),
  onSnapshot: (_ref, onNext, onError) => { successCb = onNext; errorCb = onError; return () => {}; },
  // Symboles importés par firestore.ts mais inutilisés ici :
  getDoc: vi.fn(), getDocs: vi.fn(), writeBatch: vi.fn(), query: vi.fn(), orderBy: vi.fn(),
  limit: vi.fn(), where: vi.fn(), runTransaction: vi.fn(), deleteDoc: vi.fn(), setDoc: vi.fn(),
  addDoc: vi.fn(), serverTimestamp: vi.fn(),
}));
vi.mock("@/lib/firebase/firebase.js", () => ({ db: {} }));
vi.mock("@/lib/observability/observability.js", () => ({ reportError: vi.fn() }));

import { subscribeHouseholdPointer } from "../firestore.js";

beforeEach(() => { successCb = null; errorCb = null; });

describe("subscribeHouseholdPointer", () => {
  it("émet les données du pointeur quand le doc existe", () => {
    const cb = vi.fn();
    subscribeHouseholdPointer("me", cb);
    successCb({ exists: () => true, data: () => ({ id: "h1", migrated: true }) });
    expect(cb).toHaveBeenCalledWith({ id: "h1", migrated: true });
  });

  it("émet null quand le doc n'existe pas (vraiment aucun foyer)", () => {
    const cb = vi.fn();
    subscribeHouseholdPointer("me", cb);
    successCb({ exists: () => false, data: () => ({}) });
    expect(cb).toHaveBeenCalledWith(null);
  });

  it("N'émet PAS null sur erreur d'écoute (blip réseau/jeton) — garde le dernier pointeur, évite la bascule solo", () => {
    const cb = vi.fn();
    subscribeHouseholdPointer("me", cb);
    successCb({ exists: () => true, data: () => ({ id: "h1", migrated: true }) }); // foyer connu
    cb.mockClear();
    errorCb(new Error("permission-denied / offline")); // l'erreur ne doit rien réémettre
    expect(cb).not.toHaveBeenCalled();
  });
});
