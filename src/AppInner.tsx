import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useNavigationType } from "react-router-dom";
import type { User } from "firebase/auth";
import { cleanRecipeForExport } from "@/lib/recipes/recipeSchema.js";
import { isSavedRecipe } from "@/lib/recipes/savedRecipes.js";
import { exportTextFile } from "@/lib/ui/fileExport.js";
import { parseAppRoute, originPathOf, recipeUnderIngredient } from "@/lib/ui/appRoute.js";
import { pageTitle } from "@/lib/ui/pageTitle.js";
import { reportError } from "@/lib/observability/observability.js";
import { installGlobalRipple } from "@/lib/ui/ripple.js";
import { installGlobalElasticScroll } from "@/lib/ui/globalElasticScroll.js";
import { countUnread } from "@/lib/notifications/activity.js";
import type { Recipe, SavedRecipe, Notebook, MealPlan } from "@/lib/types.js";
import type { ShoppingList } from "@/lib/food/shoppingAggregate.js";
import { SAMPLE_RECIPES, SAMPLE_COLLECTIONS } from "./constants/categories.js";
import { DEFAULT_PREFERENCES, type Preferences } from "./constants/preferences.js";
import { TAB_BY_ID, tabForPath } from "./constants/tabs.js";
import { AppShellProvider, type SyncStatus } from "./context/AppShellContext.jsx";
import { useFirestoreSync } from "./hooks/useFirestoreSync.js";
import { useRecipeDerived } from "./hooks/useRecipeDerived.js";
import { useMealPlanner } from "./hooks/useMealPlanner.js";
import { usePublicRecipeView } from "./hooks/usePublicRecipeView.js";
import { useLS } from "./hooks/useLS.js";
import { useSubscription } from "./hooks/useSubscription.js";
import { useNotifications } from "./hooks/useNotifications.js";
import { useActivityLog } from "./hooks/useActivityLog.js";
import { useMasterData } from "./hooks/useMasterData.js";
import { useRecipeImport } from "./hooks/useRecipeImport.js";
import { usePublicRecipes } from "./hooks/usePublicRecipes.js";
import { useAccount } from "./hooks/useAccount.js";
import { useRecipeActions } from "./hooks/useRecipeActions.js";
import { useDiscoverReturnAnchor } from "./hooks/useDiscoverReturnAnchor.js";
import { useDetailDismiss } from "./hooks/useDetailDismiss.js";
import { useRecipeCrud } from "./hooks/useRecipeCrud.js";
import { useIsDesktop } from "./hooks/useIsDesktop.js";
import { useSoftKeyboardOpen } from "./hooks/useSoftKeyboardOpen.js";
import { usePageZoom } from "./hooks/usePageZoom.js";
import { useAndroidBackButton } from "./hooks/useAndroidBackButton.js";
import { useLaunchLinks } from "./hooks/useLaunchLinks.js";
import { useLauncherSync } from "./hooks/useLauncherSync.js";
import { useHouseholdPointer } from "./hooks/useHouseholdPointer.js";
import { useUserDirectory } from "./hooks/useUserDirectory.js";
import { useDraftEditor } from "./hooks/useDraftEditor.js";
import { useAppShellValue } from "./hooks/useAppShellValue.js";
import { AppToast } from "./components/layout/AppToast.jsx";
import { AppTabContent } from "./components/layout/AppTabContent.jsx";
import { PublicRecipeScreen } from "./components/layout/PublicRecipeScreen.jsx";
import { LeaveEditorSheet } from "./components/layout/LeaveEditorSheet.jsx";
import { RotateGuard } from "./components/layout/RotateGuard.jsx";
import { CookTogetherBanner } from "./components/cookMode/CookTogetherBanner.jsx";
import { PullToRefresh } from "./components/ui/PullToRefresh.jsx";
import { RecipeNotFound } from "./components/recipe/RecipeNotFound.jsx";
import { OfflineModal } from "./components/modals/OfflineModal.jsx";
import { HouseholdWelcome } from "./components/household/HouseholdWelcome.jsx";
import { HouseholdInvite } from "./components/household/HouseholdInvite.jsx";
import { OnboardingCarousel } from "./components/onboarding/OnboardingCarousel.jsx";
import { TooltipLayer } from "./components/ui/TooltipLayer.jsx";
import { TabBar } from "./components/layout/TabBar.jsx";
import { DesktopSidebar } from "./components/layout/DesktopSidebar.jsx";
import { RecipeEditor } from "./pages/RecipeEditor.jsx";
import { RecipeDetail } from "./pages/RecipeDetail.jsx";
import { ImportPage } from "./pages/ImportPage.jsx";
import { PlanPage } from "./pages/PlanPage.jsx";

