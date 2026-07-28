import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, memo, Profiler } from "react";
import { useNavigate, useLocation, Navigate, Routes, Route } from "react-router-dom";

import { auth } from "./lib/firebase.js";
import { subscribeHouseholdPointer, fetchUserDirectory } from "./lib/firestore.js";
import { cleanRecipeForExport } from "./lib/recipeSchema.js";
import { deleteImageByUrl } from "./lib/storage.js";
import { printRecipe } from "./lib/recipePdf.js";
import { prepareRecipeImport } from "./lib/recipeImport.js";
import { prepareRecipeForSave, upsertRecipe, recomputeCollectionCounts, buildShoppingItems } from "./lib/recipeActions.js";
import { recipesReferencing } from "./lib/recipeComponents.js";
import { buildRecipeIndex } from "./lib/nutriscore.js";
import { SAMPLE_RECIPES, SAMPLE_COLLECTIONS } from "./constants/categories.js";
import { DEFAULT_PREFERENCES } from "./constants/preferences.js";
import { AppShellProvider } from "./context/AppShellContext.jsx";
import { useFirestoreSync } from "./hooks/useFirestoreSync.js";
import { usePublicRecipeView } from "./hooks/usePublicRecipeView.js";
import { useLS } from "./hooks/useLS.js";
import { useTheme } from "./hooks/useTheme.js";
import { useNotifications } from "./hooks/useNotifications.js";
import { useMasterData } from "./hooks/useMasterData.js";
import { useRecipeImport } from "./hooks/useRecipeImport.js";
import { usePublicRecipes } from "./hooks/usePublicRecipes.js";
import { useAccount } from "./hooks/useAccount.js";
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

