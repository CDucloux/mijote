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
vi.mock("@/lib/firebase/firebase.js", () => ({ auth: {}, db: {} }));
vi.mock("@/lib/firebase/firestore.js", () => ({
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
vi.mock("@/lib/household/householdMigration.js", () => ({ mergeShared: (_local, remote) => ({ ...remote }) }));

import * as fs from "@/lib/firebase/firestore.js";
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

  it("changement de compte : purge immédiate des données du compte précédent (anti-bleed)", async () => {
    fs.loadMasterDB.mockResolvedValue(MASTER);
    fs.loadUserData.mockResolvedValue({ recipes: [{ id: "r1" }], userDB: { ingredients: [], utensils: [] } });
    const props = makeProps();
    const { rerender } = renderHook(p => useFirestoreSync(p), { initialProps: props });
    // 1re connexion (compte A)
    await act(async () => { await authCb({ uid: "userA", email: "a@x.c" }); });
    rerender({ ...props, user: { uid: "userA", email: "a@x.c" } });
    vi.clearAllMocks();
    fs.loadMasterDB.mockResolvedValue(MASTER);
    fs.loadUserData.mockResolvedValue({ recipes: [{ id: "r2" }], userDB: { ingredients: [], utensils: [] } });
    // Bascule vers le compte B : les slices partagés + userDB sont vidés d'emblée.
    await act(async () => { await authCb({ uid: "userB", email: "b@x.c" }); });
    expect(props.setRecipes).toHaveBeenCalledWith([]);
    expect(props.setCollections).toHaveBeenCalledWith([]);
    expect(props.setMealPlan).toHaveBeenCalledWith({});
    expect(props.setUserDB).toHaveBeenCalledWith({ ingredients: [], utensils: [] });
  });

  it("Master : un résultat vide n'écrase PAS un cache/état Master déjà peuplé", async () => {
    localStorage.setItem("rf_masterDB_cache", JSON.stringify(MASTER));
    fs.loadMasterDB.mockResolvedValue({ ingredients: [], utensils: [], techniques: [], categories: {} }); // repli vide (droits refusés)
    fs.loadUserData.mockResolvedValue({ recipes: [], userDB: { ingredients: [], utensils: [] } });
    const props = makeProps({ masterDB: { ingredients: [{ id: "i" }], utensils: [] } }); // Master déjà peuplé
    const { rerender } = renderHook(p => useFirestoreSync(p), { initialProps: props });
    await act(async () => { await authCb({ uid: "me" }); });
    rerender({ ...props, user: { uid: "me" } });
    await waitFor(() => expect(props.setSyncStatus).toHaveBeenCalledWith("synced"));
    // On ne réapplique jamais un Master vide par-dessus des données valides…
    expect(props.setMasterDB).not.toHaveBeenCalledWith({ ingredients: [], utensils: [], techniques: [], categories: {} });
    // …et le cache local reste intact (toujours peuplé).
    expect(JSON.parse(localStorage.getItem("rf_masterDB_cache")).ingredients.length).toBe(1);
  });

  it("foyer hors-ligne : si la lecture partagée échoue, on NE retombe PAS sur le solo", async () => {
    // Foyer connu (cache local) + lecture du foyer qui échoue (hors-ligne) : on reste
    // sur le foyer (l'abonnement temps réel repeuplera depuis le cache Firestore), on
    // n'écrase pas l'état avec les données solo (ex. 10 recettes).
    localStorage.setItem("rf_active_hid_me", "h1");
    fs.loadMasterDB.mockResolvedValue(MASTER);
    fs.loadUserData.mockResolvedValue({ recipes: [{ id: "solo1" }], userDB: { ingredients: [], utensils: [] } });
    fs.loadSharedData.mockRejectedValue(new Error("offline"));
    const props = makeProps();
    const { rerender } = renderHook(p => useFirestoreSync(p), { initialProps: props });
    await act(async () => { await authCb({ uid: "me" }); });
    rerender({ ...props, user: { uid: "me" } });
    await waitFor(() => expect(props.setSyncStatus).toHaveBeenCalledWith("synced"));
    // Jamais les recettes du solo appliquées par-dessus le foyer.
    expect(props.setRecipes).not.toHaveBeenCalledWith([{ id: "solo1" }]);
  });

  it("expose les drapeaux cloudLoaded et workspaceReady", () => {
    const props = makeProps();
    const { result } = renderHook(p => useFirestoreSync(p), { initialProps: props });
    expect(result.current.cloudLoaded).toHaveProperty("current");
    expect(typeof result.current.workspaceReady).toBe("boolean");
  });
});
