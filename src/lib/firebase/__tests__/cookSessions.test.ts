import { describe, it, expect, vi, beforeEach } from "vitest";

const { stored, tx, updateDoc } = vi.hoisted(() => {
  const stored: { data: unknown } = { data: undefined };
  return {
    stored,
    tx: { get: vi.fn(() => Promise.resolve({ data: () => stored.data })), set: vi.fn(), update: vi.fn() },
    updateDoc: vi.fn((..._args: unknown[]) => Promise.resolve()),
  };
});

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...segs: string[]) => ({ path: segs.join("/") }),
  collection: (_db: unknown, ...segs: string[]) => ({ path: segs.join("/") }),
  runTransaction: (_db: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  updateDoc: (...args: unknown[]) => updateDoc(...args),
  arrayUnion: (v: unknown) => ({ arrayUnion: v }),
  deleteField: () => ({ deleteField: true }),
  onSnapshot: vi.fn(),
}));
vi.mock("@/lib/firebase/firebase.js", () => ({ db: {} }));

import { joinCookSession, markStepDone, finishCookSession, leaveCookSession, publishPresence } from "../cookSessions.js";

const ME = { uid: "me", name: "Corentin", photoURL: "a.png" };
const RECIPE = { id: "r1", name: "Hachis" };
const NOW = 1_800_000_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  stored.data = undefined;
  tx.set.mockClear(); tx.update.mockClear(); updateDoc.mockClear();
});

describe("joinCookSession", () => {
  it("aucune session : en démarre une neuve avec soi seul", async () => {
    const startedAt = await joinCookSession("h1", RECIPE, ME, "overview");
    expect(startedAt).toBe(NOW);
    expect(tx.set).toHaveBeenCalledWith({ path: "households/h1/cookSessions/r1" }, {
      recipeId: "r1", recipeName: "Hachis", startedAt: NOW,
      participants: { me: { name: "Corentin", photoURL: "a.png", page: "overview", lastSeen: NOW, away: false } },
      doneSteps: [], finished: false, finishedBy: null,
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("session vivante : s'y ajoute et reprend son chrono", async () => {
    stored.data = { recipeId: "r1", startedAt: NOW - 60_000, participants: { her: { name: "Léa", page: "step:2", lastSeen: NOW - 1_000 } } };
    const startedAt = await joinCookSession("h1", RECIPE, ME, "overview");
    expect(startedAt).toBe(NOW - 60_000);
    expect(tx.update).toHaveBeenCalledWith({ path: "households/h1/cookSessions/r1" }, {
      "participants.me": { name: "Corentin", photoURL: "a.png", page: "overview", lastSeen: NOW, away: false }, recipeName: "Hachis",
    });
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("session terminée ou abandonnée : repart de zéro (non-régression des étapes héritées)", async () => {
    stored.data = { recipeId: "r1", startedAt: 1, finished: true, doneSteps: [0, 1], participants: { her: { name: "Léa", page: "step:2", lastSeen: NOW } } };
    await joinCookSession("h1", RECIPE, ME, "overview");
    expect(tx.set).toHaveBeenCalledTimes(1);
    expect(tx.set.mock.calls[0][1]).toMatchObject({ doneSteps: [], finished: false, startedAt: NOW });
  });
});

describe("écritures de session", () => {
  const ref = { path: "households/h1/cookSessions/r1" };
  it("présence : entrée complète (identité comprise, non-régression avatar anonyme) et état de veille", async () => {
    await publishPresence("h1", "r1", ME, "step:3", true);
    expect(updateDoc).toHaveBeenCalledWith(ref, {
      "participants.me": { name: "Corentin", photoURL: "a.png", page: "step:3", lastSeen: NOW, away: true },
    });
  });
  it("étape faite : ajout idempotent", async () => {
    await markStepDone("h1", "r1", 2);
    expect(updateDoc).toHaveBeenCalledWith(ref, { doneSteps: { arrayUnion: 2 } });
  });
  it("fin commune et départ", async () => {
    await finishCookSession("h1", "r1", "me");
    await leaveCookSession("h1", "r1", "me");
    expect(updateDoc).toHaveBeenNthCalledWith(1, ref, { finished: true, finishedBy: "me" });
    expect(updateDoc).toHaveBeenNthCalledWith(2, ref, { "participants.me": { deleteField: true } });
  });
});
