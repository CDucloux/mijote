// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// onAuthStateChanged est capturé pour piloter la connexion/déconnexion depuis les tests.
let authCb = null;
vi.mock("firebase/auth", () => ({
  getRedirectResult: vi.fn(() => Promise.resolve(null)),
  onAuthStateChanged: (_auth, cb) => { authCb = cb; return () => {}; },
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(() => Promise.resolve()),
  onSnapshot: vi.fn(() => () => {}),
}));
vi.mock("../../lib/firebase.js", () => ({ auth: {}, db: {} }));
vi.mock("../../lib/firestore.js", () => ({
  metaDoc: vi.fn(() => ({})),
  recipesCol: vi.fn(() => ({})),
  upsertOwnDirectoryEntry: vi.fn(() => Promise.resolve()),
  loadMasterDB: vi.fn(),
  subscribeMasterDB: vi.fn(() => () => {}),
  loadUserData: vi.fn(),
  migrateLegacyDoc: vi.fn(() => Promise.resolve(null)),
  syncRecipes: vi.fn(() => Promise.resolve(new Map())),
  loadSharedData: vi.fn(),
  writeSharedData: vi.fn(() => Promise.resolve(new Map())),
  setHouseholdPointer: vi.fn(() => Promise.resolve()),
}));
vi.mock("../../lib/householdMigration.js", () => ({ mergeShared: (_local, remote) => ({ ...remote }) }));

import * as fs from "../../lib/firestore.js";
import { useFirestoreSync } from "../useFirestoreSync.js";

const SETTER_NAMES = ["setUser", "setSyncStatus", "setRecipes", "setCollections", "setMealPlan", "setShoppingLists", "setStock", "setLowStock", "setPreferences", "setMasterDB", "setUserDB"];

function makeProps(over = {}) {
  const setters = Object.fromEntries(SETTER_NAMES.map(n => [n, vi.fn()]));
  return {
    user: null, isAdmin: false, householdPointer: null,
    recipes: [], collections: [], mealPlan: {}, shoppingLists: [], stock: [], lowStock: [],
    preferences: {}, masterDB: { ingredients: [], utensils: [] }, userDB: { ingredients: [], utensils: [] },
    ...setters, ...over,
  };
}

const MASTER = { ingredients: [{ id: "i" }], utensils: [], techniques: [], categories: {} };

beforeEach(() => {
  authCb = null;
  localStorage.clear();
  vi.clearAllMocks();
  fs.migrateLegacyDoc.mockResolvedValue(null);
  fs.syncRecipes.mockResolvedValue(new Map());
  fs.writeSharedData.mockResolvedValue(new Map());
  fs.upsertOwnDirectoryEntry.mockResolvedValue();
});

describe("useFirestoreSync", () => {
  it("déconnexion : remet l'utilisateur à null sans rien charger", async () => {
    const props = makeProps();
    renderHook(p => useFirestoreSync(p), { initialProps: props });
    await act(async () => { await authCb(null); });
    expect(props.setUser).toHaveBeenCalledWith(null);
    expect(fs.loadUserData).not.toHaveBeenCalled();
    expect(fs.loadMasterDB).not.toHaveBeenCalled();
  });

  it("connexion (solo) : charge et applique les données perso + master, statut synchronisé", async () => {
    fs.loadMasterDB.mockResolvedValue(MASTER);
    fs.loadUserData.mockResolvedValue({
      recipes: [{ id: "r1", name: "X" }], collections: [{ id: "c" }], mealPlan: { d: 1 },
      shoppingLists: [], stock: [], lowStock: [], userDB: { ingredients: [], utensils: [] },
      preferences: { diet: "omnivore" },
    });
    const props = makeProps();
    const { rerender } = renderHook(p => useFirestoreSync(p), { initialProps: props });
    await act(async () => { await authCb({ uid: "me", email: "a@b.c" }); });
    rerender({ ...props, user: { uid: "me", email: "a@b.c" } }); // reflète setUser côté App

    await waitFor(() => expect(props.setSyncStatus).toHaveBeenCalledWith("synced"));
    expect(props.setRecipes).toHaveBeenCalledWith([{ id: "r1", name: "X" }]);
    expect(props.setCollections).toHaveBeenCalledWith([{ id: "c" }]);
    expect(props.setMealPlan).toHaveBeenCalledWith({ d: 1 });
    expect(props.setMasterDB).toHaveBeenCalledWith(MASTER);
    expect(localStorage.getItem("rf_masterDB_cache")).toBeTruthy();
    await waitFor(() => expect(fs.upsertOwnDirectoryEntry).toHaveBeenCalled());
  });

  it("membre d'un foyer (déjà migré) : le coordinateur charge et applique les données du foyer", async () => {
    fs.loadMasterDB.mockResolvedValue(MASTER);
    fs.loadUserData.mockResolvedValue({ recipes: [], userDB: { ingredients: [], utensils: [] } });
    fs.loadSharedData.mockResolvedValue({ recipes: [{ id: "hr" }], collections: [], mealPlan: {}, shoppingLists: [], stock: [], lowStock: [] });
    const props = makeProps({ householdPointer: { id: "h1", migrated: true } });
    const { rerender } = renderHook(p => useFirestoreSync(p), { initialProps: props });
    await act(async () => { await authCb({ uid: "me" }); });
    rerender({ ...props, user: { uid: "me" } });

    await waitFor(() => expect(props.setRecipes).toHaveBeenCalledWith([{ id: "hr" }]));
    expect(fs.loadSharedData).toHaveBeenCalled();
    expect(fs.writeSharedData).not.toHaveBeenCalled(); // déjà migré → pas de fusion/écriture
  });

  it("expose les drapeaux cloudLoaded et workspaceReady", () => {
    const props = makeProps();
    const { result } = renderHook(p => useFirestoreSync(p), { initialProps: props });
    expect(result.current.cloudLoaded).toHaveProperty("current");
    expect(typeof result.current.workspaceReady).toBe("boolean");
  });
});
