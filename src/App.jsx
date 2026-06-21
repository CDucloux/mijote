import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation, Navigate, Routes, Route } from "react-router-dom";
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, deleteDoc, onSnapshot, getDocs, query, where } from "firebase/firestore";

import { db, auth, provider } from "./lib/firebase.js";
import {
  metaDoc, sharedListsCol, sharedListDoc, userDirCol, userDirDoc,
  toSharedListDoc, loadMasterDB, loadUserData, migrateLegacyDoc, syncRecipes,
} from "./lib/firestore.js";
import { cleanRecipeForExport } from "./lib/recipeSchema.js";
import { deleteImageByUrl } from "./lib/storage.js";
import { printRecipe } from "./lib/recipePdf.js";
import { prepareRecipeImport } from "./lib/recipeImport.js";
import { prepareRecipeForSave, upsertRecipe, recomputeCollectionCounts, buildShoppingItems } from "./lib/recipeActions.js";
import {
  DEFAULT_CATEGORIES, SAMPLE_RECIPES, SAMPLE_COLLECTIONS,
} from "./constants/categories.js";
import { useLS } from "./hooks/useLS.js";
import { useIsDesktop } from "./hooks/useIsDesktop.js";
import { usePageZoom } from "./hooks/usePageZoom.js";
import { SwipeableSheet } from "./components/SwipeableSheet.jsx";
import { PullToRefresh } from "./components/PullToRefresh.jsx";
import { Icon } from "./components/Icon.jsx";
import { RecipeNotFound } from "./components/RecipeNotFound.jsx";
import { TabBar } from "./components/TabBar.jsx";
import { DesktopSidebar } from "./components/DesktopSidebar.jsx";
import { HomeTab } from "./screens/HomeTab.jsx";
import { MealPlanTab } from "./screens/MealPlanTab.jsx";
import { FridgeTab } from "./screens/FridgeTab.jsx";
import { ShoppingTab } from "./screens/ShoppingTab.jsx";
import { RecipeEditor } from "./screens/RecipeEditor.jsx";
import { RecipeDetail } from "./screens/RecipeDetail.jsx";
import { ConfigTab } from "./screens/ConfigTab.jsx";
import { LoadingScreen } from "./screens/LoadingScreen.jsx";
import { LoginScreen } from "./screens/LoginScreen.jsx";
import { TAB_BY_PATH, TAB_BY_ID } from "./constants/tabs.js";


