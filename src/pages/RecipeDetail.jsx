import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { StepTip } from "../components/StepTip.jsx";
import { Img, IngImage } from "../components/Img.jsx";
import { BaseIcon } from "../components/BaseIcon.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { NutriScoreBadge } from "../components/NutriScoreBadge.jsx";
import { DifficultyBadge } from "../components/DifficultyBadge.jsx";
import { NutritionModal } from "../components/NutritionModal.jsx";
import { BaseInfoModal } from "../components/BaseInfoModal.jsx";
import { DifficultyModal } from "../components/DifficultyModal.jsx";
import { RecipeJournal } from "../components/RecipeJournal.jsx";
import { RecipePlaceholder } from "../components/RecipePlaceholder.jsx";
import { HeroMenu } from "../components/HeroMenu.jsx";
import { RecipeCalculators } from "../components/RecipeCalculators.jsx";
import { OfficialAvatar } from "../components/OfficialAvatar.jsx";
import { CookMode } from "./CookMode.jsx";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { findIngredientMatch, createIngredientResolver } from "../lib/nameMatcher.js";
import { normalizeStr } from "../lib/parseIngredient.js";
import { isRecipeInSeason, isIngredientInSeason } from "../lib/seasonality.js";
import { isRecipeVegan } from "../lib/dietary.js";
import { fmtTime, capitalize } from "../lib/format.js";
import { cuisineEmoji } from "../constants/cuisines.js";
import { categoryLabel, categoryEmoji } from "../constants/recipeCategories.js";
import { computeDifficulty, explainDifficulty } from "../lib/difficulty.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { flattenForShopping } from "../lib/recipeComponents.js";
import { isOfficialAuthor } from "../lib/publicRecipes.js";
import { DISCOVER_PREFIX } from "../hooks/usePublicRecipeView.js";

