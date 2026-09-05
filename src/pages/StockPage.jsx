import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback, memo } from "react";
import { Icon } from "../components/Icon.jsx";
import { EmptyArt } from "../components/EmptyArt.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { paginateStockShelves, compareIngredientName } from "@/lib/food/stockShelves.js";
import { DEFAULT_CATEGORIES, sortedCategoryEntries, STOCK_CATEGORIES } from "../constants/categories.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";
import { useAppShell } from "../context/AppShellContext.jsx";

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

// Pagination « à la demande » : le mur peut compter des dizaines de bocaux (images,
// verrerie, ombres) très coûteux à monter d'un coup au 1er paint. On n'affiche
// qu'un lot de planches, puis l'utilisateur charge la suite (cf. loadMore).
const SHELVES_PAGE = 4; // planches (rangées) montées par lot

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
      aria-label={`${ing.name} : ${STATE_LABEL[state]}`}
    >
      <span className="stk-lid" aria-hidden="true" />
      <span className="stk-glass ripple ripple-accent">
        <span className="stk-fill" />
        <span className="stk-photo" aria-hidden="true">
          {ing.image && !imgErr
            ? <img src={ing.image} alt="" loading="lazy" decoding="async"
                referrerPolicy="no-referrer" onError={() => setImgErr(true)} />
            : <Icon name="photo" size={22} color="#b3afaa" />}
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

/** Une planche « fantôme » : `n` bocaux squelette posés sur un vrai rayon. */
function SkelShelf({ n }) {
  return (
    <div className="stk-shelf">
      <div className="stk-jars">
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="stk-jar" aria-hidden="true">
            <span className="stk-skel-lid skeleton" />
            <span className="stk-skel-glass skeleton" />
          </div>
        ))}
      </div>
      <div className="stk-board">
        <ShelfBracket side="l" />
        <ShelfBracket side="r" />
      </div>
    </div>
  );
}

/**
 * Squelette du mur affiché pendant l'hydratation : deux rayons peuplés, un dernier
 * partiel, pour donner d'emblée la forme de l'étagère plutôt qu'un écran vide.
 */
function StockWallSkeleton({ perRow }) {
  const p = Math.max(1, perRow);
  const partial = Math.max(2, Math.min(p, Math.round(p * 0.6)));
  return (
    <div aria-hidden="true" aria-busy="true">
      <div className="stk-group">
        <div className="skeleton" style={{ width: 150, height: 28, borderRadius: 8, margin: "0 0 12px 4px" }} />
        <SkelShelf n={p} />
        <SkelShelf n={p} />
      </div>
      <div className="stk-group">
        <div className="skeleton" style={{ width: 104, height: 28, borderRadius: 8, margin: "0 0 12px 4px" }} />
        <SkelShelf n={partial} />
      </div>
    </div>
  );
}

