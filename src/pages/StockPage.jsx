import { useState, useMemo } from "react";
import { Icon } from "../components/Icon.jsx";
import { EmptyArt } from "../components/EmptyArt.jsx";
import { LoadingSpinner } from "../components/LoadingSpinner.jsx";
import { IngImage } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { DEFAULT_CATEGORIES, sortedCategoryEntries, STOCK_CATEGORIES } from "../constants/categories.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";

// ─── STOCK TAB ────────────────────────────────────────────────────────────────
// Gestion binaire du stock (placards / étagères) : j'en ai / j'en ai pas.
// Chaque ingrédient de la base est listable ; le stock = tableau d'IDs.

/**
 * État vide centré et soigné (titre + texte + action), calqué sur l'état
 * « aucune recette » de la bibliothèque pour l'homogénéité. En tête, soit un
 * croquis animé « à l'encre » (`art`, prioritaire, comme les autres écrans),
 * soit à défaut une pastille d'icône.
 */
function StockEmpty({ icon, art, title, body, action }) {
  return (
    <div style={{ minHeight: "48vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, maxWidth: 380, margin: "0 auto" }}>
      {art ? (
        <EmptyArt name={art} size={116} style={{ marginBottom: 6 }} />
      ) : (
        <div style={{ width: 76, height: 76, borderRadius: 22, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, boxShadow: "0 8px 24px -16px rgba(0,0,0,0.35)" }}>
          <Icon name={icon} size={30} color="var(--accent)" />
        </div>
      )}
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 7 }}>{title}</h3>
      <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: action ? 22 : 0 }}>{body}</p>
      {action}
    </div>
  );
}

