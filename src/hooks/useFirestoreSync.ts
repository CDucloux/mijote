import { useEffect, useRef, useCallback, useState } from "react";
import { getRedirectResult, onAuthStateChanged, type User } from "firebase/auth";
import { doc, setDoc, onSnapshot, type DocumentData, type Unsubscribe } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/firebase.js";
import {
  metaDoc, recipesCol, upsertOwnDirectoryEntry,
  loadMasterDB, subscribeMasterDB, loadUserData, migrateLegacyDoc, syncRecipes,
  loadSharedData, writeSharedData, setHouseholdPointer,
  type WorkspaceRef, type MasterDB,
} from "@/lib/firebase/firestore.js";
import { DEFAULT_CATEGORIES } from "@/constants/categories.js";
import { normalizePreferences } from "@/constants/preferences.js";
import { soloWorkspace, householdWorkspace, type Workspace } from "@/lib/household/workspace.js";
import { mergeShared, type SharedData } from "@/lib/household/householdMigration.js";
import type { Recipe } from "@/lib/types.js";

/** Slices partagés (recettes, carnets, planning, listes, stock) — formes opaques. */
interface SharedSlices {
  recipes?: Recipe[] | null;
  collections?: unknown[] | null;
  mealPlan?: Record<string, unknown> | null;
  shoppingLists?: unknown[] | null;
  stock?: unknown[] | null;
  lowStock?: unknown[] | null;
}

/** Données de bootstrap (workspace solo/foyer), recettes garanties, reste optionnel. */
interface BootData {
  recipes: DocumentData[];
  collections?: unknown[] | null;
  mealPlan?: Record<string, unknown> | null;
  shoppingLists?: unknown[] | null;
  stock?: unknown[] | null;
  lowStock?: unknown[] | null;
  userDB?: DocumentData | null;
  preferences?: DocumentData | null;
}

/** Base Master côté hook (drapeaux de longueur + signatures). */
interface MasterLike {
  ingredients: unknown[];
  utensils: unknown[];
  techniques?: unknown[];
  categories?: unknown;
}

/** Pointeur du foyer actif. */
interface HouseholdPointer { id?: string; migrated?: boolean }

/** Dépendances : utilisateur, statut, pointeur foyer + slices d'état et leurs setters. */
export interface FirestoreSyncDeps {
  user: User | null;
  setUser: (u: User | null) => void;
  isAdmin: boolean;
  setSyncStatus: (s: string) => void;
  householdPointer: HouseholdPointer | null | undefined;
  recipes: Recipe[];
  setRecipes: (v: Recipe[]) => void;
  collections: unknown[];
  setCollections: (v: unknown[]) => void;
  mealPlan: Record<string, unknown>;
  setMealPlan: (v: Record<string, unknown>) => void;
  shoppingLists: unknown[];
  setShoppingLists: (v: unknown[]) => void;
  stock: unknown[];
  setStock: (v: unknown[]) => void;
  lowStock: unknown[];
  setLowStock: (v: unknown[]) => void;
  preferences: unknown;
  setPreferences: (v: unknown) => void;
  masterDB: MasterLike;
  setMasterDB: (v: MasterLike) => void;
  userDB: unknown;
  setUserDB: (v: unknown) => void;
}

const mapOf = (recipes: DocumentData[] | null | undefined): Map<string, Recipe> => {
  const m = new Map<string, Recipe>();
  for (const r of (recipes || [])) if (r.id) m.set(r.id, r);
  return m;
};

// Signature de la base Master (anti-écho écriture↔snapshot) : un snapshot dont la
// signature égale la dernière appliquée/écrite ne ré-applique rien et ne relance
// aucune écriture. Doit refléter exactement ce que le push envoie (les 4 slices).
const masterSig = (m: MasterLike): string => JSON.stringify({ i: m.ingredients || [], u: m.utensils || [], t: m.techniques || [], c: m.categories || DEFAULT_CATEGORIES });

