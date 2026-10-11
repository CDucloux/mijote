import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback, memo } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "../components/ui/Icon.jsx";
import { ClearSearchButton } from "../components/ui/ClearSearchButton.jsx";
import { EmptyArt } from "../components/ui/EmptyArt.jsx";
import { UserAvatar } from "../components/user/UserAvatar.jsx";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { paginateStockShelves, compareIngredientName } from "@/lib/food/stockShelves.js";
import { DEFAULT_CATEGORIES, sortedCategoryEntries, STOCK_CATEGORIES } from "../constants/categories.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { vesselColor } from "@/lib/food/vesselColor.js";

// ─── STOCK TAB ────────────────────────────────────────────────────────────────
// Gestion binaire du stock présentée en « mur d'étagères » : chaque ingrédient est
// un bocal en verre posé sur une planche. La SIGNATURE : le niveau de remplissage
// du bocal EST l'état (vide = à racheter, quart = bientôt vide, plein = en stock).
// Le modèle de données reste un simple tableau d'IDs ; seul le rendu change.

// Palette de contenus (fond du bocal quand l'image est absente/transparente) :
// tons chauds « garde-manger », choisis déterministiquement par ingrédient.
const STK_FILL = ["#cdb98a", "#c9a15c", "#b98c4a", "#a6743a", "#8f6b3f", "#7d5a34", "#c7b552", "#9aa15a", "#b5773f", "#d3a86a"];

// Contenant selon le rayon : huiles, vinaigres et alcools en BOUTEILLE (liquides
// dorés, du vinaigre blanc au balsamique, vins et spiritueux), condiments et
// épices en POT À ÉPICES (poudres : paprika, curcuma, poivre, herbes séchées…).
// Le reste en bocal. La couleur vient d'abord du nom (`vesselColor` : vin rouge,
// balsamique, paprika…), la palette du rayon ne sert qu'à défaut.
const VESSELS = {
  oil: { kind: "bottle", fill: ["#d8b44a", "#c9a23a", "#b9a646", "#e0c46a"] },
  acid: { kind: "bottle", fill: ["#a8483a", "#d6c38a", "#7a3b2a", "#c58a4a"] },
  alcohol: { kind: "bottle", fill: ["#6e1f2a", "#e3cf86", "#e8a3a0", "#b8742a", "#8a2b3a"] },
  condiment: { kind: "spice", fill: ["#b8432c", "#d9a42a", "#4a3a2c", "#7c8a45", "#a0522d", "#c9b48a"] },
};

