import { useState, useMemo, useRef, useEffect, useCallback, memo } from "react";
import { Icon } from "../components/Icon.jsx";
import { EmptyArt } from "../components/EmptyArt.jsx";
import { LoadingSpinner } from "../components/LoadingSpinner.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { DEFAULT_CATEGORIES, sortedCategoryEntries, STOCK_CATEGORIES } from "../constants/categories.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";

// ─── STOCK TAB ────────────────────────────────────────────────────────────────
// Gestion binaire du stock présentée en « mur d'étagères » : chaque ingrédient est
// un bocal en verre posé sur une planche. La SIGNATURE : le niveau de remplissage
// du bocal EST l'état (vide = à racheter, quart = bientôt vide, plein = en stock).
// Le modèle de données reste un simple tableau d'IDs ; seul le rendu change.

// Palette de contenus (fond du bocal quand l'image est absente/transparente) :
// tons chauds « garde-manger », choisis déterministiquement par ingrédient.
const STK_FILL = ["#cdb98a", "#c9a15c", "#b98c4a", "#a6743a", "#8f6b3f", "#7d5a34", "#c7b552", "#9aa15a", "#b5773f", "#d3a86a"];

/** Couleur de contenu stable pour un ingrédient (hash simple -> palette chaude). */
function stkFillColor(seed) {
  const s = String(seed || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return STK_FILL[h % STK_FILL.length];
}

const STATE_LABEL = { full: "en stock", low: "bientôt vide", empty: "à racheter" };

/** Découpe un tableau en rangées de `n` éléments (une rangée = une planche). */
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Un bocal. Mémoïsé sur `(ing, state, onCycle)` : toggler un bocal ne re-rend que
 * lui, pas les 139. Le niveau de remplissage est piloté en CSS par `data-state`.
 */
const Jar = memo(function Jar({ ing, state, onCycle }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <button
      className="stk-jar"
      data-state={state}
      onClick={() => onCycle(ing.id)}
      style={{ "--fill": stkFillColor(ing.dbId || ing.id) }}
      aria-label={`${ing.name} — ${STATE_LABEL[state]}`}
    >
      <span className="stk-lid" aria-hidden="true" />
      <span className="stk-glass">
        <span className="stk-fill">
          {ing.image && !imgErr && (
            <img className="stk-fill-img" src={ing.image} alt="" loading="lazy" decoding="async"
              referrerPolicy="no-referrer" onError={() => setImgErr(true)} />
          )}
        </span>
        <span className="stk-gloss" aria-hidden="true" />
        <span className="stk-label"><span>{ing.name}</span></span>
      </span>
      {state !== "empty" && (
        <span className="stk-badge" data-state={state}>
          <Icon name={state === "low" ? "warning" : "check"} size={state === "low" ? 12 : 11} color="#fff" />
        </span>
      )}
    </button>
  );
}, (a, b) => a.state === b.state && a.ing === b.ing && a.onCycle === b.onCycle);

/** Équerre en fer (support de planche), décalée du bord (cf. .stk-bracket). */
function ShelfBracket({ side }) {
  return (
    <svg className={`stk-bracket ${side}`} viewBox="0 0 26 32" fill="none" aria-hidden="true">
      <path d="M2 1h13a1 1 0 0 1 .8 1.6L3.6 30.4A1 1 0 0 1 1.7 30V2a1 1 0 0 1 1-1Z" fill="var(--iron)" />
      <path d="M4 4h8L4 22V4Z" fill="rgba(255,255,255,.06)" />
      <circle cx="6" cy="5.5" r="1.1" fill="var(--iron-hi)" />
    </svg>
  );
}

