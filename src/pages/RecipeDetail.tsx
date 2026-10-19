import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/ui/Icon.jsx";
import { SwipeableSheet } from "../components/ui/SwipeableSheet.jsx";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.jsx";
import { NutritionModal } from "../components/modals/NutritionModal.jsx";
import { BaseInfoModal } from "../components/modals/BaseInfoModal.jsx";
import { DifficultyModal } from "../components/modals/DifficultyModal.jsx";
import { RecipeJournal } from "../components/recipe/RecipeJournal.jsx";
import { PanScaleSheet } from "../components/recipe/PanScaleSheet.jsx";
import { CookMode } from "./CookMode.jsx";
import { RecipeHeroDesktop } from "../components/recipeDetail/RecipeHeroDesktop.jsx";
import { RecipeHeroMobile } from "../components/recipeDetail/RecipeHeroMobile.jsx";
import { RecipeInfoBarDesktop } from "../components/recipeDetail/RecipeInfoBarDesktop.jsx";
import { RecipeStatsMobile } from "../components/recipeDetail/RecipeStatsMobile.jsx";
import { RecipeCompactBar } from "../components/recipeDetail/RecipeCompactBar.jsx";
import { RecipeTabsMobile } from "../components/recipeDetail/RecipeTabsMobile.jsx";
import { RecipeContentMobile } from "../components/recipeDetail/RecipeContentMobile.jsx";
import { RecipeContentDesktop } from "../components/recipeDetail/RecipeContentDesktop.jsx";
import { ShoppingSelectSheet } from "../components/recipeDetail/ShoppingSelectSheet.jsx";
import { MealPlanSheet } from "../components/recipeDetail/MealPlanSheet.jsx";
import { ReportSheet } from "../components/recipeDetail/ReportSheet.jsx";
import { PublishSheet } from "../components/recipeDetail/PublishSheet.jsx";
import { CloneConfirmSheet } from "../components/recipeDetail/CloneConfirmSheet.jsx";
import { ShareSheet } from "../components/recipeDetail/ShareSheet.jsx";
import { CollectionsSheet } from "../components/recipeDetail/CollectionsSheet.jsx";
import { RecipeAttribution } from "../components/recipeDetail/RecipeAttribution.jsx";
import { RecipeActionDock } from "../components/recipeDetail/RecipeActionDock.jsx";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { useHeroCollapse, TAB_ORDER, type DetailTab } from "../hooks/useHeroCollapse.js";
import { isRecipeInSeason } from "@/lib/food/seasonality.js";
import { isRecipeVegan } from "@/lib/food/dietary.js";
import { asNutriLetter, computeNutriInfo } from "@/lib/recipes/nutriscore.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { computeDifficulty, explainDifficulty, workloadOf } from "@/lib/recipes/difficulty.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { DISCOVER_PREFIX } from "../hooks/usePublicRecipeView.js";
import { useRecipeView } from "../hooks/useRecipeView.js";
import type { DbEntry } from "@/lib/food/nameMatcher.js";
import type { CategoryMap } from "@/lib/cookSession/misEnPlace.js";
import type { HistoryRecipe } from "@/lib/recipes/history.js";
import type { IngredientLine, Recipe, UtensilDbItem } from "@/lib/types.js";
import type { ColoredCollection } from "../components/recipeDetail/CollectionsSheet.js";
import type { MenuItem } from "../components/recipeDetail/HeroMenu.js";

