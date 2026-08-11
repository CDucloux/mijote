import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Icon } from "../components/Icon.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { NewRecipeButton } from "../components/NewRecipeButton.jsx";
import { RecipeCard } from "../components/RecipeCard.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { CUISINES } from "../constants/cuisines.js";
import { RecipeFilterSheet } from "../components/RecipeFilterSheet.jsx";
import { SORT_OPTIONS, DEFAULT_SORT_KEY, sortOption, defaultDirFor, dirLabel, makeComparator } from "@/lib/recipes/recipeSort.js";
import { DEFAULT_FILTERS, activeFilterCount, matchesFilters, filtersEqual, summarizeFilters } from "@/lib/recipes/recipeFilters.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { createIngredientResolver } from "@/lib/food/nameMatcher.js";
import { isRecipeInSeason } from "@/lib/food/seasonality.js";
import { isRecipeVegan } from "@/lib/food/dietary.js";
import { buildTechniqueIndex } from "@/lib/recipes/techniques.js";
import { computeNutriInfo, buildRecipeIndex } from "@/lib/recipes/nutriscore.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useLS } from "../hooks/useLS.js";
import { useLongPress } from "../hooks/useLongPress.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";
import { OverscrollRow } from "../components/OverscrollRow.jsx";

// ─── RECIPE TAB (Mes Recettes) ────────────────────────────────────────────────
// Toutes les cartes s'animent à l'entrée ; le décalage est plafonné pour que les
// dernières n'attendent pas indéfiniment (cf. animDelay dans la grille).
const MAX_STAGGER = 0.6; // s — plafond du délai d'animation d'entrée

// Squelette de chargement (une seule fois par session) : laisse aux images le
// temps d'arriver avant de révéler les cartes avec leur animation d'entrée.
let recipeSkeletonSeen = false;
const SKELETON_MS = 550;

// Titre de section « fantôme » (barre courte à la place de « Carnets »/« Recettes »).
function SectionTitleSkeleton({ width = 96 }) {
  return <div className="skeleton" style={{ height: 15, width, borderRadius: 6, marginBottom: 12 }} />;
}

