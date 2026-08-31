import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { NutritionModal } from "../components/NutritionModal.jsx";
import { BaseInfoModal } from "../components/BaseInfoModal.jsx";
import { DifficultyModal } from "../components/DifficultyModal.jsx";
import { RecipeJournal } from "../components/RecipeJournal.jsx";
import { RecipeCalculators } from "../components/RecipeCalculators.jsx";
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
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { useHeroCollapse, TAB_ORDER } from "../hooks/useHeroCollapse.js";
import { findIngredientMatch, createIngredientResolver } from "@/lib/food/nameMatcher.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { isRecipeInSeason } from "@/lib/food/seasonality.js";
import { isRecipeVegan } from "@/lib/food/dietary.js";
import { computeNutriInfo } from "@/lib/recipes/nutriscore.js";
import { formatParamSummary } from "@/lib/utensils/appliances.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { computeDifficulty, explainDifficulty } from "@/lib/recipes/difficulty.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { flattenForShopping } from "@/lib/recipes/recipeComponents.js";
import { DISCOVER_PREFIX } from "../hooks/usePublicRecipeView.js";

// ─── RECIPE DETAIL ────────────────────────────────────────────────────────────
export function RecipeDetail({ recipe, recipes = [], cookMode = false, onSetCookMode, onBack, onEdit, onDelete, onAddToShopping, onAddToMealPlan, onExportJSON, onExportPDF, onPublish, onUnpublish, ingredientDB, utensilDB, categories = DEFAULT_CATEGORIES, collections, onToggleCollection, onUpdateRecipe, onCooked, notify, stock = [], lowStock = [], publicMode = false, owned = false, onClone, authorName, authorPhoto, authorUid, isAdmin = false, onReport, onAdminDelete }) {
  const navigate = useNavigate();
  const location = useLocation();
  // `state.fromPath` = page d'origine (ex. "/home") → on y retourne tel quel.
  // `state.from` = id d'une recette parente (préparation de base ouverte depuis
  // une recette) → retour vers cette recette. Sinon, comportement par défaut.
  const handleBack = location.state?.fromPath
    ? () => navigate(location.state.fromPath)
    : location.state?.from
      ? () => navigate(`/recipes/${location.state.from}`)
      : onBack;
  const [servings, setServings] = useState(Math.min(24, recipe.servings || 2));
  const [bump, setBump] = useState(0); // relance l'animation « rebond » du compteur de portions
  const [panFactor, setPanFactor] = useState(1); // facteur d'adaptation de moule (calculatrice)
  const [showCalc, setShowCalc] = useState(false);
  const [activeTab, setActiveTab] = useState("Ingrédients");
  const isDesktop = useIsDesktop();
  const [showMealModal, setShowMealModal] = useState(false);
  const [mealDate, setMealDate] = useState(new Date().toISOString().slice(0, 10));
  const [mealSlot, setMealSlot] = useState("midi");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCollModal, setShowCollModal] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [selectedIngs, setSelectedIngs] = useState([]);
  const [pendingPublish, setPendingPublish] = useState(false);
  const [confirmClone, setConfirmClone] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const isPublished = recipe.visibility === "public";

  // Intention transmise par le menu d'appui long de la liste (« Planning » /
  // « Partager ») : on ouvre le flux correspondant à l'arrivée, puis on efface
  // l'intention de l'état de navigation pour ne pas la rejouer à un remontage.
  const intent = location.state?.intent;
  useEffect(() => {
    if (!intent) return;
    if (intent === "plan") setShowMealModal(true);
    else if (intent === "share") isPublished ? setShareOpen(true) : setPendingPublish(true);
    navigate(location.pathname, { replace: true, state: { ...location.state, intent: undefined } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);
  // CTA d'ajout réutilisé (lecture seule d'une recette publique) → ouvre une confirmation.
  const keepCta = owned
    ? <button className="btn btn-ghost" disabled style={{ width: "100%", borderRadius: 30, opacity: 0.85 }}><Icon name="check" size={15} color="var(--ok)" /> Déjà dans tes recettes</button>
    : <button className="btn btn-primary" onClick={() => setConfirmClone(true)} style={{ width: "100%", borderRadius: 30 }}><Icon name="plus" size={15} /> Ajouter à mes recettes</button>;
  // Modération (mode public) : signalement (tous) + suppression admin.
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(null);
  const [reportNote, setReportNote] = useState("");
  const [confirmAdminDelete, setConfirmAdminDelete] = useState(false);
  // Attribution affichée dans le hero en mode public (auteur + source d'origine).
  const attribution = publicMode && <RecipeAttribution recipe={recipe} authorUid={authorUid} authorName={authorName} authorPhoto={authorPhoto} />;
  const stockSet = useMemo(() => new Set(stock), [stock]);
  const lowSet = useMemo(() => new Set(lowStock), [lowStock]);
  const recipesById = useMemo(() => new Map((recipes || []).map(r => [r.id, r])), [recipes]);
  // Préparations de base utilisées dans la recette qui ont leurs propres étapes,
  // dédupliquées par id → affichées avant les étapes de la recette mère.
  const baseSteps = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const ing of recipe?.ingredients || []) {
      if (!ing.recipeId || seen.has(ing.recipeId)) continue;
      const comp = recipesById.get(ing.recipeId);
      if (comp?.steps?.length > 0) { seen.add(ing.recipeId); out.push(comp); }
    }
    return out;
  }, [recipe, recipesById]);
  // Préparations de base référencées (toutes, pas seulement celles avec étapes) →
  // sert à prévenir l'utilisateur qu'elles seront publiées avec la recette.
  const componentDeps = useMemo(() => {
    const ids = new Set();
    for (const l of recipe?.ingredients || []) if (l.recipeId) ids.add(l.recipeId);
    return [...ids].map(id => recipesById.get(id)).filter(Boolean);
  }, [recipe, recipesById]);
  // Publier ouvre toujours une confirmation (avec, le cas échéant, la note sur les
  // préparations de base publiées avec). Dépublier est immédiat.
  const togglePublish = () => isPublished
    ? onUnpublish?.(recipe)
    : setPendingPublish(true);
  // Résout une ligne composant → { comp, missing }. comp = recette source (cache name).
  const resolveComp = (ing) => ing.recipeId ? { comp: recipesById.get(ing.recipeId), missing: !recipesById.get(ing.recipeId) } : null;
  // Retourne true si l'ingrédient de recette est trouvé dans le stock
  const isInStock = (ing) => {
    if (ing.recipeId) return stockSet.has(ing.recipeId); // composant stocké = déjà préparé
    const match = findIngredientMatch(ing.name, ingredientDB);
    return match ? stockSet.has(match.id) : false;
  };
  // Retourne true si l'ingrédient est marqué « bientôt vide »
  const isLowStock = (ing) => {
    const match = findIngredientMatch(ing.name, ingredientDB);
    return match ? lowSet.has(match.id) : false;
  };
  // Liste aplatie pour le modal courses : les composants sont éclatés en ingrédients bruts.
  const flatIngs = useMemo(() => {
    const raw = flattenForShopping(recipe.ingredients || [], recipesById);
    return raw.map((ing, i) => ({ ...ing, _fid: String(i) }));
  }, [recipe.ingredients, recipesById]);

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
  const [actionsOpen, setActionsOpen] = useState(false);
  const [dockClosing, setDockClosing] = useState(false);
  const [showBaseInfo, setShowBaseInfo] = useState(false);
  const [showDifficulty, setShowDifficulty] = useState(false);
  const actionsRef = useRef(null);
  // Repli animé du dock : on joue l'animation inverse avant de démonter (évite le flicker).
  const closeDock = () => {
    setDockClosing(true);
    setTimeout(() => { setActionsOpen(false); setDockClosing(false); }, 240);
  };
  // Lien PUBLIC de la recette (page communauté), jamais le lien privé. Le menu
  // « Partager » n'apparaît que lorsque la recette est publiée (cf. menus).
  const publicUrl = recipe.publicId ? `${window.location.origin}${DISCOVER_PREFIX}${encodeURIComponent(recipe.publicId)}` : "";
  const shareText = `${recipe.name} – une recette à découvrir sur Cardamome`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(publicUrl); notify?.("Lien copié dans le presse-papier"); }
    catch { notify?.("Copie impossible", "error"); }
    setShareOpen(false);
  };
  const nativeShare = async () => {
    try { if (navigator.share) await navigator.share({ title: recipe.name, text: shareText, url: publicUrl }); }
    catch { /* annulé par l'utilisateur */ }
    setShareOpen(false);
  };
  const mult = (servings / (recipe.servings || 2)) * panFactor;
  const seasonResolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  const recipeInSeason = useMemo(() => isRecipeInSeason(recipe, seasonResolver), [recipe, seasonResolver]);
  // Nutri-Score recalculé À L'AFFICHAGE : `recipe.nutriLetter` est un instantané
  // figé à l'enregistrement ; en le recomputant (avec appariement par nom pour les
  // ingrédients non liés à un `dbId`), un ingrédient reconnu après coup est bien
  // pris en compte, sans devoir ré-enregistrer la recette. Repli sur la valeur
  // stockée si le calcul ne trouve rien.
  const nutriLetter = useMemo(
    () => computeNutriInfo(recipe.ingredients, ingredientDB, recipesById).letter ?? recipe.nutriLetter,
    [recipe.ingredients, recipe.nutriLetter, ingredientDB, recipesById]
  );
  const recipeVegan = useMemo(() => isRecipeVegan(recipe, seasonResolver, { recipes }), [recipe, seasonResolver, recipes]);
  const { techniques, isPlus } = useAppShell();
  // Journal d'itérations = fonctionnalité Cardamome+ : en gratuit → page d'offre.
  const openJournal = () => isPlus ? setJournalOpen(true) : navigate("/plus");
  const difficulty = useMemo(() => computeDifficulty(recipe, techniques, { recipes }), [recipe, techniques, recipes]);
  const difficultyExplain = useMemo(() => explainDifficulty(recipe, techniques, { recipes }), [recipe, techniques, recipes]);
  const difficultyTitle = difficulty.overridden
    ? `Difficulté ${difficulty.score}/5 (définie manuellement)`
    : difficulty.drivers.length ? `Difficulté ${difficulty.score}/5 · ${difficulty.drivers.join(", ")}` : undefined;

  // Collapse the desktop actions panel when clicking anywhere outside it.
  useEffect(() => {
    if (!actionsOpen) return;
    const handlePointerDown = e => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) closeDock();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [actionsOpen]);

  // Animation du repli du hero + élastique + swipe d'onglet (refs pilotées dans le DOM).
  const hero = useHeroCollapse(isDesktop, activeTab, setActiveTab, recipe.id);

  const getIngImage = (dbId, name) => ingredientDB.find(d => d.id === dbId)?.image || (name ? findIngredientMatch(name, ingredientDB)?.image || "" : "");
  const getUtImage = (dbId, name) => utensilDB.find(d => d.id === dbId)?.image || (name ? utensilDB.find(d => normalizeStr(d.name) === normalizeStr(name))?.image || "" : "");
  // Résumé des réglages d'appareil posés sur l'étape (vide si l'ustensile n'en est pas un).
  const getUtDetail = (u, step) => formatParamSummary(utensilDB.find(d => d.id === u.dbId)?.appliance, step?.utensilParams?.[u.id]);
  // Contexte de rendu partagé par les contenus mobile/desktop (helpers d'affichage).
  const view = { mult, recipesById, getIngImage, getUtImage, getUtDetail, resolveComp, isInStock, seasonResolver, ingredientDB, navigate };

  // Actions du menu « … » du hero (identiques desktop/mobile).
  const menuItems = [
    { label: "Journal d'itérations", icon: "history", onClick: openJournal },
    ...(!recipe.isComponent && onPublish ? [{ label: isPublished ? "Rendre privée" : "Rendre publique", icon: isPublished ? "eyeOff" : "globe", onClick: togglePublish }] : []),
    ...(isPublished ? [{ label: "Partager", icon: "share", onClick: () => setShareOpen(true) }] : []),
    { label: "Télécharger (JSON)", icon: "download", onClick: () => onExportJSON(recipe) },
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
        <div ref={actionsRef} style={{ position: "fixed", right: 24, bottom: 28, zIndex: 60, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
          {actionsOpen ? (
            <div className={`action-dock${dockClosing ? " closing" : ""}`}>
              <button className="action-dock-btn action-dock-primary" onClick={() => { openShoppingModal(); }}><Icon name="shopping" size={16} color="#fff" /> Courses</button>
              <button className="action-dock-btn action-dock-ghost" onClick={() => setShowMealModal(true)}><Icon name="calendar" size={16} /> Planifier</button>
              <button className="action-dock-close" title="Réduire" onClick={closeDock}><Icon name="close" size={15} /></button>
            </div>
          ) : (
            <button className="fab-toggle" title="Actions" onClick={() => setActionsOpen(true)} style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px -6px rgba(0,0,0,0.45)" }}>
              <Icon name="plus" size={24} color="#fff" />
            </button>
          )}
        </div>
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
        <NutritionModal recipe={recipe} recipes={recipes} ingredientDB={ingredientDB} servings={recipe.servings || 2} onClose={() => setShowNutrition(false)} />
      )}
      {cookModeActive && recipe.steps?.length > 0 && (
        <CookMode recipe={recipe} mult={mult} ingredientDB={ingredientDB} utensilDB={utensilDB} categories={categories} recipes={recipes} stockSet={new Set(stock)} onUpdateRecipe={onUpdateRecipe} onCooked={onCooked} onClose={() => setCookMode(false)} />
      )}

      {showShoppingModal && (
        <ShoppingSelectSheet flatIngs={flatIngs} selectedIngs={selectedIngs} setSelectedIngs={setSelectedIngs}
          isInStock={isInStock} isLowStock={isLowStock} getIngImage={getIngImage} mult={mult}
          onClose={() => setShowShoppingModal(false)}
          onConfirm={items => { onAddToShopping(recipe, items, mult); setShowShoppingModal(false); }} />
      )}

      {showMealModal && (
        <MealPlanSheet mealDate={mealDate} setMealDate={setMealDate} mealSlot={mealSlot} setMealSlot={setMealSlot}
          onClose={() => setShowMealModal(false)}
          onConfirm={() => { onAddToMealPlan(recipe, mealDate, 1, mealSlot); setShowMealModal(false); }} />
      )}
      {showDeleteConfirm && (
        <ConfirmDialog title="Supprimer la recette ?"
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => { onDelete(recipe.id); setShowDeleteConfirm(false); }}>
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
        <PublishSheet recipe={recipe} componentDeps={componentDeps} onClose={() => setPendingPublish(false)} onPublish={onPublish} />
      )}
      {shareOpen && (
        <ShareSheet recipe={recipe} publicUrl={publicUrl} shareText={shareText}
          onCopyLink={copyLink} onNativeShare={nativeShare} onClose={() => setShareOpen(false)} />
      )}
      {journalOpen && (
        <SwipeableSheet onClose={() => setJournalOpen(false)} style={{ maxHeight: "88dvh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Icon name="history" size={20} color="var(--accent)" />
            <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text)" }}>Journal d'itérations</h3>
          </div>
          <RecipeJournal recipe={recipe} onUpdateRecipe={onUpdateRecipe} />
        </SwipeableSheet>
      )}
      {showCalc && (
        <RecipeCalculators recipe={recipe} panApplied={panFactor !== 1}
          onApply={f => setPanFactor(f)} onReset={() => setPanFactor(1)} onClose={() => setShowCalc(false)} />
      )}
      {showBaseInfo && <BaseInfoModal onClose={() => setShowBaseInfo(false)} />}
      {showDifficulty && <DifficultyModal data={difficultyExplain} onClose={() => setShowDifficulty(false)} />}
      {showCollModal && (
        <CollectionsSheet recipe={recipe} collections={collections} onToggle={onToggleCollection} onClose={() => setShowCollModal(false)} />
      )}
    </div>
  );
}
