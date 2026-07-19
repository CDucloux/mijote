import { useEffect, useRef, useCallback, useState } from "react";
import { getRedirectResult, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import {
  metaDoc, recipesCol, upsertOwnDirectoryEntry,
  loadMasterDB, loadUserData, migrateLegacyDoc, syncRecipes,
  loadSharedData, writeSharedData, setHouseholdPointer,
} from "../lib/firestore.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { normalizePreferences } from "../constants/preferences.js";
import { soloWorkspace, householdWorkspace } from "../lib/workspace.js";
import { mergeShared } from "../lib/householdMigration.js";

const mapOf = (recipes) => { const m = new Map(); for (const r of (recipes || [])) if (r.id) m.set(r.id, r); return m; };

// Cache local du foyer actif : permet au bootstrap de charger DIRECTEMENT le bon
// namespace (foyer) au lieu d'afficher le solo une fraction de seconde avant la
// bascule du coordinateur (anti-flicker solo→foyer au rechargement).
const hidCacheKey = (uid) => "rf_active_hid_" + uid;
const readCachedHid = (uid) => { try { return localStorage.getItem(hidCacheKey(uid)) || null; } catch { return null; } };
const writeCachedHid = (uid, hid) => { try { if (hid) localStorage.setItem(hidCacheKey(uid), hid); else localStorage.removeItem(hidCacheKey(uid)); } catch { /* quota */ } };

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
  const metaSigRef = useRef({});       // signatures JSON des méta partagées (anti-écho push/snapshot)
  const recipesSigRef = useRef(null);  // signature des recettes appliquées (load/snapshot) → l'autosave n'écrit QUE sur une vraie modif utilisateur
  const transitionTargetRef = useRef(undefined); // cible d'une bascule en cours (anti-concurrence)
  const [loadedHid, setLoadedHid] = useState(null); // foyer chargé → déclenche les abonnements temps réel
  const [bootstrapped, setBootstrapped] = useState(false); // miroir d'état de cloudLoaded → ré-exécute le coordinateur quand le bootstrap finit
  const [workspaceReady, setWorkspaceReady] = useState(false); // true quand le namespace chargé == le namespace voulu (évite le flash 404 pendant la bascule solo→foyer)

  // Mémorise les signatures des méta partagées chargées (un snapshot identique ne ré-applique rien).
  const seedSigs = useCallback((d) => {
    metaSigRef.current = {
      collections: JSON.stringify(d.collections || []),
      mealPlan: JSON.stringify(d.mealPlan || {}),
      shoppingLists: JSON.stringify(d.shoppingLists || []),
      stock: JSON.stringify({ items: d.stock || [], low: d.lowStock || [] }),
    };
  }, []);

  // Snapshot live des slices partagés (pour capturer l'état local au moment d'une fusion).
  const sharedRef = useRef({});
  sharedRef.current = { recipes, collections, mealPlan, shoppingLists, stock, lowStock };

  const desiredHid = householdPointer?.id || null;
  // Refs « valeur la plus récente » : les effets d'autosave les lisent au moment de
  // s'exécuter (et non via leur closure, potentiellement périmée), sinon une écriture
  // tardive réécrirait une vieille valeur par-dessus un changement distant reçu entre-temps.
  const desiredHidRef = useRef(null); desiredHidRef.current = desiredHid;
  // Le workspace est « prêt » quand le bootstrap est fini ET que le foyer chargé
  // (loadedHid) correspond au foyer voulu (desiredHid). Tant qu'une bascule
  // solo→foyer est en cours, on reste « pas prêt » → l'écran 404 ne flashe pas.
  useEffect(() => { setWorkspaceReady(bootstrapped && loadedHid === desiredHid); }, [bootstrapped, loadedHid, desiredHid]);
  const sharedWsNow = (uid) => (desiredHidRef.current ? householdWorkspace(desiredHidRef.current) : soloWorkspace(uid));
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
      setBootstrapped(false);
      recipeSyncMap.current = new Map();
      activeHidRef.current = null;
      setUser(u);
      if (!u) return;
      setSyncStatus("syncing");
      try {
        const masterPromise = loadMasterDB();
        const ws = soloWorkspace(u.uid); // espace perso (préférences/base + partagé solo)
        // Foyer connu du dernier passage → on charge DIRECTEMENT ses données partagées
        // (pas de flash solo→foyer au reload). Le coordinateur confirmera/corrigera.
        const bootHid = readCachedHid(u.uid);

        let data = await loadUserData(ws);
        const isEmpty = !bootHid && data.recipes.length === 0 && !data.collections && !data.userDB
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

        // Slices PARTAGÉS : depuis le foyer si connu, sinon depuis le solo (`data`).
        // Si le cache est périmé (foyer quitté/dissous ailleurs), le chargement échoue
        // → on retombe sur le solo, le coordinateur rebasculera proprement.
        let shared = data, loadedFromHousehold = false;
        if (bootHid) {
          try { shared = await loadSharedData(householdWorkspace(bootHid)); loadedFromHousehold = true; }
          catch { shared = data; }
        }

        setRecipes(shared.recipes || []);
        if (shared.collections) setCollections(shared.collections);
        if (shared.mealPlan) setMealPlan(shared.mealPlan);
        if (shared.shoppingLists) setShoppingLists(shared.shoppingLists);
        if (shared.stock) setStock(shared.stock);
        if (shared.lowStock) setLowStock(shared.lowStock);
        if (data.preferences) setPreferences(normalizePreferences(data.preferences)); // perso : toujours solo
        setUserDB(data.userDB || { ingredients: [], utensils: [] });               // perso : toujours solo
        const freshMaster = await masterPromise;
        setMasterDB(freshMaster);
        try { localStorage.setItem("rf_masterDB_cache", JSON.stringify(freshMaster)); } catch { /* quota */ }

        recipeSyncMap.current = mapOf(shared.recipes);
        recipesSigRef.current = JSON.stringify(shared.recipes || []);

        if (loadedFromHousehold) {
          // Le foyer est déjà chargé : on s'aligne pour que le coordinateur ne rebascule pas.
          seedSigs(shared);
          activeHidRef.current = bootHid;
          setLoadedHid(bootHid);
        } else if (isEmpty && data.recipes && (data.recipes.length || data.userDB)) {
          await Promise.all([
            syncRecipes(ws, data.recipes, new Map()).then(m => { recipeSyncMap.current = m; }),
            setDoc(metaDoc(ws, "collections"), { items: data.collections || [] }),
            setDoc(metaDoc(ws, "mealPlan"), { data: data.mealPlan || {} }),
            setDoc(metaDoc(ws, "shoppingLists"), { items: data.shoppingLists || [] }),
            setDoc(metaDoc(ws, "stock"), { items: [], low: [] }),
            setDoc(metaDoc(ws, "userDB"), data.userDB || { ingredients: [], utensils: [] }),
          ]);
        }

        setTimeout(() => { cloudLoaded.current = true; setBootstrapped(true); setSyncStatus("synced"); }, 0);
      } catch { setSyncStatus("error"); }
    });
    return () => unsub();
  }, []);

  // ── Coordinateur de workspace : bascule solo↔foyer + migration unique ─────────
  useEffect(() => {
    if (!user || !bootstrapped) return;
    if (activeHidRef.current === desiredHid) return; // déjà sur le bon namespace
    if (transitionTargetRef.current === desiredHid) return; // bascule déjà en cours vers cette cible
    transitionTargetRef.current = desiredHid;
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
            recipesSigRef.current = JSON.stringify(remote.recipes || []);
            seedSigs(remote);
          } else {
            // 1ère adhésion : fusion additive de MES données (snapshot local) dans le foyer.
            const merged = mergeShared(sharedRef.current, remote);
            const newMap = await writeSharedData(ws, merged, mapOf(remote.recipes));
            if (cancelled) return;
            applyShared(merged);
            recipeSyncMap.current = newMap;
            recipesSigRef.current = JSON.stringify(merged.recipes || []);
            seedSigs(merged);
            await setHouseholdPointer(user.uid, desiredHid, true); // marque la migration faite
          }
          activeHidRef.current = desiredHid;
          writeCachedHid(user.uid, desiredHid); // mémorise pour un chargement direct au prochain reload
          setLoadedHid(desiredHid);
        } else {
          // Retour en solo (départ / dissolution). On NE veut PAS perdre les recettes
          // créées dans le foyer : on les fusionne de façon ADDITIVE dans l'espace
          // perso (dédup par nom via mergeShared), puis on écrit le solo enrichi.
          // Effet de bord bienvenu : la transition est additive (l'écran ne se vide
          // pas d'abord pour se repeupler ensuite) → plus de flicker foyer → solo.
          const soloWs = soloWorkspace(user.uid);
          const solo = await loadSharedData(soloWs);
          if (cancelled) return;
          const merged = mergeShared(sharedRef.current, solo); // foyer (local) → solo (remote)
          const newMap = await writeSharedData(soloWs, merged, mapOf(solo.recipes));
          if (cancelled) return;
          applyShared(merged);
          recipeSyncMap.current = newMap;
          recipesSigRef.current = JSON.stringify(merged.recipes || []);
          seedSigs(merged); // signatures méta à jour → l'autosave ne ré-émet pas d'écho
          activeHidRef.current = null;
          writeCachedHid(user.uid, null); // sorti du foyer → on retire le cache
          setLoadedHid(null);
        }
        setSyncStatus("synced");
      } catch { setSyncStatus("error"); }
      finally { migratingRef.current = false; transitionTargetRef.current = undefined; }
    })();
    return () => { cancelled = true; };
  }, [user, bootstrapped, desiredHid, householdPointer, applyShared, setSyncStatus, seedSigs]);

  useEffect(() => {
    if (!masterDB.ingredients.length && !masterDB.utensils.length) return;
    try { localStorage.setItem("rf_masterDB_cache", JSON.stringify(masterDB)); } catch { /* quota */ }
  }, [masterDB]);

  // Autosave d'un slice partagé : uniquement quand le workspace est totalement chargé
  // (activeHidRef aligné sur desiredHid) et hors fenêtre de migration → pas d'écho.
  const canAutosaveShared = () => cloudLoaded.current && !migratingRef.current && activeHidRef.current === desiredHidRef.current;

  const saveMeta = useCallback(async (name, payload, ws) => {
    if (!user || !cloudLoaded.current) return;
    setSyncStatus("syncing");
    try { await setDoc(metaDoc(ws, name), payload); setSyncStatus("synced"); }
    catch { setSyncStatus("error"); }
  }, [user, setSyncStatus]);

  // Recettes (slice partagé) – diff par id vers le workspace actif. On lit la
  // DERNIÈRE valeur (sharedRef) pour ne jamais supprimer une recette arrivée d'un
  // autre membre entre la planification et l'exécution de cet effet.
  useEffect(() => {
    if (!user || !canAutosaveShared()) return;
    const latest = sharedRef.current.recipes || [];
    // N'écrire QUE sur une vraie modif utilisateur : si la signature courante est celle
    // qu'on vient d'appliquer (chargement / snapshot distant), on ne touche à rien
    // (évite l'écho et surtout les suppressions destructrices au reload).
    const sig = JSON.stringify(latest);
    if (recipesSigRef.current === sig) return;
    recipesSigRef.current = sig;
    const ws = sharedWsNow(user.uid);
    setSyncStatus("syncing");
    syncRecipes(ws, latest, recipeSyncMap.current)
      .then(map => { recipeSyncMap.current = map; setSyncStatus("synced"); })
      .catch(() => { setSyncStatus("error"); });
  }, [recipes, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Écrit une méta partagée si elle a changé (signature) : on note la signature avant
  // d'écrire, si bien que le snapshot de notre propre écriture (même JSON) est ignoré.
  // `localVal` est toujours lu depuis sharedRef (valeur la plus récente).
  const pushSharedMeta = (name, localVal, payload) => {
    if (!user || !canAutosaveShared()) return;
    const sig = JSON.stringify(localVal);
    if (metaSigRef.current[name] === sig) return; // écho ou no-op
    metaSigRef.current[name] = sig;
    saveMeta(name, payload, sharedWsNow(user.uid));
  };

  // Méta partagées → workspace actif (anti-écho, valeur la plus récente via sharedRef).
  useEffect(() => { const v = sharedRef.current.collections || []; pushSharedMeta("collections", v, { items: v }); }, [collections]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const v = sharedRef.current.mealPlan || {}; pushSharedMeta("mealPlan", v, { data: v }); }, [mealPlan]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const v = sharedRef.current.shoppingLists || []; pushSharedMeta("shoppingLists", v, { items: v }); }, [shoppingLists]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const v = { items: sharedRef.current.stock || [], low: sharedRef.current.lowStock || [] }; pushSharedMeta("stock", v, v); }, [stock, lowStock]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) saveMeta("preferences", preferences, soloWorkspace(user.uid)); }, [preferences]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) saveMeta("userDB", userDB, soloWorkspace(user.uid)); }, [userDB]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Temps réel (foyer) : abonnement aux données partagées des autres membres ──
  // Les écritures locales (hasPendingWrites) sont ignorées ; les changements distants
  // mettent à jour l'état avec garde de signature/diff pour ne pas relancer d'écriture.
  useEffect(() => {
    if (!user || !loadedHid) return;
    const ws = householdWorkspace(loadedHid);
    const unsubs = [];
    unsubs.push(onSnapshot(recipesCol(ws), snap => {
      if (snap.metadata.hasPendingWrites) return;
      if (snap.metadata.fromCache && snap.empty) return; // ne pas écraser des données valides avec un cache vide
      const remote = snap.docs.map(d => d.data());
      recipeSyncMap.current = mapOf(remote);
      recipesSigRef.current = JSON.stringify(remote);
      setRecipes(remote);
    }));
    const metaSub = (name, fromSnap, apply) => onSnapshot(metaDoc(ws, name), snap => {
      if (snap.metadata.hasPendingWrites) return;
      if (snap.metadata.fromCache && !snap.exists()) return; // cache absent : ne pas réinitialiser
      const val = fromSnap(snap.exists() ? snap.data() : {});
      const sig = JSON.stringify(val);
      if (metaSigRef.current[name] === sig) return;
      metaSigRef.current[name] = sig;
      apply(val);
    });
    unsubs.push(metaSub("collections", d => d.items || [], setCollections));
    unsubs.push(metaSub("mealPlan", d => d.data || {}, setMealPlan));
    unsubs.push(metaSub("shoppingLists", d => d.items || [], setShoppingLists));
    unsubs.push(metaSub("stock", d => ({ items: d.items || [], low: d.low || [] }), v => { setStock(v.items); setLowStock(v.low); }));
    return () => unsubs.forEach(u => u());
  }, [user, loadedHid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ma fiche d'annuaire : un seul write par session (pour être invitable / affichable).
  // La LECTURE de l'annuaire est désormais à la demande (voir loadDirectory dans App) :
  // plus de getDocs global systématique, qui faisait exploser les lectures Firestore.
  useEffect(() => {
    if (!user) return;
    upsertOwnDirectoryEntry(user).catch(() => { });
  }, [user]);

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

  return { cloudLoaded, workspaceReady };
}