// Rangée de carnets « fantômes » (forme livre : page carrée + tranche blanche).
function CarnetsSkeleton({ count = 5 }) {
  return (
    <div style={{ display: "flex", gap: 14, overflow: "hidden", padding: "7px 3px 8px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ flexShrink: 0, width: 134, borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)" }}>
          <div className="skeleton" style={{ aspectRatio: "1/1" }} />
          <div style={{ padding: "9px 11px 12px", background: "var(--surface)" }}>
            <div className="skeleton" style={{ height: 11, width: "78%", borderRadius: 5 }} />
            <div className="skeleton" style={{ height: 8, width: "46%", borderRadius: 5, marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Grille de cartes « fantômes », calquée sur la vraie grille (image 16/10 + méta).
function RecipeGridSkeleton({ count = 12 }) {
  return (
    <div className="recipe-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: "var(--surface)", borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--border)" }}>
          <div className="skeleton" style={{ width: "100%", aspectRatio: "16/10" }} />
          <div style={{ padding: "10px 12px 12px" }}>
            <div className="skeleton" style={{ height: 11, width: "85%", borderRadius: 5 }} />
            <div className="skeleton" style={{ height: 9, width: "55%", borderRadius: 5, marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Carte mémoïsée : ne re-rend que si SES props changent. Sans ça, chaque palier
// de scroll infini (setVisibleCount) re-rendait toutes les cartes déjà visibles.
// Les callbacks reçus sont stables (useCallback) et prennent la recette en argument.
const RecipeGridItem = memo(function RecipeGridItem({ recipe, inSeason, vegan, nutriLetter, animate, animDelay, onOpen, onMenu, startLongPress, cancelLongPress, moveLongPress }) {
  return (
    <div
      onPointerDown={(e) => startLongPress(e, () => onMenu(recipe))} onPointerMove={moveLongPress} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress} onPointerCancel={cancelLongPress}
      onContextMenu={(e) => { e.preventDefault(); onMenu(recipe); }}>
      <RecipeCard recipe={recipe} onClick={() => onOpen(recipe)} inSeason={inSeason} vegan={vegan} nutriLetter={nutriLetter} animate={animate} style={animate ? { animationDelay: animDelay } : undefined} />
    </div>
  );
});

export function RecipesPage({ recipes, collections, ingredientDB, onSelect, onNewRecipe, onSearchCommunity, onEditRecipe, onDeleteRecipe, onDuplicate, onAddToShopping, onToggleCollection, onPlanRecipe, onShareRecipe, setCollections, setTab }) {
  const { techniques } = useAppShell();
  const [search, setSearch] = useState("");
  // Squelette de chargement au 1er affichage de l'onglet dans la session (si des
  // recettes existent) : les images ont le temps de se charger, puis les cartes
  // apparaissent avec leur animation. Ne se rejoue pas aux changements d'onglet.
  const [booting, setBooting] = useState(() => !recipeSkeletonSeen && (recipes?.length || 0) > 0);
  useEffect(() => {
    recipeSkeletonSeen = true;
    // On (re)programme TOUJOURS le timer quand on est en booting : en dev, le
    // double montage de StrictMode annule le 1er timer via le cleanup, donc gater
    // sur `recipeSkeletonSeen` laisserait le squelette bloqué au 2ᵉ montage. En
    // prod, l'effet ne tourne qu'une fois — même résultat.
    if (!booting) return;
    const t = setTimeout(() => setBooting(false), SKELETON_MS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Persistés (localStorage, mobile + web) : carnet sélectionné, tri et filtres
  // survivent au rechargement de la page — plus simple pour retrouver son contexte.
  const [filterCol, setFilterCol] = useLS("rf_recipes_filterCol", null);
  const [sortBy, setSortBy] = useLS("rf_recipes_sortBy", DEFAULT_SORT_KEY); // défaut : plus récentes d'abord
  const [sortDir, setSortDir] = useLS("rf_recipes_sortDir", defaultDirFor(DEFAULT_SORT_KEY));
  const [storedFilters, setFilters] = useLS("rf_recipes_filters", DEFAULT_FILTERS);
  // Fusion avec les défauts : robuste si DEFAULT_FILTERS gagne une clé après coup.
  const filters = useMemo(() => ({ ...DEFAULT_FILTERS, ...storedFilters }), [storedFilters]);
  const [filterOpen, setFilterOpen] = useState(false);
  // Tri « simple » : un clic sur la pilule fait défiler les critères (et remet le
  // sens naturel du critère) ; la flèche inverse le sens du critère courant.
  const cycleSort = () => {
    const keys = SORT_OPTIONS.map(o => o.key);
    const next = keys[(keys.indexOf(sortBy) + 1) % keys.length];
    setSortBy(next); setSortDir(defaultDirFor(next));
  };
  const toggleSortDir = () => setSortDir(d => (d === "asc" ? "desc" : "asc"));
  const [newCarnet, setNewCarnet] = useState(null); // { name, color, icon } ou null
  const [carnetMenu, setCarnetMenu] = useState(null); // carnet visé par l'appui long (modifier/supprimer)
  const [recipeMenu, setRecipeMenu] = useState(null); // recette visée par l'appui long / clic droit (modifier/supprimer)
  const [carnetPickFor, setCarnetPickFor] = useState(null); // recette dont on choisit les carnets (action « Carnet »)
  const [confirmDelete, setConfirmDelete] = useState(null); // { kind: "carnet" | "recipe", item } — confirmation avant suppression
  const [editingSmartId, setEditingSmartId] = useState(null); // carnet smart dont on ré-édite la vue de filtres
  const [dragCarnetId, setDragCarnetId] = useState(null); // carnet en cours de glisser-déposer (réordonnancement)

  // Réordonnancement des carnets (persisté via setCollections → localStorage + cloud).
  // Déplace `fromId` à la position de `toId` (glisser-déposer, desktop).
  const reorderCollections = (fromId, toId) => setCollections(prev => {
    const arr = [...prev];
    const from = arr.findIndex(c => c.id === fromId), to = arr.findIndex(c => c.id === toId);
    if (from < 0 || to < 0 || from === to) return prev;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    return arr;
  });
  // Décale un carnet d'un cran (flèches du menu, mobile). dir = -1 (gauche) / +1 (droite).
  const moveCarnet = (id, dir) => setCollections(prev => {
    const arr = [...prev];
    const i = arr.findIndex(c => c.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return prev;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return arr;
  });
  // Appui long générique (carnets ET cartes recettes) : ouvre un menu après un
  // délai, s'annule au moindre mouvement (scroll / pull-to-refresh).
  const { startLongPress, cancelLongPress, moveLongPress, wasLongPress } = useLongPress();
  const [hideCarnets, setHideCarnets] = useState(() => {
    try { return localStorage.getItem("mijote_hideCarnets") === "1"; } catch { return false; }
  });
  const toggleCarnets = () => setHideCarnets(v => { const n = !v; try { localStorage.setItem("mijote_hideCarnets", n ? "1" : "0"); } catch { /* ignore */ } return n; });

  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  // Focus sans scroll : évite que la page « saute » quand le bottom-sheet s'ouvre.
  const focusNoScroll = useCallback(el => { if (el && typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches) el.focus({ preventScroll: true }); }, []);

  const recipesById = useMemo(() => buildRecipeIndex(recipes), [recipes]);
  // Saison / vegan / Nutri-Score calculés UNE fois par recette (et non à chaque rendu
  // de la grille) : isRecipeVegan remonte récursivement les préparations de base →
  // coûteux au scroll. Le Nutri-Score est recalculé EN DIRECT (score ET lettre) comme
  // la fiche détail : la carte l'affiche et le tri « Nutri-Score » l'utilise, sinon le
  // tri ordonnerait selon un score figé pendant que la carte montre l'autre → mélange.
  const seasonVeganById = useMemo(() => {
    const m = new Map();
    for (const r of recipes) {
      const nutri = computeNutriInfo(r.ingredients, ingredientDB || [], recipesById);
      m.set(r.id, {
        inSeason: isRecipeInSeason(r, resolver),
        vegan: isRecipeVegan(r, resolver, { recipes }),
        nutriLetter: nutri.letter ?? r.nutriLetter,
        healthScore: nutri.letter ? nutri.score : r.healthScore,
      });
    }
    return m;
  }, [recipes, resolver, ingredientDB, recipesById]);
  // Callbacks stables → RecipeGridItem (mémoïsé) ne re-rend pas au scroll.
  const openRecipe = useCallback((r) => { if (wasLongPress()) return; onSelect(r.id); }, [onSelect, wasLongPress]);
  const openRecipeMenu = useCallback((r) => setRecipeMenu(r), []);

  // Styles de cuisine réellement utilisés, dans l'ordre canonique de la liste.
  const usedCuisines = CUISINES.filter(c => recipes.some(r => r.cuisine === c.label));
  const techIndex = useMemo(() => buildTechniqueIndex(techniques), [techniques]);
  const nActiveFilters = activeFilterCount(filters);

  // ── Carnets : manuels (appartenance explicite) ou intelligents (vue de filtres) ──
  const matchCtx = useMemo(() => ({ resolver, techniques, techIndex, recipes }), [resolver, techniques, techIndex, recipes]);
  const isSmart = (col) => col?.kind === "smart";
  // Recettes d'un carnet : appartenance pour un manuel, prédicat de filtres pour un smart.
  const carnetMatch = useCallback((col, r) => {
    if (isSmart(col)) {
      if (!matchesFilters(r, { ...DEFAULT_FILTERS, ...col.filters }, matchCtx)) return false;
      const q = (col.search || "").trim();
      if (q) {
        const nq = normalizeStr(q);
        const hit = normalizeStr(r.name).includes(nq) || (r.cuisine && normalizeStr(r.cuisine).includes(nq))
          || r.ingredients?.some(i => normalizeStr(i.name).includes(nq));
        if (!hit) return false;
      }
      return true;
    }
    return (r.collections || []).includes(col.id);
  }, [matchCtx]);
  const countFor = useCallback((col) => recipes.reduce((n, r) => n + (carnetMatch(col, r) ? 1 : 0), 0), [recipes, carnetMatch]);
  // Un carnet smart est « actif » quand l'état de filtres/recherche courant EST sa vue.
  const smartActive = (col) => !filterCol && filtersEqual(filters, col.filters) && search.trim() === (col.search || "").trim();
  const carnetActive = (col) => isSmart(col) ? smartActive(col) : filterCol === col.id;
  const openCarnet = (col) => {
    if (isSmart(col)) {
      if (smartActive(col)) { setFilters({ ...DEFAULT_FILTERS }); setSearch(""); }
      else { setFilterCol(null); setFilters({ ...DEFAULT_FILTERS, ...col.filters }); setSearch(col.search || ""); }
    } else {
      setFilterCol(filterCol === col.id ? null : col.id);
    }
  };
  // Rouvre la feuille de filtres sur la vue d'un carnet intelligent (édition).
  const openCarnetFilters = (col) => {
    setFilters({ ...DEFAULT_FILTERS, ...col.filters }); setSearch(col.search || "");
    setEditingSmartId(col.id); setFilterOpen(true);
  };

  const filtered = useMemo(() => recipes
    .filter(r => {
      // Plats et bases cohabitent dans la même grille ; le badge en coin les distingue.
      if (search) {
        const q = normalizeStr(search);
        const inName = normalizeStr(r.name).includes(q);
        const inCuisine = r.cuisine && normalizeStr(r.cuisine).includes(q);
        const inIngredients = r.ingredients?.some(i => normalizeStr(i.name).includes(q));
        if (!inName && !inCuisine && !inIngredients) return false;
      }
      if (filterCol && !r.collections?.includes(filterCol)) return false;
      return matchesFilters(r, filters, { resolver, techniques, techIndex, recipes });
    })
    // Le comparateur lit `healthScore` : on lui présente le score recalculé EN DIRECT
    // (même source que la lettre affichée) pour que le tri « Nutri-Score » colle aux
    // badges des cartes, au lieu d'ordonner selon la valeur figée.
    .map(r => {
      const live = seasonVeganById.get(r.id)?.healthScore;
      return (typeof live === "number" && live !== r.healthScore) ? { ...r, healthScore: live } : r;
    })
    .sort(makeComparator({ sortBy, sortDir, techniques, techIndex, recipes })),
  [recipes, search, filterCol, filters, sortBy, sortDir, resolver, techniques, techIndex, seasonVeganById]);

  // Carnet persisté mais supprimé depuis (autre session / appareil) → on nettoie le filtre.
  useEffect(() => { if (filterCol && !collections.some(c => c.id === filterCol)) setFilterCol(null); }, [filterCol, collections, setFilterCol]);

  const { scrollRef, contentRef } = useElasticScroll();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Mes Recettes</h1></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NewRecipeButton onManual={onNewRecipe} />
            <UserAvatar />
          </div>
        </div>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}><Icon name="search" size={17} color="var(--text3)" /></span>
          <input className="field-input recipe-search" placeholder="Rechercher un plat, une cuisine, un ingrédient…" value={search} onChange={e => setSearch(e.target.value)}
            enterKeyHint="search"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
            style={{ paddingLeft: 44, paddingRight: search ? 40 : 16 }} />
          {search && <button onClick={() => setSearch("")} aria-label="Effacer la recherche" className="search-clear-btn" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}><Icon name="close" size={13} /></button>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {/* Filtres (la feuille de tri est désormais séparée, bouton « Tri ») */}
          <button className="toolbar-pill" data-active={nActiveFilters > 0 ? "1" : undefined} onClick={() => setFilterOpen(true)} title="Filtrer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Filtres
            {nActiveFilters > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{nActiveFilters}</span>}
          </button>
          {/* Pilule + flèche accolées : clic sur la pilule = critère suivant,
              clic sur la flèche = inverser le sens. */}
          <div className="sort-control">
            <button className="toolbar-pill sort-cycle" onClick={cycleSort} title="Changer le critère de tri">
              <Icon name="updown" size={15} color="currentColor" />
              <span style={{ color: "var(--text3)", fontWeight: 500 }}>Trié par :</span>
              <strong style={{ fontWeight: 700 }}>{sortOption(sortBy).label}</strong>
            </button>
            <button className="toolbar-pill sort-dir" onClick={toggleSortDir}
              aria-label={`Sens : ${dirLabel(sortBy, sortDir)}`} title={`Sens : ${dirLabel(sortBy, sortDir)} (inverser)`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transition: "transform 0.2s ease", transform: sortDir === "asc" ? "rotate(180deg)" : "none" }}>
                <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {recipes.length > 0 && (
            <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--text3)", whiteSpace: "nowrap", flexShrink: 0 }}>{filtered.length} recette{filtered.length > 1 ? "s" : ""}</span>
          )}
        </div>
      </div>
      {filterOpen && (
        <SwipeableSheet onClose={() => { setFilterOpen(false); setEditingSmartId(null); }} hideHandle style={{ maxHeight: "90dvh", paddingTop: 0, paddingBottom: 0 }}>
          {(close) => (
          <RecipeFilterSheet filters={filters} setFilters={setFilters} usedCuisines={usedCuisines} ingredientDB={ingredientDB || []} resultCount={filtered.length} onClose={() => close()}
            alreadySaved={!editingSmartId && collections.some(c => isSmart(c) && smartActive(c))}
            updatingCarnetName={editingSmartId ? collections.find(c => c.id === editingSmartId)?.name : null}
            onSaveAsCarnet={() => {
              if (editingSmartId) {
                setCollections(prev => prev.map(c => c.id === editingSmartId ? { ...c, filters: { ...DEFAULT_FILTERS, ...filters }, search: search.trim() } : c));
                close(() => { setFilterOpen(false); setEditingSmartId(null); });
              } else {
                close(() => { setFilterOpen(false); setEditingSmartId(null); setNewCarnet({ name: "", color: "#e8703a", icon: "📓", smart: true, filters: { ...filters }, search }); });
              }
            }} />
          )}
        </SwipeableSheet>
      )}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "4px 20px 20px" }}>
        <div ref={contentRef} style={{ minHeight: "100%" }}>
        {booting ? (
          <>
            <SectionTitleSkeleton width={96} />
            <CarnetsSkeleton />
            <div style={{ marginTop: 22 }}>
              <SectionTitleSkeleton width={116} />
              <RecipeGridSkeleton />
            </div>
          </>
        ) : (<>
        {recipes.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Carnets</h2>
              <button onClick={toggleCarnets} title={hideCarnets ? "Afficher les carnets" : "Masquer les carnets"} aria-label={hideCarnets ? "Afficher les carnets" : "Masquer les carnets"} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "transparent", border: "none", color: "var(--text3)", cursor: "pointer" }}>
                <Icon name={hideCarnets ? "eyeOff" : "eye"} size={16} color="var(--text3)" />
              </button>
              {!hideCarnets && collections.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text3)" }}>Appui long pour gérer</span>}
            </div>
            {!hideCarnets && (
            <OverscrollRow stretch className="collections-row" style={{ gap: 14, padding: "7px 3px 8px" }}>
              {collections.map((col) => {
                const active = carnetActive(col);
                const count = countFor(col);
                return (
                <button key={col.id} className="notebook-card" data-active={active ? "1" : undefined}
                  onClick={() => { if (wasLongPress()) return; openCarnet(col); }}
                  onPointerDown={(e) => startLongPress(e, () => setCarnetMenu(col))} onPointerMove={moveLongPress} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress} onPointerCancel={cancelLongPress}
                  onContextMenu={(e) => { e.preventDefault(); setCarnetMenu(col); }}
                  draggable
                  onDragStart={() => { cancelLongPress(); setDragCarnetId(col.id); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (dragCarnetId && dragCarnetId !== col.id) reorderCollections(dragCarnetId, col.id); setDragCarnetId(null); }}
                  onDragEnd={() => setDragCarnetId(null)}
                  title="Glisser pour réordonner · appui long pour modifier"
                  style={{ flexShrink: 0, width: 134, padding: 0, border: "none", background: "transparent", cursor: "grab", borderRadius: 14, opacity: dragCarnetId === col.id ? 0.4 : 1 }}>
                  <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: active ? `0 0 0 2px ${col.color}` : "none" }}>
                    {/* Page lignée + reliure colorée */}
                    <div style={{ position: "relative", aspectRatio: "1/1", background: `linear-gradient(180deg, ${col.color}1f 0%, ${col.color}12 100%)`, backgroundImage: `repeating-linear-gradient(${col.color}00 0 27px, ${col.color}22 27px 28px)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {/* Reliure */}
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 11, background: `linear-gradient(180deg, ${col.color} 0%, ${col.color}cc 100%)` }} />
                      <div style={{ position: "absolute", left: 3, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 3 }}>
                        {[0, 1, 2].map(d => <span key={d} style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.85)" }} />)}
                      </div>
                      {/* Pastille compteur */}
                      <div style={{ position: "absolute", top: 8, right: 8, minWidth: 22, height: 22, borderRadius: 11, background: count ? col.color : "var(--surface3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: count ? "#fff" : "var(--text3)", padding: "0 6px", boxShadow: count ? `0 2px 6px -1px ${col.color}99` : "none" }}>{count}</div>
                      {/* Icône */}
                      <span className="notebook-card-icon" style={{ fontSize: 34, lineHeight: 1, filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.18))" }}>{col.icon || "📓"}</span>
                    </div>
                    {/* Tranche basse blanche */}
                    <div style={{ padding: "9px 11px 11px", background: "var(--surface)", borderTop: `1px solid ${col.color}22` }}>
                      <div style={{ fontFamily: "var(--ff-display)", fontSize: 15, fontWeight: 600, textAlign: "left", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>{col.name}</div>
                      <div style={{ fontSize: 11, color: count ? "var(--text2)" : "var(--text3)", textAlign: "left", marginTop: 1 }}>{count === 0 ? "Vide" : `${count} recette${count > 1 ? "s" : ""}`}</div>
                    </div>
                  </div>
                </button>
                );
              })}
              {/* Carte « ajouter un carnet » – même gabarit que les carnets */}
              <button className="notebook-card notebook-card-add" onClick={() => setNewCarnet({ name: "", color: "#e8703a", icon: "📓" })} style={{ flexShrink: 0, width: 134, padding: 0, border: "none", background: "transparent", cursor: "pointer", borderRadius: 14 }}>
                <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", border: "2px dashed var(--border)" }}>
                  <div style={{ position: "relative", aspectRatio: "1/1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text3)" }}>
                    <span className="notebook-add-plus" style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--surface2)", color: "var(--text2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={20} color="currentColor" /></span>
                  </div>
                  <div style={{ padding: "9px 11px 11px", background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
                    <div style={{ fontFamily: "var(--ff-display)", fontSize: 15, fontWeight: 600, textAlign: "left", letterSpacing: "-0.01em", color: "var(--text2)" }}>Nouveau</div>
                    <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "left", marginTop: 1 }}>Créer un carnet</div>
                  </div>
                </div>
              </button>
            </OverscrollRow>
            )}
          </div>
        )}
        {recipes.length === 0 ? (
          // ── Première connexion : 0 recette, c'est normal → on invite, sans afficher « Carnets » ni « Recettes (0) » ──
          <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px", maxWidth: 420, margin: "0 auto" }}>
            <div style={{ position: "relative", width: 88, height: 88, borderRadius: 24, background: "linear-gradient(150deg, rgba(232,112,58,0.18), rgba(240,192,96,0.14))", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, boxShadow: "0 10px 30px -14px rgba(232,112,58,0.5)" }}>
              <span style={{ fontSize: 40, lineHeight: 1 }}>🍳</span>
              <span style={{ position: "absolute", top: -6, right: -6 }}><Icon name="sparkle" size={20} color="var(--accent)" /></span>
            </div>
            <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 8 }}>Bienvenue dans ta bibliothèque</h3>
            <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 24 }}>
              Elle est encore vide. Crée ta première recette ou pioche l'inspiration parmi les recettes partagées par la communauté.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-primary" style={{ padding: "11px 20px", borderRadius: 14, fontSize: 14 }} onClick={onNewRecipe}>
                <Icon name="plus" size={16} /> Créer ma première recette
              </button>
              {setTab && (
                <button className="btn btn-ghost" style={{ padding: "11px 20px", borderRadius: 14, fontSize: 14 }} onClick={() => setTab("home")}>
                  <Icon name="sparkle" size={16} color="var(--accent)" /> Explorer les recettes publiques
                </button>
              )}
            </div>
          </div>
        ) : (
        <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
            Recettes
          </h2>
        </div>
        {/* La clé change à chaque nouveau jeu de résultats (recherche, tri, carnet)
            → la grille se remonte et les cartes rejouent leur entrée décalée
            (fondu + translation, cascade ~40 ms). Les résultats apparaissent
            « un à un » plutôt que de surgir d'un bloc. */}
        <div key={`${filterCol || "all"}|${normalizeStr(search)}|${sortBy}|${sortDir}`} className="recipe-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {filtered.map((r, idx) => {
            const sv = seasonVeganById.get(r.id);
            return (
              <RecipeGridItem key={r.id} recipe={r}
                inSeason={sv?.inSeason || false} vegan={sv?.vegan || false} nutriLetter={sv?.nutriLetter}
                animate animDelay={`${Math.min(idx * 0.045, MAX_STAGGER)}s`}
                onOpen={openRecipe} onMenu={openRecipeMenu}
                startLongPress={startLongPress} cancelLongPress={cancelLongPress} moveLongPress={moveLongPress} />
            );
          })}
        </div>
        {filtered.length === 0 && (() => {
          const q = search.trim();
          const qShort = q.length > 22 ? q.slice(0, 22) + "…" : q;
          const hasFilters = nActiveFilters > 0 || !!filterCol;
          const reset = () => { setSearch(""); setFilters({ ...DEFAULT_FILTERS }); setFilterCol(null); };
          return (
          <div style={{ minHeight: "48vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px", maxWidth: 380, margin: "0 auto" }}>
            <div style={{ width: 76, height: 76, borderRadius: 22, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, boxShadow: "0 8px 24px -16px rgba(0,0,0,0.35)" }}>
              <Icon name="search" size={30} color="var(--accent)" />
            </div>
            <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 7 }}>Aucune recette trouvée</h3>
            <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 22 }}>
              {q
                ? <>Rien ne correspond à « <strong style={{ color: "var(--text)", fontWeight: 600 }}>{qShort}</strong> » dans ta bibliothèque.<br />Cherche-la dans la communauté ou crée-la.</>
                : "Aucune recette ne correspond à ces filtres."}
            </p>

            {q ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                {onSearchCommunity && (
                  <button className="btn btn-primary btn-pill" style={{ fontSize: 14 }} onClick={() => onSearchCommunity(q)}>
                    <Icon name="sparkle" size={16} color="#fff" /> Chercher dans la communauté
                  </button>
                )}
                <button className="btn btn-pill" style={{ fontSize: 14, background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }} onClick={() => onNewRecipe({ name: q })}>
                  <Icon name="plus" size={16} color="currentColor" /> Créer « {qShort} »
                </button>
              </div>
            ) : hasFilters && (
              <button className="btn btn-primary btn-pill" style={{ fontSize: 14 }} onClick={reset}>
                <Icon name="close" size={15} color="#fff" /> Enlever les filtres
              </button>
            )}

            {/* Reset discret quand une recherche est active (les CTA principaux vont
                de l'avant ; ce lien reste la porte de retour vers la bibliothèque). */}
            {q && (
              <button onClick={reset} style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text3)" }}>
                <Icon name="eraser" size={15} color="var(--text3)" /> {hasFilters ? "Réinitialiser recherche et filtres" : "Effacer la recherche"}
              </button>
            )}
          </div>
          );
        })()}
        </>
        )}
        </>)}
        </div>
      </div>

      {/* Confirmation avant suppression (carnet ou recette) */}
      {confirmDelete && (
        <ConfirmDialog
          title={`Supprimer ${confirmDelete.kind === "carnet" ? "ce carnet" : "cette recette"} ?`}
          icon={confirmDelete.kind === "carnet" ? "book" : "trash"}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            if (confirmDelete.kind === "carnet") {
              setCollections(prev => prev.filter(c => c.id !== confirmDelete.item.id));
              if (filterCol === confirmDelete.item.id) setFilterCol(null);
            } else {
              onDeleteRecipe?.(confirmDelete.item.id);
            }
            setConfirmDelete(null);
          }}>
          <strong style={{ color: "var(--text)" }}>« {confirmDelete.item.name} »</strong>
          {confirmDelete.kind === "carnet"
            ? " sera supprimé. Tes recettes ne sont pas effacées, seulement le carnet."
            : " sera définitivement supprimée. Cette action est irréversible."}
        </ConfirmDialog>
      )}

      {/* Menu d'une recette (appui long / clic droit) : actions rapides + liste */}
      {recipeMenu && (() => {
        const rm = recipeMenu;
        const close = () => setRecipeMenu(null);
        const isComp = rm.isComponent;
        // Actions rapides (grille) : « Ouvrir » toujours ; le reste seulement pour
        // une vraie recette (une base ne se planifie pas / ne se partage pas).
        const quick = [
          { icon: "forward", label: "Ouvrir", on: () => { onSelect(rm.id); close(); } },
          ...(isComp ? [] : [
            { icon: "calendar", label: "Planning", on: () => { onPlanRecipe?.(rm); close(); } },
            { icon: "shopping", label: "Courses", on: () => { onAddToShopping?.(rm); close(); } },
            { icon: "fileText", label: "Carnet", on: () => { close(); setCarnetPickFor(rm); } },
          ]),
        ];
        const list = [
          { icon: "edit", label: "Modifier", on: () => { onEditRecipe?.(rm); close(); } },
          { icon: "copy", label: "Dupliquer", on: () => { onDuplicate?.(rm); close(); } },
          ...(isComp ? [] : [{ icon: "share", label: "Partager", on: () => { onShareRecipe?.(rm); close(); } }]),
        ];
        return (
        <SwipeableSheet onClose={close}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, overflow: "hidden", background: "var(--surface2)", display: "grid", placeItems: "center", fontSize: 24 }}>
              {rm.image ? <img src={rm.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (isComp ? "🧩" : "🍽️")}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rm.name}</div>
              <div style={{ fontSize: 13, color: "var(--text3)" }}>{isComp ? "Préparation de base" : "Recette"}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {quick.map(a => (
              <button key={a.label} className="menu-row" onClick={a.on}>
                <Icon name={a.icon} size={19} color="var(--text2)" /> {a.label}
              </button>
            ))}
            {list.map(a => (
              <button key={a.label} className="menu-row" onClick={a.on}>
                <Icon name={a.icon} size={19} color="var(--text2)" /> {a.label}
              </button>
            ))}
            <button className="menu-row menu-row-danger" style={{ borderTop: "1px solid var(--border)", marginTop: 6 }} onClick={() => { setConfirmDelete({ kind: "recipe", item: rm }); close(); }}>
              <Icon name="trash" size={19} color="var(--red)" /> Supprimer
            </button>
          </div>
        </SwipeableSheet>
        );
      })()}

      {/* Choix des carnets (action « Carnet » du menu recette) : carnets manuels
          uniquement — les carnets intelligents se remplissent par leurs filtres. */}
      {carnetPickFor && (() => {
        const rec = recipes.find(r => r.id === carnetPickFor.id) || carnetPickFor;
        const manual = collections.filter(c => !isSmart(c));
        return (
        <SwipeableSheet onClose={() => setCarnetPickFor(null)}>
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, marginBottom: 4 }}>Ajouter à un carnet</h3>
          <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 16 }}>« {rec.name} »</p>
          {manual.length === 0 ? (
            <div style={{ textAlign: "center", padding: "8px 0 12px", color: "var(--text3)", fontSize: 13.5 }}>Aucun carnet manuel pour l'instant.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {manual.map(col => {
                const inCol = (rec.collections || []).includes(col.id);
                return (
                  <button key={col.id} onClick={() => onToggleCollection?.(rec.id, col.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, background: inCol ? "rgba(232,112,58,0.10)" : "var(--surface2)", border: `1px solid ${inCol ? "rgba(232,112,58,0.4)" : "var(--border)"}`, cursor: "pointer", textAlign: "left", transition: "background 0.15s, border-color 0.15s" }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: col.color + "33", display: "grid", placeItems: "center", fontSize: 18 }}>{col.icon || "📓"}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.name}</span>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: inCol ? "var(--accent)" : "transparent", border: `2px solid ${inCol ? "var(--accent)" : "var(--border)"}`, display: "grid", placeItems: "center" }}>
                      {inCol && <Icon name="check" size={12} color="#fff" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={() => setCarnetPickFor(null)}>Terminé</button>
        </SwipeableSheet>
        );
      })()}

      {/* Menu d'un carnet (appui long) : actions rapides + position + supprimer */}
      {carnetMenu && (() => {
        const cm = carnetMenu;
        const close = () => setCarnetMenu(null);
        const smart = isSmart(cm);
        const idx = collections.findIndex(c => c.id === cm.id);
        const total = collections.length;
        const n = countFor(cm);
        // Icône « réglages/curseurs » (même glyphe que la barre de filtres), pour
        // distinguer « Ajuster les filtres » du simple « Modifier ».
        const slidersIcon = <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" stroke="var(--text2)" strokeWidth="1.9" strokeLinecap="round" /></svg>;
        const stepBtn = (disabled) => ({ width: 28, height: 28, display: "grid", placeItems: "center", background: "none", border: "none", borderRadius: "50%", cursor: disabled ? "default" : "pointer", color: disabled ? "var(--text3)" : "var(--accent)", opacity: disabled ? 0.4 : 1 });
        return (
        <SwipeableSheet onClose={close}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: cm.color + "33", display: "grid", placeItems: "center", fontSize: 26 }}>{cm.icon || "📓"}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cm.name}</div>
              <div style={{ fontSize: 13, color: "var(--text3)" }}>{smart ? "Carnet intelligent" : "Carnet"} - {n} recette{n > 1 ? "s" : ""}</div>
            </div>
          </div>
          {/* Liste d'actions homogène (même style que « Modifier »), séparée par des filets. */}
          <div className="carnet-menu-list">
            {total > 1 && (
              <div className="menu-row" style={{ cursor: "default", paddingTop: 6, paddingBottom: 6 }}>
                <Icon name="updown" size={19} color="var(--text2)" />
                <span style={{ flex: 1 }}>Position</span>
                <div style={{ display: "flex", alignItems: "center", background: "var(--surface2)", borderRadius: 999, border: "1px solid var(--border)", padding: "2px 4px", flexShrink: 0 }}>
                  <button disabled={idx <= 0} onClick={() => moveCarnet(cm.id, -1)} style={stepBtn(idx <= 0)} aria-label="Reculer"><Icon name="back" size={15} color="currentColor" /></button>
                  <span style={{ fontSize: 13.5, fontWeight: 700, minWidth: 42, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{idx + 1} / {total}</span>
                  <button disabled={idx >= total - 1} onClick={() => moveCarnet(cm.id, 1)} style={stepBtn(idx >= total - 1)} aria-label="Avancer"><Icon name="forward" size={15} color="currentColor" /></button>
                </div>
              </div>
            )}
            {smart && (
              <button className="menu-row" onClick={() => { close(); openCarnetFilters(cm); }}>
                {slidersIcon} Ajuster les filtres
              </button>
            )}
            <button className="menu-row" onClick={() => { setNewCarnet({ ...cm, editing: true }); close(); }}>
              <Icon name="edit" size={19} color="var(--text2)" /> Modifier
            </button>
            <button className="menu-row menu-row-danger" onClick={() => { setConfirmDelete({ kind: "carnet", item: cm }); close(); }}>
              <Icon name="trash" size={19} color="var(--red)" /> Supprimer le carnet
            </button>
          </div>
        </SwipeableSheet>
        );
      })()}

      {/* Création / modification d'un carnet */}
      {newCarnet && (
        <SwipeableSheet onClose={() => setNewCarnet(null)}>
          {(close) => (<>
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 16 }}>{newCarnet.editing ? "Modifier le carnet" : newCarnet.smart ? "Enregistrer la vue" : "Nouveau carnet"}</h3>

          {/* Aperçu live : le vrai visuel « livre » qui se met à jour en direct */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{ width: 122, position: "relative", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 0 0 1px var(--border)", animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}>
              <div style={{ position: "relative", aspectRatio: "1/1", background: `linear-gradient(180deg, ${newCarnet.color}1f 0%, ${newCarnet.color}12 100%)`, backgroundImage: `repeating-linear-gradient(${newCarnet.color}00 0 23px, ${newCarnet.color}22 23px 24px)`, display: "grid", placeItems: "center" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 10, background: `linear-gradient(180deg, ${newCarnet.color} 0%, ${newCarnet.color}cc 100%)` }} />
                <div style={{ position: "absolute", left: 2.5, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 3 }}>
                  {[0, 1, 2].map(d => <span key={d} style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.85)" }} />)}
                </div>
                <span style={{ fontSize: 40, lineHeight: 1, filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.18))" }}>{newCarnet.icon}</span>
              </div>
              <div style={{ padding: "8px 10px 10px", background: "var(--surface)", borderTop: `1px solid ${newCarnet.color}22` }}>
                <div style={{ fontFamily: "var(--ff-display)", fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: newCarnet.name.trim() ? "var(--text)" : "var(--text3)" }}>{newCarnet.name.trim() || "Mon carnet"}</div>
                <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>{(newCarnet.smart || newCarnet.kind === "smart") ? "Intelligent" : "Manuel"}</div>
              </div>
            </div>
          </div>

          {newCarnet.smart && (() => {
            const nCrit = activeFilterCount(newCarnet.filters) + (newCarnet.search?.trim() ? 1 : 0);
            const nRec = recipes.reduce((n, r) => n + (carnetMatch({ kind: "smart", filters: newCarnet.filters, search: newCarnet.search }, r) ? 1 : 0), 0);
            const pill = { display: "inline-flex", alignItems: "baseline", gap: 6, padding: "7px 14px", borderRadius: 999, background: "var(--surface2)", border: "1px solid var(--border)", fontSize: 12.5, fontWeight: 600, color: "var(--text3)" };
            const val = { fontSize: 15, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" };
            return (
              <div style={{ marginTop: -6, marginBottom: 20 }}>
                {/* Légende centrée, alignée sur le preview → composition équilibrée */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 12, fontSize: 12.5, color: "var(--text3)" }}>
                  <Icon name="sparkle" size={14} color="var(--accent)" />
                  <span>Se remplit tout seul selon tes filtres</span>
                </div>
                {/* Deux stats-pills, le chiffre en héros */}
                <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={pill}><span style={val}>{nCrit}</span> critère{nCrit > 1 ? "s" : ""}</span>
                  <span style={pill}><span style={val}>{nRec}</span> recette{nRec > 1 ? "s" : ""}</span>
                </div>
              </div>
            );
          })()}

          <div style={{ marginBottom: 16 }}>
            <div className="field-label" style={{ marginBottom: 7 }}>Nom</div>
            <input className="field-input" placeholder={newCarnet.smart ? "ex: Desserts rapides" : "ex: Recettes de Mamie"} value={newCarnet.name} ref={focusNoScroll} onChange={e => setNewCarnet(p => ({ ...p, name: e.target.value }))} />
          </div>

          <div className="field-label" style={{ marginBottom: 9 }}>Couleur</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            {["#e8703a", "#f0c060", "#e05252", "#4caf7d", "#5b9cf6", "#c080e0", "#f0a875", "#9a9490"].map(c => {
              const on = newCarnet.color === c;
              return (
                <button key={c} onClick={() => setNewCarnet(p => ({ ...p, color: c }))} aria-label={`Couleur ${c}`} className="pressable"
                  style={{ width: 34, height: 34, borderRadius: "50%", background: c, border: "none", cursor: "pointer", display: "grid", placeItems: "center",
                    boxShadow: on ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : "none", transition: "box-shadow 0.15s ease" }}>
                  {on && <Icon name="check" size={16} color="#fff" />}
                </button>
              );
            })}
          </div>

          <div className="field-label" style={{ marginBottom: 9 }}>Icône</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 8, marginBottom: 18 }}>
            {["🍽️", "🥗", "🍝", "🍰", "🥩", "🥦", "🥐", "🍜", "🍛", "🫕", "🥘", "🧁", "🍣", "🫙", "🥚", "🧀", "🫒", "🌮", "🍲"].map(ico => {
              const on = newCarnet.icon === ico;
              return (
                <button key={ico} onClick={() => setNewCarnet(p => ({ ...p, icon: ico }))} className="pressable"
                  style={{ aspectRatio: "1/1", borderRadius: 12, fontSize: 21, display: "grid", placeItems: "center", cursor: "pointer",
                    background: on ? newCarnet.color + "22" : "var(--surface2)",
                    border: `2px solid ${on ? newCarnet.color : "transparent"}`,
                    boxShadow: on ? `0 4px 12px -4px ${newCarnet.color}88` : "none",
                    transition: "background 0.15s ease, border-color 0.15s ease" }}>{ico}</button>
              );
            })}
          </div>
          {/* Vue de filtres d'un carnet intelligent : consultable et modifiable */}
          {newCarnet.editing && newCarnet.kind === "smart" && (() => {
            const chips = summarizeFilters(newCarnet.filters, newCarnet.search);
            const editFilters = () => {
              setFilters({ ...DEFAULT_FILTERS, ...newCarnet.filters }); setSearch(newCarnet.search || "");
              setEditingSmartId(newCarnet.id); setNewCarnet(null); setFilterOpen(true);
            };
            return (
              <div style={{ marginBottom: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span className="field-label" style={{ margin: 0 }}>Filtres de la vue</span>
                  <button onClick={editFilters} className="pressable" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <Icon name="edit" size={13} color="var(--accent)" /> Modifier
                  </button>
                </div>
                {chips.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {chips.map((c, i) => <span key={i} style={{ fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 20, background: "rgba(232,112,58,0.12)", color: "var(--accent)", border: "1px solid rgba(232,112,58,0.28)" }}>{c}</span>)}
                  </div>
                ) : (
                  <button onClick={editFilters} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", borderRadius: 12, background: "var(--surface2)", border: "1px dashed var(--border)", color: "var(--text3)", fontSize: 12.5, cursor: "pointer", textAlign: "left" }}>
                    <Icon name="plus" size={14} color="var(--accent)" /> Aucun filtre : ce carnet montre toutes les recettes. Ajoute des critères.
                  </button>
                )}
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
              if (!newCarnet.name.trim()) return;
              if (newCarnet.editing) {
                // On ne touche qu'au nom/couleur/icône ; kind, filtres et vue sont préservés.
                setCollections(prev => prev.map(c => c.id === newCarnet.id ? { ...c, name: newCarnet.name.trim(), color: newCarnet.color, icon: newCarnet.icon } : c));
                setNewCarnet(null);
                return;
              }
              const base = { name: newCarnet.name.trim(), color: newCarnet.color, icon: newCarnet.icon, id: "c" + Date.now() };
              const col = newCarnet.smart
                ? { ...base, kind: "smart", filters: { ...DEFAULT_FILTERS, ...newCarnet.filters }, search: (newCarnet.search || "").trim() }
                : { ...base, kind: "manual", count: 0 };
              setCollections(prev => [...prev, col]);
              setNewCarnet(null);
            }}>{newCarnet.editing ? "Enregistrer" : newCarnet.smart ? "Enregistrer" : "Créer"}</button>
          </div>
          </>)}
        </SwipeableSheet>
      )}
    </div>
  );
}