// ─── RECIPE DETAIL ────────────────────────────────────────────────────────────
export function RecipeDetail({ recipe, recipes = [], onBack, onEdit, onDelete, onAddToShopping, onAddToMealPlan, onExportJSON, onExportPDF, onPublish, onUnpublish, ingredientDB, utensilDB, collections, onUpdateCollections, onToggleCollection, onUpdateRecipe, notify, stock = [], lowStock = [], publicMode = false, owned = false, onClone, authorName, authorPhoto, authorUid }) {
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
  const [panFactor, setPanFactor] = useState(1); // facteur d'adaptation de moule (calculatrice)
  const [showCalc, setShowCalc] = useState(false);
  const [activeTab, setActiveTab] = useState("Ingrédients");
  const isDesktop = useIsDesktop();
  const [showMealModal, setShowMealModal] = useState(false);
  const [mealDate, setMealDate] = useState(new Date().toISOString().slice(0, 10));
  const [mealPortions, setMealPortions] = useState(1);
  const [mealSlots, setMealSlots] = useState(["midi"]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCollModal, setShowCollModal] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [selectedIngs, setSelectedIngs] = useState([]);
  const [pendingPublish, setPendingPublish] = useState(false);
  const [confirmClone, setConfirmClone] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const isPublished = recipe.visibility === "public";
  // CTA d'ajout réutilisé (lecture seule d'une recette publique) → ouvre une confirmation.
  const keepCta = owned
    ? <button className="btn btn-ghost" disabled style={{ width: "100%", borderRadius: 30, opacity: 0.85 }}><Icon name="check" size={15} color="var(--green)" /> Déjà dans tes recettes</button>
    : <button className="btn btn-primary" onClick={() => setConfirmClone(true)} style={{ width: "100%", borderRadius: 30 }}><Icon name="plus" size={15} /> Ajouter à mes recettes</button>;
  // Attribution affichée dans le hero en mode public : pastille « Créé par : {auteur} »
  // suivie, hors pastille, du lien « d'après {source} » (source web d'origine).
  const sourceHref = recipe.source ? (recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source) : null;
  const sourceHost = recipe.source ? (() => { try { return new URL(sourceHref).hostname.replace(/^www\./, ""); } catch { return recipe.source.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0]; } })() : "";
  const official = isOfficialAuthor(authorUid);
  const attribution = publicMode && (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 11px 3px 4px", borderRadius: 20, background: "rgba(20,18,16,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.22)" }}>
        {official
          ? <OfficialAvatar size={18} ring />
          : authorPhoto
            ? <img src={authorPhoto} alt="" referrerPolicy="no-referrer" style={{ width: 18, height: 18, borderRadius: "50%" }} />
            : <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.25)" }} />}
        <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{official ? "Par" : "Créé par :"} {authorName || "un mijoteur"}</span>
      </span>
      {recipe.source && (
        <a href={sourceHref} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>
          d'après {sourceHost}
          <Icon name="externalLink" size={10} color="rgba(255,255,255,0.7)" />
        </a>
      )}
    </div>
  );
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
  const [cookMode, setCookMode] = useState(false);
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
  const shareText = `${recipe.name} – une recette à découvrir sur Mijoté`;
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
  const isProgrammaticScroll = useRef(false);
  const mult = (servings / (recipe.servings || 2)) * panFactor;
  const seasonResolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  const recipeInSeason = useMemo(() => isRecipeInSeason(recipe, seasonResolver), [recipe, seasonResolver]);
  const recipeVegan = useMemo(() => isRecipeVegan(recipe, seasonResolver, { recipes }), [recipe, seasonResolver, recipes]);
  const { techniques } = useAppShell();
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

  const scrollRef = useRef(null);
  const heroSentinelRef = useRef(null);
  const [heroProgress, setHeroProgress] = useState(0); // 0 = hero déployé, 1 = barre compacte pleine
  const swipeStart = useRef(null);
  const TAB_ORDER = ["Ingrédients", "Ustensiles", "Étapes"];
  const swipeHandlers = {
    onTouchStart: e => { swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null }; },
    onTouchMove: e => {
      const s = swipeStart.current; if (!s || s.axis) return;
      const dx = Math.abs(e.touches[0].clientX - s.x), dy = Math.abs(e.touches[0].clientY - s.y);
      if (dx > 8 || dy > 8) s.axis = dx > dy ? "x" : "y";
    },
    onTouchEnd: e => {
      const s = swipeStart.current; swipeStart.current = null;
      if (!s || s.axis !== "x") return;
      const dx = e.changedTouches[0].clientX - s.x;
      const idx = TAB_ORDER.indexOf(activeTab);
      if (dx < -50 && idx < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[idx + 1]);
      else if (dx > 50 && idx > 0) setActiveTab(TAB_ORDER[idx - 1]);
    },
  };

  // Collapse du hero piloté par la position de scroll (0 → 1) plutôt que par un
  // basculement binaire : la barre compacte apparaît/disparaît de façon continue,
  // en suivant le doigt, aussi bien en descendant qu'en remontant vers le hero.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isDesktop) return;
    let raf = 0;
    // On ne commence la transition que lorsque le hero restant est ≤ hauteur de la
    // barre (260 − 52 ≈ 208) : la barre couvre alors toujours entièrement le hero
    // encore visible → jamais de bande floue posée sur une image nette en dessous.
    const START = 208, END = 258; // px de scroll : début et fin de la transition
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const p = Math.min(1, Math.max(0, (el.scrollTop - START) / (END - START)));
        setHeroProgress(p);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { el.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [isDesktop]);

  const getIngImage = (dbId, name) => ingredientDB.find(d => d.id === dbId)?.image || (name ? findIngredientMatch(name, ingredientDB)?.image || "" : "");
  const getUtImage = (dbId, name) => utensilDB.find(d => d.id === dbId)?.image || (name ? utensilDB.find(d => normalizeStr(d.name) === normalizeStr(name))?.image || "" : "");

  return (
    <div className="recipe-detail-root" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* ── DESKTOP HERO ── */}
      {isDesktop && (
      <div style={{ position: "relative", height: 160, flexShrink: 0, color: "#fff" }}>
        <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%" }} fallback={<RecipePlaceholder name={recipe.name} fontSize={72} style={{ width: "100%", height: "100%" }} />} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,0.2) 0%,transparent 35%,rgba(14,14,15,0.82) 100%)" }} />
        <button onClick={handleBack} className="hero-back" style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="back" size={18} /></button>
        {publicMode && onExportPDF && (
        <div style={{ position: "absolute", top: 16, right: 16 }}>
          <button onClick={() => onExportPDF(recipe)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="pdf" size={16} /></button>
        </div>
        )}
        {!publicMode && (
        <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
          <button onClick={onEdit} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="edit" size={16} /></button>
          <button onClick={() => onExportPDF(recipe)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="pdf" size={16} /></button>
          <HeroMenu
            btnStyle={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
            items={[
              { label: "Journal d'itérations", icon: "history", onClick: () => setJournalOpen(true) },
              ...(!recipe.isComponent && onPublish ? [{ label: isPublished ? "Rendre privée" : "Rendre publique", icon: isPublished ? "eyeOff" : "globe", onClick: togglePublish }] : []),
              ...(isPublished ? [{ label: "Partager", icon: "share", onClick: () => setShareOpen(true) }] : []),
              { label: "Télécharger (JSON)", icon: "download", onClick: () => onExportJSON(recipe) },
              { label: "Supprimer", icon: "trash", danger: true, onClick: () => setShowDeleteConfirm(true) },
            ]} />
        </div>
        )}
        <div style={{ position: "absolute", bottom: 14, left: 20, right: 20 }}>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 2 }}>{recipe.name}</h1>
          {attribution}
          {!publicMode && recipe.source && (
            <a href={recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source}
              target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.65)", textDecoration: "none", marginTop: 1, marginBottom: 8 }}>
              {(() => { try { return new URL(recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source).hostname.replace(/^www\./, ""); } catch { return recipe.source.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0]; } })()}
              <Icon name="externalLink" size={11} color="rgba(255,255,255,0.65)" />
            </a>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {recipe.isComponent && (
              <button onClick={() => setShowBaseInfo(true)} className="tag" style={{ gap: 5, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.92)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer" }}>
                <BaseIcon size={12} color="#fff" /> Base
              </button>
            )}
            {recipeVegan && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px 3px 7px", borderRadius: 20, background: "rgba(76,175,125,0.92)", border: "1px solid rgba(255,255,255,0.3)" }}>
                <Icon name="leaf" size={11} color="#fff" />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase" }}>Vegan</span>
              </span>
            )}
            {recipeInSeason && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px 3px 7px", borderRadius: 20, background: "rgba(232,146,10,0.92)", border: "1px solid rgba(255,255,255,0.3)" }}>
                <Icon name="sun" size={11} color="#fff" />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase" }}>De saison</span>
              </span>
            )}
            <DifficultyBadge score={difficulty.score} onImage title={difficultyExplain ? "Voir comment la difficulté est calculée" : difficultyTitle} onClick={difficultyExplain ? () => setShowDifficulty(true) : undefined} />
            {categoryLabel(recipe.category) && <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)" }}><span style={{ fontSize: 12, lineHeight: 1 }}>{categoryEmoji(recipe.category)}</span>{categoryLabel(recipe.category)}</span>}
            {recipe.cuisine && <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)" }}><span style={{ fontSize: 12, lineHeight: 1 }}>{cuisineEmoji(recipe.cuisine)}</span>{recipe.cuisine}</span>}
            {(recipe.collections || []).map(cid => { const col = (collections || []).find(c => c.id === cid); return col ? <span key={cid} style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: col.color + "33", color: col.color, border: `1px solid ${col.color}66` }}>{col.name}</span> : null; })}
            {!publicMode && <button onClick={() => setShowCollModal(true)} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 500, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="plus" size={10} color="#fff" /> Carnet</button>}
          </div>
        </div>
      </div>
      )}

      {/* ── DESKTOP INFO BAR – carte arrondie façon mobile ── */}
      {isDesktop && (
      <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "stretch", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "10px 0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {/* Prép. */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
              <Icon name="clock" size={12} color="var(--text3)" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtTime(recipe.prepTime)}</span>
            </div>
            <span style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>Prép.</span>
          </div>
          <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
          {/* Cuisson */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
              <Icon name="fire" size={12} color="var(--text3)" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtTime(recipe.cookTime)}</span>
            </div>
            <span style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>Cuisson</span>
          </div>
          <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
          {/* Nutri-Score */}
          <button onClick={() => setShowNutrition(true)} title="Analyse nutritionnelle" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <NutriScoreBadge letter={recipe.nutriLetter} />
            </div>
            <span style={{ fontSize: 10, color: "var(--text3)", display: "flex", alignItems: "center", gap: 2, marginTop: 3 }}>Nutri-Score <Icon name="forward" size={9} color="var(--text3)" /></span>
          </button>
          <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
          {/* Portions */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <button onClick={() => setServings(s => Math.max(1, s - 1))} style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", border: "none", cursor: "pointer", lineHeight: 1 }}>
                <svg width="10" height="2" viewBox="0 0 10 2"><rect x="0" y="0" width="10" height="2" rx="1" fill="currentColor"/></svg>
              </button>
              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 18, textAlign: "center" }}>{servings}</span>
              <button onClick={() => setServings(s => Math.min(24, s + 1))} style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", border: "none", cursor: "pointer", lineHeight: 1 }}>
                <svg width="10" height="10" viewBox="0 0 10 10"><rect x="4" y="0" width="2" height="10" rx="1" fill="currentColor"/><rect x="0" y="4" width="10" height="2" rx="1" fill="currentColor"/></svg>
              </button>
            </div>
            <span style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>Portions</span>
          </div>
        </div>
      </div>
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
            <button className="fab-toggle" title="Actions" onClick={() => setActionsOpen(true)} style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 26px -4px rgba(232,112,58,0.5)" }}>
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
        <div className="detail-mobile-content" ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {/* Hero image – grand et beau */}
          <div style={{ position: "relative", height: 260, flexShrink: 0, color: "#fff" }}>
            <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} fallback={<RecipePlaceholder name={recipe.name} fontSize={104} style={{ width: "100%", height: "100%" }} />} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,0.25) 0%,transparent 40%,rgba(0,0,0,0.72) 100%)" }} />
            {/* Boutons overlay */}
            <button onClick={handleBack} style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="back" size={18} color="#fff" /></button>
            {publicMode && onExportPDF && (
            <div style={{ position: "absolute", top: 16, right: 16 }}>
              <button onClick={() => onExportPDF(recipe)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="pdf" size={16} color="#fff" /></button>
            </div>
            )}
            {!publicMode && (
            <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
              <button onClick={onEdit} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="edit" size={16} color="#fff" /></button>
              <button onClick={() => onExportPDF(recipe)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="pdf" size={16} color="#fff" /></button>
              <HeroMenu
                btnStyle={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
                items={[
                  { label: "Journal d'itérations", icon: "history", onClick: () => setJournalOpen(true) },
                  ...(!recipe.isComponent && onPublish ? [{ label: isPublished ? "Rendre privée" : "Rendre publique", icon: isPublished ? "eyeOff" : "globe", onClick: togglePublish }] : []),
                  ...(isPublished ? [{ label: "Partager", icon: "share", onClick: () => setShareOpen(true) }] : []),
                  { label: "Télécharger (JSON)", icon: "download", onClick: () => onExportJSON(recipe) },
                  { label: "Supprimer", icon: "trash", danger: true, onClick: () => setShowDeleteConfirm(true) },
                ]} />
            </div>
            )}
            {/* Titre + source + tags — se fond quand la barre compacte prend le relais */}
            <div style={{ position: "absolute", bottom: 16, left: 18, right: 18, opacity: 1 - heroProgress, transform: `translateY(${(heroProgress * -8).toFixed(2)}px)` }}>
              <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 4, color: "#fff" }}>{recipe.name}</h1>
              {attribution}
              {!publicMode && recipe.source && (
                <a href={recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.65)", textDecoration: "none", marginBottom: 6 }}>
                  {(() => { try { return new URL(recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source).hostname.replace(/^www\./, ""); } catch { return recipe.source.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0]; } })()}
                  <Icon name="externalLink" size={10} color="rgba(255,255,255,0.65)" />
                </a>
              )}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                {recipe.isComponent && (
                  <button onClick={() => setShowBaseInfo(true)} className="tag" style={{ gap: 5, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.92)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer" }}>
                    <BaseIcon size={12} color="#fff" /> Base
                  </button>
                )}
                {recipeVegan && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px 3px 7px", borderRadius: 20, background: "rgba(76,175,125,0.92)", border: "1px solid rgba(255,255,255,0.3)" }}>
                    <Icon name="leaf" size={11} color="#fff" />
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase" }}>Vegan</span>
                  </span>
                )}
                {recipeInSeason && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px 3px 7px", borderRadius: 20, background: "rgba(232,146,10,0.92)", border: "1px solid rgba(255,255,255,0.3)" }}>
                    <Icon name="sun" size={11} color="#fff" />
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase" }}>De saison</span>
                  </span>
                )}
                <DifficultyBadge score={difficulty.score} onImage title={difficultyExplain ? "Voir comment la difficulté est calculée" : difficultyTitle} onClick={difficultyExplain ? () => setShowDifficulty(true) : undefined} />
                {categoryLabel(recipe.category) && <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}><span style={{ fontSize: 12, lineHeight: 1 }}>{categoryEmoji(recipe.category)}</span>{categoryLabel(recipe.category)}</span>}
                {recipe.cuisine && <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}><span style={{ fontSize: 12, lineHeight: 1 }}>{cuisineEmoji(recipe.cuisine)}</span>{recipe.cuisine}</span>}
                {(recipe.collections || []).map(cid => { const col = (collections || []).find(c => c.id === cid); return col ? <span key={cid} style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: col.color + "33", color: col.color, border: `1px solid ${col.color}66` }}>{col.name}</span> : null; })}
                {!publicMode && <button onClick={() => setShowCollModal(true)} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 500, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}><Icon name="plus" size={10} color="#fff" /> Carnet</button>}
              </div>
            </div>
          </div>

          {/* Sentinelle invisible juste sous le hero – dès qu'elle sort du viewport la barre compacte apparaît */}
          <div ref={heroSentinelRef} style={{ height: 1, flexShrink: 0 }} />

          {/* Barre compacte sticky – pilotée en continu par heroProgress (0→1) :
              fond, flou et contenu suivent le scroll, dans les deux sens. */}
          {(() => {
            // Le contenu n'apparaît que sur la 2e moitié de la course, pour laisser
            // le hero se replier d'abord, puis se révéler franchement.
            const contentOp = Math.min(1, Math.max(0, (heroProgress - 0.35) / 0.65));
            return (
          <div style={{
            position: "sticky", top: 0, zIndex: 30, flexShrink: 0,
            background: `rgba(var(--bg-rgb),${(0.85 * heroProgress).toFixed(3)})`,
            backdropFilter: `blur(${(16 * heroProgress).toFixed(2)}px)`,
            WebkitBackdropFilter: `blur(${(16 * heroProgress).toFixed(2)}px)`,
            boxShadow: `0 1px 0 rgba(0,0,0,${(0.08 * heroProgress).toFixed(3)})`,
            pointerEvents: heroProgress > 0.5 ? "auto" : "none",
            height: 52, marginTop: -52,
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
              opacity: contentOp,
              transform: `translateY(${((1 - contentOp) * -6).toFixed(2)}px)`,
            }}>
              <button onClick={handleBack} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="back" size={16} color="var(--text)" /></button>
              <span style={{ fontFamily: "var(--ff-display)", fontSize: 15, fontWeight: 500, flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "0 8px", color: "var(--text)" }}>{recipe.name}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {!publicMode && <button onClick={() => { openShoppingModal(); }} style={{ height: 32, padding: "0 12px", borderRadius: 20, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, border: "none", cursor: "pointer" }}><Icon name="shopping" size={13} color="#fff" /> Courses</button>}
              </div>
            </div>
          </div>
            );
          })()}

          {/* Infos + actions – remontés juste sous le hero, au-dessus des onglets */}
          <div style={{ padding: "16px 16px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", borderRadius: 16, padding: "14px 8px", marginBottom: 12, border: "1px solid var(--border)" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <Icon name="clock" size={13} color="var(--text3)" />
                <span style={{ fontSize: 15, fontWeight: 600 }}>{fmtTime(recipe.prepTime)}</span>
                <span style={{ fontSize: 10, color: "var(--text3)" }}>Prép.</span>
              </div>
              <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <Icon name="fire" size={13} color="var(--text3)" />
                <span style={{ fontSize: 15, fontWeight: 600 }}>{fmtTime(recipe.cookTime)}</span>
                <span style={{ fontSize: 10, color: "var(--text3)" }}>Cuisson</span>
              </div>
              <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
              <button onClick={() => setShowNutrition(true)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer" }}>
                <NutriScoreBadge letter={recipe.nutriLetter} />
                <span style={{ fontSize: 10, color: "var(--text3)", display: "flex", alignItems: "center", gap: 2 }}>Nutri-Score <Icon name="forward" size={9} color="var(--text3)" /></span>
              </button>
            </div>
            {publicMode ? (
              <div>{keepCta}</div>
            ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { openShoppingModal(); }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 30, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "var(--ff-body)", border: "none", cursor: "pointer" }}>
                <Icon name="shopping" size={14} color="#fff" /> Courses
              </button>
              <button onClick={() => setShowMealModal(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 30, background: "var(--surface2)", color: "var(--text)", fontSize: 13, fontWeight: 600, fontFamily: "var(--ff-body)", border: "1px solid var(--border)", cursor: "pointer" }}>
                <Icon name="calendar" size={14} color="var(--text)" /> Planifier
              </button>
            </div>
            )}
          </div>

          {/* Onglets sticky sous la barre — switch segmenté */}
          <div style={{ position: "sticky", top: 52, zIndex: 29, background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "8px 16px 10px", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 4, background: "var(--surface2)", borderRadius: 12, padding: 4 }}>
              {TAB_ORDER.map(t => {
                const on = activeTab === t;
                return (
                  <button key={t} onClick={() => setActiveTab(t)} style={{
                    flex: 1, padding: "8px 0", fontSize: 12.5, fontWeight: 600, borderRadius: 9, border: "none", cursor: "pointer",
                    background: on ? "var(--surface)" : "transparent",
                    color: on ? "var(--accent)" : "var(--text3)",
                    boxShadow: on ? "0 1px 3px rgba(0,0,0,0.14)" : "none",
                    transition: "background 0.15s, color 0.15s, box-shadow 0.15s",
                  }}>{t}</button>
                );
              })}
            </div>
          </div>

          {/* Contenu selon onglet actif – swipe horizontal pour changer d'onglet */}
          <div {...swipeHandlers}>
          {activeTab === "Ingrédients" && (
            <div style={{ padding: "16px 16px 32px" }}>
              {/* Portions – pilote les quantités de la liste */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", borderRadius: 14, padding: "12px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>Portions</span>
                  <button onClick={() => setShowCalc(true)} title="Calculatrices (moule, conversions)" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, padding: "4px 9px", borderRadius: 999, border: "1px solid var(--border)", background: panFactor !== 1 ? "rgba(232,112,58,0.14)" : "var(--surface2)", color: panFactor !== 1 ? "var(--accent)" : "var(--text2)", cursor: "pointer" }}>
                    <Icon name="sparkle" size={13} /> {panFactor !== 1 ? `Moule ×${(Math.round(panFactor * 100) / 100)}` : "Adapter"}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setServings(s => Math.max(1, s - 1))} style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", border: "none", cursor: "pointer" }}>
                    <svg width="11" height="2" viewBox="0 0 11 2"><rect x="0" y="0" width="11" height="2" rx="1" fill="currentColor"/></svg>
                  </button>
                  <span style={{ fontSize: 18, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{servings}</span>
                  <button onClick={() => setServings(s => Math.min(24, s + 1))} style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", border: "none", cursor: "pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 11 11"><rect x="4.5" y="0" width="2" height="11" rx="1" fill="currentColor"/><rect x="0" y="4.5" width="11" height="2" rx="1" fill="currentColor"/></svg>
                  </button>
                </div>
              </div>
              {/* Liste ingrédients – carte unique, lignes séparées par un filet */}
              <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
                {recipe.ingredients.map((ing, idx) => {
                  const rc = resolveComp(ing);
                  const isComp = !!rc;
                  const last = idx === recipe.ingredients.length - 1;
                  // Sous-titre statut : stock prioritaire, sinon saison.
                  const inStock = isInStock(ing);
                  const low = isLowStock(ing);
                  const inSeason = !isComp && (() => { const it = seasonResolver(ing.name); return it ? isIngredientInSeason(it) === true : false; })();
                  let badge = null;
                  if (inStock) badge = { text: low ? "bientôt vide" : "en stock", color: low ? "var(--accent)" : "var(--green)" };
                  else if (inSeason) badge = { text: "de saison", color: "var(--green)" };

                  const name = isComp ? (rc.comp ? rc.comp.name : (ing.name || "Base")) : ing.name;
                  const clickable = isComp ? !!rc.comp : !!ing.dbId;
                  const onClick = () => {
                    if (isComp && rc.comp) navigate(`/recipes/${rc.comp.id}`, { state: { from: recipe.id } });
                    else if (!isComp && ing.dbId) navigate(`/config/ingredients/${encodeURIComponent(ing.dbId)}`);
                  };
                  return (
                    <div key={ing.id} onClick={onClick} className={clickable ? "press-hold" : undefined} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: idx === 0 ? "none" : "1px solid var(--border)", cursor: clickable ? "pointer" : "default", borderBottomLeftRadius: last ? 16 : 0, borderBottomRightRadius: last ? 16 : 0 }}>
                      {isComp && !rc.comp?.image
                        ? <span style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, background: "#fff", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}><BaseIcon size={22} /></span>
                        : <IngImage src={isComp ? rc.comp.image : getIngImage(ing.dbId, ing.name)} alt={name} size={46} cover={isComp} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{capitalize(name)}</span>
                          {isComp && <span style={{ fontSize: 9.5, fontWeight: 700, color: rc.missing ? "var(--red)" : "var(--accent)", letterSpacing: "0.04em", flexShrink: 0 }}>{rc.missing ? "⚠ SUPPRIMÉE" : "BASE"}</span>}
                        </div>
                        {badge && <div style={{ fontSize: 12, fontWeight: 600, color: badge.color, marginTop: 1 }}>{badge.text}</div>}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0, display: "flex", alignItems: "baseline", gap: 3 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--accent)" }}>{+(ing.amount * mult).toFixed(2)}</span>
                        <span style={{ fontSize: 12, color: "var(--text2)" }}>{ing.unit}</span>
                      </div>
                      {clickable && <Icon name="forward" size={14} color="var(--text3)" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {activeTab === "Ustensiles" && (
            <div style={{ padding: "16px 16px 32px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(recipe.utensils || []).map(u => (
                  <div key={u.id} style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", padding: 14, gap: 8 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", background: "#fff" }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                    <span style={{ fontSize: 13, fontWeight: 500, textAlign: "center" }}>{u.name}</span>
                  </div>
                ))}
                {(!recipe.utensils || recipe.utensils.length === 0) && <p style={{ color: "var(--text3)", fontSize: 14, gridColumn: "1/-1" }}>Aucun ustensile.</p>}
              </div>
            </div>
          )}
          {activeTab === "Étapes" && (
            <div style={{ padding: "16px 16px 32px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {recipe.steps && recipe.steps.length > 0 && (
                  <button className="btn btn-primary" style={{ width: "100%", borderRadius: 14, padding: "13px 18px", fontSize: 15, fontWeight: 600, gap: 10 }} onClick={() => setCookMode(true)}>
                    <Icon name="fire" size={17} /> Mode pas à pas
                  </button>
                )}
                {baseSteps.map(comp => (
                  <div key={comp.id} style={{ background: "rgba(232,112,58,0.05)", border: "1px solid rgba(232,112,58,0.3)", borderRadius: 14, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <BaseIcon size={18} />
                      <span style={{ fontSize: 14, fontWeight: 700 }}>Préparer la {comp.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.04em" }}>BASE</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {comp.steps.map((cstep, ci) => {
                        const cIngs = (comp.ingredients || []).filter(ing => cstep.ingredients?.includes(ing.id));
                        const cUts = (comp.utensils || []).filter(u => cstep.utensils?.includes(u.id));
                        return (
                        <div key={cstep.id}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Étape {ci + 1}</span>
                          {cstep.text && <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, margin: "4px 0 0", wordBreak: "break-word", overflowWrap: "break-word" }}>{cstep.text}</p>}
                          {(cIngs.length > 0 || cUts.length > 0) && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 8 }}>
                              {cIngs.map(ing => {
                                const displayName = ing.recipeId ? (recipesById.get(ing.recipeId)?.name || ing.name) : ing.name;
                                return (
                                <span key={ing.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--surface2)", borderRadius: 20, padding: "4px 10px 4px 4px", fontWeight: 500, color: "var(--text)", border: "1px solid var(--border)" }}>
                                  <IngImage src={ing.recipeId ? (recipesById.get(ing.recipeId)?.image || "") : getIngImage(ing.dbId, ing.name)} alt={displayName} size={22} cover={!!ing.recipeId} />
                                  {displayName}
                                  <span style={{ color: "var(--text3)", fontWeight: 400, marginLeft: 2 }}>{ing.amount}{ing.unit}</span>
                                </span>
                                );
                              })}
                              {cUts.map(u => (
                                <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--surface2)", borderRadius: 20, padding: "4px 10px 4px 4px", fontWeight: 500, color: "var(--text)", border: "1px solid var(--border)" }}>
                                  <div style={{ width: 22, height: 22, borderRadius: "50%", overflow: "hidden", background: "#fff", flexShrink: 0 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                                  {u.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {baseSteps.length > 0 && recipe.steps?.length > 0 && (
                  <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--text)", marginTop: 4 }}>Montage de la recette</div>
                )}
                {(recipe.steps || []).map((step, i) => {
                  const linkedIngs = recipe.ingredients.filter(ing => step.ingredients?.includes(ing.id));
                  const linkedUts = (recipe.utensils || []).filter(u => step.utensils?.includes(u.id));
                  const hasPills = linkedIngs.length > 0 || linkedUts.length > 0;
                  return (
                    <div key={step.id} style={{ background: "var(--surface)", borderRadius: 14, padding: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: (step.text || step.image || step.tip || hasPills) ? 8 : 0 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>Étape {i + 1}</span>
                      </div>
                      {step.text && (
                        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginBottom: (step.tip || hasPills || step.image) ? 10 : 0, wordBreak: "break-word", overflowWrap: "break-word" }}>{step.text}</p>
                      )}
                      {step.tip && <StepTip tip={step.tip} style={{ marginBottom: (hasPills || step.image) ? 10 : 0 }} />}
                      {hasPills && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: step.image ? 10 : 0 }}>
                          {linkedIngs.map(ing => {
                            const displayName = ing.recipeId ? (recipesById.get(ing.recipeId)?.name || ing.name) : ing.name;
                            return (
                            <span key={ing.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--surface2)", borderRadius: 20, padding: "4px 10px 4px 4px", fontWeight: 500, color: "var(--text)", border: "1px solid var(--border)" }}>
                              <IngImage src={ing.recipeId ? (recipesById.get(ing.recipeId)?.image || "") : getIngImage(ing.dbId, ing.name)} alt={displayName} size={22} cover={!!ing.recipeId} />
                              {displayName}
                              <span style={{ color: "var(--text3)", fontWeight: 400, marginLeft: 2 }}>{+(ing.amount * mult).toFixed(2)}{ing.unit}</span>
                            </span>
                          );
                          })}
                          {linkedUts.map(u => (
                            <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--surface2)", borderRadius: 20, padding: "4px 10px 4px 4px", fontWeight: 500, color: "var(--text)", border: "1px solid var(--border)" }}>
                              <div style={{ width: 22, height: 22, borderRadius: "50%", overflow: "hidden", background: "#fff", flexShrink: 0 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                              {u.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {step.image && (
                        <Img src={step.image} alt={`Étape ${i + 1}`} style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>{/* end swipe wrapper */}
        </div>


        {/* ── DESKTOP: 2-column layout (hidden on mobile via CSS) ── */}
        <div className="detail-desktop-content" style={{ display: "none", flex: 1, overflow: "hidden", background: "var(--bg)", padding: "12px 16px 16px", gap: 16 }}>
          {/* Left col: ingrédients + ustensiles (card) */}
          <div style={{ width: 300, minWidth: 300, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20, background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", minHeight: 34, marginBottom: 16 }}>
                <span style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--text)" }}>Ingrédients</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {recipe.ingredients.map(ing => {
                  const rc = resolveComp(ing);
                  if (rc) return (
                    <div key={ing.id} onClick={() => rc.comp && navigate(`/recipes/${rc.comp.id}`, { state: { from: recipe.id } })} style={{ display: "flex", alignItems: "center", gap: 12, cursor: rc.comp ? "pointer" : "default", borderRadius: 10, padding: "4px 6px", margin: "-4px -6px", transition: "background 0.15s" }} onMouseEnter={e => { if (rc.comp) e.currentTarget.style.background = "var(--surface2)"; }} onMouseLeave={e => { e.currentTarget.style.background = ""; }}>
                      {rc.comp?.image
                        ? <IngImage src={rc.comp.image} alt={rc.comp.name} size={48} cover />
                        : <span style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, background: "rgba(232,112,58,0.1)", border: "1px solid rgba(232,112,58,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}><BaseIcon size={22} /></span>}
                      <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{+(ing.amount * mult).toFixed(2)}</span>
                        <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: 2 }}>{ing.unit}</span>
                      </div>
                      <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "var(--text)" }}>
                        {capitalize(rc.comp ? rc.comp.name : (ing.name || "Base"))}
                        <span style={{ fontSize: 10, fontWeight: 700, color: rc.missing ? "var(--red)" : "var(--accent)", marginLeft: 6 }}>{rc.missing ? "⚠ SUPPRIMÉE" : "BASE"}</span>
                      </div>
                    </div>
                  );
                  return (
                  <div key={ing.id} onClick={() => ing.dbId && navigate(`/config/ingredients/${encodeURIComponent(ing.dbId)}`)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: ing.dbId ? "pointer" : "default", borderRadius: 10, padding: "4px 6px", margin: "-4px -6px", transition: "background 0.15s" }} onMouseEnter={e => { if (ing.dbId) e.currentTarget.style.background = "var(--surface2)"; }} onMouseLeave={e => { e.currentTarget.style.background = ""; }}>
                    <IngImage src={getIngImage(ing.dbId, ing.name)} alt={ing.name} size={48} />
                    <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{+(ing.amount * mult).toFixed(2)}</span>
                      <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: 2 }}>{ing.unit}</span>
                    </div>
                    <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{capitalize(ing.name)}</div>
                  </div>
                  );
                })}
              </div>
            </div>
            {recipe.utensils && recipe.utensils.length > 0 && (
              <div>
                <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--text)", marginBottom: 12 }}>Ustensiles</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {recipe.utensils.map(u => (
                    <div key={u.id} className="ut-pill-desktop" style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface2)", borderRadius: 12, padding: "7px 14px 7px 8px", border: "1px solid var(--border)" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, overflow: "hidden", background: "#fff", flexShrink: 0 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
          {/* Right col: étapes (card) */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: 20, background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 34, marginBottom: 16 }}>
              <span style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--text)" }}>Étapes</span>
              {recipe.steps && recipe.steps.length > 0 && (
                <button className="btn btn-primary btn-sm" style={{ gap: 7, borderRadius: 10 }} onClick={() => setCookMode(true)}>
                  <Icon name="fire" size={13} /> Mode pas à pas
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
              {baseSteps.map(comp => (
                <div key={comp.id} style={{ background: "rgba(232,112,58,0.05)", border: "1px solid rgba(232,112,58,0.3)", borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <BaseIcon size={18} />
                    <span style={{ fontFamily: "var(--ff-display)", fontSize: 16, fontWeight: 600 }}>Préparer la {comp.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.04em" }}>BASE</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {comp.steps.map((cstep, ci) => {
                      const cIngs = (comp.ingredients || []).filter(ing => cstep.ingredients?.includes(ing.id));
                      const cUts = (comp.utensils || []).filter(u => cstep.utensils?.includes(u.id));
                      return (
                      <div key={cstep.id}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>Étape {ci + 1}</div>
                        {cstep.text && <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, margin: "0 0 8px", wordBreak: "break-word", overflowWrap: "break-word" }}>{cstep.text}</p>}
                        {(cIngs.length > 0 || cUts.length > 0) && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {cIngs.map(ing => {
                              const displayName = ing.recipeId ? (recipesById.get(ing.recipeId)?.name || ing.name) : ing.name;
                              return (
                              <span key={ing.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                                <IngImage src={ing.recipeId ? (recipesById.get(ing.recipeId)?.image || "") : getIngImage(ing.dbId, ing.name)} alt={displayName} size={24} cover={!!ing.recipeId} />
                                {displayName}
                                <span style={{ color: "var(--text3)", fontWeight: 500 }}>{ing.amount}{ing.unit}</span>
                              </span>
                              );
                            })}
                            {cUts.map(u => (
                              <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                                <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "#fff", flexShrink: 0 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                                {u.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {baseSteps.length > 0 && recipe.steps?.length > 0 && (
                <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--text)", marginTop: 4 }}>Montage de la recette</div>
              )}
              {(recipe.steps || []).map((step, i) => {
                const linkedIngs = recipe.ingredients.filter(ing => step.ingredients?.includes(ing.id));
                const linkedUts = (recipe.utensils || []).filter(u => step.utensils?.includes(u.id));
                return (
                  <div key={step.id}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>Étape {i + 1}</div>
                    {step.text && <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, marginBottom: 12, wordBreak: "break-word", overflowWrap: "break-word" }}>{step.text}</p>}
                    {step.tip && <StepTip tip={step.tip} style={{ marginBottom: 12 }} />}
                    {(linkedIngs.length > 0 || linkedUts.length > 0) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: step.image ? 12 : 0 }}>
                        {linkedIngs.map(ing => {
                          const displayName = ing.recipeId ? (recipesById.get(ing.recipeId)?.name || ing.name) : ing.name;
                          return (
                          <span key={ing.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                            <IngImage src={ing.recipeId ? (recipesById.get(ing.recipeId)?.image || "") : getIngImage(ing.dbId, ing.name)} alt={displayName} size={24} cover={!!ing.recipeId} />
                            {displayName}
                            <span style={{ color: "var(--text3)", fontWeight: 500 }}>{+(ing.amount * mult).toFixed(2)}{ing.unit}</span>
                          </span>
                          );
                        })}
                        {linkedUts.map(u => (
                          <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "#fff", flexShrink: 0 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                            {u.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {step.image && <Img src={step.image} alt={`Étape ${i + 1}`} style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 12 }} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── COOK MODE – fullscreen step-by-step ── */}
      {showNutrition && (
        <NutritionModal recipe={recipe} recipes={recipes} ingredientDB={ingredientDB} servings={servings} onClose={() => setShowNutrition(false)} />
      )}
      {cookMode && recipe.steps?.length > 0 && (
        <CookMode recipe={recipe} mult={mult} ingredientDB={ingredientDB} utensilDB={utensilDB} recipes={recipes} stockSet={new Set(stock)} onClose={() => setCookMode(false)} />
      )}

      {/* Shopping ingredient selection modal */}
      {showShoppingModal && (
        <SwipeableSheet onClose={() => setShowShoppingModal(false)} style={{ maxHeight: "85dvh" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Ajouter aux courses</h3>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>Les ingrédients <span style={{ fontWeight: 600, color: "var(--green)" }}>en stock</span> sont décochés par défaut.</p>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <button style={{ fontSize: 12, color: "var(--accent)" }} onClick={() => setSelectedIngs(flatIngs.map(fi => fi._fid))}>Tout sélectionner</button>
            <button style={{ fontSize: 12, color: "var(--text3)" }} onClick={() => setSelectedIngs([])}>Tout décocher</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", maxHeight: "52vh", marginBottom: 16 }}>
            {flatIngs.map(ing => {
              const selected = selectedIngs.includes(ing._fid);
              const inStock = isInStock(ing);
              const low = isLowStock(ing);
              return (
                <button key={ing._fid} onClick={() => setSelectedIngs(prev => selected ? prev.filter(x => x !== ing._fid) : [...prev, ing._fid])}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12,
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    textAlign: "left", transition: "opacity 0.15s", opacity: selected ? 1 : 0.4
                  }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: selected ? "var(--accent)" : "transparent",
                    border: `2px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {selected && <Icon name="check" size={11} color="#fff" />}
                  </div>
                  <IngImage src={getIngImage(ing.dbId, ing.name)} alt={ing.name} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{ing.name}</span>
                      <span style={{ fontSize: 12, color: "var(--text2)" }}>{+(ing.amount * mult).toFixed(2)} {ing.unit}</span>
                      {inStock && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          marginLeft: "auto", flexShrink: 0,
                          fontSize: 10, fontWeight: 600,
                          color: low ? "var(--accent)" : "var(--green)",
                        }}>
                          <span style={{
                            width: 16, height: 16, borderRadius: "50%",
                            background: low ? "var(--accent)" : "var(--green)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <Icon name={low ? "warning" : "check"} size={low ? 10 : 9} color="#fff" />
                          </span>
                          {low ? "bientôt vide" : "en stock"}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }}
            disabled={selectedIngs.length === 0}
            onClick={() => {
              onAddToShopping(recipe, flatIngs.filter(fi => selectedIngs.includes(fi._fid)), mult);
              setShowShoppingModal(false);
            }}>
            <Icon name="shopping" size={15} /> Ajouter {selectedIngs.length > 0 ? `${selectedIngs.length} article${selectedIngs.length > 1 ? "s" : ""}` : ""}
          </button>
        </SwipeableSheet>
      )}

      {showMealModal && (
        <SwipeableSheet onClose={() => setShowMealModal(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Ajouter au planning</h3>
          <div className="field-label">Date</div>
          <input type="date" className="field-input" value={mealDate} onChange={e => setMealDate(e.target.value)} style={{ marginBottom: 12 }} />
          <div className="field-label" style={{ marginBottom: 8 }}>Repas (multi-sélection)</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["midi", "🌤 Midi", "var(--yellow)"], ["soir", "🌙 Soir", "var(--blue)"]].map(([slot, label, col]) => {
              const active = mealSlots.includes(slot);
              const toggle = () => setMealSlots(prev => {
                const next = active ? prev.filter(s => s !== slot) : [...prev, slot];
                return next.length ? next : prev;
              });
              return (
                <button key={slot} onClick={toggle} style={{ flex: 1, padding: "10px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: active ? col : "var(--surface2)", color: active ? "#000" : "var(--text2)", border: `2px solid ${active ? col : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }}>
                  {active && <Icon name="check" size={14} color="#000" />}
                  {label}
                </button>
              );
            })}
          </div>
          {mealSlots.length === 2 && <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10, textAlign: "center" }}>Ajouté au midi ET au soir</div>}
          <div className="field-label">Étaler sur X jours consécutifs</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => setMealPortions(p => Math.max(1, p - 1))} className="btn btn-ghost btn-sm" style={{ width: 34, height: 34, borderRadius: "50%", padding: 0 }}>−</button>
            <span style={{ fontSize: 18, fontWeight: 700, minWidth: 30, textAlign: "center" }}>{mealPortions}</span>
            <button onClick={() => setMealPortions(p => p + 1)} className="btn btn-ghost btn-sm" style={{ width: 34, height: 34, borderRadius: "50%", padding: 0 }}>+</button>
            <span style={{ fontSize: 12, color: "var(--text2)", flex: 1 }}>{mealPortions > 1 ? `${recipe.servings} portions ÷ ${mealPortions} jours = ${(recipe.servings / mealPortions).toFixed(1)} p/j` : "Toutes les portions ce jour"}</span>
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => {
            for (let d = 0; d < mealPortions; d++) {
              const dt = new Date(mealDate + "T12:00:00"); dt.setDate(dt.getDate() + d);
              const dateStr = dt.toISOString().slice(0, 10);
              mealSlots.forEach(slot => onAddToMealPlan(recipe, dateStr, mealPortions, slot));
            }
            setShowMealModal(false);
          }}><Icon name="check" size={16} /> Confirmer</button>
        </SwipeableSheet>
      )}
      {showDeleteConfirm && (
        <SwipeableSheet onClose={() => setShowDeleteConfirm(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Supprimer la recette ?</h3>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20 }}>Retirer cette recette la supprimera définitivement des recettes enregistrées.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)}>Annuler</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { onDelete(recipe.id); setShowDeleteConfirm(false); }}>Supprimer</button>
          </div>
        </SwipeableSheet>
      )}
      {confirmClone && (
        <SwipeableSheet onClose={() => setConfirmClone(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Ajouter à mes recettes ?</h3>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 14, lineHeight: 1.5 }}>
            Une <strong>copie personnelle</strong> est créée dans ta bibliothèque. C'est elle qui te permet de la planifier, de l'ajouter à tes courses, de la cuisiner en pas-à-pas et de l'<strong>adapter librement</strong> – même hors-ligne. L'auteur d'origine reste crédité.
          </p>
          {componentDeps.length > 0 && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 12, background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 20 }}>
              <Icon name="info" size={16} color="var(--accent)" />
              <span style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.45 }}>
                Ses <strong>{componentDeps.length} préparation{componentDeps.length > 1 ? "s" : ""} de base</strong> ({componentDeps.map(c => c.name).join(", ")}) ser{componentDeps.length > 1 ? "ont" : "a"} ajoutée{componentDeps.length > 1 ? "s" : ""} avec, pour que la recette soit complète.
              </span>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: componentDeps.length > 0 ? 0 : 6 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmClone(false)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setConfirmClone(false); onClone?.(); }}>Ajouter</button>
          </div>
        </SwipeableSheet>
      )}
      {pendingPublish && (
        <SwipeableSheet onClose={() => setPendingPublish(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Rendre cette recette publique ?</h3>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
            Elle sera visible par la communauté de mijoteurs et chacun pourra l'ajouter à ses recettes.
          </p>
          {componentDeps.length > 0 && (
            <div style={{ borderRadius: 14, background: "rgba(232,112,58,0.07)", border: "1px solid rgba(232,112,58,0.22)", padding: "13px 14px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: "rgba(232,112,58,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="import" size={14} color="var(--accent)" />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                  Publiée{componentDeps.length > 1 ? "s" : ""} avec {componentDeps.length > 1 ? "ses" : "sa"} préparation{componentDeps.length > 1 ? "s" : ""} de base
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {componentDeps.map(c => (
                  <span key={c.id} style={{ fontSize: 12, fontWeight: 500, color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 9px" }}>{c.name}</span>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 9, lineHeight: 1.45 }}>
                Incluses pour que le clone reste complet. Déjà publiques ? Elles seront simplement mises à jour.
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: componentDeps.length > 0 ? 0 : 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPendingPublish(false)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { onPublish?.(recipe); setPendingPublish(false); }}>Publier</button>
          </div>
        </SwipeableSheet>
      )}
      {shareOpen && (
        <SwipeableSheet onClose={() => setShareOpen(false)}>
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 600, margin: "0 0 14px" }}>Partager</h3>

          {/* Aperçu type carte de la recette */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
              <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%" }} fallback={<RecipePlaceholder name={recipe.name} fontSize={30} style={{ width: "100%", height: "100%" }} />} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: "var(--ff-display)", fontSize: 15.5, fontWeight: 600, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{recipe.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}><Icon name="globe" size={11} color="var(--text3)" /> Recette publique · Mijoté</div>
            </div>
          </div>

          {/* Options de partage */}
          <div style={{ display: "flex", gap: 12, justifyContent: "space-around", marginBottom: 6 }}>
            {(() => {
              const opt = (label, bg, glyph, onClick) => (
                <button onClick={onClick} className="pressable" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
                  <span style={{ width: 54, height: 54, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{glyph}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text2)" }}>{label}</span>
                </button>
              );
              return (
                <>
                  {opt("Copier le lien", "var(--surface3)", (
                    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5" stroke="var(--text)" strokeWidth="1.9" /><path d="M6 15H5.5A2.5 2.5 0 0 1 3 12.5v-7A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5V6" stroke="var(--text)" strokeWidth="1.9" strokeLinecap="round" /></svg>
                  ), copyLink)}
                  {opt("WhatsApp", "#25D366", (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.04c-.24.68-1.42 1.31-1.95 1.36-.53.05-1.02.24-3.44-.72-2.9-1.14-4.75-4.1-4.9-4.29-.14-.19-1.17-1.56-1.17-2.97 0-1.41.74-2.11 1-2.4.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.42-.07.65.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.09.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.29-.12.57.17.29.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.3 1.42.29.14.45.12.62-.07.17-.19.71-.83.9-1.12.19-.29.38-.24.65-.14.26.1 1.67.79 1.96.93.29.14.48.22.55.34.07.12.07.68-.17 1.36Z" /></svg>
                  ), () => { window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + publicUrl)}`, "_blank", "noopener"); setShareOpen(false); })}
                  {opt("SMS", "#34C759", (
                    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V16H5.5A1.5 1.5 0 0 1 4 14.5v-9Z" fill="#fff" /></svg>
                  ), () => { window.location.href = `sms:?&body=${encodeURIComponent(shareText + " " + publicUrl)}`; setShareOpen(false); })}
                  {typeof navigator !== "undefined" && navigator.share && opt("Plus…", "var(--surface3)", (
                    <Icon name="share" size={22} color="var(--text)" />
                  ), nativeShare)}
                </>
              );
            })()}
          </div>
        </SwipeableSheet>
      )}
      {journalOpen && (
        <SwipeableSheet onClose={() => setJournalOpen(false)} style={{ maxHeight: "88dvh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Icon name="history" size={20} color="var(--accent)" />
            <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--text)" }}>Journal d'itérations</h3>
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
        <SwipeableSheet onClose={() => setShowCollModal(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Carnets</h3>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>Range <strong>{recipe.name}</strong> dans tes carnets</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {(collections || []).map(col => {
              const active = (recipe.collections || []).includes(col.id);
              return (
                <button key={col.id} onClick={() => onToggleCollection(recipe.id, col.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: active ? col.color + "22" : "var(--surface2)", border: `1.5px solid ${active ? col.color : "var(--border)"}`, transition: "all 0.15s" }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, textAlign: "left", color: active ? col.color : "var(--text)" }}>{col.name}</span>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: active ? col.color : "transparent", border: `2px solid ${active ? col.color : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {active && <Icon name="check" size={12} color="#fff" />}
                  </div>
                </button>
              );
            })}
            {(!collections || collections.length === 0) && <p style={{ color: "var(--text3)", fontSize: 13 }}>Aucun carnet. Créez-en dans l'onglet Config.</p>}
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setShowCollModal(false)}>Fermer</button>
        </SwipeableSheet>
      )}
    </div>
  );
}
