import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Icon } from "../components/Icon.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { NewRecipeButton } from "../components/NewRecipeButton.jsx";
import { RecipeCard } from "../components/RecipeCard.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { ConfirmSheet } from "../components/ConfirmSheet.jsx";
import { CUISINES } from "../constants/cuisines.js";
import { RecipeFilterSheet } from "../components/RecipeFilterSheet.jsx";
import { DEFAULT_FILTERS, activeFilterCount, matchesFilters, filtersEqual, summarizeFilters } from "../lib/recipeFilters.js";
import { normalizeStr } from "../lib/parseIngredient.js";
import { createIngredientResolver } from "../lib/nameMatcher.js";
import { isRecipeInSeason } from "../lib/seasonality.js";
import { isRecipeVegan } from "../lib/dietary.js";
import { buildTechniqueIndex } from "../lib/techniques.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useLS } from "../hooks/useLS.js";

// ─── RECIPE TAB (Mes Recettes) ────────────────────────────────────────────────
const PAGE_SIZE = 8;

// Horodatage ms encodé dans l'id ("r"+Date.now()…) → départage les recettes créées
// le même jour, car createdAt est au jour près (et parfois absent). 0 si non horodaté.
const idTimestamp = (id) => { const m = /^r(\d{10,})/.exec(id || ""); return m ? Number(m[1]) : 0; };
// Tri par récence DÉCROISSANTE (plus récent d'abord) : createdAt (jour) puis, à
// égalité ou en son absence, l'horodatage encodé dans l'id.
const byRecent = (a, b) => {
  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  const da = Number.isNaN(ta) ? 0 : ta, db = Number.isNaN(tb) ? 0 : tb;
  return db !== da ? db - da : idTimestamp(b.id) - idTimestamp(a.id);
};

