import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, memo, Profiler } from "react";
import { useNavigate, useLocation, Navigate, Routes, Route } from "react-router-dom";

import { signInWithGoogle } from "@/lib/firebase/auth.js";
import { subscribeHouseholdPointer, fetchUserDirectory } from "@/lib/firebase/firestore.js";
import { cleanRecipeForExport } from "@/lib/recipes/recipeSchema.js";
import { canAddRecipes, FREE_RECIPE_LIMIT } from "@/lib/recipes/plan.js";
import { newGroupId, roleForCategory } from "@/lib/planning/composedMeal.js";
import { SAMPLE_RECIPES, SAMPLE_COLLECTIONS } from "./constants/categories.js";
import { DEFAULT_PREFERENCES } from "./constants/preferences.js";
import { AppShellProvider } from "./context/AppShellContext.jsx";
import { useFirestoreSync } from "./hooks/useFirestoreSync.js";
import { usePublicRecipeView } from "./hooks/usePublicRecipeView.js";
import { useLS } from "./hooks/useLS.js";
import { useTheme } from "./hooks/useTheme.js";
import { useAuthUser } from "./hooks/useAuthUser.js";
import { useSubscription } from "./hooks/useSubscription.js";
import { useNotifications } from "./hooks/useNotifications.js";
import { useMasterData } from "./hooks/useMasterData.js";
import { useRecipeImport } from "./hooks/useRecipeImport.js";
import { usePublicRecipes } from "./hooks/usePublicRecipes.js";
import { useAccount } from "./hooks/useAccount.js";
import { useRecipeCrud } from "./hooks/useRecipeCrud.js";
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
import { ImportFromUrl } from "./pages/ImportFromUrl.jsx";
import { ImportFromPicture } from "./pages/ImportFromPicture.jsx";
import { PlusPage } from "./pages/PlusPage.jsx";
import { TAB_BY_PATH, TAB_BY_ID } from "./constants/tabs.js";

// Pages mémoïsées : ne re-rendent que si LEURS props (ou le contexte) changent —
// et non à chaque render d'App (toast, statut de sync…). Requiert des props stables
// (setters useState/useLS, valeurs mémoïsées) + une valeur de contexte stable.
const MealPlanPageMemo = memo(MealPlanPage);


const NOOP = () => {};