export function StockPage({ stock = [], setStock, lowStock = [], setLowStock, ingredientDB = [], categories = DEFAULT_CATEGORIES, loading = false }) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("all"); // "all" = tout | "stock" = ce que j'ai | "low" = à racheter

  const stockSet = useMemo(() => new Set(stock), [stock]);
  const lowSet = useMemo(() => new Set(lowStock), [lowStock]);

  // Cycle à 3 états : pas en stock → en stock → bientôt vide → pas en stock
  const cycle = (id) => {
    const inStock = stockSet.has(id), isLow = lowSet.has(id);
    if (!inStock) {
      setStock(prev => [...prev, id]);                       // → en stock
    } else if (!isLow) {
      setLowStock(prev => [...prev, id]);                    // → bientôt vide
    } else {
      setStock(prev => prev.filter(x => x !== id));          // → pas en stock
      setLowStock(prev => prev.filter(x => x !== id));
    }
  };

  // Tous les ingrédients stockables (catégories non-périssables, avec nom)
  const stockable = useMemo(() =>
    ingredientDB.filter(i => i.name && STOCK_CATEGORIES.has(i.category || "other")),
    [ingredientDB]);

  // Ingrédients filtrés par recherche + vue active (tous / en stock / à racheter)
  const filtered = useMemo(() => {
    const q = normalizeStr(search);
    const matchView = (i) =>
      view === "all" ? true : view === "stock" ? stockSet.has(i.id) : lowSet.has(i.id);
    return stockable
      .filter(i => matchView(i)
        && (!q || normalizeStr(i.name).includes(q) || (i.aliases || []).some(a => normalizeStr(a).includes(q))))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  }, [stockable, search, view, stockSet, lowSet]);

  // Regroupement par catégorie
  const grouped = useMemo(() => {
    const catOrder = sortedCategoryEntries(categories).map(([k]) => k);
    const map = new Map();
    for (const ing of filtered) {
      const key = ing.category || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ing);
    }
    return [...map.entries()].sort((a, b) => {
      const ia = catOrder.indexOf(a[0]), ib = catOrder.indexOf(b[0]);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [filtered, categories]);

  const inStockCount = stock.length;
  const { scrollRef, contentRef } = useElasticScroll();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Mon Stock</h1>
            
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserAvatar />
          </div>
        </div>

        {/* Recherche */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
            <Icon name="search" size={17} color="var(--text3)" />
          </span>
          <input className="field-input recipe-search" placeholder="Rechercher un ingrédient…" value={search} onChange={e => setSearch(e.target.value)}
            enterKeyHint="search" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
            style={{ paddingLeft: 44, paddingRight: search ? 40 : 16 }} />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Effacer la recherche" className="search-clear-btn" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
              <Icon name="close" size={13} />
            </button>
          )}
        </div>

        {/* Pills de filtre : tout ce qu'on peut chercher / ce que j'ai en stock */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[
            { key: "stock", label: "En stock", count: inStockCount },
            { key: "low", label: "Bientôt vide", count: lowStock.length },
            { key: "all", label: "Tous", count: stockable.length },
          ].map(p => {
            const active = view === p.key;
            return (
              <button key={p.key} onClick={() => setView(p.key)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                  background: active ? "var(--accent)" : "var(--surface)",
                  color: active ? "#fff" : "var(--text2)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                {p.label}
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: "1px 7px", borderRadius: 10,
                  background: active ? "rgba(255,255,255,0.25)" : "var(--surface3)",
                  color: active ? "#fff" : "var(--text3)",
                }}>{p.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Corps scrollable */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "0 20px 32px" }}>
        <div ref={contentRef} style={{ minHeight: "100%" }}>
        {ingredientDB.length === 0 && loading ? (
          // Base pas encore hydratée : spinner plutôt que « Base d'ingrédients vide ».
          <LoadingSpinner />
        ) : ingredientDB.length === 0 ? (
          <StockEmpty icon="box" title="Base d'ingrédients vide"
            body={<>Importe-la dans <strong style={{ color: "var(--text)", fontWeight: 600 }}>Config → Ingrédients</strong>.</>} />
        ) : filtered.length === 0 ? (() => {
          const q = search.trim();
          const qShort = q.length > 22 ? q.slice(0, 22) + "…" : q;
          if (q) {
            return (
              <StockEmpty art="bocal" title="Aucun ingrédient trouvé"
                body={<>Rien ne correspond à « <strong style={{ color: "var(--text)", fontWeight: 600 }}>{qShort}</strong> » dans ta base d'ingrédients.<br />Vérifie l'orthographe ou essaie un autre terme.</>}
                action={
                  <button onClick={() => setSearch("")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text3)" }}>
                    <Icon name="eraser" size={15} color="var(--text3)" /> Effacer la recherche
                  </button>
                } />
            );
          }
          const low = view === "low";
          return (
            <StockEmpty icon="box" art={low ? "liste" : undefined}
              title={low ? "Rien à racheter" : "Aucun article en stock"}
              body={low ? "Marque un ingrédient « bientôt vide » en tapant deux fois dessus." : "Ajoute des ingrédients depuis l'onglet « Tous »."}
              action={
                <button className="btn btn-primary btn-pill" style={{ fontSize: 14 }} onClick={() => setView("all")}>
                  <Icon name="box" size={15} color="#fff" /> Voir tous les ingrédients
                </button>
              } />
          );
        })() : (
          grouped.map(([catKey, ings]) => {
            const cat = categories[catKey] || DEFAULT_CATEGORIES.other;
            const inStockInCat = ings.filter(i => stockSet.has(i.id)).length;
            const lowInCat = ings.filter(i => lowSet.has(i.id)).length;
            return (
              <div key={catKey} style={{ marginBottom: 24 }}>
                {/* En-tête catégorie */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "4px 0" }}>
                  <span style={{ fontSize: 15 }}>{cat.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)", letterSpacing: "0.01em" }}>{cat.label}</span>
                  {view === "all" && inStockInCat > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "rgba(var(--green-rgb),0.15)", color: "var(--green)" }}>
                      {inStockInCat}/{ings.length}
                    </span>
                  )}
                  {lowInCat > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "rgba(var(--accent-rgb),0.15)", color: "var(--accent)" }}>
                      {lowInCat} bientôt vide
                    </span>
                  )}
                </div>

                {/* Grille d'ingrédients */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                  {ings.map((ing, i) => {
                    const has = stockSet.has(ing.id);
                    const low = lowSet.has(ing.id);
                    // Couleurs selon l'état : bientôt vide (orange) > en stock (vert) > absent
                    const accentCol = low ? "var(--accent)" : "var(--green)";
                    const borderCol = low ? "rgba(var(--accent-rgb),0.6)" : has ? "rgba(var(--green-rgb),0.6)" : "var(--border)";
                    const bgCol = low ? "rgba(var(--accent-rgb),0.10)" : has ? "rgba(var(--green-rgb),0.10)" : "var(--surface)";
                    return (
                      <button
                        key={ing.id}
                        onClick={() => cycle(ing.id)}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                          padding: "10px 6px 8px",
                          borderRadius: 14,
                          border: `1.5px solid ${borderCol}`,
                          background: bgCol,
                          cursor: "pointer",
                          transition: "background 0.55s cubic-bezier(0.4,0,0.2,1), border-color 0.55s cubic-bezier(0.4,0,0.2,1), color 0.35s ease",
                          position: "relative",
                          // Arrivée échelonnée des cards (plafonnée pour rester fluide)
                          animation: "stockCardIn 0.4s cubic-bezier(0.25,0.46,0.45,0.94) both",
                          animationDelay: `${Math.min(i, 14) * 0.025}s`,
                        }}
                      >
                        {/* Badge d'état : ⚠ bientôt vide / ✓ en stock */}
                        {has && (
                          <span style={{
                            position: "absolute", top: 6, right: 6,
                            width: 16, height: 16, borderRadius: "50%",
                            background: accentCol, display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "background 0.55s cubic-bezier(0.4,0,0.2,1)",
                            animation: "popIn 0.32s cubic-bezier(0.25,0.46,0.45,0.94) both",
                          }}>
                            <Icon name={low ? "warning" : "check"} size={low ? 10 : 9} color="#fff" />
                          </span>
                        )}
                        <IngImage src={ing.image} alt={ing.name} size={44} style={{ borderRadius: 10, opacity: has ? 1 : 0.65, transition: "opacity 0.35s ease" }} />
                        <span style={{
                          fontSize: 11, fontWeight: 400,
                          color: has ? accentCol : "var(--text2)",
                          textAlign: "center", lineHeight: 1.3,
                          height: "2.6em", // 2 lignes réservées : hauteur constante quel que soit le poids
                          transition: "color 0.35s ease",
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                          {ing.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>
    </div>
  );
}