/** Couleur de contenu stable pour un ingrédient (hash simple -> palette). */
function stkFillColor(seed, palette = STK_FILL) {
  const s = String(seed || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
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
const Jar = memo(function Jar({ ing, state, onCycle, catKey }) {
  const [imgErr, setImgErr] = useState(false);
  const vessel = VESSELS[catKey];
  return (
    <button
      className="stk-jar"
      data-state={state}
      data-vessel={vessel?.kind}
      onClick={() => onCycle(ing.id)}
      style={{ "--fill": (vessel && vesselColor(ing.name, catKey)) || stkFillColor(ing.dbId || ing.id, vessel?.fill) }}
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
}, (a, b) => a.state === b.state && a.ing === b.ing && a.onCycle === b.onCycle && a.catKey === b.catKey);

/** Équerre vue de FACE (comme l'étagère) : on n'en voit que la tranche, une barre
 *  étroite qui descend sous la planche et s'affine vers le mur, avec sa vis de
 *  fixation. Décalée du bord (cf. .stk-bracket). */
function ShelfBracket({ side }) {
  return (
    <svg className={`stk-bracket ${side}`} viewBox="0 0 10 30" fill="none" aria-hidden="true">
      <path d="M0.5 0H9.5L7.6 27.2C7.4 29 6.4 30 5 30C3.6 30 2.6 29 2.4 27.2Z" fill="var(--iron)" />
      <path d="M0.5 0H3L3.8 26.5C3.2 26.5 2.6 26.9 2.4 27.2Z" fill="rgba(255,255,255,.09)" />
      <circle cx="5" cy="21" r="1.3" fill="var(--iron-hi)" />
    </svg>
  );
}

// Feuilles du brin : position (base sur la tige), angle, longueur, largeur, teinte.
// Tailles et teintes irrégulières : un vrai brin n'est jamais symétrique.
const SPRIG_LEAVES = [
  { x: 27.4, y: 60, r: -58, l: 13, w: 7.5, c: "#6d9447" },
  { x: 27.6, y: 56, r: 62, l: 12, w: 7, c: "#7fa155" },
  { x: 26.6, y: 48, r: -48, l: 14, w: 8, c: "#7fa155" },
  { x: 27, y: 44, r: 52, l: 12.5, w: 7, c: "#8cae60" },
  { x: 26.2, y: 36, r: -40, l: 12, w: 6.8, c: "#8cae60" },
  { x: 26.6, y: 32, r: 44, l: 11, w: 6.2, c: "#9cbb73" },
  { x: 26.4, y: 25, r: -22, l: 9, w: 5.4, c: "#a6c47f" },
  { x: 26.8, y: 23, r: 26, l: 8, w: 5, c: "#a6c47f" },
  { x: 33.5, y: 47, r: 70, l: 9.5, w: 5.6, c: "#9cbb73" },
  { x: 37, y: 41.5, r: 30, l: 8.5, w: 5, c: "#a6c47f" },
];
const leafPath = (l, w) => `M0 0C${w / 2} ${-l * 0.28} ${w / 2} ${-l * 0.72} 0 ${-l}C${-w / 2} ${-l * 0.72} ${-w / 2} ${-l * 0.28} 0 0Z`;

/** Fioriture unique : un brin dans son pot de terre cuite, posé en bout de rayon (décoratif). */
function ShelfSprig() {
  return (
    <svg className="stk-sprig" viewBox="0 0 54 96" aria-hidden="true">
      {/* tige principale et rameau */}
      <path d="M28 68C27.4 56 26 44 26.5 21" stroke="#56773a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M27.2 52C31 49 34.5 45 37.5 40" stroke="#56773a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {SPRIG_LEAVES.map((leaf, i) => (
        <g key={i} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r})`}>
          <path d={leafPath(leaf.l, leaf.w)} fill={leaf.c} />
          <path d={`M0 -1.5V${-leaf.l * 0.8}`} stroke="rgba(40,60,25,.28)" strokeWidth="0.7" strokeLinecap="round" />
        </g>
      ))}
      {/* pot : corps évasé, rebord, ombre du côté droit */}
      <path d="M14 72H42L39 93C38.8 94.7 37.6 96 35.9 96H20.1C18.4 96 17.2 94.7 17 93Z" fill="#c8693f" />
      <path d="M33 72H42L39 93C38.8 94.7 37.6 96 35.9 96H32Z" fill="#a9532f" />
      <rect x="11" y="66" width="34" height="8" rx="2.5" fill="#d9804f" />
      <rect x="11" y="66" width="34" height="2.4" rx="1.2" fill="#e89a6b" />
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
  // "all" = catalogue (tout ce que Cardamome sait gérer). Le filtre vit dans l'URL
  // (?view=…) pour être partageable et survivre au refresh ; "stock" reste implicite
  // (URL nue), un param inconnu retombe sur le défaut. `replace` : le filtre est une
  // vue, pas une étape d'historique.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get("view");
  const view = rawView === "low" || rawView === "all" ? rawView : "stock";
  const setView = useCallback(
    (v) => setSearchParams(v === "stock" ? {} : { view: v }, { replace: true }),
    [setSearchParams]
  );

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
  const isDesktop = useIsDesktop();
  const { scrollRef, contentRef } = useElasticScroll({ disabled: isDesktop });

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
              <button key={p.key} onClick={() => setView(p.key)} className={`ripple${active ? "" : " hov-pill"}`}
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
                  <ClearSearchButton onClick={() => setSearch("")} />
                } />
            );
          }
          const low = view === "low";
          return (
            <StockEmpty icon="box" art={low ? "liste" : "etagere"}
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
                          return <Jar key={ing.id} ing={ing} state={state} onCycle={cycle} catKey={catKey} />;
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