// Cache local du foyer actif : permet au bootstrap de charger DIRECTEMENT le bon
// namespace (foyer) au lieu d'afficher le solo une fraction de seconde avant la
// bascule du coordinateur (anti-flicker solo→foyer au rechargement).
const hidCacheKey = (uid: string): string => "rf_active_hid_" + uid;
const readCachedHid = (uid: string): string | null => { try { return localStorage.getItem(hidCacheKey(uid)) || null; } catch { return null; } };
const writeCachedHid = (uid: string, hid: string | null): void => { try { if (hid) localStorage.setItem(hidCacheKey(uid), hid); else localStorage.removeItem(hidCacheKey(uid)); } catch { /* quota */ } };

/**
 * Couche de synchronisation Firestore. Les slices PARTAGÉS (recettes, carnets,
 * planning, listes, stock) sont lus/écrits dans le « workspace actif » (espace perso
 * solo ou foyer) ; les slices PERSONNELS (préférences, ajouts perso) restent en solo.
 * Le pointeur `users/{uid}/meta/household` désigne le foyer actif ; le coordinateur
 * bascule le namespace et migre les données une seule fois (à l'adhésion), sans
 * course ni écho destructeur.
 *
 * @param deps - Utilisateur, statut de sync, pointeur foyer, slices d'état + setters.
 * @returns `{ cloudLoaded, workspaceReady }`.
 */
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
}: FirestoreSyncDeps) {
  const cloudLoaded = useRef(false);
  const recipeSyncMap = useRef<Map<string, Recipe>>(new Map());
  const activeHidRef = useRef<string | null>(null);   // hid du workspace partagé chargé (null = solo)
  const migratingRef = useRef(false);  // true pendant la bascule/migration → suspend l'autosave
  const metaSigRef = useRef<Record<string, string>>({});       // signatures JSON des méta partagées (anti-écho push/snapshot)
  const metaTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});       // timers de debounce par méta (écritures groupées, ex. planning)
  const metaPending = useRef<Record<string, { payload: unknown; ws: WorkspaceRef }>>({});      // { name: { payload, ws } } en attente de flush
  const recipesSigRef = useRef<string | null>(null);  // signature des recettes appliquées (load/snapshot) → l'autosave n'écrit QUE sur une vraie modif utilisateur
  const masterSigRef = useRef("");     // signature de la Master appliquée/écrite (anti-écho écriture↔snapshot temps réel)
  const transitionTargetRef = useRef<string | null | undefined>(undefined); // cible d'une bascule en cours (anti-concurrence)
  const [loadedHid, setLoadedHid] = useState<string | null>(null); // foyer chargé → déclenche les abonnements temps réel
  const [bootstrapped, setBootstrapped] = useState(false); // miroir d'état de cloudLoaded → ré-exécute le coordinateur quand le bootstrap finit
  const [workspaceReady, setWorkspaceReady] = useState(false); // true quand le namespace chargé == le namespace voulu (évite le flash 404 pendant la bascule solo→foyer)

  // Mémorise les signatures des méta partagées chargées (un snapshot identique ne ré-applique rien).
  const seedSigs = useCallback((d: SharedSlices) => {
    metaSigRef.current = {
      collections: JSON.stringify(d.collections || []),
      mealPlan: JSON.stringify(d.mealPlan || {}),
      shoppingLists: JSON.stringify(d.shoppingLists || []),
      stock: JSON.stringify({ items: d.stock || [], low: d.lowStock || [] }),
    };
  }, []);

  // Snapshot live des slices partagés (pour capturer l'état local au moment d'une fusion).
  const sharedRef = useRef<SharedSlices>({});
  sharedRef.current = { recipes, collections, mealPlan, shoppingLists, stock, lowStock };
  // Miroir des préférences locales (perso) : permet au bootstrap de ne pas perdre
  // un displayName saisi localement mais pas encore synchronisé (sinon un
  // rechargement l'écrasait par le displayName vide du cloud).
  const prefsRef = useRef<{ displayName?: string } | null | undefined>(preferences as { displayName?: string } | null | undefined);
  prefsRef.current = preferences as { displayName?: string } | null | undefined;

  const desiredHid = householdPointer?.id || null;
  // Refs « valeur la plus récente » : les effets d'autosave les lisent au moment de
  // s'exécuter (et non via leur closure, potentiellement périmée), sinon une écriture
  // tardive réécrirait une vieille valeur par-dessus un changement distant reçu entre-temps.
  const desiredHidRef = useRef<string | null>(null); desiredHidRef.current = desiredHid;
  // Le workspace est « prêt » quand le bootstrap est fini ET que le foyer chargé
  // (loadedHid) correspond au foyer voulu (desiredHid). Tant qu'une bascule
  // solo→foyer est en cours, on reste « pas prêt » → l'écran 404 ne flashe pas.
  useEffect(() => { setWorkspaceReady(bootstrapped && loadedHid === desiredHid); }, [bootstrapped, loadedHid, desiredHid]);
  const sharedWsNow = (uid: string): Workspace => (desiredHidRef.current ? householdWorkspace(desiredHidRef.current) : soloWorkspace(uid));
  const applyShared = useCallback((d: SharedSlices) => {
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
    // Anti double-démarrage : le repli hors-ligne (plus bas) et la 1re émission du
    // listener peuvent viser le même utilisateur ; on ne bootstrape qu'une fois par
    // uid (les émissions ultérieures pour le même uid — refresh de jeton — sont ignorées).
    let bootstrappedUid: string | null | undefined = undefined;
    const handle = async (u: User | null): Promise<void> => {
      if (bootstrappedUid !== undefined && bootstrappedUid === (u?.uid ?? null)) return;
      bootstrappedUid = u?.uid ?? null;
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

        let data: BootData = await loadUserData(ws);
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
        let shared: BootData = data, loadedFromHousehold = false;
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
        // Préférences (perso, toujours solo). On préserve un displayName saisi
        // localement mais non encore synchronisé : si le cloud ne l'a pas (vide),
        // on garde le local ET on le repousse pour qu'il se propage aux autres
        // appareils. Évite la perte du pseudo au rechargement / sur un 2e appareil.
        {
          const localName = (prefsRef.current?.displayName || "").trim();
          let prefs = data.preferences ? normalizePreferences(data.preferences) : (localName ? normalizePreferences(prefsRef.current) : null);
          if (prefs) {
            if (!prefs.displayName && localName) {
              prefs = { ...prefs, displayName: localName };
              setDoc(metaDoc(ws, "preferences"), prefs).catch(() => { }); // resynchronise le pseudo
            }
            setPreferences(prefs);
          }
        }
        setUserDB(data.userDB || { ingredients: [], utensils: [] });               // perso : toujours solo
        const freshMaster = await masterPromise;
        setMasterDB(freshMaster);
        masterSigRef.current = masterSig(freshMaster); // seed anti-écho : le 1er snapshot (identique) ne re-déclenche rien
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
    };

    const unsub = onAuthStateChanged(auth, handle);
    // ── Démarrage hors-ligne (PWA installée) ──────────────────────────────────
    // Sur un lancement à froid sans réseau, la 1re émission de `onAuthStateChanged`
    // peut tarder très longtemps (jeton d'auth en attente d'un refresh réseau qui
    // n'aboutira pas). Dès que l'utilisateur persisté est disponible (`auth.currentUser`,
    // restauré depuis IndexedDB), on démarre nous-mêmes depuis le cache Firestore sans
    // attendre le réseau. Court-circuité si le listener a déjà démarré (garde par uid).
    let tries = 0;
    let offlineTimer: ReturnType<typeof setTimeout>;
    const tryOfflineBoot = (): void => {
      if (bootstrappedUid !== undefined) return;                 // le listener a déjà démarré
      if (auth.currentUser) { void handle(auth.currentUser); return; }
      if (++tries < 10) offlineTimer = setTimeout(tryOfflineBoot, navigator.onLine ? 900 : 350);
    };
    offlineTimer = setTimeout(tryOfflineBoot, navigator.onLine ? 3500 : 400);
    return () => { clearTimeout(offlineTimer); unsub(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
            recipeSyncMap.current = mapOf(remote.recipes as DocumentData[]);
            recipesSigRef.current = JSON.stringify(remote.recipes || []);
            seedSigs(remote);
          } else {
            // 1ère adhésion : fusion additive de MES données (snapshot local) dans le foyer.
            const merged = mergeShared(sharedRef.current as SharedData, remote);
            const newMap = await writeSharedData(ws, merged, mapOf(remote.recipes as DocumentData[]));
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
          // Retour en solo (départ / dissolution). On CONSERVE tel quel l'état vécu
          // dans le foyer (recettes, carnets, planning, listes, stock) et on l'écrit
          // dans l'espace perso, qui REMPLACE l'ancienne sauvegarde solo (potentiellement
          // périmée : vieilles listes de courses, etc.). Aucune donnée ne « ressuscite »,
          // et rien ne disparaît — le foyer contenait déjà tout (nos données solo y ont
          // été fusionnées à l'adhésion). Transition additive → pas de flicker.
          const soloWs = soloWorkspace(user.uid);
          const soloPrev = await loadSharedData(soloWs); // uniquement pour differ les recettes
          if (cancelled) return;
          const keep = {
            recipes: sharedRef.current.recipes || [],
            collections: sharedRef.current.collections || [],
            mealPlan: sharedRef.current.mealPlan || {},
            shoppingLists: sharedRef.current.shoppingLists || [],
            stock: sharedRef.current.stock || [],
            lowStock: sharedRef.current.lowStock || [],
          };
          const newMap = await writeSharedData(soloWs, keep as SharedData, mapOf(soloPrev.recipes as DocumentData[]));
          if (cancelled) return;
          applyShared(keep);
          recipeSyncMap.current = newMap;
          recipesSigRef.current = JSON.stringify(keep.recipes || []);
          seedSigs(keep); // signatures méta à jour → l'autosave ne ré-émet pas d'écho
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
  const canAutosaveShared = (): boolean => cloudLoaded.current && !migratingRef.current && activeHidRef.current === desiredHidRef.current;

  const saveMeta = useCallback(async (name: string, payload: unknown, ws: WorkspaceRef) => {
    if (!user || !cloudLoaded.current) return;
    setSyncStatus("syncing");
    try { await setDoc(metaDoc(ws, name), payload as DocumentData); setSyncStatus("synced"); }
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
  const pushSharedMeta = (name: string, localVal: unknown, payload: unknown, { debounce = 0 }: { debounce?: number } = {}): void => {
    if (!user || !canAutosaveShared()) return;
    const sig = JSON.stringify(localVal);
    if (metaSigRef.current[name] === sig) return; // écho ou no-op
    metaSigRef.current[name] = sig;
    const ws = sharedWsNow(user.uid);
    if (debounce > 0) {
      // Écritures groupées : glisser/déposer et éditions rapides du planning ne
      // déclenchent qu'un seul setDoc après la pause. Flush garanti (unmount/pagehide).
      metaPending.current[name] = { payload, ws };
      clearTimeout(metaTimers.current[name]);
      setSyncStatus("syncing");
      metaTimers.current[name] = setTimeout(() => {
        const p = metaPending.current[name];
        delete metaPending.current[name]; delete metaTimers.current[name];
        if (p) saveMeta(name, p.payload, p.ws);
      }, debounce);
      return;
    }
    saveMeta(name, payload, ws);
  };

  // Flush des méta debouncées encore en attente (fermeture d'onglet, démontage).
  useEffect(() => {
    const flush = (): void => {
      for (const name of Object.keys(metaPending.current)) {
        clearTimeout(metaTimers.current[name]);
        const p = metaPending.current[name];
        delete metaPending.current[name]; delete metaTimers.current[name];
        if (p) saveMeta(name, p.payload, p.ws);
      }
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => { window.removeEventListener("pagehide", flush); window.removeEventListener("beforeunload", flush); flush(); };
  }, [saveMeta]);

  // Méta partagées → workspace actif (anti-écho, valeur la plus récente via sharedRef).
  useEffect(() => { const v = sharedRef.current.collections || []; pushSharedMeta("collections", v, { items: v }); }, [collections]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const v = sharedRef.current.mealPlan || {}; pushSharedMeta("mealPlan", v, { data: v }, { debounce: 700 }); }, [mealPlan]); // eslint-disable-line react-hooks/exhaustive-deps
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
    const unsubs: Unsubscribe[] = [];
    unsubs.push(onSnapshot(recipesCol(ws), snap => {
      if (snap.metadata.hasPendingWrites) return;
      if (snap.metadata.fromCache && snap.empty) return; // ne pas écraser des données valides avec un cache vide
      const remote = snap.docs.map(d => d.data());
      recipeSyncMap.current = mapOf(remote);
      recipesSigRef.current = JSON.stringify(remote);
      setRecipes(remote);
    }));
    const metaSub = (name: string, fromSnap: (d: DocumentData) => unknown, apply: (v: never) => void): Unsubscribe => onSnapshot(metaDoc(ws, name), snap => {
      if (snap.metadata.hasPendingWrites) return;
      if (snap.metadata.fromCache && !snap.exists()) return; // cache absent : ne pas réinitialiser
      const val = fromSnap(snap.exists() ? snap.data() : {});
      const sig = JSON.stringify(val);
      if (metaSigRef.current[name] === sig) return;
      metaSigRef.current[name] = sig;
      apply(val as never);
    });
    unsubs.push(metaSub("collections", d => d.items || [], setCollections as (v: never) => void));
    unsubs.push(metaSub("mealPlan", d => d.data || {}, setMealPlan as (v: never) => void));
    unsubs.push(metaSub("shoppingLists", d => d.items || [], setShoppingLists as (v: never) => void));
    unsubs.push(metaSub("stock", d => ({ items: d.items || [], low: d.low || [] }), ((v: { items: unknown[]; low: unknown[] }) => { setStock(v.items); setLowStock(v.low); }) as (v: never) => void));
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
    // Pas de vraie modif locale (écho d'un snapshot distant ou seed du bootstrap) → on n'écrit pas.
    if (masterSig(masterDB) === masterSigRef.current) return;
    masterSigRef.current = masterSig(masterDB);
    setSyncStatus("syncing");
    Promise.all([
      setDoc(doc(db, "master", "ingredients"), { items: masterDB.ingredients }),
      setDoc(doc(db, "master", "utensils"), { items: masterDB.utensils }),
      setDoc(doc(db, "master", "categories"), { map: masterDB.categories || DEFAULT_CATEGORIES }),
      setDoc(doc(db, "master", "techniques"), { items: masterDB.techniques || [] }),
    ]).then(() => setSyncStatus("synced")).catch(() => setSyncStatus("error"));
  }, [masterDB, user, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Abonnement temps réel à la Master : un 2e appareil (ou un non-admin) reçoit
  // les modifs sans recharger. Garde de signature → pas de boucle avec l'écriture
  // ci-dessus, et un snapshot identique à l'état courant ne ré-applique rien.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeMasterDB((fresh: MasterDB) => {
      const sig = masterSig(fresh);
      if (sig === masterSigRef.current) return; // écho de notre propre écriture / snapshot identique
      masterSigRef.current = sig;
      setMasterDB(fresh);
      try { localStorage.setItem("rf_masterDB_cache", JSON.stringify(fresh)); } catch { /* quota */ }
    });
    return () => unsub();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return { cloudLoaded, workspaceReady };
}
