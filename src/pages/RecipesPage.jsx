import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Icon } from "../components/Icon.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { RecipeCard } from "../components/RecipeCard.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { CUISINES } from "../constants/cuisines.js";
import { normalizeStr } from "../lib/parseIngredient.js";
import { createIngredientResolver } from "../lib/nameMatcher.js";
import { isRecipeInSeason } from "../lib/seasonality.js";

// ─── RECIPE TAB (Mes Recettes) ────────────────────────────────────────────────
const PAGE_SIZE = 8;

export function RecipesPage({ recipes, collections, ingredientDB, onSelect, onNewRecipe, setCollections }) {
  const [search, setSearch] = useState("");
  const [filterCuisine, setFilterCuisine] = useState(null);
  const [filterCol, setFilterCol] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [seasonOnly, setSeasonOnly] = useState(false);
  const [showCuisines, setShowCuisines] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [newCarnet, setNewCarnet] = useState(null); // { name, color, icon } ou null
  const [hideCarnets, setHideCarnets] = useState(() => {
    try { return localStorage.getItem("mijote_hideCarnets") === "1"; } catch { return false; }
  });
  const toggleCarnets = () => setHideCarnets(v => { const n = !v; try { localStorage.setItem("mijote_hideCarnets", n ? "1" : "0"); } catch { /* ignore */ } return n; });
  const sentinelRef = useRef(null);

  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  // Focus sans scroll : évite que la page « saute » quand le bottom-sheet s'ouvre.
  const focusNoScroll = useCallback(el => el?.focus({ preventScroll: true }), []);

  // Styles de cuisine réellement utilisés, dans l'ordre canonique de la liste.
  const usedCuisines = CUISINES.filter(c => recipes.some(r => r.cuisine === c.label));
  const filtered = recipes
    .filter(r => {
      // Plats et bases cohabitent dans la même grille ; le badge en coin les distingue.
      if (search) {
        const q = normalizeStr(search);
        const inName = normalizeStr(r.name).includes(q);
        const inCuisine = r.cuisine && normalizeStr(r.cuisine).includes(q);
        const inIngredients = r.ingredients?.some(i => normalizeStr(i.name).includes(q));
        if (!inName && !inCuisine && !inIngredients) return false;
      }
      if (filterCuisine && r.cuisine !== filterCuisine) return false;
      if (filterCol && !r.collections?.includes(filterCol)) return false;
      if (seasonOnly && !isRecipeInSeason(r, resolver)) return false;
      return true;
    })
    .sort((a, b) => sortBy === "name" ? a.name.localeCompare(b.name) : sortBy === "health" ? b.healthScore - a.healthScore : new Date(b.createdAt) - new Date(a.createdAt));

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, filterCuisine, filterCol, sortBy, seasonOnly]);

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
            <button className="btn btn-primary" style={{ padding: "8px 14px", borderRadius: 12 }} onClick={onNewRecipe}><Icon name="plus" size={16} /> Nouvelle</button>
            <UserAvatar />
          </div>
        </div>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}><Icon name="search" size={16} color="var(--text3)" /></span>
          <input className="field-input" placeholder="Rechercher dans Mijoté" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
          {search && <button onClick={() => setSearch("")} aria-label="Effacer la recherche" className="search-clear-btn" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}><Icon name="close" size={13} /></button>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 2 }}>
          {/* Tri — segmented control (« choisis-en un ») pour le distinguer des filtres */}
          <div style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 2, padding: 2, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 20 }}>
            <span title="Trier" aria-label="Trier" style={{ display: "inline-flex", padding: "0 5px 0 7px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {/* Barres décroissantes = ordre + flèche = direction du tri */}
                <path d="M4 7h11M4 12h7M4 17h4" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" />
                <path d="M19 5v13" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m16 15 3 3 3-3" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {["name", "health", "date"].map(s => (
              <button key={s} onClick={() => setSortBy(s)} style={{ flexShrink: 0, padding: "4px 11px", borderRadius: 16, fontSize: 12, fontWeight: 600, background: sortBy === s ? "var(--accent)" : "transparent", color: sortBy === s ? "#fff" : "var(--text2)", border: "none" }}>
                {s === "name" ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, lineHeight: 1 }}>A<span style={{ fontSize: 9, position: "relative", top: "-1px", margin: "0 1px" }}>→</span>Z</span> : s === "health" ? "Santé" : "Récent"}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />
          {/* Filtres — puces indépendantes (activables/désactivables) */}
          <button onClick={() => setSeasonOnly(s => !s)} title="Recettes de saison ce mois-ci" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: seasonOnly ? "rgba(76,175,125,0.18)" : "var(--surface2)", color: seasonOnly ? "var(--green)" : "var(--text2)", border: `1px solid ${seasonOnly ? "rgba(76,175,125,0.5)" : "var(--border)"}` }}>
            <Icon name="leaf" size={13} color={seasonOnly ? "var(--green)" : "var(--text3)"} /> De saison
          </button>
          {usedCuisines.length > 0 && (
            <button onClick={() => { setShowCuisines(v => { if (v) setFilterCuisine(null); return !v; }); }} title={showCuisines ? "Masquer les styles" : "Filtrer par style de cuisine"} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: showCuisines ? "var(--surface3)" : "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: 14, lineHeight: 1, fontWeight: 400 }}>{showCuisines ? "−" : "+"}</span> Cuisine
            </button>
          )}
          <div style={{ display: "flex", gap: 6, flexShrink: 0, maxWidth: showCuisines ? 2000 : 0, opacity: showCuisines ? 1 : 0, overflow: "hidden", transition: "max-width 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease" }}>
            {usedCuisines.map(c => (
              <button key={c.label} onClick={() => setFilterCuisine(filterCuisine === c.label ? null : c.label)} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: filterCuisine === c.label ? "rgba(232,112,58,0.2)" : "var(--surface2)", color: filterCuisine === c.label ? "var(--accent)" : "var(--text2)", border: `1px solid ${filterCuisine === c.label ? "rgba(232,112,58,0.5)" : "var(--border)"}` }}><span style={{ fontSize: 13, lineHeight: 1 }}>{c.emoji}</span>{c.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 20px" }}>
        {!search && !filterCuisine && !filterCol && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Carnets</h2>
              <button onClick={toggleCarnets} title={hideCarnets ? "Afficher les carnets" : "Masquer les carnets"} aria-label={hideCarnets ? "Afficher les carnets" : "Masquer les carnets"} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "transparent", border: "none", color: "var(--text3)", cursor: "pointer" }}>
                <Icon name={hideCarnets ? "eyeOff" : "eye"} size={16} color="var(--text3)" />
              </button>
            </div>
            {!hideCarnets && (
            <div className="collections-row" style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 6 }}>
              {collections.map((col) => {
                const active = filterCol === col.id;
                const count = col.count || 0;
                return (
                <button key={col.id} className="notebook-card" data-active={active ? "1" : undefined} onClick={() => setFilterCol(active ? null : col.id)} style={{ flexShrink: 0, width: 134, padding: 0, border: "none", background: "transparent", cursor: "pointer", borderRadius: 14 }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, display: "flex", alignItems: "baseline", gap: 6 }}>
              Recettes <span style={{ color: "var(--text3)", fontWeight: 400, fontSize: 13 }}>({filtered.length})</span>
            </h2>
            {filterCol && (() => { const ac = collections.find(c => c.id === filterCol); return ac ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: ac.color + "22", color: ac.color, border: `1px solid ${ac.color}55`, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 13, lineHeight: 1 }}>{ac.icon || "📓"}</span>{ac.name}
              </span>
            ) : null; })()}
          </div>
          {filterCol && (
            <button onClick={() => setFilterCol(null)} title="Revenir à toutes les recettes" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px 6px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)", cursor: "pointer", transition: "background 0.15s" }}>
              <Icon name="back" size={14} color="var(--text2)" /> Retour
            </button>
          )}
        </div>
        <div key={filterCol || "all"} className="recipe-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {filtered.slice(0, visibleCount).map((r, idx) => <RecipeCard key={r.id} recipe={r} onClick={() => onSelect(r.id)} inSeason={isRecipeInSeason(r, resolver)} style={{ animationDelay: `${(idx % PAGE_SIZE) * 0.04}s` }} />)}
        </div>
        {visibleCount < filtered.length && (
          <div ref={sentinelRef} style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <div style={{ width: 22, height: 22, border: "2.5px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
          </div>
        )}
        {filtered.length === 0 && <div style={{ textAlign: "center", color: "var(--text3)", padding: "40px 0" }}><Icon name="search" size={32} /><br /><span style={{ fontSize: 14, marginTop: 8, display: "block" }}>Aucune recette trouvée</span></div>}
      </div>

      {/* Création rapide d'un carnet (mêmes pickers que Config) */}
      {newCarnet && (
        <SwipeableSheet onClose={() => setNewCarnet(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Nouveau carnet</h3>
          <div style={{ marginBottom: 12 }}>
            <div className="field-label">Nom</div>
            <input className="field-input" placeholder="ex: Plats végétariens" value={newCarnet.name} ref={focusNoScroll} onChange={e => setNewCarnet(p => ({ ...p, name: e.target.value }))} />
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
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setNewCarnet(null)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
              if (!newCarnet.name.trim()) return;
              setCollections(prev => [...prev, { ...newCarnet, name: newCarnet.name.trim(), id: "c" + Date.now(), count: 0 }]);
              setNewCarnet(null);
            }}>Créer</button>
          </div>
        </SwipeableSheet>
      )}
    </div>
  );
}
