import { useEffect, useRef, useCallback } from "react";
import { getRedirectResult, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import {
  metaDoc, sharedListsCol, userDirCol, userDirDoc,
  loadMasterDB, loadUserData, migrateLegacyDoc, syncRecipes,
  loadSharedData, writeSharedData, setHouseholdPointer,
} from "../lib/firestore.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { normalizePreferences } from "../constants/preferences.js";
import { soloWorkspace, householdWorkspace } from "../lib/workspace.js";
import { mergeShared } from "../lib/householdMigration.js";

const mapOf = (recipes) => { const m = new Map(); for (const r of (recipes || [])) if (r.id) m.set(r.id, r); return m; };

// ─── COUCHE DE SYNCHRONISATION FIRESTORE ──────────────────────────────────────
// Les slices PARTAGÉS (recettes, carnets, planning, listes, stock) sont lus/écrits
// dans le « workspace actif » : l'espace perso (solo) ou un foyer. Les slices
// PERSONNELS (préférences, ajouts perso à la base) restent toujours en solo.
// Le pointeur `users/{uid}/meta/household` ({ id, migrated }) désigne le foyer
// actif ; le coordinateur ci-dessous bascule le namespace et migre les données
// une seule fois (à l'adhésion), sans course ni écho destructeur.
export function useFirestoreSync({
  user, setUser, isAdmin, setSyncStatus, householdPointer,
  recipes, setRecipes,
  collections, setCollections,
  mealPlan, setMealPlan,
  shoppingLists, setShoppingLists,
  setSharedLists,
  setDirectory,
  stock, setStock,
  lowStock, setLowStock,
  preferences, setPreferences,
  masterDB, setMasterDB,
  userDB, setUserDB,
}) {
  const cloudLoaded = useRef(false);
  const recipeSyncMap = useRef(new Map());
  const activeHidRef = useRef(null);   // hid du workspace partagé chargé (null = solo)
  const migratingRef = useRef(false);  // true pendant la bascule/migration → suspend l'autosave

  // Snapshot live des slices partagés (pour capturer l'état local au moment d'une fusion).
  const sharedRef = useRef({});
  sharedRef.current = { recipes, collections, mealPlan, shoppingLists, stock, lowStock };

  const desiredHid = householdPointer?.id || null;
  const sharedWs = useCallback((uid) => (desiredHid ? householdWorkspace(desiredHid) : soloWorkspace(uid)), [desiredHid]);
  const applyShared = useCallback((d) => {
    setRecipes(d.recipes || []);
    setCollections(d.collections || []);
    setMealPlan(d.mealPlan || {});
    setShoppingLists(d.shoppingLists || []);
    setStock(d.stock || []);
    setLowStock(d.lowStock || []);
  }, [setRecipes, setCollections, setMealPlan, setShoppingLists, setStock, setLowStock]);

  // ── Bootstrap auth : charge perso + partagé SOLO, master, migration legacy ────
  useEffect(() => {
    getRedirectResult(auth).catch(() => { });
    const unsub = onAuthStateChanged(auth, async u => {
      cloudLoaded.current = false;
      recipeSyncMap.current = new Map();
      activeHidRef.current = null;
      setUser(u);
      if (!u) return;
      setSyncStatus("syncing");
      try {
        const masterPromise = loadMasterDB();
        const ws = soloWorkspace(u.uid); // bootstrap : toujours l'espace perso (le foyer arrive via le coordinateur)

        let data = await loadUserData(ws);
        const isEmpty = data.recipes.length === 0 && !data.collections && !data.userDB
          && !data.mealPlan && !data.shoppingLists && !data.stock;
        if (isEmpty) {
          const legacy = await migrateLegacyDoc(u.uid);
          if (legacy) {
            data = {
              recipes: legacy.recipes || [],
              collections: legacy.collections || null,
              mealPlan: legacy.mealPlan || null,
              shoppingLists: legacy.shoppingLists || null,
              userDB: { ingredients: legacy.ingredientDB || [], utensils: legacy.utensilDB || [] },
            };
          }
        }

        setRecipes(data.recipes || []);
        if (data.collections) setCollections(data.collections);
        if (data.mealPlan) setMealPlan(data.mealPlan);
        if (data.shoppingLists) setShoppingLists(data.shoppingLists);
        if (data.stock) setStock(data.stock);
        if (data.lowStock) setLowStock(data.lowStock);
        if (data.preferences) setPreferences(normalizePreferences(data.preferences));
        setUserDB(data.userDB || { ingredients: [], utensils: [] });
        const freshMaster = await masterPromise;
        setMasterDB(freshMaster);
        try { localStorage.setItem("rf_masterDB_cache", JSON.stringify(freshMaster)); } catch { /* quota */ }

        recipeSyncMap.current = mapOf(data.recipes);

        if (isEmpty && data.recipes && (data.recipes.length || data.userDB)) {
          await Promise.all([
            syncRecipes(ws, data.recipes, new Map()).then(m => { recipeSyncMap.current = m; }),
            setDoc(metaDoc(ws, "collections"), { items: data.collections || [] }),
            setDoc(metaDoc(ws, "mealPlan"), { data: data.mealPlan || {} }),
            setDoc(metaDoc(ws, "shoppingLists"), { items: data.shoppingLists || [] }),
            setDoc(metaDoc(ws, "stock"), { items: [], low: [] }),
            setDoc(metaDoc(ws, "userDB"), data.userDB || { ingredients: [], utensils: [] }),
          ]);
        }

        setTimeout(() => { cloudLoaded.current = true; setSyncStatus("synced"); }, 0);
      } catch (e) { setSyncStatus("error"); }
    });
    return () => unsub();
  }, []);

  // ── Coordinateur de workspace : bascule solo↔foyer + migration unique ─────────
  useEffect(() => {
    if (!user || !cloudLoaded.current) return;
    if (activeHidRef.current === desiredHid) return; // déjà sur le bon namespace
    let cancelled = false;
    (async () => {
      migratingRef.current = true;
      setSyncStatus("syncing");
      try {
        if (desiredHid) {
          const ws = householdWorkspace(desiredHid);
          const remote = await loadSharedData(ws);
          if (cancelled) return;
          if (householdPointer?.migrated) {
            applyShared(remote);                       // membre déjà à jour : simple chargement
            recipeSyncMap.current = mapOf(remote.recipes);
          } else {
            // 1ère adhésion : fusion additive de MES données (snapshot local) dans le foyer.
            const merged = mergeShared(sharedRef.current, remote);
            const newMap = await writeSharedData(ws, merged, mapOf(remote.recipes));
            if (cancelled) return;
            applyShared(merged);
            recipeSyncMap.current = newMap;
            await setHouseholdPointer(user.uid, desiredHid, true); // marque la migration faite
          }
          activeHidRef.current = desiredHid;
        } else {
          const solo = await loadSharedData(soloWorkspace(user.uid)); // retour en solo (départ)
          if (cancelled) return;
          applyShared(solo);
          recipeSyncMap.current = mapOf(solo.recipes);
          activeHidRef.current = null;
        }
        setSyncStatus("synced");
      } catch { setSyncStatus("error"); }
      finally { migratingRef.current = false; }
    })();
    return () => { cancelled = true; };
  }, [user, desiredHid, householdPointer, applyShared, setSyncStatus]);

  useEffect(() => {
    if (!masterDB.ingredients.length && !masterDB.utensils.length) return;
    try { localStorage.setItem("rf_masterDB_cache", JSON.stringify(masterDB)); } catch { /* quota */ }
  }, [masterDB]);

  // Autosave d'un slice partagé : uniquement quand le workspace est totalement chargé
  // (activeHidRef aligné sur desiredHid) et hors fenêtre de migration → pas d'écho.
  const canAutosaveShared = () => cloudLoaded.current && !migratingRef.current && activeHidRef.current === desiredHid;

  const saveMeta = useCallback(async (name, payload, ws) => {
    if (!user || !cloudLoaded.current) return;
    setSyncStatus("syncing");
    try { await setDoc(metaDoc(ws, name), payload); setSyncStatus("synced"); }
    catch (e) { setSyncStatus("error"); }
  }, [user, setSyncStatus]);

  // Recettes (slice partagé) — diff par id vers le workspace actif.
  useEffect(() => {
    if (!user || !canAutosaveShared()) return;
    setSyncStatus("syncing");
    syncRecipes(sharedWs(user.uid), recipes, recipeSyncMap.current)
      .then(map => { recipeSyncMap.current = map; setSyncStatus("synced"); })
      .catch(() => setSyncStatus("error"));
  }, [recipes, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Méta partagées → workspace actif ; méta perso (préférences, userDB) → solo.
  useEffect(() => { if (canAutosaveShared() && user) saveMeta("collections", { items: collections }, sharedWs(user.uid)); }, [collections]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (canAutosaveShared() && user) saveMeta("mealPlan", { data: mealPlan }, sharedWs(user.uid)); }, [mealPlan]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (canAutosaveShared() && user) saveMeta("shoppingLists", { items: shoppingLists }, sharedWs(user.uid)); }, [shoppingLists]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (canAutosaveShared() && user) saveMeta("stock", { items: stock, low: lowStock }, sharedWs(user.uid)); }, [stock, lowStock]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) saveMeta("preferences", preferences, soloWorkspace(user.uid)); }, [preferences]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) saveMeta("userDB", userDB, soloWorkspace(user.uid)); }, [userDB]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.email) { setSharedLists([]); return; }
    const email = user.email.toLowerCase();
    let unsub;
    try {
      unsub = onSnapshot(
        query(sharedListsCol(), where("memberEmails", "array-contains", email)),
        snap => setSharedLists(snap.docs.map(d => ({ ...d.data(), _shared: true }))),
        () => { }
      );
    } catch { /* noop */ }
    return () => { if (unsub) unsub(); };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) { setDirectory([]); return; }
    setDoc(userDirDoc(user.uid), {
      uid: user.uid, email: (user.email || "").toLowerCase(),
      displayName: user.displayName || "", photoURL: user.photoURL || "", updatedAt: Date.now(),
    }, { merge: true }).catch(() => { });
    getDocs(userDirCol()).then(s => setDirectory(s.docs.map(d => d.data()))).catch(() => { });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !cloudLoaded.current || !isAdmin) return;
    setSyncStatus("syncing");
    Promise.all([
      setDoc(doc(db, "master", "ingredients"), { items: masterDB.ingredients }),
      setDoc(doc(db, "master", "utensils"), { items: masterDB.utensils }),
      setDoc(doc(db, "master", "categories"), { map: masterDB.categories || DEFAULT_CATEGORIES }),
      setDoc(doc(db, "master", "techniques"), { items: masterDB.techniques || [] }),
    ]).then(() => setSyncStatus("synced")).catch(() => setSyncStatus("error"));
  }, [masterDB, user, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  return { cloudLoaded };
}