// Pages mémoïsées : ne re-rendent que si LEURS props (ou le contexte) changent —
// et non à chaque render d'App (toast, statut de sync…). Requiert des props stables
// (setters useState/useLS, valeurs mémoïsées) + une valeur de contexte stable.
const MealPlanPageMemo = memo(MealPlanPage);


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
  // Base de référence (Master partagée + ajouts perso) — voir useMasterData.
  const {
    masterDB, setMasterDB, userDB, setUserDB,
    categories, setCategories, ingredientDB, utensilDB, techniques,
    setIngredientDB, setUtensilDB, setTechniques,
  } = useMasterData(isAdmin);

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
  // Import de recette (URL / photos) → ouvre l'éditeur sur le brouillon (useRecipeImport).
  const { importFromUrl, importFromImages } = useRecipeImport({ ingredientDB, utensilDB, openEditor: setEditingRecipe });
  const { notification, notify } = useNotifications();
  // Vue d'une recette publique (route /discover/:pubId) – logique isolée dans son hook.
  const { pubId: publicPubId, docs: publicDocs, open: openPublic } = usePublicRecipeView({ user, recipes, location, navigate });

  // ── Couche de synchronisation Firestore (auth, chargement, sauvegardes) ───────
  const { workspaceReady } = useFirestoreSync({
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

  const { isDark, toggleTheme } = useTheme();

  // Update document title on tab change
  useEffect(() => {
    const titles = { "home": "Accueil", "recipes": "Recettes", "meal-plan": "Planning", "shopping": "Courses", "fridge": "Mon Stock", "config": "Configuration", "profile": "Profil", "legal": "Informations légales" };
    document.title = `Mijoté | ${titles[tab] || "Accueil"}`;
  }, [tab]);


  // Valeur de contexte À IDENTITÉ STABLE : sans ça, `shellValue` était recréé à
  // chaque render → TOUS les consommateurs useAppShell (toutes les pages, cartes,
  // sections…) se re-rendaient à chaque render d'App, même pour un simple toast.
  // Les fonctions passent par une ref (toujours la dernière closure, jamais périmée
  // — utile car certaines sont définies après les retours anticipés), et l'objet ne
  // change que quand une VRAIE valeur change (user, syncStatus, thème, techniques…).
  // Déclaré AVANT tout return conditionnel (règles des hooks) ; la ref est remplie
  // plus bas, une fois les fonctions définies.
  const shellApiRef = useRef({});
  const stableApi = useMemo(() => ({
    signOut: (...a) => shellApiRef.current.signOut?.(...a),
    toggleTheme: (...a) => shellApiRef.current.toggleTheme?.(...a),
    getSharedData: (...a) => shellApiRef.current.getSharedData?.(...a),
    loadDirectory: (...a) => shellApiRef.current.loadDirectory?.(...a),
    importFromUrl: (...a) => shellApiRef.current.importFromUrl?.(...a),
    importFromImages: (...a) => shellApiRef.current.importFromImages?.(...a),
  }), []);
  const shellValue = useMemo(
    () => ({ user, syncStatus, isDark, notify, techniques, directory, isAdmin, ...stableApi }),
    [user, syncStatus, isDark, notify, techniques, directory, isAdmin, stableApi]
  );

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
  // Publier / dépublier / cloner des recettes publiques (communauté) — voir usePublicRecipes.
  const { publishRecipe, unpublishRecipe, cloneFromPublic, quickCloneFromPublic } =
    usePublicRecipes({ user, recipes, setRecipes, setCollections, ingredientDB, notify, navigate });

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
    printRecipe(recipe, { ingredientDB, utensilDB, recipesById: buildRecipeIndex(recipes), techniques });
    notify("Ouverture de l'aperçu d'impression…");
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

  // Compte : auth + purge + suppression RGPD (useAccount).
  const { handleSignIn, handleSignOut, purgeData, deleteAccount } = useAccount({
    user, setUser, notify, setMealPlan, setShoppingLists, setStock, setLowStock, setRecipes, setCollections,
  });

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
    // Filet de sécurité : le feed est réhydraté depuis le cache, l'ancre apparaît
    // donc quasi immédiatement. On borne court pour ne jamais rester blanc longtemps.
    const deadline = Date.now() + 1200;
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


  const tabContent = (
    <div style={{ flex: 1, overflow: isDesktop ? "hidden" : "auto", minHeight: 0, display: "flex", flexDirection: "column", opacity: scrollHold ? 0 : 1 }} className={isDesktop ? "desktop-content" : ""}>
      {/* [DEBUG PERF — temporaire] mesure la durée de rendu de chaque onglet en dev.
          À retirer une fois le point chaud identifié. */}
      <Profiler id={tab} onRender={(id, phase, actualDuration) => {
        if (import.meta.env.DEV) console.log(`⏱️ [${id}] ${phase} : ${actualDuration.toFixed(1)} ms`);
      }}>
      {tab === "home" && <HomePage recipes={recipes} mealPlan={mealPlan} shoppingLists={shoppingLists} lowStock={lowStock} stock={stock} ingredientDB={ingredientDB} preferences={preferences} onSelectRecipe={setSelectedRecipe} setTab={setTab} onOpenPublic={openPublic} onClonePublic={quickCloneFromPublic} onNewRecipe={() => setEditingRecipe({ name: "", description: "", prepTime: 0, cookTime: 0, servings: 2, cuisine: "", ingredients: [], utensils: [], steps: [], collections: [], image: "" })} />}
      {tab === "recipes" && <RecipesPage recipes={recipes} collections={collections} ingredientDB={ingredientDB} onSelect={setSelectedRecipe} onNewRecipe={() => setEditingRecipe({ name: "", description: "", prepTime: 0, cookTime: 0, servings: 2, cuisine: "", ingredients: [], utensils: [], steps: [], collections: [], image: "" })} setCollections={setCollections} setTab={setTab} />}
      {tab === "meal-plan" && <MealPlanPageMemo mealPlan={mealPlan} recipes={recipes} setMealPlan={setMealPlan} onSelectRecipe={setSelectedRecipe} ingredientDB={ingredientDB} preferences={preferences} stock={stock} notify={notify} />}
      {tab === "shopping" && <ShoppingPage shoppingLists={shoppingLists} setShoppingLists={setShoppingLists} ingredientDB={ingredientDB} categories={categories} stock={stock} setStock={setStock} lowStock={lowStock} setLowStock={setLowStock} />}
      {tab === "fridge" && <StockPage stock={stock} setStock={setStock} lowStock={lowStock} setLowStock={setLowStock} ingredientDB={ingredientDB} categories={categories} components={recipes.filter(r => r.isComponent)} />}
      {tab === "config" && <ConfigPage ingredientDB={ingredientDB} setIngredientDB={setIngredientDB} utensilDB={utensilDB} setUtensilDB={setUtensilDB} collections={collections} setCollections={setCollections} recipes={recipes} onExportAll={() => { const b = new Blob([JSON.stringify(recipes.map(cleanRecipeForExport), null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "all_recipes.json"; a.click(); notify("Export complet téléchargé"); }} onImport={importJSON} isAdmin={isAdmin} categories={categories} setCategories={setCategories} preferences={preferences} setPreferences={setPreferences} techniques={techniques} setTechniques={setTechniques} />}
      {tab === "profile" && <ProfilePage user={user} preferences={preferences} setPreferences={setPreferences} mealPlan={mealPlan} onPurge={purgeData} onDeleteAccount={deleteAccount} />}
      {tab === "legal" && <LegalPage />}
      </Profiler>
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

  // La dernière closure des fonctions du shell (définies plus bas, après les retours
  // anticipés) est publiée dans la ref stable déclarée en tête de composant. Écriture
  // pendant le render volontaire (motif « latest ref ») : idempotente, sans effet de
  // bord, et ces fonctions ne sont appelées que sur action utilisateur (jamais au
  // render ni dans un effet de montage) — donc jamais lue avant d'être remplie.
  // eslint-disable-next-line react-hooks/refs
  shellApiRef.current = { signOut: handleSignOut, toggleTheme, getSharedData, loadDirectory, importFromUrl, importFromImages };

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