function AppInner() {
  usePageZoom();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = TAB_BY_PATH[location.pathname] || (location.pathname.startsWith("/config/") ? "config" : "home");
  const setTab = useCallback((id) => navigate(TAB_BY_ID[id] || "/recipes"), [navigate]);
  // ── Auth state (declared early so DB setters can read isAdmin) ────────────────
  // `undefined` = en cours de résolution (1er chargement), `null` = déconnecté.
  // Au remontage du composant lors d'une navigation, Firebase est déjà initialisé :
  // `auth.currentUser` renvoie l'utilisateur synchronement, évitant un flash de l'écran
  // de chargement entre les onglets.
  const [user, setUser] = useState(() => auth.currentUser ?? undefined);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
  const isAdmin = !!(user && ADMIN_EMAIL && user.email === ADMIN_EMAIL);

  const [recipes, setRecipes] = useLS("rf_recipes2", SAMPLE_RECIPES);
  const [collections, setCollections] = useLS("rf_collections2", SAMPLE_COLLECTIONS);
  const [mealPlan, setMealPlan] = useLS("rf_mealplan2", {});
  const [shoppingLists, setShoppingLists] = useLS("rf_shopping3", []);
  // Listes partagées (autres membres ou que je partage) — alimentées par onSnapshot.
  const [sharedLists, setSharedLists] = useState([]);
  // Annuaire des utilisateurs connus (pour proposer les e-mails avec avatar au partage).
  const [directory, setDirectory] = useState([]);
  const personalListsRef = useRef(shoppingLists);
  const sharedListsRef = useRef(sharedLists);
  useEffect(() => { personalListsRef.current = shoppingLists; }, [shoppingLists]);
  useEffect(() => { sharedListsRef.current = sharedLists; }, [sharedLists]);
  // Une liste est « partagée » dès qu'elle a au moins un invité. Le tag _shared (issu du
  // snapshot) ne sert qu'à l'affichage — pas à la décision de routage, sinon le départage
  // (sharedWith vidé) ne ramènerait jamais la liste en perso.
  const listIsShared = (l) => Array.isArray(l.sharedWith) && l.sharedWith.length > 0;
  // Vue fusionnée affichée : listes partagées d'abord, puis perso, dédoublonnées par id.
  const mergedShoppingLists = useMemo(() => {
    const sharedIds = new Set(sharedLists.map(l => l.id));
    return [...sharedLists, ...shoppingLists.filter(l => !sharedIds.has(l.id))];
  }, [shoppingLists, sharedLists]);
  // Reference DBs: shared Master + user's own additions, merged for display.
  const [masterDB, setMasterDB] = useState(() => {
    try {
      const cached = localStorage.getItem("rf_masterDB_cache");
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }
    return { ingredients: [], utensils: [], categories: DEFAULT_CATEGORIES };
  });
  const [userDB, setUserDB] = useState({ ingredients: [], utensils: [] });
  // Nutrition categories live in the Master (admin-managed). Fall back to defaults.
  const categories = useMemo(
    () => (masterDB.categories && Object.keys(masterDB.categories).length ? masterDB.categories : DEFAULT_CATEGORIES),
    [masterDB]
  );
  const setCategories = useCallback((updater) => {
    setMasterDB(prev => {
      const cur = prev.categories && Object.keys(prev.categories).length ? prev.categories : DEFAULT_CATEGORIES;
      const next = typeof updater === "function" ? updater(cur) : updater;
      return { ...prev, categories: next };
    });
  }, []);
  // Admins see master items as editable; normal users see them read-only.
  const ingredientDB = useMemo(
    () => [...masterDB.ingredients, ...userDB.ingredients].map(i => ({ ...i, _ro: !isAdmin })),
    [masterDB, userDB, isAdmin]
  );
  const utensilDB = useMemo(
    () => [...masterDB.utensils, ...userDB.utensils].map(u => ({ ...u, _ro: !isAdmin })),
    [masterDB, userDB, isAdmin]
  );
  // Setters: admins write everything to the shared Master (folding in any of their
  // own/migrated items); normal users only ever write to their own additions.
  const setIngredientDB = useCallback((updater) => {
    if (!isAdmin) return; // base de référence en lecture seule pour les non-admins
    const merged = [...masterDB.ingredients, ...userDB.ingredients];
    const next = (typeof updater === "function" ? updater(merged) : updater).map(({ _ro, ...rest }) => rest);
    setMasterDB(prev => ({ ...prev, ingredients: next }));
    if (userDB.ingredients.length) setUserDB(prev => ({ ...prev, ingredients: [] }));
  }, [masterDB, userDB, isAdmin]);
  const setUtensilDB = useCallback((updater) => {
    if (!isAdmin) return; // base de référence en lecture seule pour les non-admins
    const merged = [...masterDB.utensils, ...userDB.utensils];
    const next = (typeof updater === "function" ? updater(merged) : updater).map(({ _ro, ...rest }) => rest);
    setMasterDB(prev => ({ ...prev, utensils: next }));
    if (userDB.utensils.length) setUserDB(prev => ({ ...prev, utensils: [] }));
  }, [masterDB, userDB, isAdmin]);

  // Écrit les changements des listes partagées vers Firestore (création/màj/suppression/quitter).
  // Compare l'ancien et le nouvel état fusionné pour n'écrire que ce qui change.
  const persistSharedDiffs = useCallback(async (prevMerged, next) => {
    if (!user?.email) return;
    const myEmail = user.email.toLowerCase();
    const prevById = new Map(prevMerged.map(l => [l.id, l]));
    const nextById = new Map(next.map(l => [l.id, l]));
    const ops = [];
    for (const l of next) {
      const prev = prevById.get(l.id);
      if (!listIsShared(l)) {
        // Départage : était partagée, redevient perso → le propriétaire supprime le doc partagé.
        if (prev && prev._shared && (prev.ownerEmail || "").toLowerCase() === myEmail) {
          ops.push(deleteDoc(sharedListDoc(l.id)));
        }
        continue;
      }
      const ownerEmail = (l.ownerEmail || myEmail).toLowerCase();
      const ownerUid = l.ownerUid || (ownerEmail === myEmail ? user.uid : null);
      const payload = toSharedListDoc(l, { ownerEmail, ownerUid });
      const sig = p => JSON.stringify({ name: p.name, items: p.items, hideClear: !!p.hideClear, sharedWith: (p.sharedWith || []).map(e => (e || "").toLowerCase()) });
      if (!prev || !prev._shared || sig(prev) !== sig(payload)) {
        ops.push(setDoc(sharedListDoc(l.id), payload));
      }
    }
    for (const l of prevMerged) {
      if (l._shared && !nextById.has(l.id)) {
        if ((l.ownerEmail || "").toLowerCase() === myEmail) {
          ops.push(deleteDoc(sharedListDoc(l.id)));                          // propriétaire : suppression
        } else {
          const sharedWith = (l.sharedWith || []).filter(e => (e || "").toLowerCase() !== myEmail);
          const memberEmails = (l.memberEmails || []).filter(e => (e || "").toLowerCase() !== myEmail);
          ops.push(setDoc(sharedListDoc(l.id), { ...toSharedListDoc(l, { ownerEmail: (l.ownerEmail || "").toLowerCase(), ownerUid: l.ownerUid || null }), sharedWith, memberEmails })); // membre : quitter
        }
      }
    }
    if (!ops.length) return;
    setSyncStatus("syncing");
    const results = await Promise.allSettled(ops);
    if (results.some(r => r.status === "rejected")) {
      setSyncStatus("error");
      notify("Partage indisponible : écriture refusée. Les règles Firestore sont-elles déployées ?", "error");
    } else {
      setSyncStatus("synced");
    }
  }, [user]);

  // Setter unique exposé à ShoppingTab : reçoit la liste FUSIONNÉE, aiguille perso vs partagé.
  const setMergedShoppingLists = useCallback((updater) => {
    const myEmail = (user?.email || "").toLowerCase();
    const sharedIds = new Set(sharedListsRef.current.map(l => l.id));
    // Vue fusionnée identique au memo : la version partagée prime sur la copie perso de même id.
    const prevMerged = [...sharedListsRef.current, ...personalListsRef.current.filter(l => !sharedIds.has(l.id))];
    const next = typeof updater === "function" ? updater(prevMerged) : updater;

    const ownerOf = l => (l.ownerEmail || myEmail).toLowerCase();
    const isMine = l => !listIsShared(l) || ownerOf(l) === myEmail;

    // Anti-perte : le PROPRIÉTAIRE garde toujours une copie perso durable, même partagée.
    // Les listes partagées PAR d'autres ne vivent que dans la collection partagée.
    const nextPersonal = next.filter(isMine);
    const nextShared = next.filter(listIsShared);

    const strippedPersonal = nextPersonal.map(l => {
      const { _shared, memberEmails, ownerUid, ...rest } = l;
      if (listIsShared(l)) return { ...rest, ownerEmail: ownerOf(l) };  // conserve sharedWith + ownerEmail
      const { ownerEmail, sharedWith, ...clean } = rest;                // perso non partagée : aucune méta de partage
      return clean;
    });
    if (JSON.stringify(personalListsRef.current) !== JSON.stringify(strippedPersonal)) setShoppingLists(strippedPersonal);

    setSharedLists(nextShared.map(l => {                              // reflet optimiste immédiat
      const ownerEmail = ownerOf(l);
      const sw = (l.sharedWith || []).map(e => (e || "").toLowerCase());
      return { ...l, _shared: true, ownerEmail, ownerUid: l.ownerUid || (ownerEmail === myEmail ? user?.uid : null), memberEmails: Array.from(new Set([ownerEmail, ...sw])) };
    }));
    persistSharedDiffs(prevMerged, next);
  }, [persistSharedDiffs, setShoppingLists, user]);
  const [fridge, setFridge] = useLS("rf_fridge", []);
  const [fridgeSettings, setFridgeSettings] = useLS("rf_fridge_settings", { matchThreshold: 25 });
  const [pantry, setPantry] = useLS("rf_pantry", []);
  // Dérivé du pathname (et non de useParams) pour qu'AppInner reste une instance
  // unique montée sur `path="*"` : pas de remontage entre les onglets.
  const recipeIdParam = location.pathname.startsWith("/recipes/")
    ? decodeURIComponent(location.pathname.slice(9)) || undefined
    : undefined;
  const selectedRecipe = recipeIdParam || null;
  const setSelectedRecipe = useCallback((id) => {
    if (id) navigate(`/recipes/${id}`);
    else navigate(location.pathname === `/recipes/${recipeIdParam}` ? "/recipes" : location.pathname, { replace: true });
  }, [navigate, location.pathname, recipeIdParam]);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [notification, setNotification] = useState(null);

  // ── Auth refs ─────────────────────────────────────────────────────────────────
  const firestoreUnsub = useRef(null);
  const cloudLoaded = useRef(false); // gate saves until initial cloud load completes
  const recipeSyncMap = useRef(new Map()); // last-synced recipe snapshot for diffing

  useEffect(() => {
    getRedirectResult(auth).catch(() => { });
    const unsub = onAuthStateChanged(auth, async u => {
      cloudLoaded.current = false;
      recipeSyncMap.current = new Map();
      setUser(u);
      if (u) {
        setSyncStatus("syncing");
        try {
          // Master reference DB (shared, read-only) — load in parallel.
          const masterPromise = loadMasterDB();

          // Load user's split data.
          let data = await loadUserData(u.uid);
          const isEmpty = data.recipes.length === 0 && !data.collections && !data.userDB
            && !data.mealPlan && !data.shoppingLists && !data.fridge;

          // First run with no split data? Try migrating the legacy single doc.
          if (isEmpty) {
            const legacy = await migrateLegacyDoc(u.uid);
            if (legacy) {
              data = {
                recipes: legacy.recipes || [],
                collections: legacy.collections || null,
                mealPlan: legacy.mealPlan || null,
                shoppingLists: legacy.shoppingLists || null,
                fridge: legacy.fridge || null,
                fridgeSettings: legacy.fridgeSettings || null,
                // Legacy ingredientDB/utensilDB become the user's own additions.
                userDB: { ingredients: legacy.ingredientDB || [], utensils: legacy.utensilDB || [] },
              };
            }
          }

          // Hydrate state.
          setRecipes(data.recipes || []);
          if (data.collections) setCollections(data.collections);
          if (data.mealPlan) setMealPlan(data.mealPlan);
          if (data.shoppingLists) setShoppingLists(data.shoppingLists);
          if (data.fridge) setFridge(data.fridge);
          if (data.fridgeSettings) setFridgeSettings(data.fridgeSettings);
          if (data.pantry) setPantry(data.pantry);
          setUserDB(data.userDB || { ingredients: [], utensils: [] });
          const freshMaster = await masterPromise;
          setMasterDB(freshMaster);
          try { localStorage.setItem("rf_masterDB_cache", JSON.stringify(freshMaster)); } catch { /* quota */ }

          // Seed the recipe diff map so the first save doesn't rewrite everything.
          const map = new Map();
          for (const r of (data.recipes || [])) if (r.id) map.set(r.id, r);
          recipeSyncMap.current = map;

          // If we migrated, persist into the split structure once.
          if (isEmpty && data.recipes && (data.recipes.length || data.userDB)) {
            await Promise.all([
              syncRecipes(u.uid, data.recipes, new Map()).then(m => { recipeSyncMap.current = m; }),
              setDoc(metaDoc(u.uid, "collections"), { items: data.collections || [] }),
              setDoc(metaDoc(u.uid, "mealPlan"), { data: data.mealPlan || {} }),
              setDoc(metaDoc(u.uid, "shoppingLists"), { items: data.shoppingLists || [] }),
              setDoc(metaDoc(u.uid, "fridge"), { items: data.fridge || [], settings: data.fridgeSettings || { matchThreshold: 25 }, pantry: data.pantry || [] }),
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
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem("rf_theme") !== "light"; } catch { return true; }
  });
  const toggleTheme = () => setIsDark(prev => {
    const next = !prev;
    try { localStorage.setItem("rf_theme", next ? "dark" : "light"); } catch { }
    return next;
  });

  // Sync theme class to <html> so html/body background updates too
  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);
  }, [isDark]);

  // Keep masterDB cache in sync so images are available after reload
  useEffect(() => {
    if (!masterDB.ingredients.length && !masterDB.utensils.length) return;
    try { localStorage.setItem("rf_masterDB_cache", JSON.stringify(masterDB)); } catch { /* quota */ }
  }, [masterDB]);

  // Update document title on tab change
  useEffect(() => {
    const titles = { "home": "Recettes", "meal-plan": "Planning", "shopping": "Courses", "fridge": "Frigo", "config": "Configuration" };
    document.title = `Mijoté | ${titles[tab] || "Recettes"}`;
  }, [tab]);


  // ── Save to Firestore whenever data changes (split structure) ─────────────────
  const saveMeta = useCallback(async (name, payload) => {
    if (!user || !cloudLoaded.current) return;
    setSyncStatus("syncing");
    try {
      await setDoc(metaDoc(user.uid, name), payload);
      setSyncStatus("synced");
    } catch (e) { setSyncStatus("error"); }
  }, [user]);

  // Recipes: diff-based — only changed/new/removed docs are written.
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

  // Abonnement temps réel aux listes partagées dont je suis membre (par e-mail).
  useEffect(() => {
    if (!user?.email) { setSharedLists([]); return; }
    const email = user.email.toLowerCase();
    let unsub;
    try {
      unsub = onSnapshot(
        query(sharedListsCol(), where("memberEmails", "array-contains", email)),
        snap => setSharedLists(snap.docs.map(d => ({ ...d.data(), _shared: true }))),
        () => { } // règles non déployées / hors-ligne : on ignore silencieusement
      );
    } catch { /* noop */ }
    return () => { if (unsub) unsub(); };
  }, [user]);

  // Annuaire : publie ma fiche (e-mail/avatar) et charge celles des autres pour le partage.
  useEffect(() => {
    if (!user) { setDirectory([]); return; }
    setDoc(userDirDoc(user.uid), {
      uid: user.uid, email: (user.email || "").toLowerCase(),
      displayName: user.displayName || "", photoURL: user.photoURL || "", updatedAt: Date.now(),
    }, { merge: true }).catch(() => { });
    getDocs(userDirCol()).then(s => setDirectory(s.docs.map(d => d.data()))).catch(() => { });
  }, [user]);
  useEffect(() => { saveMeta("fridge", { items: fridge, settings: fridgeSettings, pantry }); }, [fridge, fridgeSettings, pantry]);
  useEffect(() => { saveMeta("userDB", userDB); }, [userDB]);

  // Master DB: only admins persist changes (and Firestore rules enforce it server-side).
  useEffect(() => {
    if (!user || !cloudLoaded.current || !isAdmin) return;
    setSyncStatus("syncing");
    Promise.all([
      setDoc(doc(db, "master", "ingredients"), { items: masterDB.ingredients }),
      setDoc(doc(db, "master", "utensils"), { items: masterDB.utensils }),
      setDoc(doc(db, "master", "categories"), { map: masterDB.categories || DEFAULT_CATEGORIES }),
    ]).then(() => setSyncStatus("synced")).catch(() => setSyncStatus("error"));
  }, [masterDB, user, isAdmin]);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 2800);
  };

  const saveRecipe = r => {
    const result = prepareRecipeForSave(r, { recipes, ingredientDB });
    if (result.error) { notify(result.error, "error"); return; }
    const updatedRecipes = upsertRecipe(recipes, result.recipe);
    setRecipes(updatedRecipes);
    setCollections(prev => recomputeCollectionCounts(prev, updatedRecipes));
    setEditingRecipe(null);
    notify("Recette sauvegardée ✓");
  };

  const deleteRecipe = id => {
    const r = recipes.find(x => x.id === id);
    if (r?.image) deleteImageByUrl(r.image);
    setRecipes(prev => prev.filter(r => r.id !== id));
    navigate("/recipes");
    notify("Recette supprimée");
  };

  const addToShopping = (recipe, selectedIngredients, mult = 1) => {
    const items = buildShoppingItems(recipe, selectedIngredients, mult, ingredientDB);
    if (items.length === 0) return;
    setShoppingLists(prev => {
      const existing = prev.find(l => l.type === "recipe" && l.recipeId === recipe.id);
      if (existing) {
        return prev.map(l => l.id === existing.id ? { ...l, items: [...l.items, ...items] } : l);
      }
      return [...prev, { id: "sl" + Date.now(), name: recipe.name, type: "recipe", recipeId: recipe.id, items }];
    });
    notify(`${items.length} ingrédient(s) ajoutés aux courses`);
  };

  const exportJSON = recipe => {
    const blob = new Blob([JSON.stringify(cleanRecipeForExport(recipe), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${recipe.name.split(" ").join("_")}.json`; a.click();
    notify("Export JSON téléchargé");
  };

  const importJSON = json => {
    const result = prepareRecipeImport(json, { ingredientDB, utensilDB });
    if (result.error) { notify(result.error, "error"); return; }
    const { prepared, linked, rejected } = result;
    setRecipes(prev => {
      const existingNames = new Set(prev.map(r => r.name.toLowerCase().trim()));
      const newOnes = prepared.filter(r => !existingNames.has(r.name.toLowerCase().trim()));
      const dupes = prepared.length - newOnes.length;
      const extras = [
        linked > 0 ? `${linked} élément(s) reliés à ta base` : "",
        dupes > 0 ? `${dupes} doublon(s) ignoré(s)` : "",
        rejected > 0 ? `${rejected} recette(s) non conforme(s) écartée(s)` : "",
      ].filter(Boolean).join(" · ");
      if (newOnes.length > 0) notify(`${newOnes.length} recette(s) importée(s)${extras ? ` · ${extras}` : ""} ✓`);
      else notify(`Aucune recette importée${extras ? ` — ${extras}` : ""}`, "error");
      return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
    });
  };

  const exportPDF = recipe => {
    printRecipe(recipe, { ingredientDB, utensilDB });
    notify("PDF en cours de génération…");
  };

  const currentRecipe = recipes.find(r => r.id === selectedRecipe);
  const isDesktop = useIsDesktop();
  const [pendingTab, setPendingTab] = useState(null); // tab requested while editing

  // Navigate with guard: if editing, show confirm dialog first
  const requestTab = (newTab) => {
    if (editingRecipe !== null) {
      setPendingTab(newTab);
    } else {
      setTab(newTab);
    }
  };

  const confirmLeaveEditor = () => {
    setEditingRecipe(null);
    setTab(pendingTab);
    setPendingTab(null);
  };

  // Sign in / out handlers
  const ALLOWED_EMAIL = import.meta.env.VITE_ALLOWED_EMAIL;
  const handleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      if (ALLOWED_EMAIL && result.user.email !== ALLOWED_EMAIL) {
        await signOut(auth);
        notify("Accès non autorisé", "error");
        return;
      }
    } catch (e) {
      if (e.code === "auth/popup-blocked") signInWithRedirect(auth, provider);
      else notify("Connexion échouée", "error");
    }
  };
  const handleSignOut = () => { signOut(auth); setUser(null); };

  const tabContent = (
    <div style={{ flex: 1, overflow: isDesktop ? "hidden" : "auto", minHeight: 0, display: "flex", flexDirection: "column" }} className={isDesktop ? "desktop-content" : ""}>
      {tab === "home" && <HomeTab recipes={recipes} collections={collections} ingredientDB={ingredientDB} onSelect={setSelectedRecipe} onNewRecipe={() => setEditingRecipe({ name: "", description: "", prepTime: 0, cookTime: 0, servings: 2, tags: [], ingredients: [], utensils: [], steps: [], collections: [], image: "" })} setCollections={setCollections} user={user} syncStatus={syncStatus} onSignOut={handleSignOut} isDark={isDark} onToggleTheme={toggleTheme} />}
      {tab === "meal-plan" && <MealPlanTab mealPlan={mealPlan} recipes={recipes} setMealPlan={setMealPlan} onSelectRecipe={setSelectedRecipe} ingredientDB={ingredientDB} user={user} syncStatus={syncStatus} onSignOut={handleSignOut} isDark={isDark} onToggleTheme={toggleTheme} notify={notify} />}
      {tab === "shopping" && <ShoppingTab shoppingLists={mergedShoppingLists} setShoppingLists={setMergedShoppingLists} ingredientDB={ingredientDB} user={user} directory={directory} syncStatus={syncStatus} onSignOut={handleSignOut} isDark={isDark} onToggleTheme={toggleTheme} categories={categories} />}
      {tab === "fridge" && <FridgeTab fridge={fridge} setFridge={setFridge} fridgeSettings={fridgeSettings} setFridgeSettings={setFridgeSettings} pantry={pantry} setPantry={setPantry} recipes={recipes} ingredientDB={ingredientDB} onSelectRecipe={setSelectedRecipe} user={user} syncStatus={syncStatus} onSignOut={handleSignOut} isDark={isDark} onToggleTheme={toggleTheme} categories={categories} notify={notify} />}
      {tab === "config" && <ConfigTab ingredientDB={ingredientDB} setIngredientDB={setIngredientDB} utensilDB={utensilDB} setUtensilDB={setUtensilDB} collections={collections} setCollections={setCollections} recipes={recipes} onExportAll={() => { const b = new Blob([JSON.stringify(recipes.map(cleanRecipeForExport), null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "all_recipes.json"; a.click(); notify("Export complet téléchargé"); }} onImport={importJSON} isDark={isDark} onToggleTheme={toggleTheme} user={user} onSignOut={handleSignOut} syncStatus={syncStatus} isAdmin={isAdmin} categories={categories} setCategories={setCategories} />}
    </div>
  );

  const mainScreen = editingRecipe !== null ? (
    <div className={isDesktop ? "desktop-content editor-layout" : ""} style={{ flex: 1, overflow: "hidden", width: "100%" }}>
      <RecipeEditor recipe={editingRecipe} onSave={saveRecipe} onCancel={() => setEditingRecipe(null)} ingredientDB={ingredientDB} utensilDB={utensilDB} collections={collections} recipes={recipes} />
    </div>
  ) : selectedRecipe && currentRecipe ? (
    <div key={selectedRecipe} className={`editor-enter${isDesktop ? " desktop-content" : ""}`} style={{ flex: 1, overflow: isDesktop ? "hidden" : "auto", minHeight: 0 }}>
      <RecipeDetail recipe={currentRecipe} onBack={() => setSelectedRecipe(null)} onEdit={() => setEditingRecipe(currentRecipe)} onDelete={deleteRecipe} onAddToShopping={addToShopping} onAddToMealPlan={(r, date, portions, slot) => { setMealPlan(prev => ({ ...prev, [date]: [...(prev[date] || []), { recipeId: r.id, portions: portions || 1, slot: slot || "midi" }] })); notify("Ajouté au planning"); }} onExportJSON={exportJSON} onExportPDF={exportPDF} ingredientDB={ingredientDB} utensilDB={utensilDB} collections={collections} onUpdateCollections={setCollections} onToggleCollection={(recipeId, colId) => { setRecipes(prev => { const updated = prev.map(r => { if (r.id !== recipeId) return r; const cols = r.collections || []; const next = cols.includes(colId) ? cols.filter(c => c !== colId) : [...cols, colId]; return { ...r, collections: next }; }); setCollections(c => c.map(col => ({ ...col, count: updated.filter(r => (r.collections || []).includes(col.id)).length }))); return updated; }); }} />
    </div>
  ) : selectedRecipe && !currentRecipe && cloudLoaded.current ? (
    <RecipeNotFound onBack={() => navigate("/recipes")} />
  ) : tabContent;

  // Loading state
  if (user === undefined) return <LoadingScreen isDark={isDark} />;

  // Login screen
  if (!user) return <LoginScreen isDark={isDark} onToggleTheme={toggleTheme} onSignIn={handleSignIn} />;

  return (
    <div id="root" className={isDark ? "" : "light"}>
        {notification && (
          <div style={{ position: "fixed", top: 16, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 999, pointerEvents: "none" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: notification.type === "error" ? "var(--red)" : notification.type === "warning" ? "#e8920a" : notification.type === "info" ? "#4a90d9" : "var(--green)", color: "#fff", padding: "10px 18px 10px 12px", borderRadius: 30, fontSize: 13, fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.35)", whiteSpace: "nowrap", animation: "toastIn 0.22s cubic-bezier(0.25,0.46,0.45,0.94) both" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={notification.type === "error" ? "close" : notification.type === "warning" ? "warning" : notification.type === "info" ? "forward" : "check"} size={12} color="#fff" />
              </div>
              {notification.msg}
            </div>
          </div>
        )}
        {isDesktop ? (
          <>
            <DesktopSidebar tab={tab} setTab={requestTab} onNewRecipe={() => setEditingRecipe({ name: "", description: "", prepTime: 0, cookTime: 0, servings: 2, tags: [], ingredients: [], utensils: [], steps: [], collections: [], image: "" })} />
            {mainScreen}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PullToRefresh
              enabled={!isDesktop && editingRecipe === null}
              threshold={110}
              onRefresh={() => window.location.reload()}
            >
              {mainScreen}
            </PullToRefresh>
            <TabBar tab={tab} setTab={requestTab} />
          </div>
        )}

        {/* Leave editor confirmation modal */}
        {pendingTab && (
          <SwipeableSheet onClose={() => setPendingTab(null)}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Quitter le formulaire ?</h3>
            <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Les modifications non sauvegardées seront perdues. Tu peux sauvegarder d'abord en cliquant sur "Sauvegarder" en haut.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPendingTab(null)}>Rester</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmLeaveEditor}>Quitter sans sauvegarder</button>
            </div>
          </SwipeableSheet>
        )}
      </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/recipes" replace />} />
      {/* Une seule instance d'AppInner pour toutes les routes de l'app : elle dérive
          l'onglet / la recette / la section depuis le pathname, ce qui évite tout
          remontage (et donc le flicker de l'écran de chargement) lors de la navigation. */}
      <Route path="*" element={<AppInner />} />
    </Routes>
  );
}

