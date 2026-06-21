import { useState, useEffect, useRef } from "react";
import { Icon } from "../components/Icon.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { RecipeCard } from "../components/RecipeCard.jsx";
import { normalizeStr } from "../lib/parseIngredient.js";

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 8;

export function HomeTab({ recipes, collections, ingredientDB, onSelect, onNewRecipe, setCollections, user, syncStatus, onSignOut, isDark, onToggleTheme }) {
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState(null);
  const [filterCol, setFilterCol] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  const allTags = [...new Set(recipes.flatMap(r => r.tags || []))];
  const filtered = recipes
    .filter(r => {
      if (search) {
        const q = normalizeStr(search);
        const inName = normalizeStr(r.name).includes(q);
        const inTags = r.tags?.some(t => normalizeStr(t).includes(q));
        const inIngredients = r.ingredients?.some(i => normalizeStr(i.name).includes(q));
        if (!inName && !inTags && !inIngredients) return false;
      }
      if (filterTag && !r.tags?.includes(filterTag)) return false;
      if (filterCol && !r.collections?.includes(filterCol)) return false;
      return true;
    })
    .sort((a, b) => sortBy === "name" ? a.name.localeCompare(b.name) : sortBy === "health" ? b.healthScore - a.healthScore : new Date(b.createdAt) - new Date(a.createdAt));

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, filterTag, filterCol, sortBy]);

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
            <UserAvatar user={user} syncStatus={syncStatus} onSignOut={onSignOut} isDark={isDark} onToggleTheme={onToggleTheme} />
          </div>
        </div>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}><Icon name="search" size={16} color="var(--text3)" /></span>
          <input className="field-input" placeholder="Rechercher dans Mijoté" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text3)" }}><Icon name="close" size={14} /></button>}
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
          {["name", "health", "date"].map(s => (
            <button key={s} onClick={() => setSortBy(s)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: sortBy === s ? "var(--accent)" : "var(--surface2)", color: sortBy === s ? "#fff" : "var(--text2)", border: `1px solid ${sortBy === s ? "transparent" : "var(--border)"}` }}>
              {s === "name" ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, lineHeight: 1 }}>A<span style={{ fontSize: 9, position: "relative", top: "-1px", margin: "0 1px" }}>→</span>Z</span> : s === "health" ? "Santé" : "Récent"}
            </button>
          ))}
          {allTags.length > 0 && <div style={{ width: 1, background: "var(--border)", flexShrink: 0 }} />}
          {allTags.map(t => (
            <button key={t} onClick={() => setFilterTag(filterTag === t ? null : t)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: filterTag === t ? "rgba(232,112,58,0.2)" : "var(--surface2)", color: filterTag === t ? "var(--accent)" : "var(--text2)", border: `1px solid ${filterTag === t ? "rgba(232,112,58,0.5)" : "var(--border)"}` }}>{t}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
        {!search && !filterTag && !filterCol && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Collections</h2>
            <div className="collections-row" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {collections.map((col, i) => (
                <button key={col.id} onClick={() => setFilterCol(filterCol === col.id ? null : col.id)} style={{ flexShrink: 0, width: 120, background: filterCol === col.id ? "rgba(232,112,58,0.15)" : "var(--surface)", border: `1px solid ${filterCol === col.id ? "rgba(232,112,58,0.4)" : "var(--border)"}`, borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ aspectRatio: "3/2", position: "relative", background: col.color + "33", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <span style={{ fontSize: 26, lineHeight: 1 }}>{col.icon || "📁"}</span>
                    <div style={{ position: "absolute", top: 6, right: 6, minWidth: 20, height: 20, borderRadius: 10, background: col.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", padding: "0 5px" }}>{col.count}</div>
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, textAlign: "left" }}>{col.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)", textAlign: "left" }}>{col.count} recettes</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            Recettes <span style={{ color: "var(--text3)", fontWeight: 400, fontSize: 13 }}>({filtered.length})</span>
            {(() => { const ac = collections.find(c => c.id === filterCol); return ac ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: ac.color + "22", color: ac.color, border: `1px solid ${ac.color}55`, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 13, lineHeight: 1 }}>{ac.icon || "📁"}</span>{ac.name}
              </span>
            ) : null; })()}
          </h2>
          {filterCol && <button onClick={() => setFilterCol(null)} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}><Icon name="close" size={13} color="var(--accent)" /> Quitter la collection</button>}
        </div>
        <div key={filterCol || "all"} className="recipe-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {filtered.slice(0, visibleCount).map((r, idx) => <RecipeCard key={r.id} recipe={r} onClick={() => onSelect(r.id)} style={{ animationDelay: `${(idx % PAGE_SIZE) * 0.04}s` }} />)}
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
