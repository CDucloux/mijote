import { memo, Profiler, type ComponentProps, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { HomePage } from "../../pages/HomePage.jsx";
import { RecipesPage } from "../../pages/RecipesPage.jsx";
import { MealPlanPage } from "../../pages/MealPlanPage.jsx";
import { StockPage } from "../../pages/StockPage.jsx";
import { ShoppingPage } from "../../pages/ShoppingPage.jsx";
import { ConfigPage } from "../../pages/ConfigPage.jsx";
import { ProfilePage } from "../../pages/ProfilePage.jsx";
import { LegalPage } from "../../pages/LegalPage.jsx";
import { GuidePage } from "../../pages/GuidePage.jsx";
import { NotificationsPage } from "../../pages/NotificationsPage.jsx";
import type { useMasterData } from "../../hooks/useMasterData.js";
import type { UseRecipeDerivedResult } from "../../hooks/useRecipeDerived.js";
import type { ActivityEvent } from "@/lib/notifications/activity.js";
import type { ShoppingList } from "@/lib/food/shoppingAggregate.js";
import type { Preferences } from "@/constants/preferences.js";
import type { Notebook, MealPlan, SavedRecipe } from "@/lib/types.js";

// Pages mémoïsées : ne re-rendent que si LEURS props (ou le contexte) changent, et non
// à chaque rendu d'App (toast, statut de sync…). Requiert des props stables.
const MealPlanPageMemo = memo(MealPlanPage);

interface AppTabContentProps {
  /** Onglet affiché (l'onglet d'origine tant qu'une fiche est ouverte par-dessus). */
  tab: string;
  isDesktop: boolean;
  /** Masque l'onglet le temps de recaler « Découvrir » sur la carte d'origine. */
  hidden: boolean;
  /** Données partagées encore en chargement : squelettes plutôt qu'états vides. */
  loading: boolean;
  user: User;
  isAdmin: boolean;
  /** Fiche ingrédient publique ouverte sous `/admin`. */
  ingredientFiche: boolean;
  discoverMode: boolean;
  recipes: SavedRecipe[];
  collections: Notebook[];
  setCollections: Dispatch<SetStateAction<Notebook[]>>;
  mealPlan: MealPlan;
  setMealPlan: Dispatch<SetStateAction<MealPlan>>;
  shoppingLists: ShoppingList[];
  setShoppingLists: Dispatch<SetStateAction<ShoppingList[]>>;
  stock: string[];
  setStock: Dispatch<SetStateAction<string[]>>;
  lowStock: string[];
  setLowStock: Dispatch<SetStateAction<string[]>>;
  preferences: Preferences;
  setPreferences: Dispatch<SetStateAction<Preferences>>;
  master: ReturnType<typeof useMasterData>;
  recipeDerived: UseRecipeDerivedResult;
  activities: ActivityEvent[];
  activitiesLoading: boolean;
  unreadCount: number;
  planner: { generate: ComponentProps<typeof MealPlanPage>["generate"]; undo: ComponentProps<typeof MealPlanPage>["undo"]; undoKey: string | null };
  discoverSeed: string;
  onDiscoverSeedConsumed: () => void;
  onExploreSeason: (query: string) => void;
  onSelectRecipe: (recipeId: string) => void;
  setTab: (tab: string) => void;
  onOpenPublic: ComponentProps<typeof HomePage>["onOpenPublic"];
  onClonePublic: ComponentProps<typeof HomePage>["onClonePublic"];
  onNewRecipe: (seed?: { name: string }) => void;
  library: Pick<ComponentProps<typeof RecipesPage>, "onSearchCommunity" | "onDeleteRecipe" | "onDuplicate" | "onAddToShopping" | "onToggleCollection" | "onPlanRecipe" | "onShareRecipe">;
  profile: Pick<ComponentProps<typeof ProfilePage>, "onPurge" | "onDeleteAccount" | "onExportAll" | "onImport">;
  ingredientDetail: { dismissing: boolean; onBack: () => void; onDismissEnd: () => void };
}

/**
 * Contenu de l'onglet courant. Le wrapper à clé d'onglet rejoue l'animation d'entrée
 * à chaque changement d'onglet ; le profileur mesure le coût de rendu de chacun.
 */
export function AppTabContent(props: AppTabContentProps) {
  const { tab, isDesktop, hidden, loading, user, isAdmin, ingredientFiche, discoverMode, recipes, collections, setCollections, mealPlan, setMealPlan, shoppingLists, setShoppingLists, stock, setStock, lowStock, setLowStock, preferences, setPreferences, master, recipeDerived } = props;
  const navigate = useNavigate();
  const { ingredientDB, utensilDB, categories, techniques, sources } = master;
  const openIngredient = (id: string) => navigate(`/admin/ingredients/${encodeURIComponent(id)}`);

  return (
    <div style={{ flex: 1, overflow: isDesktop ? "hidden" : "auto", minHeight: 0, display: "flex", flexDirection: "column", opacity: hidden ? 0 : 1 }} className={isDesktop ? "desktop-content" : ""}>
      {/* Moniteur de perf : durée de rendu de chaque onglet (console en dev). */}
      <Profiler id={tab} onRender={(id, phase, actualDuration) => {
        if (import.meta.env.DEV) console.log(`⏱️ [${id}] ${phase} : ${actualDuration.toFixed(1)} ms`);
      }}>
        <div key={tab} className="page-enter" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {tab === "home" && <HomePage recipes={recipes} mealPlan={mealPlan} shoppingLists={shoppingLists} lowStock={lowStock} ingredientDB={ingredientDB} unreadCount={props.unreadCount} preferences={preferences} loading={loading}
            mode={discoverMode ? "discover" : "home"} onNavigateSubview={(v) => navigate(v === "discover" ? "/discover" : "/home")} onSelectRecipe={props.onSelectRecipe} setTab={props.setTab}
            onOpenPublic={props.onOpenPublic} onClonePublic={props.onClonePublic} onNewRecipe={props.onNewRecipe}
            onOpenIngredient={(ing) => openIngredient(ing.id)} onExploreSeason={(ing) => props.onExploreSeason(ing?.name || "")}
            discoverSeed={props.discoverSeed} onDiscoverSeedConsumed={props.onDiscoverSeedConsumed} />}
          {tab === "recipes" && <RecipesPage recipes={recipes} collections={collections} ingredientDB={ingredientDB} recipeDerived={recipeDerived} loading={loading}
            onSelect={props.onSelectRecipe} onNewRecipe={props.onNewRecipe} onEditRecipe={(r) => navigate(`/recipes/${r.id}/edit`)}
            setCollections={setCollections} setTab={props.setTab} {...props.library} />}
          {tab === "meal-plan" && <MealPlanPageMemo mealPlan={mealPlan} recipes={recipes} setMealPlan={setMealPlan} onSelectRecipe={props.onSelectRecipe} ingredientDB={ingredientDB} recipeDerived={recipeDerived}
            preferences={preferences} stock={stock} loading={loading} generate={props.planner.generate} undo={props.planner.undo} undoKey={props.planner.undoKey} />}
          {tab === "shopping" && <ShoppingPage shoppingLists={shoppingLists} setShoppingLists={setShoppingLists} ingredientDB={ingredientDB} recipes={recipes} categories={categories} loading={loading} setStock={setStock} setLowStock={setLowStock} />}
          {tab === "stock" && <StockPage stock={stock} setStock={setStock} lowStock={lowStock} setLowStock={setLowStock} ingredientDB={ingredientDB} categories={categories} loading={loading}
            recipes={recipes} resolver={recipeDerived.resolver} onOpenRecipe={props.onSelectRecipe} onOpenIngredient={openIngredient}
            onSeeRecipesWith={(id) => navigate("/recipes", { state: { ingredientFilter: id } })} />}
          {tab === "admin" && (isAdmin || ingredientFiche) && <ConfigPage ingredientDB={ingredientDB} setIngredientDB={master.setIngredientDB} utensilDB={utensilDB} setUtensilDB={master.setUtensilDB} isAdmin={isAdmin}
            categories={categories} setCategories={master.setCategories} techniques={techniques} setTechniques={master.setTechniques} sources={sources} setSources={master.setSources}
            detailDismissing={props.ingredientDetail.dismissing && ingredientFiche} onDetailBack={props.ingredientDetail.onBack} onDetailDismissEnd={props.ingredientDetail.onDismissEnd} />}
          {tab === "profile" && <ProfilePage user={user} preferences={preferences} setPreferences={setPreferences} recipes={recipes} ingredientDB={ingredientDB} categories={categories} {...props.profile} />}
          {tab === "legal" && <LegalPage />}
          {tab === "guide" && <GuidePage />}
          {tab === "notifications" && <NotificationsPage activities={props.activities} loading={props.activitiesLoading} />}
        </div>
      </Profiler>
    </div>
  );
}