export function RecipesPage({ recipes, collections, ingredientDB, onSelect, onNewRecipe, onEditRecipe, onDeleteRecipe, setCollections, setTab }) {
  const { techniques } = useAppShell();
  const [search, setSearch] = useState("");
  // Persistés (localStorage, mobile + web) : carnet sélectionné, tri et filtres
  // survivent au rechargement de la page — plus simple pour retrouver son contexte.
  const [filterCol, setFilterCol] = useLS("rf_recipes_filterCol", null);
  const [sortBy, setSortBy] = useLS("rf_recipes_sortBy", "date"); // défaut : plus récentes d'abord
  const [storedFilters, setFilters] = useLS("rf_recipes_filters", DEFAULT_FILTERS);
  // Fusion avec les défauts : robuste si DEFAULT_FILTERS gagne une clé après coup.
  const filters = useMemo(() => ({ ...DEFAULT_FILTERS, ...storedFilters }), [storedFilters]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [newCarnet, setNewCarnet] = useState(null); // { name, color, icon } ou null
  const [carnetMenu, setCarnetMenu] = useState(null); // carnet visé par l'appui long (modifier/supprimer)
  const [recipeMenu, setRecipeMenu] = useState(null); // recette visée par l'appui long / clic droit (modifier/supprimer)
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
  const lpTimer = useRef(null);
  const lpFired = useRef(false);
  // Appui long générique : ouvre un menu (callback) après 480 ms ; `lpFired` sert à
  // annuler le clic qui suit. Utilisé par les carnets ET les cartes recettes.
  const startLongPress = (onFire) => { lpFired.current = false; clearTimeout(lpTimer.current); lpTimer.current = setTimeout(() => { lpFired.current = true; onFire(); }, 480); };
  const cancelLongPress = () => clearTimeout(lpTimer.current);
  const [hideCarnets, setHideCarnets] = useState(() => {
    try { return localStorage.getItem("mijote_hideCarnets") === "1"; } catch { return false; }
  });
  const toggleCarnets = () => setHideCarnets(v => { const n = !v; try { localStorage.setItem("mijote_hideCarnets", n ? "1" : "0"); } catch { /* ignore */ } return n; });
  const sentinelRef = useRef(null);

  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  // Focus sans scroll : évite que la page « saute » quand le bottom-sheet s'ouvre.
  const focusNoScroll = useCallback(el => { if (el && typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches) el.focus({ preventScroll: true }); }, []);

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
    .sort((a, b) => sortBy === "name" ? a.name.localeCompare(b.name) : sortBy === "health" ? b.healthScore - a.healthScore : byRecent(a, b)),
  [recipes, search, filterCol, filters, sortBy, resolver, techniques, techIndex]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, filterCol, sortBy, filters]);
  // Carnet persisté mais supprimé depuis (autre session / appareil) → on nettoie le filtre.
  useEffect(() => { if (filterCol && !collections.some(c => c.id === filterCol)) setFilterCol(null); }, [filterCol, collections, setFilterCol]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(c => c + PAGE_SIZE); },
      { rootMargin: "240px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, filtered.length]);

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
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}><Icon name="search" size={16} color="var(--text3)" /></span>
          <input className="field-input" placeholder="Rechercher dans Mijoté" value={search} onChange={e => setSearch(e.target.value)}
            enterKeyHint="search"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
            style={{ paddingLeft: 38 }} />
          {search && <button onClick={() => setSearch("")} aria-label="Effacer la recherche" className="search-clear-btn" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}><Icon name="close" size={13} /></button>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {/* Un seul point d'entrée : la feuille « Tous les filtres » (tri + filtres) */}
          <button className="filter-btn" onClick={() => setFilterOpen(true)} title="Trier et filtrer" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 22, fontSize: 12.5, fontWeight: 600, background: nActiveFilters ? "rgba(232,112,58,0.16)" : "var(--surface2)", color: nActiveFilters ? "var(--accent)" : "var(--text2)", border: `1px solid ${nActiveFilters ? "rgba(232,112,58,0.5)" : "var(--border)"}` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Filtres
            {nActiveFilters > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{nActiveFilters}</span>}
          </button>
          <span style={{ fontSize: 12, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Trié par <strong style={{ color: "var(--text2)", fontWeight: 600 }}>{sortBy === "name" ? "A → Z" : sortBy === "health" ? "Santé" : "Récent"}</strong>
          </span>
        </div>
      </div>
      {filterOpen && (
        <SwipeableSheet onClose={() => { setFilterOpen(false); setEditingSmartId(null); }} hideHandle style={{ maxHeight: "90dvh", paddingTop: 0, paddingBottom: 0 }}>
          <RecipeFilterSheet filters={filters} setFilters={setFilters} sortBy={sortBy} setSortBy={setSortBy} usedCuisines={usedCuisines} ingredientDB={ingredientDB || []} resultCount={filtered.length} onClose={() => { setFilterOpen(false); setEditingSmartId(null); }}
            alreadySaved={!editingSmartId && collections.some(c => isSmart(c) && smartActive(c))}
            updatingCarnetName={editingSmartId ? collections.find(c => c.id === editingSmartId)?.name : null}
            onSaveAsCarnet={() => {
              if (editingSmartId) {
                setCollections(prev => prev.map(c => c.id === editingSmartId ? { ...c, filters: { ...DEFAULT_FILTERS, ...filters }, search: search.trim() } : c));
                setEditingSmartId(null); setFilterOpen(false);
              } else {
                setFilterOpen(false);
                setNewCarnet({ name: "", color: "#e8703a", icon: "📓", smart: true, filters: { ...filters }, search });
              }
            }} />
        </SwipeableSheet>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 20px" }}>
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
            <div className="collections-row" style={{ display: "flex", gap: 14, overflowX: "auto", padding: "7px 3px 8px" }}>
              {collections.map((col) => {
                const active = carnetActive(col);
                const count = countFor(col);
                return (
                <button key={col.id} className="notebook-card" data-active={active ? "1" : undefined}
                  onClick={() => { if (lpFired.current) { lpFired.current = false; return; } openCarnet(col); }}
                  onPointerDown={() => startLongPress(() => setCarnetMenu(col))} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress} onPointerCancel={cancelLongPress}
                  onContextMenu={(e) => { e.preventDefault(); setCarnetMenu(col); }}
                  draggable
                  onDragStart={() => { cancelLongPress(); setDragCarnetId(col.id); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (dragCarnetId && dragCarnetId !== col.id) reorderCollections(dragCarnetId, col.id); setDragCarnetId(null); }}
                  onDragEnd={() => setDragCarnetId(null)}
                  title="Glisser pour réordonner · appui long pour modifier"
                  style={{ flexShrink: 0, width: 134, padding: 0, border: "none", background: "transparent", cursor: "grab", borderRadius: 14, opacity: dragCarnetId === col.id ? 0.4 : 1 }}>
                  <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: active ? `0 8px 22px -10px ${col.color}, 0 0 0 2px ${col.color}` : "0 6px 16px -10px rgba(0,0,0,0.35)" }}>
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
            </div>
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
            Recettes <span style={{ color: "var(--text3)", fontWeight: 400, fontSize: 13 }}>({filtered.length})</span>
          </h2>
        </div>
        <div key={filterCol || "all"} className="recipe-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {filtered.slice(0, visibleCount).map((r, idx) => (
            <div key={r.id}
              onPointerDown={() => startLongPress(() => setRecipeMenu(r))} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress} onPointerCancel={cancelLongPress}
              onContextMenu={(e) => { e.preventDefault(); setRecipeMenu(r); }}>
              <RecipeCard recipe={r} onClick={() => { if (lpFired.current) { lpFired.current = false; return; } onSelect(r.id); }} inSeason={isRecipeInSeason(r, resolver)} vegan={isRecipeVegan(r, resolver, { recipes })} style={{ animationDelay: `${(idx % PAGE_SIZE) * 0.04}s` }} />
            </div>
          ))}
        </div>
        {visibleCount < filtered.length && (
          <div ref={sentinelRef} style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <div style={{ width: 22, height: 22, border: "2.5px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
          </div>
        )}
        {filtered.length === 0 && (
          <div style={{ minHeight: "48vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px", maxWidth: 400, margin: "0 auto" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Icon name="search" size={30} color="var(--text3)" />
            </div>
            <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Aucune recette trouvée</h3>
            <p style={{ fontSize: 13.5, color: "var(--text3)", lineHeight: 1.5, marginBottom: 18 }}>
              {search ? <>Rien ne correspond à « <strong style={{ color: "var(--text2)", fontWeight: 600 }}>{search}</strong> » dans ta bibliothèque.<br />Essaie un autre mot-clé ou ajuste tes filtres.</> : "Aucune recette ne correspond à ces filtres."}
            </p>
            {(search || nActiveFilters > 0 || filterCol) && (
              <button className="btn btn-ghost" style={{ padding: "9px 18px", borderRadius: 12, fontSize: 13.5 }} onClick={() => { setSearch(""); setFilters({ ...DEFAULT_FILTERS }); setFilterCol(null); }}>
                <Icon name="close" size={14} /> Réinitialiser
              </button>
            )}
          </div>
        )}
        </>
        )}
      </div>

      {/* Confirmation avant suppression (carnet ou recette) */}
      {confirmDelete && (
        <ConfirmSheet
          title={`Supprimer ${confirmDelete.kind === "carnet" ? "ce carnet" : "cette recette"} ?`}
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
        </ConfirmSheet>
      )}

      {/* Menu d'une recette (appui long / clic droit) : modifier / supprimer */}
      {recipeMenu && (
        <SwipeableSheet onClose={() => setRecipeMenu(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, overflow: "hidden", background: "var(--surface2)", display: "grid", placeItems: "center", fontSize: 20 }}>
              {recipeMenu.image ? <img src={recipeMenu.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (recipeMenu.isComponent ? "🧩" : "🍽️")}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recipeMenu.name}</div>
              <div style={{ fontSize: 12, color: "var(--text3)" }}>{recipeMenu.isComponent ? "Préparation de base" : "Recette"}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn btn-ghost" style={{ justifyContent: "flex-start" }} onClick={() => { onEditRecipe?.(recipeMenu); setRecipeMenu(null); }}>
              <Icon name="edit" size={16} /> Modifier
            </button>
            <button className="btn btn-danger" style={{ justifyContent: "flex-start" }} onClick={() => { setConfirmDelete({ kind: "recipe", item: recipeMenu }); setRecipeMenu(null); }}>
              <Icon name="trash" size={16} /> Supprimer
            </button>
          </div>
        </SwipeableSheet>
      )}

      {/* Menu d'un carnet (appui long) : modifier / supprimer */}
      {carnetMenu && (
        <SwipeableSheet onClose={() => setCarnetMenu(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: carnetMenu.color + "33", display: "grid", placeItems: "center", fontSize: 22 }}>{carnetMenu.icon || "📓"}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{carnetMenu.name}</div>
              <div style={{ fontSize: 12, color: "var(--text3)" }}>{isSmart(carnetMenu) ? "Carnet intelligent" : "Carnet"}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {collections.length > 1 && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} disabled={collections.findIndex(c => c.id === carnetMenu.id) === 0}
                  onClick={() => moveCarnet(carnetMenu.id, -1)}>
                  <Icon name="back" size={15} /> Vers la gauche
                </button>
                <button className="btn btn-ghost" style={{ flex: 1 }} disabled={collections.findIndex(c => c.id === carnetMenu.id) === collections.length - 1}
                  onClick={() => moveCarnet(carnetMenu.id, 1)}>
                  Vers la droite <Icon name="forward" size={15} />
                </button>
              </div>
            )}
            <button className="btn btn-ghost" style={{ justifyContent: "flex-start" }} onClick={() => { setNewCarnet({ ...carnetMenu, editing: true }); setCarnetMenu(null); }}>
              <Icon name="edit" size={16} /> Modifier
            </button>
            <button className="btn btn-danger" style={{ justifyContent: "flex-start" }} onClick={() => { setConfirmDelete({ kind: "carnet", item: carnetMenu }); setCarnetMenu(null); }}>
              <Icon name="trash" size={16} /> Supprimer
            </button>
          </div>
        </SwipeableSheet>
      )}

      {/* Création / modification d'un carnet */}
      {newCarnet && (
        <SwipeableSheet onClose={() => setNewCarnet(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{newCarnet.editing ? "Modifier le carnet" : newCarnet.smart ? "Enregistrer la vue" : "Nouveau carnet"}</h3>
          {newCarnet.smart && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 16, padding: "10px 12px", borderRadius: 12, background: "rgba(232,112,58,0.08)", border: "1px solid rgba(232,112,58,0.25)" }}>
              <Icon name="thinking" size={16} color="var(--accent)" />
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.45 }}>
                <strong style={{ color: "var(--text)" }}>Carnet intelligent</strong> : il applique tes filtres actuels
                {" "}({activeFilterCount(newCarnet.filters)} critère{activeFilterCount(newCarnet.filters) > 1 ? "s" : ""}{newCarnet.search?.trim() ? " + recherche" : ""})
                {" "}et se remplit tout seul : {recipes.reduce((n, r) => n + (carnetMatch({ kind: "smart", filters: newCarnet.filters, search: newCarnet.search }, r) ? 1 : 0), 0)} recette(s) pour l'instant.
              </div>
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <div className="field-label">Nom</div>
            <input className="field-input" placeholder={newCarnet.smart ? "ex: Desserts rapides" : "ex: Recettes de Mamie"} value={newCarnet.name} ref={focusNoScroll} onChange={e => setNewCarnet(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="field-label" style={{ marginBottom: 8 }}>Couleur</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {["#e8703a", "#f0c060", "#e05252", "#4caf7d", "#5b9cf6", "#c080e0", "#f0a875", "#9a9490"].map(c => (
              <button key={c} onClick={() => setNewCarnet(p => ({ ...p, color: c }))} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: `3px solid ${newCarnet.color === c ? "#fff" : "transparent"}`, boxShadow: newCarnet.color === c ? "0 0 0 2px " + c : "none", transition: "all 0.15s" }} />
            ))}
          </div>
          <div className="field-label" style={{ marginBottom: 8 }}>Icône</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {["🍽️", "🥗", "🍝", "🍰", "🥩", "🥦", "🥐", "🍜", "🍛", "🫕", "🥘", "🧁", "🍣", "🫙", "🥚", "🧀", "🫒", "🌮", "🍲"].map(ico => (
              <button key={ico} onClick={() => setNewCarnet(p => ({ ...p, icon: ico }))} style={{ width: 38, height: 38, borderRadius: 10, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", background: newCarnet.icon === ico ? newCarnet.color + "33" : "var(--surface2)", border: `2px solid ${newCarnet.icon === ico ? newCarnet.color : "var(--border)"}`, transition: "all 0.15s" }}>{ico}</button>
            ))}
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
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setNewCarnet(null)}>Annuler</button>
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
        </SwipeableSheet>
      )}
    </div>
  );
}