/** Fioriture unique : un brin d'eucalyptus en bout de rayon (décoratif). */
function ShelfSprig() {
  return (
    <svg className="stk-sprig" viewBox="0 0 54 78" aria-hidden="true">
      <path d="M40 78 C36 55 34 40 33 22" stroke="#5a7d3e" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <g fill="#7fa155">
        <ellipse cx="26" cy="30" rx="8" ry="4.6" transform="rotate(-32 26 30)" />
        <ellipse cx="41" cy="34" rx="8" ry="4.6" transform="rotate(28 41 34)" />
        <ellipse cx="24" cy="44" rx="7.5" ry="4.4" transform="rotate(-30 24 44)" />
        <ellipse cx="40" cy="49" rx="7.5" ry="4.4" transform="rotate(26 40 49)" />
        <ellipse cx="27" cy="59" rx="6.6" ry="4" transform="rotate(-26 27 59)" />
      </g>
      <g fill="#9cbb73">
        <ellipse cx="24" cy="24" rx="5.5" ry="3.2" transform="rotate(-34 24 24)" />
        <ellipse cx="34" cy="19" rx="5" ry="3" transform="rotate(-4 34 19)" />
      </g>
    </svg>
  );
}

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
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 7 }}>{title}</h3>
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

  // Cycle à 3 états : pas en stock → en stock → bientôt vide → pas en stock.
  // Lecture de l'état courant via refs pour garder `cycle` stable (mémoïsation des
  // bocaux) ; comportement identique à un accès direct à stock/lowStock.
  const stockRef = useRef(stock);
  const lowRef = useRef(lowStock);
  useEffect(() => { stockRef.current = stock; lowRef.current = lowStock; }, [stock, lowStock]);
  const cycle = useCallback((id) => {
    const inStock = stockRef.current.includes(id);
    const isLow = lowRef.current.includes(id);
    if (!inStock) {
      setStock(prev => [...prev, id]);                       // → en stock
    } else if (!isLow) {
      setLowStock(prev => [...prev, id]);                    // → bientôt vide
    } else {
      setStock(prev => prev.filter(x => x !== id));          // → pas en stock
      setLowStock(prev => prev.filter(x => x !== id));
    }
  }, [setStock, setLowStock]);

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

  // Largeur utile du mur -> nombre de bocaux par planche (une planche = une rangée).
  const [wallW, setWallW] = useState(0);
  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width;
      if (w) setWallW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [contentRef]);

  const perRow = useMemo(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
    const mobile = vw <= 620;
    const jarW = mobile ? 96 : 116;
    const gap = mobile ? 14 : 22;
    const sidePad = mobile ? 8 : 14; // padding horizontal de .stk-jars
    const inner = (wallW || vw - 40) - sidePad * 2;
    return Math.max(1, Math.floor((inner + gap - 2) / (jarW + gap)));
  }, [wallW]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête (sur le fond crème, hors du mur) */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Mon Stock</h1>
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

      {/* Corps scrollable : le fond chaud du mur est le fond de ce conteneur */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div ref={contentRef} className="stk-wall" style={{ minHeight: "100%" }}>
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
            const rows = chunk(ings, perRow);
            return (
              <div key={catKey} className="stk-group">
                {/* Étiquette de rayon */}
                <div className="stk-tag">
                  <span className="ico">{cat.icon}</span>
                  {cat.label}
                  {view === "all" && inStockInCat > 0 && <span className="cnt">{inStockInCat}/{ings.length}</span>}
                  {lowInCat > 0 && <span className="cnt low">{lowInCat} bientôt vide</span>}
                </div>

                {rows.map((row, ri) => {
                  const roomForSprig = ri === rows.length - 1 && row.length < perRow;
                  return (
                    <div key={ri} className="stk-shelf">
                      <div className="stk-jars">
                        {row.map(ing => {
                          const state = lowSet.has(ing.id) ? "low" : stockSet.has(ing.id) ? "full" : "empty";
                          return <Jar key={ing.id} ing={ing} state={state} onCycle={cycle} />;
                        })}
                      </div>
                      {roomForSprig && <ShelfSprig />}
                      <div className="stk-board">
                        <ShelfBracket side="l" />
                        <ShelfBracket side="r" />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
        </div>
      </div>
    </div>
  );
}