interface RecipeDetailProps {
  recipe: Recipe;
  /** Recettes connues : résolution des préparations de base. */
  recipes?: Recipe[];
  /** Pas à pas ouvert (porté par l'URL hors mode public). */
  cookMode?: boolean;
  onSetCookMode?: (on: boolean) => void;
  onBack: () => void;
  onEdit?: () => void;
  onDelete?: (recipeId: string | undefined) => void;
  onAddToShopping?: (recipe: Recipe, items: IngredientLine[], mult: number) => void;
  onAddToMealPlan?: (recipe: Recipe, date: string, portions: number, slot: string) => void;
  onExportJSON?: (recipe: Recipe) => void;
  onExportPDF: (recipe: Recipe) => void;
  onPublish?: (recipe: Recipe) => void;
  onUnpublish?: (recipe: Recipe) => void;
  ingredientDB: DbEntry[];
  utensilDB: UtensilDbItem[];
  categories?: CategoryMap;
  collections?: ColoredCollection[];
  onToggleCollection?: (recipeId: string | undefined, collectionId: string) => void;
  onUpdateRecipe?: (recipe: HistoryRecipe) => void;
  onCooked?: (recipeId: string) => void;
  notify?: (message: string, type?: string) => void;
  /** IDs en stock (ingrédients et préparations de base déjà réalisées). */
  stock?: string[];
  lowStock?: string[];
  /** Lecture seule d'une recette publique de la communauté. */
  publicMode?: boolean;
  /** Recette publique déjà présente dans les recettes de l'utilisateur. */
  owned?: boolean;
  onClone?: () => void;
  authorName?: string;
  authorPhoto?: string;
  authorUid?: string;
  isAdmin?: boolean;
  onReport?: (reason: string | null, note: string) => void;
  onAdminDelete?: () => void;
}

/** État de navigation reçu par la fiche (page d'origine, recette parente, intention). */
interface RecipeDetailNavState {
  fromPath?: string;
  from?: string;
  intent?: "plan" | "share";
}

const readNavState = (state: unknown): RecipeDetailNavState => {
  if (!state || typeof state !== "object") return {};
  const raw = state as Record<string, unknown>;
  const str = (value: unknown) => (typeof value === "string" ? value : undefined);
  const intent = raw.intent === "plan" || raw.intent === "share" ? raw.intent : undefined;
  return { fromPath: str(raw.fromPath), from: str(raw.from), intent };
};

