import { useMemo, type ComponentProps, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/ui/Icon.jsx";
import { UserAvatar } from "../components/user/UserAvatar.jsx";
import { DiscoverSection } from "../components/recipe/DiscoverSection.jsx";
import { SpotlightIngredient } from "../components/ingredient/SpotlightIngredient.jsx";
import { ElasticScroll } from "../components/ui/ElasticScroll.jsx";
import { HouseholdSection } from "../components/household/HouseholdSection.jsx";
import { NotifRow, OnboardingCard, CalmDayCard, TodayMealRow } from "../components/home/HomeCards.jsx";
import { SubviewPill, type HomeSubview } from "../components/home/SubviewPill.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useCanHover } from "../hooks/useCanHover.js";
import { pickSpotlightIngredient } from "@/lib/planning/spotlight.js";
import { buildDashboardSummary, groupTodayMeals } from "@/lib/planning/dashboard.js";
import type { IngredientDbItem, MealPlan, Recipe } from "@/lib/types.js";
import type { ShoppingList } from "@/lib/food/shoppingAggregate.js";
import type { DbEntry } from "@/lib/food/nameMatcher.js";

type DiscoverProps = ComponentProps<typeof DiscoverSection>;

/** Fiche ingrédient de la base, nommée (résumé du jour, ingrédient du moment). */
type HomeIngredient = IngredientDbItem & DbEntry;

interface HomePageProps {
  recipes?: Recipe[];
  mealPlan?: MealPlan;
  shoppingLists?: ShoppingList[];
  /** IDs d'ingrédients marqués « bientôt vide ». */
  lowStock?: string[];
  ingredientDB?: HomeIngredient[];
  unreadCount?: number;
  preferences?: DiscoverProps["preferences"];
  loading?: boolean;
  mode?: HomeSubview;
  onNavigateSubview?: (mode: HomeSubview) => void;
  onSelectRecipe?: (recipeId: string) => void;
  setTab?: (tab: string) => void;
  onOpenPublic?: DiscoverProps["onOpenPublic"];
  onClonePublic?: DiscoverProps["onClonePublic"];
  /** Création d'une recette (saisie manuelle, ou pré-nommée depuis Découvrir). */
  onNewRecipe: (seed?: { name: string }) => void;
  onOpenIngredient?: (ingredient: IngredientDbItem) => void;
  onExploreSeason?: (ingredient: IngredientDbItem) => void;
  discoverSeed?: string;
  onDiscoverSeedConsumed?: () => void;
}

// ─── HOME / ACCUEIL ───────────────────────────────────────────────────────────

function greeting(date = new Date()) {
  const h = date.getHours();
  return h >= 6 && h < 18 ? "Bonjour" : "Bonsoir";
}

// Titre d'onglet, identique au standard des autres pages (Recettes, Planning…) :
// même fonte, taille et graisse, pour une hiérarchie de titres homogène.
const HOME_TITLE_STYLE: CSSProperties = { fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

export function HomePage({ recipes = [], mealPlan = {}, shoppingLists = [], lowStock = [], ingredientDB = [], unreadCount = 0, preferences, loading = false, mode = "home", onNavigateSubview, onSelectRecipe, setTab, onOpenPublic, onClonePublic, onNewRecipe, onOpenIngredient, onExploreSeason, discoverSeed = "", onDiscoverSeedConsumed }: HomePageProps) {
  const { user } = useAppShell();
  const canHover = useCanHover();
  const navigate = useNavigate();
  const firstName = ((preferences?.displayName || user?.displayName) || "").trim().split(" ")[0] || "";
  const spotlight = useMemo(() => pickSpotlightIngredient(ingredientDB), [ingredientDB]);

  const summary = useMemo(
    () => buildDashboardSummary({ mealPlan, recipes, shoppingLists, lowStock, ingredientDB }),
    [mealPlan, recipes, shoppingLists, lowStock, ingredientDB]
  );
  const { meals, shoppingTodo, lowStockNames, isCalm, isEmpty } = summary;

  // Un repas composé (même créneau + groupe) = une carte, le plat en tête.
  const mealCards = useMemo(() => groupTodayMeals(meals), [meals]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête aligné sur le standard des autres onglets : titre serif 26/600 en
          tête à padding 20/20/0 (+ sous-titre discret), avatar à droite. Le
          sélecteur de sous-vue reste un contrôle SECONDAIRE, SOUS le titre : il ne
          remplace plus le titre en tête d'onglet (cohérence de hiérarchie). */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0, position: "relative", zIndex: 1, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <h1 style={HOME_TITLE_STYLE}>{mode === "discover" ? "Découvrir" : (firstName ? `${greeting()}, ${firstName} !` : `${greeting()} !`)}</h1>
            {/* Même sous-titre « Bienvenue sur Cardamome » dans les deux sous-vues
                (À suivre / Découvrir) pour uniformiser l'en-tête d'accueil. */}
            <span style={{ fontSize: 12.5, color: "var(--text3)", fontWeight: 500, marginTop: 3 }}>
              Bienvenue sur <span style={{ fontFamily: "var(--ff-display)", fontWeight: 700, color: "var(--text2)" }}>Cardam<span style={{ color: "var(--accent)" }}>o</span>me<span style={{ color: "var(--accent)" }}>·</span></span>
            </span>
          </div>
          <UserAvatar />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, marginBottom: 12 }}>
          <SubviewPill mode={mode} onNavigate={onNavigateSubview} />
          <button
            type="button" className="pressable hov-circle" onClick={() => navigate("/guide")}
            aria-label="Guide d'utilisation" title="Guide d'utilisation"
            style={{ marginLeft: "auto", flexShrink: 0, width: 40, height: 40, borderRadius: 999,
              display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              background: "none", border: "none", padding: 0 }}>
            <Icon name="help" size={22} color="var(--text2)" />
          </button>
          <button
            type="button" className="pressable hov-circle" onClick={() => navigate("/notifications")}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Notifications"}
            title="Notifications"
            style={{ position: "relative", flexShrink: 0, width: 40, height: 40, borderRadius: 999,
              display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              background: "none", border: "none", padding: 0 }}>
            <Icon name="bell" size={22} color="var(--text2)" />
            {unreadCount > 0 && (
              <span style={{ position: "absolute", top: 2, right: 2, minWidth: 17, height: 17, padding: "0 4px",
                display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999,
                background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 700, lineHeight: 1,
                fontVariantNumeric: "tabular-nums", border: "2px solid var(--bg)", boxSizing: "content-box" }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {mode === "discover" ? (
        /* ── Découvrir : recettes de la communauté (route /discover) ──────────
            La section gère elle-même son en-tête FIXE et sa zone défilante : plus
            de wrapper ElasticScroll ici (sinon l'en-tête défilerait et laisserait
            voir les cartes derrière lui). */
        <DiscoverSection ingredientDB={ingredientDB} preferences={preferences} recipes={recipes} onOpenPublic={onOpenPublic} onClonePublic={onClonePublic} onNewRecipe={onNewRecipe} initialSearch={discoverSeed} onSeedConsumed={onDiscoverSeedConsumed} />
      ) : (
      /* ── À suivre : tableau de bord perso (route /home) ─────────────────── */
      <ElasticScroll armWhenUnscrollable style={{ flex: 1, padding: "4px 20px var(--page-pad-b)" }}>
        {/* ── Mon foyer (en tête d'accueil) ───────────────────────────────── */}
        <HouseholdSection />

        {/* ── Aujourd'hui ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: isCalm ? 18 : 26 }}>
          {!isCalm && (
            <h2 className="slide-up" style={{ animationDelay: "0.04s", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              Aujourd'hui
            </h2>
          )}

          {loading ? (
            // Données partagées pas encore hydratées (bootstrap / cache temps réel) :
            // squelette plutôt que « Tout est à jour » (qui flasherait avant l'arrivée
            // du planning, des courses et du stock).
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="skeleton" style={{ height: 74, borderRadius: 18 }} />
              <div className="skeleton" style={{ height: 62, borderRadius: 14 }} />
              <div className="skeleton" style={{ height: 62, borderRadius: 14 }} />
            </div>
          ) : isEmpty ? (
            <OnboardingCard onNewRecipe={() => onNewRecipe()} onExplore={() => onNavigateSubview?.("discover")} />
          ) : isCalm ? (
            <CalmDayCard
              onPlan={() => setTab?.("meal-plan")}
              onNewRecipe={() => onNewRecipe()}
              onStock={() => setTab?.("stock")}
              onShopping={() => setTab?.("shopping")} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Repas du jour (un repas composé = une carte, plat en tête) */}
              {mealCards.map((card, i) => (
                <TodayMealRow key={i} card={card} index={i} canHover={canHover} onOpen={id => onSelectRecipe?.(id)} />
              ))}

              {/* Courses à faire */}
              {shoppingTodo > 0 && (
                <NotifRow
                  animationDelay={`${meals.length * 0.06 + 0.04}s`}
                  icon="shopping" color="var(--accent)" canHover={canHover}
                  onClick={() => setTab?.("shopping")}
                  title={`${shoppingTodo} article${shoppingTodo > 1 ? "s" : ""} à acheter`}
                  subtitle="Ta liste de courses t'attend" />
              )}

              {/* Stock bas */}
              {lowStockNames.length > 0 && (
                <NotifRow
                  animationDelay={`${(meals.length + (shoppingTodo > 0 ? 1 : 0)) * 0.06 + 0.04}s`}
                  icon="warning" color="#e8920a" canHover={canHover}
                  onClick={() => navigate("/stock?view=low")}
                  title={`${lowStockNames.length} ingrédient${lowStockNames.length > 1 ? "s" : ""} à racheter bientôt`}
                  subtitle={lowStockNames.slice(0, 4).join(" · ")} />
              )}
            </div>
          )}
        </section>

        {/* ── L'ingrédient du moment (engagement de saison) ────────────────── */}
        {spotlight && (
          <SpotlightIngredient
            ingredient={spotlight}
            onOpenIngredient={onOpenIngredient}
            onExplore={onExploreSeason}
          />
        )}
      </ElasticScroll>
      )}
    </div>
  );
}