// AppInner n'est monté QUE lorsqu'un utilisateur est connecté (garde d'auth au
// niveau du routeur racine). `user`, `isDark` et `toggleTheme` sont donc fournis
// par le haut : l'écran de connexion ne monte plus la machinerie de l'app.
function AppInner({ user, isDark, toggleTheme }) {
  usePageZoom();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = TAB_BY_PATH[location.pathname] || (location.pathname.startsWith("/config") ? "config" : location.pathname.startsWith("/profile") ? "profile" : location.pathname.startsWith("/legal") ? "legal" : location.pathname.startsWith("/recipes") ? "recipes" : "home");
  const setTab = useCallback((id) => navigate(TAB_BY_ID[id] || "/home"), [navigate]);
  // ── Auth state (declared early so DB setters can read isAdmin) ────────────────
  // `undefined` = en cours de résolution (1er chargement), `null` = déconnecté.
  // Au remontage du composant lors d'une navigation, Firebase est déjà initialisé :
  // `auth.currentUser` renvoie l'utilisateur synchronement, évitant un flash de l'écran
  // de chargement entre les onglets.
  // L'auth est possédée par le routeur racine (`App`) ; ici `user` est un prop.
  // `setUser` reste un no-op : la déconnexion se fait via `signOut(auth)`, dont
  // l'écouteur racine déclenche la redirection vers /login (démontage d'AppInner).
  const setUser = NOOP;
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
  // `/recipes/:id` et, optionnellement, le suffixe `/cookmode` (mode pas à pas
  // porté par l'URL → survit à un remontage, ex. dézoom desktop, et est
  // partageable / navigable au bouton retour).
  const recipeSeg = location.pathname.startsWith("/recipes/") ? location.pathname.slice(9) : "";
  // Pages d'import IA (routes dédiées) : ne correspondent à aucune recette.
  const importRoute = recipeSeg === "import-from-url" ? "url" : recipeSeg === "import-from-picture" ? "picture" : null;
  // Page d'offre Mijoté+ (route dédiée).
  const plusRoute = location.pathname === "/plus";
  const cookModeRoute = recipeSeg.endsWith("/cookmode");
  const editRoute = recipeSeg.endsWith("/edit");
  const routeSuffix = cookModeRoute ? "/cookmode" : editRoute ? "/edit" : "";
  const recipeIdParam = importRoute || !recipeSeg
    ? undefined
    : decodeURIComponent(routeSuffix ? recipeSeg.slice(0, -routeSuffix.length) : recipeSeg) || undefined;
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
  // Accès à l'offre Mijoté+ : abonnement Stripe actif (extension Firebase) OU
  // admin (accès complet du propriétaire de l'app).
  const subscribed = useSubscription(user?.uid);
  const isPlus = isAdmin || subscribed;
  const shellValue = useMemo(
    () => ({ user, syncStatus, isDark, notify, techniques, directory, isAdmin, isPlus, ...stableApi }),
    [user, syncStatus, isDark, notify, techniques, directory, isAdmin, isPlus, stableApi]
  );

  // Recettes — opérations cœur (sauvegarde, suppression, courses, import/export, PDF).
  const { saveRecipe, deleteRecipe, addToShopping, exportJSON, importJSON, exportPDF } = useRecipeCrud({
    recipes, setRecipes, setCollections, setEditingRecipe, setShoppingLists,
    ingredientDB, utensilDB, techniques, stock, isPlus, notify, navigate,
  });

  // Publier / dépublier / cloner des recettes publiques (communauté) — voir usePublicRecipes.
  const { publishRecipe, unpublishRecipe, cloneFromPublic, quickCloneFromPublic } =
    usePublicRecipes({ user, recipes, setRecipes, setCollections, ingredientDB, isPlus, notify, navigate });

  // Snapshot des slices partagés (espace courant) – utilisé pour semer un foyer
  // à sa création (copie de mes données vers le namespace du foyer).
  const getSharedData = useCallback(
    () => ({ recipes, collections, mealPlan, shoppingLists, stock, lowStock }),
    [recipes, collections, mealPlan, shoppingLists, stock, lowStock]
  );
  const currentRecipe = recipes.find(r => r.id === selectedRecipe);
  const isDesktop = useIsDesktop();

  // Suppression optimiste : la recette disparaît de la liste avant que l'URL ne
  // change, ouvrant une fenêtre où l'id de l'URL ne résout plus rien. On mémorise
  // l'id supprimé pour rediriger vers /recipes au lieu de clignoter « introuvable ».
  const [deletedId, setDeletedId] = useState(null);
  const deleteAndLeave = useCallback((id) => { setDeletedId(id); deleteRecipe(id); }, [deleteRecipe]);
  const justDeleted = !!selectedRecipe && !currentRecipe && deletedId === selectedRecipe;
  useEffect(() => {
    if (justDeleted) navigate("/recipes", { replace: true });
  }, [justDeleted, navigate]);

  // Ouvre l'éditeur sur une recette vierge, éventuellement pré-nommée (ex. depuis
  // l'état « aucun résultat » : « Créer "X" » passe { name: recherche }). On ne lit
  // que `name` : certains appelants passent l'évènement click en argument.
  const startNewRecipe = useCallback((preset) => {
    // Quota du plan gratuit vérifié À L'OUVERTURE (évite de remplir le formulaire
    // pour rien) : au-delà de la limite → offre Mijoté+.
    if (!canAddRecipes(recipes, isPlus, 1)) {
      notify(`Plan gratuit limité à ${FREE_RECIPE_LIMIT} recettes. Passe à Mijoté+ pour en créer plus.`, "warning");
      navigate("/plus");
      return;
    }
    const name = preset && typeof preset === "object" && typeof preset.name === "string" ? preset.name : "";
    setEditingRecipe({ name, description: "", prepTime: 0, cookTime: 0, servings: 2, cuisine: "", ingredients: [], utensils: [], steps: [], collections: [], image: "" });
  }, [recipes, isPlus, notify, navigate]);

  // Requête semée dans « Découvrir » depuis un autre onglet (ex. « chercher dans
  // la communauté » quand la bibliothèque privée ne renvoie rien). Consommée une
  // fois par DiscoverSection puis remise à zéro.
  const [discoverSeed, setDiscoverSeed] = useState("");
  const searchCommunity = useCallback((q) => { setDiscoverSeed((q || "").trim()); setTab("home"); }, [setTab]);

  // Bascule l'appartenance d'une recette à un carnet + recalcule les compteurs.
  // Partagé par la fiche recette et le menu d'appui long de la liste.
  const toggleRecipeCollection = useCallback((recipeId, colId) => {
    setRecipes(prev => {
      const updated = prev.map(r => {
        if (r.id !== recipeId) return r;
        const cols = r.collections || [];
        const next = cols.includes(colId) ? cols.filter(c => c !== colId) : [...cols, colId];
        return { ...r, collections: next };
      });
      setCollections(c => c.map(col => ({ ...col, count: updated.filter(r => (r.collections || []).includes(col.id)).length })));
      return updated;
    });
  }, []);

  // Ajoute une recette au planning (créneau explicite). Extrait pour être réutilisé
  // par la fiche et le menu d'appui long (via l'intention « plan »).
  const addRecipeToMealPlan = useCallback((r, date, portions, slot) => {
    setMealPlan(prev => ({ ...prev, [date]: [...(prev[date] || []), { recipeId: r.id, portions: portions || 1, slot: slot || "midi", groupId: newGroupId(), role: roleForCategory(r.category) }] }));
    notify("Ajouté au planning");
  }, [notify]);

  // Duplique une recette : copie privée (pas de lien public), nom suffixé, en tête
  // de liste ; recalcule les compteurs de carnets (la copie hérite des carnets).
  const duplicateRecipe = useCallback((recipe) => {
    if (!canAddRecipes(recipes, isPlus, 1)) {
      notify(`Plan gratuit limité à ${FREE_RECIPE_LIMIT} recettes. Passe à Mijoté+ pour en créer plus.`, "warning");
      navigate("/plus");
      return;
    }
    const copy = { ...recipe, id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: `${recipe.name} (copie)`, createdAt: Date.now(), updatedAt: Date.now() };
    delete copy.visibility; delete copy.publicId; delete copy.clonedFrom;
    setRecipes(prev => {
      const next = [copy, ...prev];
      setCollections(c => c.map(col => ({ ...col, count: next.filter(r => (r.collections || []).includes(col.id)).length })));
      return next;
    });
    notify("Recette dupliquée");
  }, [notify, recipes, isPlus, navigate]);

  // Ouvre une recette en transmettant une intention consommée à l'arrivée par la
  // fiche (« plan » → modale planning, « share » → flux de partage/publication).
  const openRecipeWithIntent = useCallback((id, intent) => navigate(`/recipes/${id}`, { state: { intent } }), [navigate]);

  // Édition : `editingRecipe` (état) pour une nouvelle recette ou un import IA ;
  // pour une recette EXISTANTE, l'éditeur est piloté par la route /recipes/:id/edit
  // (accès direct, survit à un remontage). On dérive donc la recette en cours
  // d'édition et un booléen unique `isEditing` réutilisé partout.
  const recipeBeingEdited = editingRecipe ?? (editRoute && currentRecipe ? currentRecipe : null);
  const isEditing = recipeBeingEdited !== null;

  // Titre de l'onglet navigateur : nom de la recette quand on en consulte/édite une,
  // sinon l'onglet courant.
  useEffect(() => {
    const TAB_TITLES = { home: "Accueil", recipes: "Recettes", "meal-plan": "Planning", shopping: "Courses", stock: "Mon Stock", config: "Configuration", profile: "Profil", legal: "Informations légales" };
    const recipeName = recipeBeingEdited
      ? (recipeBeingEdited.name?.trim() || "Nouvelle recette")
      : (publicDocs?.pub?.recipe?.name)
      || (selectedRecipe && currentRecipe ? currentRecipe.name : null);
    document.title = `Mijoté | ${recipeName || TAB_TITLES[tab] || "Accueil"}`;
  }, [tab, recipeBeingEdited, publicDocs, selectedRecipe, currentRecipe]);
  const [pendingTab, setPendingTab] = useState(null); // tab requested while editing

  // Navigate with guard: if editing, show confirm dialog first
  const requestTab = (newTab) => {
    if (isEditing) {
      setPendingTab(newTab);
    } else {
      setTab(newTab);
    }
  };

  const confirmLeaveEditor = () => {
    setEditingRecipe(null);
    if (editRoute) navigate(`/recipes/${selectedRecipe}`, { replace: true });
    setTab(pendingTab);
    setPendingTab(null);
  };

  // Compte : auth + purge + suppression RGPD (useAccount).
  const { handleSignOut, purgeData, deleteAccount } = useAccount({
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
  const atTabView = !isEditing && !publicPubId
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
      {/* Moniteur de perf : durée de rendu de chaque onglet. En dev → console ;
          en prod, brancher ici un envoi vers l'analytics si besoin. */}
      <Profiler id={tab} onRender={(id, phase, actualDuration) => {
        if (import.meta.env.DEV) console.log(`⏱️ [${id}] ${phase} : ${actualDuration.toFixed(1)} ms`);
      }}>
      {/* Wrapper clé=tab : rejoue l'animation d'entrée à chaque changement d'onglet
          (Accueil, Recettes, Planning, Profil, Config, Légal…), qui apparaissaient
          jusqu'ici sans transition. */}
      <div key={tab} className="page-enter" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {tab === "home" && <HomePage recipes={recipes} mealPlan={mealPlan} shoppingLists={shoppingLists} lowStock={lowStock} stock={stock} ingredientDB={ingredientDB} preferences={preferences} onSelectRecipe={setSelectedRecipe} setTab={setTab} onOpenPublic={openPublic} onClonePublic={quickCloneFromPublic} onNewRecipe={startNewRecipe} discoverSeed={discoverSeed} onDiscoverSeedConsumed={() => setDiscoverSeed("")} />}
      {tab === "recipes" && <RecipesPage recipes={recipes} collections={collections} ingredientDB={ingredientDB} onSelect={setSelectedRecipe} onNewRecipe={startNewRecipe} onSearchCommunity={searchCommunity} onEditRecipe={(r) => navigate(`/recipes/${r.id}/edit`)} onDeleteRecipe={deleteRecipe} onDuplicate={duplicateRecipe} onAddToShopping={addToShopping} onToggleCollection={toggleRecipeCollection} onPlanRecipe={(r) => openRecipeWithIntent(r.id, "plan")} onShareRecipe={(r) => openRecipeWithIntent(r.id, "share")} setCollections={setCollections} setTab={setTab} />}
      {tab === "meal-plan" && <MealPlanPageMemo mealPlan={mealPlan} recipes={recipes} setMealPlan={setMealPlan} onSelectRecipe={setSelectedRecipe} ingredientDB={ingredientDB} preferences={preferences} stock={stock} notify={notify} />}
      {tab === "shopping" && <ShoppingPage shoppingLists={shoppingLists} setShoppingLists={setShoppingLists} ingredientDB={ingredientDB} categories={categories} stock={stock} setStock={setStock} lowStock={lowStock} setLowStock={setLowStock} />}
      {tab === "stock" && <StockPage stock={stock} setStock={setStock} lowStock={lowStock} setLowStock={setLowStock} ingredientDB={ingredientDB} categories={categories} components={recipes.filter(r => r.isComponent)} />}
      {tab === "config" && <ConfigPage ingredientDB={ingredientDB} setIngredientDB={setIngredientDB} utensilDB={utensilDB} setUtensilDB={setUtensilDB} collections={collections} setCollections={setCollections} recipes={recipes} onExportAll={() => { const b = new Blob([JSON.stringify(recipes.map(cleanRecipeForExport), null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "all_recipes.json"; a.click(); notify("Export complet téléchargé"); }} onImport={importJSON} isAdmin={isAdmin} categories={categories} setCategories={setCategories} preferences={preferences} setPreferences={setPreferences} techniques={techniques} setTechniques={setTechniques} />}
      {tab === "profile" && <ProfilePage user={user} preferences={preferences} setPreferences={setPreferences} mealPlan={mealPlan} recipes={recipes} onPurge={purgeData} onDeleteAccount={deleteAccount} />}
      {tab === "legal" && <LegalPage />}
      </div>
      </Profiler>
    </div>
  );

  const mainScreen = isEditing ? (
    <div key={recipeBeingEdited?.id || "new"} className={isDesktop ? "desktop-content editor-layout" : ""} style={{ flex: 1, overflow: "hidden", width: "100%" }}>
      <RecipeEditor recipe={recipeBeingEdited}
        onSave={(r) => { const ok = saveRecipe(r); if (ok !== false && editRoute) navigate(`/recipes/${selectedRecipe}`, { replace: true }); }}
        onCancel={() => { setEditingRecipe(null); if (editRoute) navigate(`/recipes/${selectedRecipe}`); }}
        ingredientDB={ingredientDB} utensilDB={utensilDB} collections={collections} recipes={recipes} />
    </div>
  ) : importRoute ? (
    <div key={importRoute} className={`editor-enter${isDesktop ? " desktop-content" : ""}`} style={{ flex: 1, overflow: "hidden", width: "100%" }}>
      {importRoute === "url" ? <ImportFromUrl /> : <ImportFromPicture />}
    </div>
  ) : plusRoute ? (
    <div className={`editor-enter${isDesktop ? " desktop-content" : ""}`} style={{ flex: 1, overflow: "hidden", width: "100%" }}>
      <PlusPage />
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
      <RecipeDetail recipe={currentRecipe} recipes={recipes} cookMode={cookModeRoute} onSetCookMode={(v) => navigate(v ? `/recipes/${selectedRecipe}/cookmode` : `/recipes/${selectedRecipe}`, v ? undefined : { replace: true })} onBack={() => setSelectedRecipe(null)} onEdit={() => navigate(`/recipes/${selectedRecipe}/edit`)} onDelete={deleteAndLeave} onUpdateRecipe={(updated) => setRecipes(prev => prev.map(r => r.id === updated.id ? updated : r))} notify={notify} onAddToShopping={addToShopping} stock={stock} lowStock={lowStock} onAddToMealPlan={addRecipeToMealPlan} onExportJSON={exportJSON} onExportPDF={exportPDF} onPublish={publishRecipe} onUnpublish={unpublishRecipe} ingredientDB={ingredientDB} utensilDB={utensilDB} collections={collections} onUpdateCollections={setCollections} onToggleCollection={toggleRecipeCollection} />
    </div>
  ) : justDeleted ? (
    // Recette supprimée : la redirection vers /recipes est en cours, on n'affiche
    // rien pendant cette micro-fenêtre plutôt que l'écran « introuvable ».
    null
  ) : selectedRecipe && !currentRecipe && workspaceReady ? (
    <RecipeNotFound onBack={() => navigate("/recipes")} />
  ) : tabContent;

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
              enabled={!isDesktop && !isEditing}
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
            {(close) => (<>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Quitter le formulaire ?</h3>
              <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
                Les modifications non sauvegardées seront perdues. Tu peux sauvegarder d'abord en cliquant sur "Sauvegarder" en haut.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}>Rester</button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => close(confirmLeaveEditor)}>Quitter sans sauvegarder</button>
              </div>
            </>)}
          </SwipeableSheet>
        )}
        <OfflineModal />
        <HouseholdWelcome />
        <OnboardingCarousel />
      </div>
    </AppShellProvider>
  );
}

// Une fois connecté sur /login, on revient à la page d'origine (mémorisée dans
// l'état de navigation lors de la redirection), sinon à l'accueil.
function RedirectFromLogin() {
  const location = useLocation();
  return <Navigate to={location.state?.from || "/home"} replace />;
}

// Garde d'auth au niveau du routeur : écran de chargement tant que l'auth se
// résout, documents légaux publics, redirection vers /login sinon, et l'app
// complète (AppInner + toute sa machinerie) UNIQUEMENT une fois connecté.
function ProtectedRoutes({ user, isDark, toggleTheme }) {
  const location = useLocation();
  if (user === undefined) return <LoadingPage isDark={isDark} />;
  if (!user && location.pathname.startsWith("/legal")) {
    return <div style={{ height: "100dvh", background: "var(--bg)", color: "var(--text)" }}><LegalPage /></div>;
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <AppInner user={user} isDark={isDark} toggleTheme={toggleTheme} />;
}

export default function App() {
  // Thème et auth possédés à la racine : partagés par l'écran de connexion (public)
  // et l'app (protégée), sans doublon d'instance.
  const { isDark, toggleTheme } = useTheme();
  const { user, postLogin } = useAuthUser();
  const [signInError, setSignInError] = useState("");
  const onSignIn = useCallback(() => { setSignInError(""); return signInWithGoogle(setSignInError); }, []);

  return (
    <Routes>
      {/* Écran de connexion : route publique dédiée. Déjà connecté → retour à
          l'origine, après une brève transition « Connexion en cours… » (postLogin)
          pour que l'écran de chargement soit visible même quand le login est instantané. */}
      <Route path="/login" element={user === undefined || postLogin ? <LoadingPage isDark={isDark} /> : user ? <RedirectFromLogin /> : <LoginPage isDark={isDark} onToggleTheme={toggleTheme} onSignIn={onSignIn} error={signInError} />} />
      <Route path="/" element={<Navigate to="/home" replace />} />
      {/* Une seule instance d'AppInner pour toutes les routes de l'app : elle dérive
          l'onglet / la recette / la section depuis le pathname, ce qui évite tout
          remontage (et donc le flicker de l'écran de chargement) lors de la navigation. */}
      <Route path="*" element={<ProtectedRoutes user={user} isDark={isDark} toggleTheme={toggleTheme} />} />
    </Routes>
  );
}