export function StockPage({ stock = [], setStock, lowStock = [], setLowStock, ingredientDB = [], categories = DEFAULT_CATEGORIES, loading = false }) {
  const [search, setSearch] = useState("");
  // Vue par défaut : « ce que j'ai en stock » (l'objet de la page), pas le catalogue
  // complet des ingrédients gérables. "stock" = ce que j'ai | "low" = à racheter |
  // "all" = catalogue (tout ce que Cardamome sait gérer).
  const [view, setView] = useState("stock");

  const { logActivity } = useAppShell();
  const stockSet = useMemo(() => new Set(stock), [stock]);
  const lowSet = useMemo(() => new Set(lowStock), [lowStock]);
  const nameById = useMemo(() => new Map(ingredientDB.map(i => [i.id, i.name || ""])), [ingredientDB]);

  // Cycle à 3 états : pas en stock → en stock → bientôt vide → pas en stock.
  // Lecture de l'état courant via refs pour garder `cycle` stable (mémoïsation des
  // bocaux) ; comportement identique à un accès direct à stock/lowStock.
  const stockRef = useRef(stock);
  const lowRef = useRef(lowStock);
  useEffect(() => { stockRef.current = stock; lowRef.current = lowStock; }, [stock, lowStock]);
  const cycle = useCallback((id) => {
    const inStock = stockRef.current.includes(id);
    const isLow = lowRef.current.includes(id);
    const target = nameById.get(id) || "";
    if (!inStock) {
      setStock(prev => [...prev, id]);                       // → en stock
      logActivity?.({ type: "stock.add", target });
    } else if (!isLow) {
      setLowStock(prev => [...prev, id]);                    // → bientôt vide
      logActivity?.({ type: "stock.low", target });
    } else {
      setStock(prev => prev.filter(x => x !== id));          // → pas en stock
      setLowStock(prev => prev.filter(x => x !== id));
      logActivity?.({ type: "stock.out", target });
    }
  }, [setStock, setLowStock, logActivity, nameById]);

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
      .sort(compareIngredientName);
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
  // Mesure AVANT peinture (useLayoutEffect + lecture synchrone de la largeur de
  // contenu) : `perRow` est ainsi correct dès le 1er rendu du mur, ce qui évite un
  // second découpage/reflow après coup. Le ResizeObserver ne gère que les
  // redimensionnements ultérieurs (rotation, split-view…).
  const [wallW, setWallW] = useState(0);
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const measure = () => { const w = el.clientWidth - padX; if (w > 0) setWallW(w); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [contentRef]);

  // Montage différé d'une frame : à l'arrivée sur l'onglet (key=tab remonte tout),
  // on peint d'abord le squelette (quasi gratuit) pour que l'animation d'entrée
  // reste fluide, puis on monte le mur de bocaux (réconciliation + paint lourds) à
  // la frame suivante, hors du chemin critique de la transition.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const perRow = useMemo(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
    const mobile = vw <= 620;
    const jarW = mobile ? 96 : 116;
    const gap = mobile ? 14 : 22;
    const sidePad = mobile ? 8 : 14; // padding horizontal de .stk-jars
    const inner = (wallW || vw - 40) - sidePad * 2;
    return Math.max(1, Math.floor((inner + gap - 2) / (jarW + gap)));
  }, [wallW]);

  const [visibleShelves, setVisibleShelves] = useState(SHELVES_PAGE);
  // Reset de pagination quand le jeu de résultats change (vue / recherche) :
  // ajustement d'état PENDANT le rendu (pattern React), pas via un effet.
  const listKey = `${view}|${normalizeStr(search)}`;
  const [pagedKey, setPagedKey] = useState(listKey);
  if (pagedKey !== listKey) { setPagedKey(listKey); setVisibleShelves(SHELVES_PAGE); }

  // Pagination : on ne construit QUE les planches visibles (le reste n'est que
  // compté), au lieu de matérialiser tout le mur à chaque montage/toggle.
  const { groups: shownGroups, totalShelves } = useMemo(
    () => paginateStockShelves(grouped, perRow, stockSet, lowSet, visibleShelves),
    [grouped, perRow, stockSet, lowSet, visibleShelves]);
  const remainingShelves = Math.max(0, totalShelves - visibleShelves);

  // Chargement du lot suivant : bref « spinner » avant de monter les planches
  // (le rendu d'un lot de bocaux peut être perceptible sur mobile) → feedback immédiat.
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setTimeout(() => { setVisibleShelves(c => c + SHELVES_PAGE); setLoadingMore(false); }, 320);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête (sur le fond crème, hors du mur) */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>Mon Stock</h1>
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
            { key: "all", label: "Catalogue", count: stockable.length },
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
        {loading ? (
          // Données pas encore hydratées : squelette d'étagères (forme immédiate,
          // pas d'écran vide) plutôt que « Base d'ingrédients vide » prématuré.
          <StockWallSkeleton perRow={perRow} />
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
              body={low ? "Marque un ingrédient « bientôt vide » en tapant deux fois dessus." : "Ajoute des ingrédients depuis l'onglet « Catalogue »."}
              action={
                <button className="btn btn-primary btn-pill" style={{ fontSize: 14 }} onClick={() => setView("all")}>
                  <Icon name="box" size={15} color="#fff" /> Voir le catalogue
                </button>
              } />
          );
        })() : !ready ? (
          // 1re frame après l'arrivée sur l'onglet : squelette d'abord, le mur de
          // bocaux (lourd à peindre) est monté à la frame suivante (cf. `ready`).
          <StockWallSkeleton perRow={perRow} />
        ) : (
          <>
          {shownGroups.map(({ catKey, total, inStockInCat, lowInCat, shelves }) => {
            const cat = categories[catKey] || DEFAULT_CATEGORIES.other;
            return (
              <div key={catKey} className="stk-group">
                {/* Étiquette de rayon */}
                <div className="stk-tag">
                  <span className="ico">{cat.icon}</span>
                  {cat.label}
                  {view === "all" && inStockInCat > 0 && <span className="cnt">{inStockInCat}/{total}</span>}
                  {lowInCat > 0 && <span className="cnt low">{lowInCat} bientôt vide</span>}
                </div>

                {shelves.map(({ row, ri, lastRow }) => {
                  const roomForSprig = lastRow && row.length < perRow;
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
          })}
          {remainingShelves > 0 && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <button onClick={loadMore} disabled={loadingMore} aria-busy={loadingMore} className="btn pressable ripple"
                style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 999, boxShadow: "none", fontSize: 14, fontWeight: 600, gap: 8, opacity: loadingMore ? 0.8 : 1 }}>
                {loadingMore ? (
                  <>
                    <span aria-hidden="true" style={{ width: 16, height: 16, border: "2px solid var(--border)", borderTopColor: "var(--text2)", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
                    Chargement…
                  </>
                ) : (
                  <>
                    <Icon name="chevronDown" size={16} color="var(--text2)" />
                    Charger plus d'étagères
                    <span style={{ color: "var(--text3)", fontWeight: 500 }}>· {remainingShelves}</span>
                  </>
                )}
              </button>
            </div>
          )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
