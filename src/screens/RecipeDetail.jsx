import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { Img, IngImage } from "../components/Img.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { NutriScoreBadge } from "../components/NutriScoreBadge.jsx";
import { NutritionModal } from "../components/NutritionModal.jsx";
import { CookMode } from "./CookMode.jsx";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { findIngredientMatch } from "../lib/nameMatcher.js";
import { normalizeStr } from "../lib/parseIngredient.js";
import { fmtTime } from "../lib/format.js";

// ─── RECIPE DETAIL ────────────────────────────────────────────────────────────
export function RecipeDetail({ recipe, onBack, onEdit, onDelete, onAddToShopping, onAddToMealPlan, onExportJSON, onExportPDF, ingredientDB, utensilDB, collections, onUpdateCollections, onToggleCollection, stock = [], lowStock = [] }) {
  const navigate = useNavigate();
  const [servings, setServings] = useState(Math.min(24, recipe.servings || 2));
  const [activeTab, setActiveTab] = useState("Ingrédients");
  const isDesktop = useIsDesktop();
  const [showMealModal, setShowMealModal] = useState(false);
  const [mealDate, setMealDate] = useState(new Date().toISOString().slice(0, 10));
  const [mealPortions, setMealPortions] = useState(1);
  const [mealSlots, setMealSlots] = useState(["midi"]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCollModal, setShowCollModal] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [selectedIngs, setSelectedIngs] = useState([]);
  const stockSet = useMemo(() => new Set(stock), [stock]);
  const lowSet = useMemo(() => new Set(lowStock), [lowStock]);
  // Retourne true si l'ingrédient de recette est trouvé dans le stock
  const isInStock = (ing) => {
    const match = findIngredientMatch(ing.name, ingredientDB);
    return match ? stockSet.has(match.id) : false;
  };
  // Retourne true si l'ingrédient est marqué « bientôt vide »
  const isLowStock = (ing) => {
    const match = findIngredientMatch(ing.name, ingredientDB);
    return match ? lowSet.has(match.id) : false;
  };
  const openShoppingModal = () => {
    // Pré-cocher tout sauf ce qui est déjà en stock
    setSelectedIngs(recipe.ingredients.filter(i => !isInStock(i)).map(i => i.id));
    setShowShoppingModal(true);
  };
  const [cookMode, setCookMode] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef(null);
  const isProgrammaticScroll = useRef(false);
  const mult = servings / (recipe.servings || 2);

  // Collapse the desktop actions panel when clicking anywhere outside it.
  useEffect(() => {
    if (!actionsOpen) return;
    const handlePointerDown = e => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) setActionsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [actionsOpen]);

  const scrollRef = useRef(null);
  const heroSentinelRef = useRef(null);
  const [heroCollapsed, setHeroCollapsed] = useState(false);
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

  useEffect(() => {
    const sentinel = heroSentinelRef.current;
    if (!sentinel || isDesktop) return;
    const obs = new IntersectionObserver(
      ([entry]) => setHeroCollapsed(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [isDesktop]);

  const getIngImage = (dbId, name) => ingredientDB.find(d => d.id === dbId)?.image || (name ? findIngredientMatch(name, ingredientDB)?.image || "" : "");
  const getUtImage = (dbId, name) => utensilDB.find(d => d.id === dbId)?.image || (name ? utensilDB.find(d => normalizeStr(d.name) === normalizeStr(name))?.image || "" : "");

  return (
    <div className="recipe-detail-root" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* ── DESKTOP HERO ── */}
      {isDesktop && (
      <div style={{ position: "relative", height: 160, flexShrink: 0, color: "#fff" }}>
        <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,0.2) 0%,transparent 35%,rgba(14,14,15,0.82) 100%)" }} />
        <button onClick={onBack} style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="back" size={18} /></button>
        <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
          <button onClick={onEdit} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="edit" size={16} /></button>
          <button onClick={() => onExportPDF(recipe)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="pdf" size={16} /></button>
          <button onClick={() => onExportJSON(recipe)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="download" size={16} /></button>
          <button onClick={() => setShowDeleteConfirm(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(224,82,82,0.55)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="trash" size={16} /></button>
        </div>
        <div style={{ position: "absolute", bottom: 14, left: 20, right: 20 }}>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 2 }}>{recipe.name}</h1>
          {recipe.source && (
            <a href={recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source}
              target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.65)", textDecoration: "none", marginTop: 1, marginBottom: 8 }}>
              {(() => { try { return new URL(recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source).hostname.replace(/^www\./, ""); } catch { return recipe.source.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0]; } })()}
              <Icon name="externalLink" size={11} color="rgba(255,255,255,0.65)" />
            </a>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {recipe.tags?.map(t => <span key={t} className="tag" style={{ fontSize: 10, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)" }}>{t}</span>)}
            {(recipe.collections || []).map(cid => { const col = (collections || []).find(c => c.id === cid); return col ? <span key={cid} style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: col.color + "33", color: col.color, border: `1px solid ${col.color}66` }}>{col.name}</span> : null; })}
            <button onClick={() => setShowCollModal(true)} style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 500, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", gap: 4 }}><Icon name="plus" size={10} color="#fff" /> Collection</button>
          </div>
        </div>
      </div>
      )}

      {/* ── DESKTOP INFO BAR — carte arrondie façon mobile ── */}
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
              <button onClick={() => setServings(s => Math.max(1, s - 1))} style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontSize: 15, border: "none", cursor: "pointer" }}>−</button>
              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 18, textAlign: "center" }}>{servings}</span>
              <button onClick={() => setServings(s => Math.min(24, s + 1))} style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, border: "none", cursor: "pointer" }}>+</button>
            </div>
            <span style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>Portions</span>
          </div>
        </div>
      </div>
      )}

      {/* Desktop FAB */}
      {isDesktop && (
        <div ref={actionsRef} style={{ position: "fixed", right: 24, bottom: 28, zIndex: 60, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
          {actionsOpen ? (
            <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, minWidth: 232, background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)", boxShadow: "0 16px 42px -8px rgba(0,0,0,0.28)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Actions</span>
                <button className="icon-btn-soft" title="Réduire" onClick={() => setActionsOpen(false)} style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface2)", color: "var(--text3)" }}>
                  <Icon name="close" size={13} color="var(--text3)" />
                </button>
              </div>
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => { openShoppingModal(); }}><Icon name="shopping" size={15} /> Courses</button>
              <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => setShowMealModal(true)}><Icon name="calendar" size={15} /> Planifier</button>
            </div>
          ) : (
            <button className="fab-toggle" title="Actions" onClick={() => setActionsOpen(true)} style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 26px -4px rgba(232,112,58,0.5)" }}>
              <Icon name="shopping" size={22} color="#fff" />
            </button>
          )}
        </div>
      )}

      {/* Desktop tabs */}
      {isDesktop && (
      <div className="detail-tabs-mobile" style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
        {["Ingrédients", "Ustensiles", "Étapes"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "10px 0", fontSize: 12, fontWeight: 500, color: activeTab === t ? "var(--accent)" : "var(--text3)", borderBottom: `2px solid ${activeTab === t ? "var(--accent)" : "transparent"}`, transition: "color 0.15s, border-color 0.15s" }}>{t}</button>
        ))}
      </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
        {/* ── MOBILE: scrollable hero + sticky bar + tabs + content ── */}
        <div className="detail-mobile-content" ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {/* Hero image — grand et beau */}
          <div style={{ position: "relative", height: 260, flexShrink: 0, color: "#fff" }}>
            <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,0.25) 0%,transparent 40%,rgba(0,0,0,0.72) 100%)" }} />
            {/* Boutons overlay */}
            <button onClick={onBack} style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="back" size={18} color="#fff" /></button>
            <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
              <button onClick={onEdit} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="edit" size={16} color="#fff" /></button>
              <button onClick={() => onExportPDF(recipe)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="pdf" size={16} color="#fff" /></button>
              <button onClick={() => setShowDeleteConfirm(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(224,82,82,0.5)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="trash" size={16} color="#fff" /></button>
            </div>
            {/* Titre + source + tags */}
            <div style={{ position: "absolute", bottom: 16, left: 18, right: 18 }}>
              <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 4, color: "#fff" }}>{recipe.name}</h1>
              {recipe.source && (
                <a href={recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.65)", textDecoration: "none", marginBottom: 6 }}>
                  {(() => { try { return new URL(recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source).hostname.replace(/^www\./, ""); } catch { return recipe.source.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0]; } })()}
                  <Icon name="externalLink" size={10} color="rgba(255,255,255,0.65)" />
                </a>
              )}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                {recipe.tags?.map(t => <span key={t} className="tag" style={{ fontSize: 10, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>{t}</span>)}
                {(recipe.collections || []).map(cid => { const col = (collections || []).find(c => c.id === cid); return col ? <span key={cid} style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: col.color + "33", color: col.color, border: `1px solid ${col.color}66` }}>{col.name}</span> : null; })}
                <button onClick={() => setShowCollModal(true)} style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 500, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><Icon name="plus" size={10} color="#fff" /> Collection</button>
              </div>
            </div>
          </div>

          {/* Sentinelle invisible juste sous le hero — dès qu'elle sort du viewport la barre compacte apparaît */}
          <div ref={heroSentinelRef} style={{ height: 1, flexShrink: 0 }} />

          {/* Barre compacte sticky */}
          <div style={{
            position: "sticky", top: 0, zIndex: 30, flexShrink: 0,
            background: heroCollapsed ? "rgba(var(--bg-rgb),0.85)" : "transparent",
            backdropFilter: heroCollapsed ? "blur(16px)" : "none",
            borderBottom: heroCollapsed ? "1px solid var(--border)" : "none",
            transition: "background 0.25s, border-color 0.25s",
            pointerEvents: heroCollapsed ? "auto" : "none",
            height: 52, marginTop: -52,
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px",
          }}>
            {heroCollapsed && <>
              <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="back" size={16} color="var(--text)" /></button>
              <span style={{ fontFamily: "var(--ff-display)", fontSize: 15, fontWeight: 500, flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "0 8px", color: "var(--text)" }}>{recipe.name}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { openShoppingModal(); }} style={{ height: 32, padding: "0 12px", borderRadius: 20, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, border: "none", cursor: "pointer" }}><Icon name="shopping" size={13} color="#fff" /> Courses</button>
              </div>
            </>}
          </div>

          {/* Infos + actions — remontés juste sous le hero, au-dessus des onglets */}
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
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { openShoppingModal(); }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 30, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "var(--ff-body)", border: "none", cursor: "pointer" }}>
                <Icon name="shopping" size={14} color="#fff" /> Courses
              </button>
              <button onClick={() => setShowMealModal(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 30, background: "var(--surface2)", color: "var(--text)", fontSize: 13, fontWeight: 600, fontFamily: "var(--ff-body)", border: "1px solid var(--border)", cursor: "pointer" }}>
                <Icon name="calendar" size={14} color="var(--text)" /> Planifier
              </button>
            </div>
          </div>

          {/* Onglets sticky sous la barre */}
          <div style={{ position: "sticky", top: 52, zIndex: 29, background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex", flexShrink: 0 }}>
            {TAB_ORDER.map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "11px 0", fontSize: 12, fontWeight: 500, color: activeTab === t ? "var(--accent)" : "var(--text3)", background: "none", border: "none", borderBottom: `2px solid ${activeTab === t ? "var(--accent)" : "transparent"}`, transition: "color 0.15s, border-color 0.15s", cursor: "pointer" }}>{t}</button>
            ))}
          </div>

          {/* Contenu selon onglet actif — swipe horizontal pour changer d'onglet */}
          <div {...swipeHandlers}>
          {activeTab === "Ingrédients" && (
            <div style={{ padding: "16px 16px 32px" }}>
              {/* Portions — pilote les quantités de la liste */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", borderRadius: 14, padding: "12px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>Portions</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setServings(s => Math.max(1, s - 1))} style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontSize: 18, border: "none", cursor: "pointer" }}>−</button>
                  <span style={{ fontSize: 18, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{servings}</span>
                  <button onClick={() => setServings(s => Math.min(24, s + 1))} style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, border: "none", cursor: "pointer" }}>+</button>
                </div>
              </div>
              {/* Liste ingrédients */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recipe.ingredients.map(ing => (
                  <div key={ing.id} onClick={() => ing.dbId && navigate(`/config/ingredients/${encodeURIComponent(ing.dbId)}`)} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", borderRadius: 12, padding: "10px 14px", border: "1px solid var(--border)", cursor: ing.dbId ? "pointer" : "default" }}>
                    <IngImage src={getIngImage(ing.dbId, ing.name)} alt={ing.name} size={50} />
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{ing.name}</div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--accent)" }}>{+(ing.amount * mult).toFixed(2)}</span>
                      <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: 4 }}>{ing.unit}</span>
                    </div>
                    {ing.dbId && <Icon name="forward" size={13} color="var(--text3)" />}
                  </div>
                ))}
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
                {(recipe.steps || []).map((step, i) => {
                  const linkedIngs = recipe.ingredients.filter(ing => step.ingredients?.includes(ing.id));
                  const linkedUts = (recipe.utensils || []).filter(u => step.utensils?.includes(u.id));
                  const hasPills = linkedIngs.length > 0 || linkedUts.length > 0;
                  return (
                    <div key={step.id} style={{ background: "var(--surface)", borderRadius: 14, padding: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: step.text ? 8 : hasPills ? 10 : 0 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>Étape {i + 1}</span>
                      </div>
                      {step.text && (
                        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginBottom: hasPills ? 10 : 0, wordBreak: "break-word", overflowWrap: "break-word" }}>{step.text}</p>
                      )}
                      {hasPills && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                          {linkedIngs.map(ing => (
                            <span key={ing.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--surface2)", borderRadius: 20, padding: "4px 10px 4px 4px", fontWeight: 500, color: "var(--text)", border: "1px solid var(--border)" }}>
                              <IngImage src={getIngImage(ing.dbId, ing.name)} alt={ing.name} size={22} />
                              {ing.name}
                              <span style={{ color: "var(--text3)", fontWeight: 400, marginLeft: 2 }}>{+(ing.amount * mult).toFixed(2)}{ing.unit}</span>
                            </span>
                          ))}
                          {linkedUts.map(u => (
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
                {recipe.ingredients.map(ing => (
                  <div key={ing.id} onClick={() => ing.dbId && navigate(`/config/ingredients/${encodeURIComponent(ing.dbId)}`)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: ing.dbId ? "pointer" : "default", borderRadius: 10, padding: "4px 6px", margin: "-4px -6px", transition: "background 0.15s" }} onMouseEnter={e => { if (ing.dbId) e.currentTarget.style.background = "var(--surface2)"; }} onMouseLeave={e => { e.currentTarget.style.background = ""; }}>
                    <IngImage src={getIngImage(ing.dbId, ing.name)} alt={ing.name} size={48} />
                    <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{+(ing.amount * mult).toFixed(2)}</span>
                      <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: 2 }}>{ing.unit}</span>
                    </div>
                    <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{ing.name}</div>
                  </div>
                ))}
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
              {(recipe.steps || []).map((step, i) => {
                const linkedIngs = recipe.ingredients.filter(ing => step.ingredients?.includes(ing.id));
                const linkedUts = (recipe.utensils || []).filter(u => step.utensils?.includes(u.id));
                return (
                  <div key={step.id}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>Étape {i + 1}</div>
                    {step.text && <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, marginBottom: 12, wordBreak: "break-word", overflowWrap: "break-word" }}>{step.text}</p>}
                    {(linkedIngs.length > 0 || linkedUts.length > 0) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {linkedIngs.map(ing => (
                          <span key={ing.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                            <IngImage src={getIngImage(ing.dbId, ing.name)} alt={ing.name} size={24} />
                            {ing.name}
                            <span style={{ color: "var(--text3)", fontWeight: 500 }}>{+(ing.amount * mult).toFixed(2)}{ing.unit}</span>
                          </span>
                        ))}
                        {linkedUts.map(u => (
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
        </div>
      </div>

      {/* ── COOK MODE — fullscreen step-by-step ── */}
      {showNutrition && (
        <NutritionModal recipe={recipe} ingredientDB={ingredientDB} servings={servings} onClose={() => setShowNutrition(false)} />
      )}
      {cookMode && recipe.steps?.length > 0 && (
        <CookMode recipe={recipe} mult={mult} ingredientDB={ingredientDB} utensilDB={utensilDB} onClose={() => setCookMode(false)} />
      )}

      {/* Shopping ingredient selection modal */}
      {showShoppingModal && (
        <SwipeableSheet onClose={() => setShowShoppingModal(false)} style={{ maxHeight: "85dvh" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Ajouter aux courses</h3>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>Les ingrédients <span style={{ fontWeight: 600, color: "var(--green)" }}>en stock</span> sont décochés par défaut.</p>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <button style={{ fontSize: 12, color: "var(--accent)" }} onClick={() => setSelectedIngs(recipe.ingredients.map(i => i.id))}>Tout sélectionner</button>
            <button style={{ fontSize: 12, color: "var(--text3)" }} onClick={() => setSelectedIngs([])}>Tout décocher</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", maxHeight: "52vh", marginBottom: 16 }}>
            {recipe.ingredients.map(ing => {
              const selected = selectedIngs.includes(ing.id);
              const inStock = isInStock(ing);
              const low = isLowStock(ing);
              return (
                <button key={ing.id} onClick={() => setSelectedIngs(prev => selected ? prev.filter(x => x !== ing.id) : [...prev, ing.id])}
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
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{ing.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text2)" }}>{+(ing.amount * mult).toFixed(2)} {ing.unit}</span>
                    {inStock && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        marginLeft: "auto", flexShrink: 0,
                        fontSize: 10, fontWeight: 600,
                        color: low ? "var(--accent)" : "var(--green)",
                      }}>
                        {/* Même pastille circulaire que dans l'onglet Stock */}
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
                </button>
              );
            })}
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }}
            disabled={selectedIngs.length === 0}
            onClick={() => { onAddToShopping(recipe, recipe.ingredients.filter(i => selectedIngs.includes(i.id)), mult); setShowShoppingModal(false); }}>
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
      {showCollModal && (
        <SwipeableSheet onClose={() => setShowCollModal(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Collections</h3>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>Sélectionne les collections pour <strong>{recipe.name}</strong></p>
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
            {(!collections || collections.length === 0) && <p style={{ color: "var(--text3)", fontSize: 13 }}>Aucune collection. Créez-en dans l'onglet Config.</p>}
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setShowCollModal(false)}>Fermer</button>
        </SwipeableSheet>
      )}
    </div>
  );
}
