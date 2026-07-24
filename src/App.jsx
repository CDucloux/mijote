import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useLocation, Navigate, Routes, Route } from "react-router-dom";
import { signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";

import { auth, provider } from "./lib/firebase.js";
import { publishPublicBundle, unpublishPublicDocs, fetchPublicDocsByIds, subscribeHouseholdPointer, fetchUserDirectory } from "./lib/firestore.js";
import { publicId, buildPublishBundle, collectComponentDeps, clonePublicBundle } from "./lib/publicRecipes.js";
import { cleanRecipeForExport } from "./lib/recipeSchema.js";
import { deleteImageByUrl } from "./lib/storage.js";
import { printRecipe } from "./lib/recipePdf.js";
import { prepareRecipeImport } from "./lib/recipeImport.js";
import { importRecipeFromUrl, importRecipeFromImages } from "./lib/recipeUrlImport.js";
import { prepareRecipeForSave, upsertRecipe, recomputeCollectionCounts, buildShoppingItems } from "./lib/recipeActions.js";
import { recipesReferencing } from "./lib/recipeComponents.js";
import { buildRecipeIndex } from "./lib/nutriscore.js";
import {
  DEFAULT_CATEGORIES, SAMPLE_RECIPES, SAMPLE_COLLECTIONS,
} from "./constants/categories.js";
import { DEFAULT_PREFERENCES } from "./constants/preferences.js";
import { AppShellProvider } from "./context/AppShellContext.jsx";
import { useFirestoreSync } from "./hooks/useFirestoreSync.js";
import { usePublicRecipeView } from "./hooks/usePublicRecipeView.js";
import { useLS } from "./hooks/useLS.js";
import { useIsDesktop } from "./hooks/useIsDesktop.js";
import { usePageZoom } from "./hooks/usePageZoom.js";
import { SwipeableSheet } from "./components/SwipeableSheet.jsx";
import { PullToRefresh } from "./components/PullToRefresh.jsx";
import { Icon } from "./components/Icon.jsx";
import { RecipeNotFound } from "./components/RecipeNotFound.jsx";
import { OfflineModal } from "./components/OfflineModal.jsx";
import { HouseholdWelcome } from "./components/HouseholdWelcome.jsx";
import { OnboardingCarousel } from "./components/OnboardingCarousel.jsx";
import { TabBar } from "./components/TabBar.jsx";
import { DesktopSidebar } from "./components/DesktopSidebar.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { RecipesPage } from "./pages/RecipesPage.jsx";
import { MealPlanPage } from "./pages/MealPlanPage.jsx";
import { StockPage } from "./pages/StockPage.jsx";
import { ShoppingPage } from "./pages/ShoppingPage.jsx";
import { RecipeEditor } from "./pages/RecipeEditor.jsx";
import { RecipeDetail } from "./pages/RecipeDetail.jsx";
import { ConfigPage } from "./pages/ConfigPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { LegalPage } from "./pages/LegalPage.jsx";
import { LoadingPage } from "./pages/LoadingPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { TAB_BY_PATH, TAB_BY_ID } from "./constants/tabs.js";


function AppInner() {
  usePageZoom();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = TAB_BY_PATH[location.pathname] || (location.pathname.startsWith("/config") ? "config" : location.pathname.startsWith("/profile") ? "profile" : location.pathname.startsWith("/legal") ? "legal" : "home");
  const setTab = useCallback((id) => navigate(TAB_BY_ID[id] || "/home"), [navigate]);
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
  // Annuaire des utilisateurs connus (avatars des membres du foyer, invitations).
  // Chargé À LA DEMANDE (loadDirectory) : les utilisateurs solo ne le lisent jamais.
  const [directory, setDirectory] = useState([]);
  const directoryLoadedRef = useRef(null); // uid dont l'annuaire est (en cours de) chargement
  const loadDirectory = useCallback(async () => {
    if (!user || directoryLoadedRef.current === user.uid) return;
    directoryLoadedRef.current = user.uid; // garde par uid → refetch après changement de compte
    try { setDirectory(await fetchUserDirectory()); }
    catch { directoryLoadedRef.current = null; }
  }, [user]);
  // Reference DBs: shared Master + user's own additions, merged for display.
  const [masterDB, setMasterDB] = useState(() => {
    try {
      const cached = localStorage.getItem("rf_masterDB_cache");
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }
    return { ingredients: [], utensils: [], techniques: [], categories: DEFAULT_CATEGORIES };
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
  // Glossaire des techniques : entièrement Master (pas de pendant userDB). Lecture
  // pour tous, écriture admin seulement.
  const techniques = useMemo(() => masterDB.techniques || [], [masterDB]);
  const setTechniques = useCallback((updater) => {
    if (!isAdmin) return;
    setMasterDB(prev => {
      const cur = prev.techniques || [];
      const next = typeof updater === "function" ? updater(cur) : updater;
      return { ...prev, techniques: next };
    });
  }, [isAdmin]);

  const [stock, setStock] = useLS("rf_stock", []);
  const [lowStock, setLowStock] = useLS("rf_lowStock", []);
  const [preferences, setPreferences] = useLS("rf_preferences", DEFAULT_PREFERENCES);
  // Pointeur du foyer actif ({ id, migrated } | null) – pilote le namespace partagé.
  const [householdPointer, setHouseholdPointer] = useState(null);
  useEffect(() => {
    if (!user?.uid) { setHouseholdPointer(null); return; }
    return subscribeHouseholdPointer(user.uid, setHouseholdPointer);
  }, [user]);
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
  // Vue d'une recette publique (route /discover/:pubId) – logique isolée dans son hook.
  const { pubId: publicPubId, docs: publicDocs, open: openPublic } = usePublicRecipeView({ user, recipes, location, navigate });

  // ── Couche de synchronisation Firestore (auth, chargement, sauvegardes) ───────
  const { cloudLoaded, workspaceReady } = useFirestoreSync({
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
  });

  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem("rf_theme") !== "light"; } catch { return true; }
  });
  // Applique le thème au DOM (classe <html> + theme-color de la barre de statut PWA).
  const applyThemeToDOM = (dark) => {
    document.documentElement.classList.toggle("light", !dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0e0e0f" : "#f5f0eb");
  };

  const toggleTheme = () => {
    const next = !isDark;
    // Le fondu de thème par élément (règle globale `*`) est écrasé sur toute
    // page dont les éléments portent une `transition` inline → bascule sèche.
    // L'API View Transitions capture un instantané du viewport entier et le
    // fait cross-fader uniformément, indépendamment des transitions par élément.
    const run = () => {
      // flushSync : le commit React doit être appliqué DANS le callback pour que
      // l'instantané « après » du view-transition reflète déjà le nouveau thème.
      flushSync(() => setIsDark(next));
      applyThemeToDOM(next);
      try { localStorage.setItem("rf_theme", next ? "dark" : "light"); } catch { }
    };
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduce) document.startViewTransition(run);
    else run();
  };

  // Synchronisation initiale (au montage) : aligne le DOM sur l'état persistant.
  useEffect(() => {
    applyThemeToDOM(isDark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update document title on tab change
  useEffect(() => {
    const titles = { "home": "Accueil", "recipes": "Recettes", "meal-plan": "Planning", "shopping": "Courses", "fridge": "Mon Stock", "config": "Configuration" };
    document.title = `Mijoté | ${titles[tab] || "Accueil"}`;
  }, [tab]);


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
    notify("Recette sauvegardée");
  };

  const deleteRecipe = id => {
    const r = recipes.find(x => x.id === id);
    if (r?.isComponent) {
      const refs = recipesReferencing(id, recipes);
      if (refs.length > 0) {
        const names = refs.slice(0, 3).map(x => `« ${x.name} »`).join(", ");
        const extra = refs.length > 3 ? ` et ${refs.length - 3} autre(s)` : "";
        const ok = window.confirm(
          `Cette base est utilisée dans ${refs.length} recette(s) : ${names}${extra}.\n\nLes lignes qui y font référence seront supprimées. Continuer ?`
        );
        if (!ok) return;
        // Délie les lignes orphelines dans les recettes référencées
        setRecipes(prev => prev.map(recipe => {
          if (!refs.some(x => x.id === recipe.id)) return recipe;
          return {
            ...recipe,
            ingredients: (recipe.ingredients || []).filter(ing => ing.recipeId !== id),
          };
        }).filter(recipe => recipe.id !== id));
        if (r?.image) deleteImageByUrl(r.image);
        navigate("/recipes");
        notify("Base supprimée");
        return;
      }
    }
    if (r?.image) deleteImageByUrl(r.image);
    setRecipes(prev => prev.filter(r => r.id !== id));
    navigate("/recipes");
    notify("Recette supprimée");
  };

  const addToShopping = (recipe, selectedIngredients, mult = 1) => {
    const items = buildShoppingItems(recipe, selectedIngredients, mult, ingredientDB, buildRecipeIndex(recipes), new Set(stock));
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

  // ── Recettes publiques (communauté) ──────────────────────────────────────────
  // Publication en cascade : la recette + ses préparations de base partent ensemble
  // (sinon le clone serait cassé, les bases vivant dans l'espace privé de l'auteur).
  const publishRecipe = async (recipe) => {
    if (!user) return;
    try {
      const recipesById = buildRecipeIndex(recipes);
      const { docs } = buildPublishBundle(recipe, user, { ingredientDB, recipesById });
      await publishPublicBundle(docs);
      setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, visibility: "public", publicId: publicId(user.uid, recipe.id) } : r));
      const bases = docs.length - 1;
      notify(bases > 0 ? `Recette publiée (+ ${bases} base${bases > 1 ? "s" : ""})` : "Recette publiée");
    } catch { notify("Publication refusée – règles Firestore déployées ?", "error"); }
  };

  const unpublishRecipe = async (recipe) => {
    if (!user) return;
    try {
      const recipesById = buildRecipeIndex(recipes);
      const myPub = publicId(user.uid, recipe.id);
      const myComps = collectComponentDeps(recipe, recipesById).map(c => publicId(user.uid, c.id));
      // On ne retire une base que si plus AUCUNE de mes autres recettes publiques ne l'utilise.
      const stillUsed = new Set();
      for (const r of recipes) {
        if (r.id === recipe.id || r.visibility !== "public") continue;
        for (const c of collectComponentDeps(r, recipesById)) stillUsed.add(publicId(user.uid, c.id));
      }
      await unpublishPublicDocs([myPub, ...myComps.filter(id => !stillUsed.has(id))]);
      setRecipes(prev => prev.map(r => {
        if (r.id !== recipe.id) return r;
        const { visibility, publicId: _p, ...rest } = r; void visibility; void _p; return rest;
      }));
      notify("Recette dépubliée");
    } catch { notify("Échec de la dépublication", "error"); }
  };

  // Clone hybride : récupère la recette publique + ses bases publiques et les
  // installe comme recettes locales (ids remappés, attribution, anti-doublon).
  const cloneFromPublic = async (pub) => {
    if (!pub) return;
    try {
      const compPubIds = (pub.componentRefs || []).map(origId => publicId(pub.authorUid, origId));
      const comps = compPubIds.length ? await fetchPublicDocsByIds(compPubIds) : [];
      const { added, mainId, alreadyOwned } = clonePublicBundle(pub, comps, { existingRecipes: recipes });
      if (alreadyOwned) { notify("Déjà dans tes recettes"); navigate(`/recipes/${mainId}`); return; }
      const updated = [...added, ...recipes];
      setRecipes(updated);
      setCollections(prev => recomputeCollectionCounts(prev, updated));
      const bases = added.length - 1;
      notify(bases > 0 ? `Ajoutée à tes recettes (+ ${bases} base${bases > 1 ? "s" : ""})` : "Ajoutée à tes recettes");
      navigate(`/recipes/${mainId}`);
    } catch { notify("Échec du clonage", "error"); }
  };

  const quickCloneFromPublic = async (pub) => {
    if (!pub) return;
    try {
      const compPubIds = (pub.componentRefs || []).map(origId => publicId(pub.authorUid, origId));
      const comps = compPubIds.length ? await fetchPublicDocsByIds(compPubIds) : [];
      const { added, mainId, alreadyOwned } = clonePublicBundle(pub, comps, { existingRecipes: recipes });
      if (alreadyOwned) { notify("Déjà dans tes recettes"); return; }
      const updated = [...added, ...recipes];
      setRecipes(updated);
      setCollections(prev => recomputeCollectionCounts(prev, updated));
      const bases = added.length - 1;
      notify(bases > 0 ? `Ajoutée à tes recettes (+ ${bases} base${bases > 1 ? "s" : ""})` : "Ajoutée à tes recettes");
    } catch { notify("Échec de l'ajout", "error"); }
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
      if (newOnes.length > 0) notify(`${newOnes.length} recette(s) importée(s)${extras ? ` · ${extras}` : ""}`);
      else notify(`Aucune recette importée${extras ? ` – ${extras}` : ""}`, "error");
      return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
    });
  };

  const exportPDF = recipe => {
    printRecipe(recipe, { ingredientDB, utensilDB, recipesById: buildRecipeIndex(recipes) });
    notify("PDF en cours de génération…");
  };

  // Snapshot des slices partagés (espace courant) – utilisé pour semer un foyer
  // à sa création (copie de mes données vers le namespace du foyer).
  const getSharedData = useCallback(
    () => ({ recipes, collections, mealPlan, shoppingLists, stock, lowStock }),
    [recipes, collections, mealPlan, shoppingLists, stock, lowStock]
  );
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

  // Retour d'une recette publique → on revient sur la carte cliquée dans
  // « Découvrir » via son ancre (#discover-card-<pubId>). `scrollIntoView` est
  // agnostique du conteneur qui défile ; on réessaie tant que la carte n'existe
  // pas encore (le feed public se charge de façon asynchrone au remontage).
  const lastPublicPubId = useRef(null);
  const wasAtTabView = useRef(true);
  const [scrollHold, setScrollHold] = useState(false); // masque l'onglet le temps de se caler
  useEffect(() => { if (publicPubId) lastPublicPubId.current = publicPubId; }, [publicPubId]);
  const atTabView = editingRecipe === null && !publicPubId
    && !(selectedRecipe && currentRecipe)
    && !(selectedRecipe && !currentRecipe && workspaceReady);
  useLayoutEffect(() => {
    const returning = atTabView && !wasAtTabView.current;
    wasAtTabView.current = atTabView;
    const anchor = lastPublicPubId.current;
    if (!returning || !anchor) return;
    lastPublicPubId.current = null;
    setScrollHold(true); // rendu masqué avant peinture → pas de flash en haut
    const deadline = Date.now() + 3000;
    let raf;
    const tryScroll = () => {
      const el = document.getElementById(`discover-card-${anchor}`);
      if (el) { el.scrollIntoView({ block: "center", behavior: "auto" }); setScrollHold(false); return; }
      if (Date.now() < deadline) raf = requestAnimationFrame(tryScroll);
      else setScrollHold(false);
    };
    tryScroll();
    return () => cancelAnimationFrame(raf);
  }, [atTabView]);

  // Purge de données (depuis le profil). Vide l'état local ; la synchro propage
  // l'effacement au cloud. « all » remet l'espace à zéro.
  const purgeData = (scope) => {
    if (scope === "planning" || scope === "all") setMealPlan({});
    if (scope === "shopping" || scope === "all") setShoppingLists([]);
    if (scope === "stock" || scope === "all") { setStock([]); setLowStock([]); }
    if (scope === "all") { setRecipes([]); setCollections([]); }
    notify(scope === "all" ? "Données effacées" : "Effacé", "info");
  };

  const tabContent = (
    <div style={{ flex: 1, overflow: isDesktop ? "hidden" : "auto", minHeight: 0, display: "flex", flexDirection: "column", opacity: scrollHold ? 0 : 1 }} className={isDesktop ? "desktop-content" : ""}>
      {tab === "home" && <HomePage recipes={recipes} mealPlan={mealPlan} shoppingLists={shoppingLists} lowStock={lowStock} stock={stock} ingredientDB={ingredientDB} preferences={preferences} onSelectRecipe={setSelectedRecipe} setTab={setTab} onOpenPublic={openPublic} onClonePublic={quickCloneFromPublic} onNewRecipe={() => setEditingRecipe({ name: "", description: "", prepTime: 0, cookTime: 0, servings: 2, cuisine: "", ingredients: [], utensils: [], steps: [], collections: [], image: "" })} />}
      {tab === "recipes" && <RecipesPage recipes={recipes} collections={collections} ingredientDB={ingredientDB} onSelect={setSelectedRecipe} onNewRecipe={() => setEditingRecipe({ name: "", description: "", prepTime: 0, cookTime: 0, servings: 2, cuisine: "", ingredients: [], utensils: [], steps: [], collections: [], image: "" })} setCollections={setCollections} setTab={setTab} />}
      {tab === "meal-plan" && <MealPlanPage mealPlan={mealPlan} recipes={recipes} setMealPlan={setMealPlan} onSelectRecipe={setSelectedRecipe} ingredientDB={ingredientDB} preferences={preferences} stock={stock} notify={notify} />}
      {tab === "shopping" && <ShoppingPage shoppingLists={shoppingLists} setShoppingLists={setShoppingLists} ingredientDB={ingredientDB} categories={categories} stock={stock} setStock={setStock} lowStock={lowStock} setLowStock={setLowStock} />}
      {tab === "fridge" && <StockPage stock={stock} setStock={setStock} lowStock={lowStock} setLowStock={setLowStock} ingredientDB={ingredientDB} categories={categories} components={recipes.filter(r => r.isComponent)} />}
      {tab === "config" && <ConfigPage ingredientDB={ingredientDB} setIngredientDB={setIngredientDB} utensilDB={utensilDB} setUtensilDB={setUtensilDB} collections={collections} setCollections={setCollections} recipes={recipes} onExportAll={() => { const b = new Blob([JSON.stringify(recipes.map(cleanRecipeForExport), null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "all_recipes.json"; a.click(); notify("Export complet téléchargé"); }} onImport={importJSON} isAdmin={isAdmin} categories={categories} setCategories={setCategories} preferences={preferences} setPreferences={setPreferences} techniques={techniques} setTechniques={setTechniques} />}
      {tab === "profile" && <ProfilePage user={user} preferences={preferences} setPreferences={setPreferences} mealPlan={mealPlan} onPurge={purgeData} />}
      {tab === "legal" && <LegalPage />}
    </div>
  );

  const mainScreen = editingRecipe !== null ? (
    <div className={isDesktop ? "desktop-content editor-layout" : ""} style={{ flex: 1, overflow: "hidden", width: "100%" }}>
      <RecipeEditor recipe={editingRecipe} onSave={saveRecipe} onCancel={() => setEditingRecipe(null)} ingredientDB={ingredientDB} utensilDB={utensilDB} collections={collections} recipes={recipes} />
    </div>
  ) : publicPubId ? (
    publicDocs ? (
      <div key={publicDocs.pub.pubId} className={`editor-enter${isDesktop ? " desktop-content" : ""}`} style={{ flex: 1, overflow: isDesktop ? "hidden" : "auto", minHeight: 0 }}>
        <RecipeDetail
          recipe={publicDocs.pub.recipe}
          recipes={publicDocs.components}
          publicMode
          owned={recipes.some(r => r.clonedFrom?.publicId === publicDocs.pub.pubId) || publicDocs.pub.authorUid === user?.uid}
          authorName={publicDocs.pub.authorName}
          authorPhoto={publicDocs.pub.authorPhoto}
          authorUid={publicDocs.pub.authorUid}
          onClone={() => cloneFromPublic(publicDocs.pub)}
          onBack={() => navigate("/home")}
          onExportPDF={exportPDF}
          ingredientDB={ingredientDB} utensilDB={utensilDB} collections={[]} notify={notify}
        />
      </div>
    ) : publicDocs === undefined ? (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 26, height: 26, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
      </div>
    ) : (
      <RecipeNotFound onBack={() => navigate("/home")} />
    )
  ) : selectedRecipe && currentRecipe ? (
    <div key={selectedRecipe} className={`editor-enter${isDesktop ? " desktop-content" : ""}`} style={{ flex: 1, overflow: isDesktop ? "hidden" : "auto", minHeight: 0 }}>
      <RecipeDetail recipe={currentRecipe} recipes={recipes} onBack={() => setSelectedRecipe(null)} onEdit={() => setEditingRecipe(currentRecipe)} onDelete={deleteRecipe} onUpdateRecipe={(updated) => setRecipes(prev => prev.map(r => r.id === updated.id ? updated : r))} notify={notify} onAddToShopping={addToShopping} stock={stock} lowStock={lowStock} onAddToMealPlan={(r, date, portions, slot) => { setMealPlan(prev => ({ ...prev, [date]: [...(prev[date] || []), { recipeId: r.id, portions: portions || 1, slot: slot || "midi" }] })); notify("Ajouté au planning"); }} onExportJSON={exportJSON} onExportPDF={exportPDF} onPublish={publishRecipe} onUnpublish={unpublishRecipe} ingredientDB={ingredientDB} utensilDB={utensilDB} collections={collections} onUpdateCollections={setCollections} onToggleCollection={(recipeId, colId) => { setRecipes(prev => { const updated = prev.map(r => { if (r.id !== recipeId) return r; const cols = r.collections || []; const next = cols.includes(colId) ? cols.filter(c => c !== colId) : [...cols, colId]; return { ...r, collections: next }; }); setCollections(c => c.map(col => ({ ...col, count: updated.filter(r => (r.collections || []).includes(col.id)).length }))); return updated; }); }} />
    </div>
  ) : selectedRecipe && !currentRecipe && workspaceReady ? (
    <RecipeNotFound onBack={() => navigate("/recipes")} />
  ) : tabContent;

  // Loading state
  if (user === undefined) return <LoadingPage isDark={isDark} />;

  // Login screen
  // Les documents légaux sont publics : accessibles même sans être connecté
  // (l'écran de connexion y renvoie). On les rend en autonomie, avant la garde d'auth.
  if (!user && location.pathname.startsWith("/legal")) {
    return <div style={{ height: "100dvh", background: "var(--bg)", color: "var(--text)" }}><LegalPage /></div>;
  }
  if (!user) return <LoginPage isDark={isDark} onToggleTheme={toggleTheme} onSignIn={handleSignIn} />;

  // Import depuis une URL (admin) : appelle la Cloud Function puis ouvre l'ÉDITEUR
  // avec le brouillon (jamais d'enregistrement direct — le créateur relit/corrige).
  const withItemIds = (recipe) => ({
    description: "", collections: [], image: "", cuisine: "", category: "", source: "",
    prepTime: 0, cookTime: 0, servings: 2, ...recipe,
    ingredients: (recipe.ingredients || []).map((i, k) => ({ id: `i${Date.now()}_${k}`, dbId: "", name: "", amount: "", unit: "", ...i })),
    utensils: (recipe.utensils || []).map((u, k) => ({ id: `u${Date.now()}_${k}`, dbId: "", name: "", ...u })),
    steps: (recipe.steps || []).map((s, k) => ({ id: `s${Date.now()}_${k}`, title: "", text: "", ingredients: [], utensils: [], ...s })),
  });
  // Recette brute extraite (URL ou image) → brouillon prêt pour l'éditeur.
  const openImportedDraft = (recipe) => {
    // Complète dbId + Nutri-Score via le pipeline d'import existant (schéma toléré).
    const res = prepareRecipeImport(JSON.stringify(recipe), { ingredientDB, utensilDB });
    let draft = res.prepared?.[0] || recipe;
    // Ustensiles : ne garder QUE ceux réellement en base master (dbId résolu), et
    // purger les liens d'étapes qui pointaient vers un ustensile écarté.
    const keptUt = (draft.utensils || []).filter(u => u.dbId);
    const keptIds = new Set(keptUt.map(u => u.id));
    draft = {
      ...draft,
      utensils: keptUt,
      steps: (draft.steps || []).map(s => ({ ...s, utensils: (s.utensils || []).filter(id => keptIds.has(id)) })),
    };
    setEditingRecipe(withItemIds(draft));
  };
  const importFromUrl = async (url) => {
    const { recipe, method } = await importRecipeFromUrl(url, utensilDB.map(u => u.name));
    openImportedDraft(recipe);
    return { method };
  };
  const importFromImages = async (images) => {
    const { recipe, method } = await importRecipeFromImages(images, utensilDB.map(u => u.name));
    openImportedDraft(recipe);
    return { method };
  };

  const shellValue = { user, syncStatus, signOut: handleSignOut, isDark, toggleTheme, notify, techniques, getSharedData, directory, loadDirectory, isAdmin, importFromUrl, importFromImages };

  return (
    <AppShellProvider value={shellValue}>
    <div id="root" className={isDark ? "" : "light"}>
        {notification && (
          <div style={{ position: "fixed", left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 999, pointerEvents: "none",
            ...(isDesktop
              ? { top: 16 }
              : { bottom: "calc(var(--tab-h) + env(safe-area-inset-bottom) + 12px)" }) }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, maxWidth: "calc(100vw - 32px)", background: notification.type === "error" ? "var(--red)" : notification.type === "warning" ? "#e8920a" : notification.type === "info" ? "#4a90d9" : "var(--green)", color: "#fff", padding: "10px 18px 10px 12px", borderRadius: 30, fontSize: 13, fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.35)", whiteSpace: "nowrap", animation: `${isDesktop ? "toastIn" : "toastUp"} 0.22s cubic-bezier(0.25,0.46,0.45,0.94) both` }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={notification.type === "error" ? "close" : notification.type === "warning" ? "warning" : notification.type === "info" ? "forward" : "check"} size={12} color="#fff" />
              </div>
              {notification.msg}
            </div>
          </div>
        )}
        {isDesktop ? (
          <>
            {/* Les pages légales s'affichent en plein écran : la sidebar y est superflue. */}
            {tab !== "legal" && <DesktopSidebar tab={tab} setTab={requestTab} />}
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
        <OfflineModal />
        <HouseholdWelcome />
        <OnboardingCarousel />
      </div>
    </AppShellProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/fridge" element={<Navigate to="/stock" replace />} />
      {/* Une seule instance d'AppInner pour toutes les routes de l'app : elle dérive
          l'onglet / la recette / la section depuis le pathname, ce qui évite tout
          remontage (et donc le flicker de l'écran de chargement) lors de la navigation. */}
      <Route path="*" element={<AppInner />} />
    </Routes>
  );
}

