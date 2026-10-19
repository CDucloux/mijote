import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fs = vi.hoisted(() => ({
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getDocFromCache: vi.fn(),
  getDocsFromCache: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  writeBatch: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: (...a: unknown[]) => fs.getDoc(...a),
  getDocs: (...a: unknown[]) => fs.getDocs(...a),
  getDocFromCache: (...a: unknown[]) => fs.getDocFromCache(...a),
  getDocsFromCache: (...a: unknown[]) => fs.getDocsFromCache(...a),
}));
vi.mock("@/lib/firebase/firebase.js", () => ({ db: {} }));
vi.mock("@/lib/firebase/paths.js", () => ({
  recipesCol: (ws: string) => ({ path: `${ws}/recipes` }),
  metaDoc: (ws: string, name: string) => ({ path: `${ws}/meta/${name}` }),
}));
vi.mock("@/lib/firebase/userDirectory.js", () => ({ userDirDoc: () => ({}) }));

import { loadUserDataFromCache, loadUserDataFast } from "../workspaceData.js";
import { loadAppConfigFast } from "../appConfig.js";

const snap = (data: Record<string, unknown> | null) => ({ exists: () => data !== null, data: () => data ?? undefined });
const META: Record<string, Record<string, unknown> | null> = {
  collections: { items: [{ id: "c1" }] },
  mealPlan: { data: { "2026-10-19": [] } },
  shoppingLists: null,
  stock: { items: [], low: [] },
  userDB: { ingredients: [], utensils: [] },
  preferences: { displayName: "Corentin" },
};
const fullCache = () => {
  fs.getDocsFromCache.mockResolvedValue({ docs: [{ data: () => ({ id: "r1", name: "Tarte" }) }] });
  fs.getDocFromCache.mockImplementation(async (ref: { path: string }) => snap(META[ref.path.split("/").pop() as string]));
};

beforeEach(() => { Object.values(fs).forEach(f => f.mockReset()); });
afterEach(() => { vi.useRealTimers(); });

describe("loadUserDataFromCache", () => {
  it("relit le workspace depuis le cache, docs connus comme absents compris", async () => {
    fullCache();
    const d = await loadUserDataFromCache("users/u1" as never);
    expect(d?.recipes).toEqual([{ id: "r1", name: "Tarte" }]);
    expect(d?.collections).toEqual([{ id: "c1" }]);
    expect(d?.shoppingLists).toBeNull();
    expect(d?.preferences).toEqual({ displayName: "Corentin" });
    expect(fs.getDoc).not.toHaveBeenCalled();
  });

  it("renvoie null si un document n'a jamais été mis en cache (pas d'état partiel)", async () => {
    fullCache();
    fs.getDocFromCache.mockImplementation(async (ref: { path: string }) => {
      if (ref.path.endsWith("mealPlan")) throw new Error("Failed to get document from cache");
      return snap(META[ref.path.split("/").pop() as string]);
    });
    await expect(loadUserDataFromCache("users/u1" as never)).resolves.toBeNull();
  });
});

describe("loadUserDataFast", () => {
  it("sert le cache quand le serveur ne répond pas dans le budget", async () => {
    vi.useFakeTimers();
    fullCache();
    fs.getDocs.mockReturnValue(new Promise(() => { }));
    fs.getDoc.mockReturnValue(new Promise(() => { }));
    const p = loadUserDataFast("users/u1" as never, 1200);
    await vi.advanceTimersByTimeAsync(1200);
    const r = await p;
    expect(r.source).toBe("fallback");
    expect(r.value.recipes).toHaveLength(1);
  });

  it("garde le serveur quand il répond à temps", async () => {
    fs.getDocs.mockResolvedValue({ docs: [] });
    fs.getDoc.mockResolvedValue(snap(null));
    const r = await loadUserDataFast("users/u1" as never, 1200);
    expect(r.source).toBe("primary");
    expect(fs.getDocFromCache).not.toHaveBeenCalled();
  });
});

describe("loadAppConfigFast", () => {
  it("lit la config en cache tout de suite hors ligne", async () => {
    fs.getDocFromCache.mockResolvedValue(snap({ minimumVersion: "4.0.0" }));
    const r = await loadAppConfigFast(new Promise(() => { }), 0);
    expect(r).toEqual({ value: { minimumVersion: "4.0.0" }, source: "fallback" });
  });

  it("fail-open sans config en cache : aucune contrainte, sans attendre le serveur", async () => {
    fs.getDocFromCache.mockRejectedValue(new Error("not cached"));
    await expect(loadAppConfigFast(new Promise(() => { }), 0)).resolves.toEqual({ value: null, source: "fallback" });
  });

  it("préfère la config serveur quand elle arrive dans le budget", async () => {
    const r = await loadAppConfigFast(Promise.resolve(null), 1200);
    expect(r).toEqual({ value: null, source: "primary" });
    expect(fs.getDocFromCache).not.toHaveBeenCalled();
  });
});
