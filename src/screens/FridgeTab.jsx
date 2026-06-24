import { useState, useMemo } from "react";
import { Icon } from "../components/Icon.jsx";
import { BaseIcon } from "../components/BaseIcon.jsx";
import { IngImage } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { normalizeStr } from "../lib/parseIngredient.js";
import { DEFAULT_CATEGORIES, sortedCategoryEntries } from "../constants/categories.js";

// ─── STOCK TAB ────────────────────────────────────────────────────────────────
// Gestion binaire du stock (placards / étagères) : j'en ai / j'en ai pas.
// Chaque ingrédient de la base est listable ; le stock = tableau d'IDs.

// Catégories non-périssables stockables en placard (clés techniques explicites,
// indépendantes de l'ordre d'affichage). Les produits frais (légumes, fruits,
// laitiers, herbes, champignons, viandes, poissons) sont volontairement exclus.
const STOCK_CATEGORIES = new Set([
  "legume", "grain", "oil", "acid", "sauce", "condiment",
  "nuts_seeds", "sugar", "baking", "alcohol", "other",
]);
export function FridgeTab({ stock = [], setStock, lowStock = [], setLowStock, ingredientDB = [], categories = DEFAULT_CATEGORIES, components = [] }) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("all"); // "all" = tout | "stock" = ce que j'ai | "low" = à racheter

  const stockSet = useMemo(() => new Set(stock), [stock]);
  const lowSet = useMemo(() => new Set(lowStock), [lowStock]);

  // Toggle binaire pour les préparations (composants) : en stock / pas en stock
  const toggleComp = (id) => {
    if (stockSet.has(id)) {
      setStock(prev => prev.filter(x => x !== id));
    } else {
      setStock(prev => [...prev, id]);
    }
  };

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

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Mon Stock</h1>
            <span className="app-brand" style={{ fontSize: 11, fontWeight: 500, color: "var(--text3)", letterSpacing: "0.04em", fontFamily: "var(--ff-body)" }}>Mijoté<span style={{ color: "var(--accent)" }}>·</span> <span style={{ opacity: 0.5 }}>{`v${__APP_VERSION__}`}</span></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserAvatar />
          </div>
        </div>

        {/* Recherche */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
            <Icon name="search" size={16} color="var(--text3)" />
          </span>
          <input className="field-input" placeholder="Rechercher un ingrédient…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Effacer la recherche" className="search-clear-btn" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}>
              <Icon name="close" size={13} />
            </button>
          )}
        </div>

        {/* Pills de filtre : tout ce qu'on peut chercher / ce que j'ai en stock */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
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
                  padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500,
                  background: active ? "var(--accent)" : "var(--surface2)",
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
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 32px" }}>
        {ingredientDB.length === 0 ? (
          <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text3)", gap: 12, padding: "0 40px", textAlign: "center" }}>
            <Icon name="box" size={44} />
            <p style={{ fontSize: 15, fontWeight: 500 }}>Base d'ingrédients vide</p>
            <p style={{ fontSize: 13 }}>Importe-la dans Config → Ingrédients.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text3)", gap: 12, padding: "0 40px", textAlign: "center" }}>
            <Icon name={!search && view === "low" ? "warning" : !search && view === "stock" ? "box" : "search"} size={44} />
            <p style={{ fontSize: 15, fontWeight: 500 }}>
              {!search && view === "low" ? "Rien à racheter" : !search && view === "stock" ? "Aucun article en stock" : "Aucun ingrédient trouvé"}
            </p>
            <p style={{ fontSize: 13 }}>
              {!search && view === "low" ? "Marque un ingrédient « bientôt vide » en tapant deux fois dessus." : !search && view === "stock" ? "Ajoute des ingrédients depuis l'onglet « Tous »." : "Essaie un autre terme de recherche."}
            </p>
          </div>
        ) : (
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
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "rgba(76,175,125,0.15)", color: "var(--green)" }}>
                      {inStockInCat}/{ings.length}
                    </span>
                  )}
                  {lowInCat > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "rgba(232,112,58,0.15)", color: "var(--accent)" }}>
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
                    const borderCol = low ? "rgba(232,112,58,0.6)" : has ? "rgba(76,175,125,0.6)" : "var(--border)";
                    const bgCol = low ? "rgba(232,112,58,0.10)" : has ? "rgba(76,175,125,0.10)" : "var(--surface)";
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

        {/* ── Section Préparations (toujours visible) ──────────────────────── */}
        <div style={{ marginTop: grouped.length > 0 || filtered.length === 0 ? 32 : 0, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ display: "flex", alignItems: "center" }}><BaseIcon size={16} color="var(--text2)" /></span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)", letterSpacing: "0.01em" }}>Mes Bases</span>
            {components.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "rgba(76,175,125,0.15)", color: "var(--green)" }}>
                {components.filter(c => stockSet.has(c.id)).length}/{components.length}
              </span>
            )}
          </div>
          {components.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.5 }}>
              Crée une base dans la bibliothèque pour l'afficher ici.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {components.map((comp, i) => {
                const has = stockSet.has(comp.id);
                return (
                  <button
                    key={comp.id}
                    onClick={() => toggleComp(comp.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px",
                      borderRadius: 14,
                      border: `1.5px solid ${has ? "rgba(76,175,125,0.6)" : "var(--border)"}`,
                      background: has ? "rgba(76,175,125,0.10)" : "var(--surface)",
                      cursor: "pointer", textAlign: "left",
                      transition: "background 0.35s ease, border-color 0.35s ease",
                      animation: "stockCardIn 0.4s cubic-bezier(0.25,0.46,0.45,0.94) both",
                      animationDelay: `${Math.min(i, 10) * 0.04}s`,
                    }}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: has ? "var(--green)" : "var(--surface3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background 0.35s ease",
                    }}>
                      <Icon name={has ? "check" : "close"} size={13} color={has ? "#fff" : "var(--text3)"} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: has ? "var(--green)" : "var(--text1)", transition: "color 0.35s ease", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {comp.name}
                      </div>
                      {comp.yield && (
                        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                          Rendement : {comp.yield.amount} {comp.yield.unit}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: has ? "var(--green)" : "var(--text3)", flexShrink: 0 }}>
                      {has ? "Disponible" : "Épuisée"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
