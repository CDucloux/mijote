import { useState, useEffect, useRef, useMemo } from "react";
import { Icon } from "../components/Icon.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { RecipeCard } from "../components/RecipeCard.jsx";
import { normalizeStr } from "../lib/parseIngredient.js";
import { createIngredientResolver } from "../lib/nameMatcher.js";
import { isRecipeInSeason } from "../lib/seasonality.js";

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 8;

export function HomeTab({ recipes, collections, ingredientDB, onSelect, onNewRecipe, setCollections }) {
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState(null);
  const [filterCol, setFilterCol] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [seasonOnly, setSeasonOnly] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);

  const allTags = [...new Set(recipes.flatMap(r => r.tags || []))];
  const filtered = recipes
    .filter(r => {
      // Plats et bases cohabitent dans la même grille ; le badge en coin les distingue.
      if (search) {
        const q = normalizeStr(search);
        const inName = normalizeStr(r.name).includes(q);
        const inTags = r.tags?.some(t => normalizeStr(t).includes(q));
        const inIngredients = r.ingredients?.some(i => normalizeStr(i.name).includes(q));
        if (!inName && !inTags && !inIngredients) return false;
      }
      if (filterTag && !r.tags?.includes(filterTag)) return false;
      if (filterCol && !r.collections?.includes(filterCol)) return false;
      if (seasonOnly && !isRecipeInSeason(r, resolver)) return false;
      return true;
    })
    .sort((a, b) => sortBy === "name" ? a.name.localeCompare(b.name) : sortBy === "health" ? b.healthScore - a.healthScore : new Date(b.createdAt) - new Date(a.createdAt));

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, filterTag, filterCol, sortBy, seasonOnly]);

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
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Mes Recettes</h1><span className="app-brand" style={{ fontSize: 11, fontWeight: 500, color: "var(--text3)", letterSpacing: "0.04em", fontFamily: "var(--ff-body)" }}>Mijoté<span style={{ color: "var(--accent)" }}>·</span> <span style={{ opacity: 0.5 }}>{`v${__APP_VERSION__}`}</span></span></div>
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
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14, marginBottom: 2 }}>
          {["name", "health", "date"].map(s => (
            <button key={s} onClick={() => setSortBy(s)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: sortBy === s ? "var(--accent)" : "var(--surface2)", color: sortBy === s ? "#fff" : "var(--text2)", border: `1px solid ${sortBy === s ? "transparent" : "var(--border)"}` }}>
              {s === "name" ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, lineHeight: 1 }}>A<span style={{ fontSize: 9, position: "relative", top: "-1px", margin: "0 1px" }}>→</span>Z</span> : s === "health" ? "Santé" : "Récent"}
            </button>
          ))}
          <button onClick={() => setSeasonOnly(s => !s)} title="Recettes de saison ce mois-ci" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: seasonOnly ? "rgba(76,175,125,0.18)" : "var(--surface2)", color: seasonOnly ? "var(--green)" : "var(--text2)", border: `1px solid ${seasonOnly ? "rgba(76,175,125,0.5)" : "var(--border)"}` }}>
            De saison
          </button>
          {allTags.length > 0 && <div style={{ width: 1, background: "var(--border)", flexShrink: 0 }} />}
          {allTags.length > 0 && (
            <button onClick={() => { setShowTags(v => { if (v) setFilterTag(null); return !v; }); }} title={showTags ? "Masquer les tags" : "Afficher les tags"} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: showTags ? "var(--surface3)" : "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: 14, lineHeight: 1, fontWeight: 400 }}>{showTags ? "−" : "+"}</span> Tags
            </button>
          )}
          <div style={{ display: "flex", gap: 6, flexShrink: 0, maxWidth: showTags ? 2000 : 0, opacity: showTags ? 1 : 0, overflow: "hidden", transition: "max-width 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease" }}>
            {allTags.map(t => (
              <button key={t} onClick={() => setFilterTag(filterTag === t ? null : t)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: filterTag === t ? "rgba(232,112,58,0.2)" : "var(--surface2)", color: filterTag === t ? "var(--accent)" : "var(--text2)", border: `1px solid ${filterTag === t ? "rgba(232,112,58,0.5)" : "var(--border)"}` }}>{t}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
        {!search && !filterTag && !filterCol && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Carnets</h2>
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
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
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
    </div>
  );
}
