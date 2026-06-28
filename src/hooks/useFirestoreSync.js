import { useEffect, useRef, useCallback } from "react";
import { getRedirectResult, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import {
  metaDoc, sharedListsCol, userDirCol, userDirDoc,
  loadMasterDB, loadUserData, migrateLegacyDoc, syncRecipes,
} from "../lib/firestore.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { normalizePreferences } from "../constants/preferences.js";

// ─── COUCHE DE SYNCHRONISATION FIRESTORE ──────────────────────────────────────
export function useFirestoreSync({
  user, setUser, isAdmin, setSyncStatus,
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
  const firestoreUnsub = useRef(null);
  const cloudLoaded = useRef(false);
  const recipeSyncMap = useRef(new Map());

  useEffect(() => {
    getRedirectResult(auth).catch(() => { });
    const unsub = onAuthStateChanged(auth, async u => {
      cloudLoaded.current = false;
      recipeSyncMap.current = new Map();
      setUser(u);
      if (u) {
        setSyncStatus("syncing");
        try {
          const masterPromise = loadMasterDB();

          let data = await loadUserData(u.uid);
          const isEmpty = data.recipes.length === 0 && !data.collections && !data.userDB
            && !data.mealPlan && !data.shoppingLists && !data.fridge;

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

          const map = new Map();
          for (const r of (data.recipes || [])) if (r.id) map.set(r.id, r);
          recipeSyncMap.current = map;

          if (isEmpty && data.recipes && (data.recipes.length || data.userDB)) {
            await Promise.all([
              syncRecipes(u.uid, data.recipes, new Map()).then(m => { recipeSyncMap.current = m; }),
              setDoc(metaDoc(u.uid, "collections"), { items: data.collections || [] }),
              setDoc(metaDoc(u.uid, "mealPlan"), { data: data.mealPlan || {} }),
              setDoc(metaDoc(u.uid, "shoppingLists"), { items: data.shoppingLists || [] }),
              setDoc(metaDoc(u.uid, "stock"), { items: [], low: [] }),
              setDoc(metaDoc(u.uid, "userDB"), data.userDB || { ingredients: [], utensils: [] }),
            ]);
          }

          setTimeout(() => { cloudLoaded.current = true; setSyncStatus("synced"); }, 0);
        } catch (e) { setSyncStatus("error"); }
      } else {
        if (firestoreUnsub.current) { firestoreUnsub.current(); firestoreUnsub.current = null; }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!masterDB.ingredients.length && !masterDB.utensils.length) return;
    try { localStorage.setItem("rf_masterDB_cache", JSON.stringify(masterDB)); } catch { /* quota */ }
  }, [masterDB]);

  const saveMeta = useCallback(async (name, payload) => {
    if (!user || !cloudLoaded.current) return;
    setSyncStatus("syncing");
    try {
      await setDoc(metaDoc(user.uid, name), payload);
      setSyncStatus("synced");
    } catch (e) { setSyncStatus("error"); }
  }, [user, setSyncStatus]);

  useEffect(() => {
    if (!user || !cloudLoaded.current) return;
    setSyncStatus("syncing");
    syncRecipes(user.uid, recipes, recipeSyncMap.current)
      .then(map => { recipeSyncMap.current = map; setSyncStatus("synced"); })
      .catch(() => setSyncStatus("error"));
  }, [recipes, user]);

  useEffect(() => { saveMeta("collections", { items: collections }); }, [collections]);
  useEffect(() => { saveMeta("mealPlan", { data: mealPlan }); }, [mealPlan]);
  useEffect(() => { saveMeta("shoppingLists", { items: shoppingLists }); }, [shoppingLists]);
  useEffect(() => { saveMeta("stock", { items: stock, low: lowStock }); }, [stock, lowStock]);
  useEffect(() => { saveMeta("preferences", preferences); }, [preferences]);

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
  }, [user]);

  useEffect(() => {
    if (!user) { setDirectory([]); return; }
    setDoc(userDirDoc(user.uid), {
      uid: user.uid, email: (user.email || "").toLowerCase(),
      displayName: user.displayName || "", photoURL: user.photoURL || "", updatedAt: Date.now(),
    }, { merge: true }).catch(() => { });
    getDocs(userDirCol()).then(s => setDirectory(s.docs.map(d => d.data()))).catch(() => { });
  }, [user]);

  useEffect(() => { saveMeta("userDB", userDB); }, [userDB]);

  useEffect(() => {
    if (!user || !cloudLoaded.current || !isAdmin) return;
    setSyncStatus("syncing");
    Promise.all([
      setDoc(doc(db, "master", "ingredients"), { items: masterDB.ingredients }),
      setDoc(doc(db, "master", "utensils"), { items: masterDB.utensils }),
      setDoc(doc(db, "master", "categories"), { map: masterDB.categories || DEFAULT_CATEGORIES }),
      setDoc(doc(db, "master", "techniques"), { items: masterDB.techniques || [] }),
    ]).then(() => setSyncStatus("synced")).catch(() => setSyncStatus("error"));
  }, [masterDB, user, isAdmin]);

  return { cloudLoaded };
}