// ─── RECIPE DETAIL ────────────────────────────────────────────────────────────
export function RecipeDetail({ recipe, recipes = [], cookMode = false, onSetCookMode, onBack, onEdit, onDelete, onAddToShopping, onAddToMealPlan, onExportJSON, onExportPDF, onPublish, onUnpublish, ingredientDB, utensilDB, categories = DEFAULT_CATEGORIES, collections, onToggleCollection, onUpdateRecipe, onCooked, notify, stock = [], lowStock = [], publicMode = false, owned = false, onClone, authorName, authorPhoto, authorUid, isAdmin = false, onReport, onAdminDelete }: RecipeDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  // `state.fromPath` = page d'origine (ex. "/home") → on y retourne tel quel.
  // `state.from` = id d'une recette parente (préparation de base ouverte depuis
  // une recette) → retour vers cette recette. Sinon, comportement par défaut.
  const navState = readNavState(location.state);
  const { fromPath, from } = navState;
  const backTo = fromPath
    ? () => navigate(fromPath)
    : from
      ? () => navigate(`/recipes/${from}`)
      : onBack;
  // Portions d'origine : les quantités d'ingrédients y correspondent.
  const baseServings = Number(recipe.servings) || 2;
  const [servings, setServings] = useState(Math.min(24, baseServings));
  const [bump, setBump] = useState(0); // relance l'animation « rebond » du compteur de portions
  const [panFactor, setPanFactor] = useState(1); // facteur d'adaptation de moule (calculatrice)
  const [showCalc, setShowCalc] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("Ingrédients");
  const isDesktop = useIsDesktop();
  const [showMealModal, setShowMealModal] = useState(false);
  const [mealDate, setMealDate] = useState(new Date().toISOString().slice(0, 10));
  const [mealSlot, setMealSlot] = useState("midi");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCollModal, setShowCollModal] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [selectedIngs, setSelectedIngs] = useState<string[]>([]);
  const [pendingPublish, setPendingPublish] = useState(false);
  const [confirmClone, setConfirmClone] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const isPublished = recipe.visibility === "public";

  // Intention transmise par le menu d'appui long de la liste (« Planning » /
  // « Partager ») : on ouvre le flux correspondant à l'arrivée, puis on efface
  // l'intention de l'état de navigation pour ne pas la rejouer à un remontage.
  const intent = navState.intent;
  useEffect(() => {
    if (!intent) return;
    if (intent === "plan") setShowMealModal(true);
    else if (intent === "share") { if (isPublished) setShareOpen(true); else setPendingPublish(true); }
    navigate(location.pathname, { replace: true, state: { ...navState, intent: undefined } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);
  // CTA d'ajout réutilisé (lecture seule d'une recette publique) → ouvre une confirmation.
  const keepCta = owned
    ? <button className="btn btn-ghost" disabled style={{ width: "100%", borderRadius: 30, opacity: 0.85 }}><Icon name="check" size={15} color="var(--ok)" /> Déjà dans tes recettes</button>
    : <button className="btn btn-primary" onClick={() => setConfirmClone(true)} style={{ width: "100%", borderRadius: 30 }}><Icon name="plus" size={15} /> Ajouter à mes recettes</button>;
  // Modération (mode public) : signalement (tous) + suppression admin.
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState("");
  const [confirmAdminDelete, setConfirmAdminDelete] = useState(false);
  // Attribution affichée dans le hero en mode public (auteur + source d'origine).
  const attribution = publicMode && <RecipeAttribution recipe={recipe} authorUid={authorUid} authorName={authorName} authorPhoto={authorPhoto} />;
  // Publier ouvre toujours une confirmation (avec, le cas échéant, la note sur les
  // préparations de base publiées avec). Dépublier est immédiat.
  const togglePublish = () => {
    if (isPublished) onUnpublish?.(recipe);
    else setPendingPublish(true);
  };

  const openShoppingModal = () => {
    setSelectedIngs(flatIngs.filter(fi => !isInStock(fi)).map(fi => fi._fid));
    setShowShoppingModal(true);
  };
  // Le mode pas à pas est porté par l'URL (/recipes/:id/cookmode) → il survit à un
  // remontage (dézoom desktop) et au bouton retour. En mode public (pas de route
  // dédiée), on retombe sur un état LOCAL, sinon le bouton serait inerte.
  const [localCookMode, setLocalCookMode] = useState(false);
  const cookModeActive = onSetCookMode ? cookMode : localCookMode;
  const setCookMode = onSetCookMode || setLocalCookMode;
  const [showNutrition, setShowNutrition] = useState(false);
  const [showBaseInfo, setShowBaseInfo] = useState(false);
  const [showDifficulty, setShowDifficulty] = useState(false);
  // Lien PUBLIC de la recette (page communauté), jamais le lien privé. Le menu
  // « Partager » n'apparaît que lorsque la recette est publiée (cf. menus).
  const publicUrl = typeof recipe.publicId === "string" && recipe.publicId ? `${window.location.origin}${DISCOVER_PREFIX}${encodeURIComponent(recipe.publicId)}` : "";
  const shareText = `${recipe.name} – une recette à découvrir sur Cardamome`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(publicUrl); notify?.("Lien copié dans le presse-papier"); }
    catch { notify?.("Copie impossible", "error"); }
    setShareOpen(false);
  };
  const nativeShare = async () => {
    // Sans `text` : les messageries concatènent texte + lien et perdent l'aperçu.
    try { if (navigator.share) await navigator.share({ title: recipe.name, url: publicUrl }); }
    catch { /* annulé par l'utilisateur */ }
    setShareOpen(false);
  };
  const mult = (servings / baseServings) * panFactor;
  const { view, recipesById, stockSet, baseSteps, componentDeps, flatIngs, isInStock, isLowStock } = useRecipeView({ recipe, recipes, ingredientDB, utensilDB, stock, lowStock, mult, navigate });
  const { seasonResolver } = view;
  const recipeInSeason = useMemo(() => isRecipeInSeason(recipe, seasonResolver), [recipe, seasonResolver]);
  // Nutri-Score recalculé À L'AFFICHAGE : `recipe.nutriLetter` est un instantané
  // figé à l'enregistrement ; en le recomputant (avec appariement par nom pour les
  // ingrédients non liés à un `dbId`), un ingrédient reconnu après coup est bien
  // pris en compte, sans devoir ré-enregistrer la recette. Repli sur la valeur
  // stockée si le calcul ne trouve rien.
  const nutriLetter = useMemo(
    () => computeNutriInfo(recipe.ingredients, ingredientDB, recipesById).letter ?? asNutriLetter(recipe.nutriLetter),
    [recipe.ingredients, recipe.nutriLetter, ingredientDB, recipesById]
  );
  const recipeVegan = useMemo(() => isRecipeVegan(recipe, seasonResolver, { recipes }), [recipe, seasonResolver, recipes]);
  const { techniques, isPlus } = useAppShell();
  // Journal d'itérations = fonctionnalité Cardamome+ : en gratuit → page d'offre.
  const openJournal = () => isPlus ? setJournalOpen(true) : navigate("/plan");
  const difficulty = useMemo(() => computeDifficulty(recipe, techniques, { recipes }), [recipe, techniques, recipes]);
  const difficultyExplain = useMemo(() => explainDifficulty(recipe, techniques, { recipes }), [recipe, techniques, recipes]);
  const difficultyTitle = difficulty.overridden
    ? `Difficulté ${difficulty.score}/5 (définie manuellement)`
    : difficulty.drivers.length ? `Difficulté ${difficulty.score}/5 · ${difficulty.drivers.join(", ")}` : undefined;

  // Animation du repli du hero + élastique + swipe d'onglet (refs pilotées dans le DOM).
  const hero = useHeroCollapse(isDesktop, activeTab, setActiveTab, recipe.id);
  // Quitter réellement la fiche (bouton retour) oublie la position mémorisée : la
  // restauration ne doit servir qu'au retour depuis la fiche d'un ingrédient, pas à
  // une réouverture ultérieure de la recette depuis une liste.
  const handleBack = () => { hero.forgetScroll(); backTo(); };

  // Actions du menu « … » du hero (identiques desktop/mobile).
  const publishItem: MenuItem = { label: isPublished ? "Rendre privée" : "Rendre publique", icon: isPublished ? "eyeOff" : "globe", onClick: togglePublish };
  const shareItem: MenuItem = { label: "Partager", icon: "share", onClick: () => setShareOpen(true) };
  const menuItems: MenuItem[] = [
    { label: "Journal d'itérations", icon: "history", onClick: openJournal },
    ...(!recipe.isComponent && onPublish ? [publishItem] : []),
    ...(isPublished ? [shareItem] : []),
    { label: "Télécharger (JSON)", icon: "download", onClick: () => onExportJSON?.(recipe) },
    { label: "Supprimer", icon: "trash", danger: true, onClick: () => setShowDeleteConfirm(true) },
  ];
  // Données de la rangée de badges du hero (partagée desktop/mobile).
  const badges = {
    recipeVegan, recipeInSeason, difficulty, difficultyExplain, difficultyTitle, collections, publicMode,
    onOpenBaseInfo: () => setShowBaseInfo(true),
    onOpenDifficulty: () => setShowDifficulty(true),
    onOpenCollections: () => setShowCollModal(true),
  };
  // Props communes aux deux heros (image, actions, modération, badges).
  const heroCommon = {
    recipe, handleBack, publicMode, onEdit, onExportPDF,
    reportAvailable: !!onReport, adminDeleteAvailable: !!(isAdmin && onAdminDelete),
    onOpenReport: () => { setReportReason(null); setReportNote(""); setReportOpen(true); },
    onOpenAdminDelete: () => setConfirmAdminDelete(true),
    menuItems, attribution, badges,
  };

  return (
    <div className="recipe-detail-root" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* ── DESKTOP HERO ── */}
      {isDesktop && <RecipeHeroDesktop {...heroCommon} />}

      {/* ── DESKTOP INFO BAR – carte arrondie façon mobile ── */}
      {isDesktop && (
        <RecipeInfoBarDesktop recipe={recipe} nutriLetter={nutriLetter} servings={servings} setServings={setServings} onOpenNutrition={() => setShowNutrition(true)} />
      )}

      {/* Desktop : « Garder » en mode public, sinon dock d'actions */}
      {isDesktop && publicMode && (
        <div style={{ position: "fixed", right: 24, bottom: 28, zIndex: 60, width: 280 }}>{keepCta}</div>
      )}
      {isDesktop && !publicMode && (
        <RecipeActionDock onOpenShopping={openShoppingModal} onOpenMealPlan={() => setShowMealModal(true)} />
      )}

      {/* Desktop tabs */}
      {isDesktop && (
      <div className="detail-tabs-mobile" style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
        {TAB_ORDER.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "10px 0", fontSize: 12, fontWeight: 500, color: activeTab === t ? "var(--accent)" : "var(--text3)", borderBottom: `2px solid ${activeTab === t ? "var(--accent)" : "transparent"}`, transition: "color 0.15s, border-color 0.15s" }}>{t}</button>
        ))}
      </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
        {/* ── MOBILE: scrollable hero + sticky bar + tabs + content ── */}
        <div className="detail-mobile-content" ref={hero.scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <RecipeHeroMobile
            {...heroCommon}
            heroImgRef={hero.heroImgRef} shadeRef={hero.shadeRef} ctrlLRef={hero.ctrlLRef} ctrlRRef={hero.ctrlRRef}
            titleRef={hero.titleRef} srcRef={hero.srcRef} attribRef={hero.attribRef} badgesRef={hero.badgesRef} />

          <RecipeCompactBar barRef={hero.barRef} barInnerRef={hero.barInnerRef} recipeName={recipe.name}
            publicMode={publicMode} onBack={handleBack} onOpenShopping={() => { openShoppingModal(); }} />

          {/* Infos + actions – remontés juste sous le hero, au-dessus des onglets */}
          <RecipeStatsMobile recipe={recipe} nutriLetter={nutriLetter} publicMode={publicMode} keepCta={keepCta}
            onOpenNutrition={() => setShowNutrition(true)} onOpenShopping={() => { openShoppingModal(); }} onOpenMealPlan={() => setShowMealModal(true)} />

          {/* Onglets sticky sous la barre, switch segmenté avec indicateur glissant */}
          <RecipeTabsMobile activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* Contenu selon onglet actif – swipe horizontal pour changer d'onglet */}
          <div ref={hero.paneRef} {...hero.swipeHandlers} style={{ willChange: "transform", flexShrink: 0 }}>
            <RecipeContentMobile recipe={recipe} activeTab={activeTab} view={view}
              servings={servings} setServings={setServings} bump={bump} setBump={setBump}
              panFactor={panFactor} setShowCalc={setShowCalc} baseSteps={baseSteps} setCookMode={setCookMode} />
          </div>
          {/* Cale : hauteur ajustée pour qu'un contenu court laisse quand même replier
              le hero entièrement (voir l'effet de cale du hook). */}
          <div ref={hero.spacerRef} aria-hidden="true" style={{ flexShrink: 0 }} />
        </div>

        {/* ── DESKTOP: 2-column layout (hidden on mobile via CSS) ── */}
        <RecipeContentDesktop recipe={recipe} view={view} baseSteps={baseSteps} setCookMode={setCookMode} />
      </div>

      {/* ── MODALS ── */}
      {showNutrition && (
        // Base = portions D'ORIGINE de la recette (les quantités d'ingrédients y
        // correspondent), pas le sélecteur de portions : l'apport PAR portion est
        // invariant, cuisiner plus ou moins ne change pas ce qu'il y a dans une assiette.
        <NutritionModal recipe={recipe} recipes={recipes} ingredientDB={ingredientDB} servings={baseServings} onClose={() => setShowNutrition(false)} />
      )}
      {cookModeActive && !!recipe.steps?.length && (
        <CookMode recipe={recipe} mult={mult} ingredientDB={ingredientDB} utensilDB={utensilDB} categories={categories} recipes={recipes} stockSet={stockSet} onUpdateRecipe={onUpdateRecipe} onCooked={onCooked} onClose={() => setCookMode(false)} />
      )}

      {showShoppingModal && (
        <ShoppingSelectSheet flatIngs={flatIngs} selectedIngs={selectedIngs} setSelectedIngs={setSelectedIngs}
          isInStock={isInStock} isLowStock={isLowStock} getIngImage={view.getIngImage} mult={mult}
          onClose={() => setShowShoppingModal(false)}
          onConfirm={items => { onAddToShopping?.(recipe, items, mult); setShowShoppingModal(false); }} />
      )}

      {showMealModal && (
        <MealPlanSheet mealDate={mealDate} setMealDate={setMealDate} mealSlot={mealSlot} setMealSlot={setMealSlot}
          onClose={() => setShowMealModal(false)}
          onConfirm={() => { onAddToMealPlan?.(recipe, mealDate, 1, mealSlot); setShowMealModal(false); }} />
      )}
      {showDeleteConfirm && (
        <ConfirmDialog title="Supprimer la recette ?"
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => { onDelete?.(recipe.id); setShowDeleteConfirm(false); }}>
          <strong style={{ color: "var(--text)" }}>« {recipe.name} »</strong> sera définitivement supprimée des recettes enregistrées.
        </ConfirmDialog>
      )}
      {confirmClone && (
        <CloneConfirmSheet componentDeps={componentDeps} onClose={() => setConfirmClone(false)} onClone={onClone} />
      )}
      {reportOpen && (
        <ReportSheet reportReason={reportReason} setReportReason={setReportReason} reportNote={reportNote} setReportNote={setReportNote}
          onClose={() => setReportOpen(false)} onReport={onReport} />
      )}
      {confirmAdminDelete && (
        <ConfirmDialog title="Retirer cette recette publique ?"
          icon="trash"
          onCancel={() => setConfirmAdminDelete(false)}
          onConfirm={() => { setConfirmAdminDelete(false); onAdminDelete?.(); }}>
          Elle sera <strong style={{ color: "var(--text)" }}>retirée de la communauté</strong> (modération). La copie privée de son auteur·e n'est <strong style={{ color: "var(--text)" }}>pas</strong> supprimée.
        </ConfirmDialog>
      )}
      {pendingPublish && (
        <PublishSheet recipe={recipe} componentDeps={componentDeps} onClose={() => setPendingPublish(false)} onPublish={onPublish} isAdmin={isAdmin} />
      )}
      {shareOpen && (
        <ShareSheet recipe={recipe} publicUrl={publicUrl} shareText={shareText}
          onCopyLink={copyLink} onNativeShare={nativeShare} onClose={() => setShareOpen(false)} />
      )}
      {journalOpen && onUpdateRecipe && (
        <SwipeableSheet onClose={() => setJournalOpen(false)} style={{ maxHeight: "88dvh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Icon name="history" size={20} color="var(--accent)" />
            <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text)" }}>Journal d'itérations</h3>
          </div>
          <RecipeJournal recipe={recipe} onUpdateRecipe={onUpdateRecipe} />
        </SwipeableSheet>
      )}
      {showCalc && (
        <PanScaleSheet applied={panFactor !== 1}
          onApply={f => setPanFactor(f)} onReset={() => setPanFactor(1)} onClose={() => setShowCalc(false)} />
      )}
      {showBaseInfo && <BaseInfoModal onClose={() => setShowBaseInfo(false)} />}
      {showDifficulty && <DifficultyModal data={difficultyExplain} workload={workloadOf(recipe)} onClose={() => setShowDifficulty(false)} />}
      {showCollModal && onToggleCollection && (
        <CollectionsSheet recipe={recipe} collections={collections} onToggle={onToggleCollection} onClose={() => setShowCollModal(false)} />
      )}
    </div>
  );
}