// L'auth est possédée par le routeur racine : la déconnexion passe par `signOut(auth)`,
// dont l'écouteur racine redirige vers /login (démontage d'AppInner).
const NOOP = () => {};
const IMPORT_MODES = { url: "lien", text: "texte", pdf: "pdf", picture: "photo" } as const;
const ADMIN_EMAIL: unknown = import.meta.env.VITE_ADMIN_EMAIL;

interface AppInnerProps {
  user: User;
  isDark: boolean;
  toggleTheme: () => void;
}

/**
 * App authentifiée : montée UNE fois pour toutes les routes (l'écran se déduit du
 * pathname), elle possède l'état métier, la synchro Firestore et le shell.
 */
export function AppInner({ user, isDark, toggleTheme }: AppInnerProps) {
  usePageZoom();
  const location = useLocation();
  // Retour arrière (POP) : la fiche réapparaît en place, sans rejouer son entrée.
  const detailEnter = useNavigationType() === "POP" ? "" : "editor-enter";
  const navigate = useNavigate();
  const tab = tabForPath(location.pathname);
  const route = parseAppRoute(location.pathname);
  const { importRoute, planRoute, cookModeRoute, editRoute } = route;
  const selectedRecipe = route.recipeId;
  const adminFiche = route.ingredientId !== null;
  const setTab = useCallback((id: string) => navigate(TAB_BY_ID[id] || "/home"), [navigate]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const isAdmin = typeof ADMIN_EMAIL === "string" && !!ADMIN_EMAIL && user.email === ADMIN_EMAIL;

  const [recipes, setRecipes] = useLS<SavedRecipe[]>("rf_recipes2", SAMPLE_RECIPES);
  const [collections, setCollections] = useLS<Notebook[]>("rf_collections2", SAMPLE_COLLECTIONS);
  const [mealPlan, setMealPlan] = useLS<MealPlan>("rf_mealplan2", {});
  const [shoppingLists, setShoppingLists] = useLS<ShoppingList[]>("rf_shopping3", []);
  const { directory, loadDirectory } = useUserDirectory(user.uid);
  const master = useMasterData(isAdmin);
  const { masterDB, setMasterDB, userDB, setUserDB, categories, ingredientDB, utensilDB, techniques, sources } = master;
  const [stock, setStock] = useLS<string[]>("rf_stock", []);
  const [lowStock, setLowStock] = useLS<string[]>("rf_lowStock", []);
  const [preferences, setPreferences] = useLS<Preferences>("rf_preferences", DEFAULT_PREFERENCES);
  // Onde tactile et overscroll « stretch » globaux, installés une fois pour toute l'app.
  useEffect(() => installGlobalRipple(), []);
  useEffect(() => installGlobalElasticScroll(), []);

  // Dérivés par recette et planificateur hébergés ICI (composant persistant) : la
  // bascule d'onglet ne recalcule rien, et l'« Annuler » d'une génération survit.
  const recipeDerived = useRecipeDerived(recipes, ingredientDB);
  const { generate: generateMealPlan, undo: undoMealPlan, undoKey: mealPlanUndoKey } =
    useMealPlanner({ recipes, ingredientDB, preferences, stock, mealPlan, setMealPlan });
  const householdPointer = useHouseholdPointer(user.uid);

  const setSelectedRecipe = useCallback((id: string | null) => {
    // Ouverture : la page d'origine est mémorisée sous `originPath` pour y revenir au
    // recul (clé distincte de `from`/`fromPath`, que la fiche interprète autrement).
    if (id) navigate(`/recipes/${id}`, { state: { originPath: location.pathname } });
    else {
      const origin = originPathOf(location.state);
      const fallback = location.pathname === `/recipes/${selectedRecipe}` ? "/recipes" : location.pathname;
      navigate(origin && origin !== location.pathname ? origin : fallback, { replace: true });
    }
  }, [navigate, location.pathname, location.state, selectedRecipe]);
  const { editingRecipe, setEditingRecipe, openDraftEditor, closeDraftEditor } = useDraftEditor(route.newRoute, navigate);
  const { importFromUrl, importFromImages, importFromText, importFromPdf, importGift } = useRecipeImport({ ingredientDB, utensilDB, openEditor: openDraftEditor });
  const { notification, leaving: notifLeaving, notify } = useNotifications();
  const { pubId: publicPubId, docs: publicDocs, open: openPublic } = usePublicRecipeView({ user, recipes, location, navigate });

  const { workspaceReady, sharedHydrating, removeRecipe } = useFirestoreSync({
    user, setUser: NOOP, isAdmin, setSyncStatus, householdPointer,
    recipes, setRecipes, collections, setCollections, mealPlan, setMealPlan,
    shoppingLists, setShoppingLists, stock, setStock, lowStock, setLowStock,
    preferences, setPreferences, masterDB, setMasterDB, userDB, setUserDB,
  });
  const loading = !workspaceReady || sharedHydrating;

  const { activities, activitiesLoading, logActivity } = useActivityLog({
    user, householdId: householdPointer?.id || null, workspaceReady,
    actorName: preferences.displayName || user.displayName || "",
  });
  // Non lus : instant de dernière consultation, marqué à l'ouverture de /notifications.
  const [notifsLastSeen, setNotifsLastSeen] = useLS("rf_notifsLastSeen", 0);
  const unreadCount = useMemo(() => countUnread(activities, notifsLastSeen), [activities, notifsLastSeen]);
  useEffect(() => {
    if (tab === "notifications") setNotifsLastSeen(Date.now());
  }, [tab, activities, setNotifsLastSeen]);

  // Cardamome+ : abonnement actif ou admin (accès complet du propriétaire de l'app).
  const subscription = useSubscription(user.uid);
  const isPlus = isAdmin || subscription.active;
  // Recette découverte offerte (non-abonné), consommée une fois (flag synchronisé).
  const giftImportUsed = preferences.giftImportUsed === true;
  const markGiftImportUsed = useCallback(() => setPreferences(p => ({ ...p, giftImportUsed: true })), [setPreferences]);

  const { saveRecipe, deleteRecipe, addToShopping, exportJSON, importJSON, exportPDF } = useRecipeCrud({
    recipes, setRecipes, setCollections, setEditingRecipe, shoppingLists, setShoppingLists,
    ingredientDB, utensilDB, techniques, stock, isPlus, notify, navigate, logActivity, removeRecipe,
  });
  const { publishRecipe, unpublishRecipe, cloneFromPublic, quickCloneFromPublic } =
    usePublicRecipes({ user, displayName: preferences.displayName, recipes, setRecipes, setCollections, ingredientDB, isPlus, notify, navigate, logActivity, isAdmin });
  // Instantané des slices partagés : sème un foyer à sa création.
  const getSharedData = useCallback(
    () => ({ recipes, collections, mealPlan, shoppingLists, stock, lowStock }),
    [recipes, collections, mealPlan, shoppingLists, stock, lowStock],
  );
  const currentRecipe = recipes.find(r => r.id === selectedRecipe);
  const isDesktop = useIsDesktop();
  // Clavier logiciel ouvert : la tab bar se masque au lieu de se coller au clavier.
  const keyboardOpen = useSoftKeyboardOpen();

  // Suppression optimiste : l'id de l'URL ne résout plus rien avant la navigation ;
  // on redirige vers /recipes au lieu de clignoter « introuvable ».
  const [deletedId, setDeletedId] = useState<string | null>(null);
  const deleteAndLeave = useCallback((id: string | undefined) => { if (!id) return; setDeletedId(id); deleteRecipe(id); }, [deleteRecipe]);
  const justDeleted = !!selectedRecipe && !currentRecipe && deletedId === selectedRecipe;
  useEffect(() => {
    if (justDeleted) navigate("/recipes", { replace: true });
  }, [justDeleted, navigate]);

  const { guardQuota, toggleRecipeCollection, addRecipeToMealPlan, logCooked, duplicateRecipe } = useRecipeActions({
    recipes, setRecipes, setCollections, setMealPlan, setPreferences, isPlus, notify, navigate, logActivity,
  });
  // Recette vierge, éventuellement pré-nommée (« Créer "X" » depuis une recherche vide)
  // ou pré-remplie d'ingrédients. Quota vérifié À L'OUVERTURE.
  const startNewRecipe = useCallback((preset?: Pick<Recipe, "name" | "ingredients">) => {
    if (!guardQuota()) return;
    const name = typeof preset?.name === "string" ? preset.name : "";
    const ingredients = Array.isArray(preset?.ingredients) ? preset.ingredients : [];
    openDraftEditor({ name, description: "", prepTime: 0, cookTime: 0, servings: 2, cuisine: "", ingredients, utensils: [], steps: [], collections: [], image: "" });
  }, [guardQuota, openDraftEditor]);

  // Requête semée dans « Découvrir » (recherche vide, ingrédient du moment), consommée une fois.
  const [discoverSeed, setDiscoverSeed] = useState("");
  const goDiscover = useCallback((q = "") => { setDiscoverSeed(q.trim()); navigate("/discover"); }, [navigate]);
  // Intention consommée par la fiche à l'arrivée (« plan » → planning, « share » → partage).
  const openRecipeWithIntent = useCallback((id: string, intent: "plan" | "share") =>
    navigate(`/recipes/${id}`, { state: { intent, originPath: location.pathname } }), [navigate, location.pathname]);

  // Recette en cours d'édition : brouillon (nouvelle / import) ou recette existante
  // pilotée par la route /recipes/:id/edit (survit à un remontage).
  const recipeBeingEdited = editingRecipe ?? (editRoute && currentRecipe ? currentRecipe : null);
  const isEditing = recipeBeingEdited !== null;

  useEffect(() => {
    document.title = pageTitle({
      tab, editing: isEditing, editedName: recipeBeingEdited?.name,
      viewedName: publicDocs?.pub.recipe.name || (selectedRecipe && currentRecipe ? currentRecipe.name : null),
      ingredientName: route.ingredientId ? ingredientDB.find(d => d.id === route.ingredientId)?.name : null,
      routeName: planRoute ? "Abonnement" : null,
    });
  }, [tab, isEditing, recipeBeingEdited, publicDocs, selectedRecipe, currentRecipe, route.ingredientId, ingredientDB, planRoute]);
  const [pendingTab, setPendingTab] = useState<string | null>(null); // onglet demandé pendant l'édition

  // Sortie animée de la fiche recette (Capacitor mobile).
  const { dismissing, dismissDetail, finishDismiss } = useDetailDismiss({ onDetail: (!!selectedRecipe && !!currentRecipe && !isEditing) || adminFiche, isDesktop });
  // Retour Android : en édition, même garde d'abandon que la TabBar ; sur la fiche, sortie animée.
  useAndroidBackButton({ isEditing, onLeaveEditor: () => setPendingTab(tab), onBackDismiss: dismissDetail });
  // Lanceur Android : raccourcis et widgets tenus à jour depuis le planning et les courses.
  useLaunchLinks();
  useLauncherSync({ ready: workspaceReady && !sharedHydrating, mealPlan, recipes, shoppingLists, ingredientDB, setShoppingLists });

  const requestTab = (newTab: string) => { if (isEditing) setPendingTab(newTab); else setTab(newTab); };
  const confirmLeaveEditor = () => {
    closeDraftEditor(editRoute ? `/recipes/${selectedRecipe}` : "/recipes");
    if (pendingTab) setTab(pendingTab);
    setPendingTab(null);
  };

  const { handleSignOut, purgeData, deleteAccount } = useAccount({
    user, setUser: NOOP, notify, setMealPlan, setShoppingLists, setStock, setLowStock, setRecipes, setCollections,
  });

  // Console admin réservée aux admins, SAUF la fiche ingrédient, publique.
  useEffect(() => { if (tab === "admin" && !isAdmin && !adminFiche) navigate("/profile", { replace: true }); }, [tab, isAdmin, adminFiche, navigate]);
  // Retour d'une recette publique : recale « Découvrir » sur la carte cliquée.
  const atTabView = !isEditing && !publicPubId && !(selectedRecipe && currentRecipe) && !(selectedRecipe && !currentRecipe && workspaceReady);
  const scrollHold = useDiscoverReturnAnchor({ publicPubId, atTabView, tab });

  // Onglet affiché sous une fiche privée : l'onglet d'ORIGINE, gardé monté et identique
  // de l'ouverture au retour (pas de rejeu d'animation, scroll conservé).
  const originPath = originPathOf(location.state);
  const visibleTab = selectedRecipe && currentRecipe ? (originPath ? tabForPath(originPath) : tab) : tab;
  // Fiche ingrédient ouverte depuis une fiche recette : la recette reste montée
  // DESSOUS (même calque, même position dans l'arbre, scroll conservé). Sans elle, la
  // sortie de la fiche ingrédient glissait sur un fond vide.
  const underRecipeId = adminFiche ? recipeUnderIngredient(originPath) : null;
  const underRecipe = underRecipeId ? recipes.find(r => r.id === underRecipeId) : undefined;
  const ficheOverRecipe = !!underRecipe && !(selectedRecipe && currentRecipe);
  const overlayRecipe = selectedRecipe && currentRecipe ? currentRecipe : underRecipe;

  const shellValue = useAppShellValue(
    { user, householdId: householdPointer?.id || null, syncStatus, isDark, notify, techniques, sources, directory, isAdmin, isPlus, subscription, giftImportUsed, markGiftImportUsed },
    { signOut: handleSignOut, toggleTheme, getSharedData, loadDirectory, importFromUrl, importFromImages, importFromText, importFromPdf, importGift, logActivity },
  );

  const tabContent = (
    <AppTabContent tab={visibleTab} isDesktop={isDesktop} hidden={scrollHold} loading={loading} user={user} isAdmin={isAdmin}
      ingredientFiche={adminFiche} discoverMode={location.pathname.startsWith("/discover")}
      recipes={recipes} collections={collections} setCollections={setCollections} mealPlan={mealPlan} setMealPlan={setMealPlan}
      shoppingLists={shoppingLists} setShoppingLists={setShoppingLists} stock={stock} setStock={setStock} lowStock={lowStock} setLowStock={setLowStock}
      preferences={preferences} setPreferences={setPreferences} master={master} recipeDerived={recipeDerived}
      activities={activities} activitiesLoading={activitiesLoading} unreadCount={unreadCount}
      planner={{ generate: generateMealPlan, undo: undoMealPlan, undoKey: mealPlanUndoKey }}
      discoverSeed={discoverSeed} onDiscoverSeedConsumed={() => setDiscoverSeed("")} onExploreSeason={goDiscover}
      onSelectRecipe={setSelectedRecipe} setTab={setTab} onOpenPublic={openPublic} onClonePublic={quickCloneFromPublic} onNewRecipe={startNewRecipe}
      library={{
        onSearchCommunity: goDiscover, onDeleteRecipe: deleteRecipe, onDuplicate: duplicateRecipe,
        onAddToShopping: (r) => addToShopping(r, undefined), onToggleCollection: toggleRecipeCollection,
        onPlanRecipe: (r) => openRecipeWithIntent(r.id, "plan"), onShareRecipe: (r) => openRecipeWithIntent(r.id, "share"),
      }}
      profile={{ onPurge: purgeData, onDeleteAccount: deleteAccount, onImport: importJSON, onExportAll: () => exportTextFile("all_recipes.json", JSON.stringify(recipes.map(cleanRecipeForExport), null, 2), "application/json")
        .then(o => { if (o === "downloaded") notify("Export complet téléchargé"); })
        .catch(e => { reportError(e, { action: "export", filename: "all_recipes.json" }); notify("Export impossible", "error"); }) }}
      ingredientDetail={{ dismissing, onBack: () => dismissDetail(() => navigate(-1)), onDismissEnd: finishDismiss }} />
  );

  const mainScreen = isEditing ? (
    <div key={recipeBeingEdited.id || "new"} className={isDesktop ? "desktop-content editor-layout" : ""} style={{ flex: 1, overflow: "hidden", width: "100%" }}>
      <RecipeEditor recipe={recipeBeingEdited}
        onSave={(r) => {
          if (!saveRecipe(r)) return; // quota atteint ou recette invalide : l'éditeur reste ouvert
          if (editRoute) navigate(`/recipes/${selectedRecipe}`, { replace: true });
          else closeDraftEditor("/recipes"); // brouillon enregistré : cache purgé
        }}
        onCancel={() => { if (editRoute) { setEditingRecipe(null); navigate(`/recipes/${selectedRecipe}`); } else closeDraftEditor("/recipes"); }}
        ingredientDB={ingredientDB} utensilDB={utensilDB} recipes={recipes} />
    </div>
  ) : importRoute ? (
    // Clé STABLE : changer de mode glisse le segmented sans remonter la page (saisie préservée).
    <div key="import" className={`page-slide-in-right${isDesktop ? " desktop-content" : ""}`} style={{ flex: 1, overflow: "hidden", width: "100%" }}>
      <ImportPage mode={IMPORT_MODES[importRoute]} />
    </div>
  ) : planRoute ? (
    <div className={`editor-enter${isDesktop ? " desktop-content" : ""}`} style={{ flex: 1, overflow: "hidden", width: "100%" }}>
      <PlanPage />
    </div>
  ) : publicPubId ? (
    <PublicRecipeScreen docs={publicDocs} enterClass={detailEnter} isDesktop={isDesktop} user={user} isAdmin={isAdmin}
      owned={!!publicDocs && (recipes.some(r => r.clonedFrom?.publicId === publicDocs.pub.pubId) || publicDocs.pub.authorUid === user.uid)}
      onClone={cloneFromPublic} onExportPDF={exportPDF} notify={notify} ingredientDB={ingredientDB} utensilDB={utensilDB} categories={categories} />
  ) : overlayRecipe ? (
    // Fiche privée en OVERLAY au-dessus de l'onglet d'origine, gardé monté dessous
    // toute la vie de la fiche : pas de rejeu d'entrée au retour, scroll conservé.
    // `paddingTop` rend à l'onglet la réserve d'inset que #root cède au hero à fond perdu.
    // Fiche ingrédient ouverte depuis la recette : elle passe AU-DESSUS du calque
    // recette (inerte), qui reste en place pour réapparaître à sa sortie.
    <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column", boxSizing: "border-box", paddingTop: isDesktop ? 0 : "var(--safe-hero-top)" }}>
      {ficheOverRecipe ? (
        // Calque transparent : c'est la fiche (fond opaque, cf. ConfigPage) qui glisse à
        // la sortie. La bande de la barre système la suit, pour ne pas laisser voir le
        // hero de la recette sous l'heure et les icônes pendant la lecture de la fiche.
        <div style={{ position: "absolute", inset: 0, zIndex: 3, display: "flex", flexDirection: "column" }}>
          {!isDesktop && <div className={dismissing ? "page-dismiss-right" : undefined} style={{ height: "var(--safe-hero-top)", flexShrink: 0, background: "var(--bg)" }} />}
          {tabContent}
        </div>
      ) : tabContent}
      <div key={overlayRecipe.id} inert={ficheOverRecipe}
        className={ficheOverRecipe ? (isDesktop ? "desktop-content" : "") : dismissing ? "page-dismiss-right" : `${detailEnter}${isDesktop ? " desktop-content" : ""}`}
        onAnimationEnd={dismissing && !ficheOverRecipe ? (e) => { if (e.target === e.currentTarget && e.animationName === "detailDismissRight") finishDismiss(); } : undefined}
        style={{ position: "absolute", inset: 0, overflow: isDesktop ? "hidden" : "auto", minHeight: 0, background: "var(--bg)", zIndex: 2 }}>
        <RecipeDetail recipe={overlayRecipe} recipes={recipes} cookMode={cookModeRoute}
          onSetCookMode={(v) => navigate(v ? `/recipes/${selectedRecipe}/cookmode` : `/recipes/${selectedRecipe}`, v ? undefined : { replace: true })}
          onBack={() => dismissDetail(() => setSelectedRecipe(null))} onEdit={() => navigate(`/recipes/${selectedRecipe}/edit`)} onDelete={deleteAndLeave}
          onUpdateRecipe={(updated) => { if (isSavedRecipe(updated)) setRecipes(prev => prev.map(r => r.id === updated.id ? updated : r)); }}
          onCooked={logCooked} notify={notify} onAddToShopping={addToShopping} stock={stock} lowStock={lowStock} onAddToMealPlan={addRecipeToMealPlan}
          onExportJSON={exportJSON} onExportPDF={exportPDF}
          onPublish={(r) => { if (isSavedRecipe(r)) publishRecipe(r); }} onUnpublish={(r) => { if (isSavedRecipe(r)) unpublishRecipe(r); }}
          isAdmin={isAdmin} ingredientDB={ingredientDB} utensilDB={utensilDB} categories={categories} collections={collections}
          onToggleCollection={(recipeId, collectionId) => { if (recipeId) toggleRecipeCollection(recipeId, collectionId); }} />
      </div>
    </div>
  ) : justDeleted ? (
    // Recette supprimée : la redirection vers /recipes est en cours, rien à afficher.
    null
  ) : selectedRecipe && !currentRecipe && workspaceReady ? (
    <RecipeNotFound onBack={() => navigate("/recipes")} />
  ) : (
    // Même conteneur `relative` que la branche fiche : React réconcilie les deux et ne
    // démonte PAS l'onglet au retour d'une fiche (pas de rejeu, scroll préservé).
    <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>
      {tabContent}
    </div>
  );

  // Fiche affichée en mobile : le hero à fond perdu remonte jusqu'à la barre système,
  // la réserve d'inset du #root est donc coupée (cf. .root--edge-hero).
  const edgeHero = !isDesktop && !isEditing && !importRoute && !planRoute
    && (publicPubId ? !!publicDocs : (!!selectedRecipe && !!currentRecipe) || ficheOverRecipe);

  return (
    <AppShellProvider value={shellValue}>
      <div id="root" className={`${isDark ? "" : "light"}${edgeHero ? " root--edge-hero" : ""}`}>
        <RotateGuard />
        {notification && <AppToast notification={notification} leaving={notifLeaving} isDesktop={isDesktop} />}
        {/* Cuisiner à deux : un autre membre du foyer a lancé un pas à pas. */}
        {!cookModeRoute && !isEditing && <CookTogetherBanner isDesktop={isDesktop} onJoin={(id) => navigate(`/recipes/${id}/cookmode`)} />}
        {isDesktop ? (
          <>
            {/* Pages légales en plein écran : la sidebar y est superflue. */}
            {tab !== "legal" && <DesktopSidebar tab={tab} setTab={requestTab} />}
            {mainScreen}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PullToRefresh enabled={!isEditing} threshold={110} onRefresh={() => window.location.reload()}>
              {mainScreen}
            </PullToRefresh>
            {!keyboardOpen && <TabBar tab={tab} setTab={requestTab} />}
          </div>
        )}
        {pendingTab && <LeaveEditorSheet onStay={() => setPendingTab(null)} onLeave={confirmLeaveEditor} />}
        <OfflineModal />
        <HouseholdInvite />
        <HouseholdWelcome />
        <OnboardingCarousel />
        <TooltipLayer />
      </div>
    </AppShellProvider>
  );
}
