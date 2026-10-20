import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useTransition, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "../components/ui/Icon.jsx";
import { LoadMoreButton } from "../components/ui/LoadMoreButton.jsx";
import { ClearSearchButton } from "../components/ui/ClearSearchButton.jsx";
import { UserAvatar } from "../components/user/UserAvatar.jsx";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { paginateStockShelves, compareIngredientName } from "@/lib/food/stockShelves.js";
import { DEFAULT_CATEGORIES, sortedCategoryEntries, STOCK_CATEGORIES } from "../constants/categories.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { Jar, ShelfBoard, ShelfSprig, StockEmpty, StockWallSkeleton } from "../components/stock/StockShelf.jsx";
import { jarFillColor } from "@/lib/food/jarLook.js";
import { JarSheet } from "../components/stock/JarSheet.jsx";
import { useStockLevels } from "../hooks/useStockLevels.js";
import { recipesUsingIngredient, stockLevelOf } from "@/lib/food/stockLevel.js";
import type { Resolver } from "@/lib/food/nameMatcher.js";
import type { IngredientDbItem, Recipe } from "@/lib/types.js";
import type { CategoryMap } from "@/lib/cookSession/misEnPlace.js";

// ─── STOCK TAB ────────────────────────────────────────────────────────────────
// Gestion binaire du stock présentée en « mur d'étagères » : chaque ingrédient est
// un bocal en verre posé sur une planche. La SIGNATURE : le niveau de remplissage
// du bocal EST l'état (vide = à racheter, quart = bientôt vide, plein = en stock).
// Le modèle de données reste un simple tableau d'IDs ; seul le rendu change.

// Pagination « à la demande » : le mur peut compter des dizaines de bocaux (images,
// verrerie, ombres) très coûteux à monter d'un coup au 1er paint. On n'affiche
// qu'un lot de planches, puis l'utilisateur charge la suite (cf. loadMore).
const SHELVES_PAGE = 4; // planches (rangées) montées par lot

/** Filtre du mur : ce que j'ai, ce qui est à racheter, ou tout le catalogue. */
type StockView = "stock" | "low" | "all";

interface StockPageProps {
  /** IDs d'ingrédients en stock. */
  stock?: string[];
  setStock: Dispatch<SetStateAction<string[]>>;
  /** IDs marqués « bientôt vide » (sous-ensemble du stock). */
  lowStock?: string[];
  setLowStock: Dispatch<SetStateAction<string[]>>;
  ingredientDB?: IngredientDbItem[];
  categories?: CategoryMap;
  loading?: boolean;
  /** Bibliothèque, pour « À cuisiner avec » dans le menu d'un bocal. */
  recipes?: Recipe[];
  /** Rapprochement nom de ligne de recette vers fiche (mêmes règles que les filtres). */
  resolver: Resolver;
  onOpenRecipe: (recipeId: string) => void;
  onOpenIngredient: (ingredientId: string) => void;
  /** Ouvre la bibliothèque filtrée sur l'ingrédient. */
  onSeeRecipesWith: (ingredientId: string) => void;
}

export function StockPage({ stock = [], setStock, lowStock = [], setLowStock, ingredientDB = [], categories = DEFAULT_CATEGORIES, loading = false, recipes = [], resolver, onOpenRecipe, onOpenIngredient, onSeeRecipesWith }: StockPageProps) {
  const [search, setSearch] = useState("");
  // Vue par défaut : « ce que j'ai en stock » (l'objet de la page), pas le catalogue
  // complet des ingrédients gérables. "stock" = ce que j'ai | "low" = à racheter |
  // "all" = catalogue (tout ce que Cardamome sait gérer). Le filtre vit dans l'URL
  // (?view=…) pour être partageable et survivre au refresh ; "stock" reste implicite
  // (URL nue), un param inconnu retombe sur le défaut. `replace` : le filtre est une
  // vue, pas une étape d'historique.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get("view");
  const view: StockView = rawView === "low" || rawView === "all" ? rawView : "stock";
  const setView = useCallback(
    (v: StockView) => setSearchParams(v === "stock" ? {} : { view: v }, { replace: true }),
    [setSearchParams]
  );

  const { logActivity } = useAppShell();
  const nameById = useMemo(() => new Map(ingredientDB.map(i => [i.id, i.name || ""])), [ingredientDB]);
  // Tap : cycle pas en stock → en stock → bientôt vide → pas en stock ; appui long : menu du bocal.
  const { stockSet, lowSet, setLevel, cycle } = useStockLevels({ stock, setStock, lowStock, setLowStock, nameById, logActivity });
  const [heldId, setHeldId] = useState<string | null>(null);
  const holdJar = useCallback((id: string) => {
    try { navigator.vibrate?.(12); } catch { /* vibration indisponible : ouverture silencieuse */ }
    setHeldId(id);
  }, []);

  // Tous les ingrédients stockables (catégories non-périssables, avec nom)
  const stockable = useMemo(() =>
    ingredientDB.filter(i => i.name && STOCK_CATEGORIES.has(i.category || "other")),
    [ingredientDB]);

  // Ingrédients filtrés par recherche + vue active (tous / en stock / à racheter)
  const filtered = useMemo(() => {
    const q = normalizeStr(search);
    const matchView = (i: IngredientDbItem) =>
      view === "all" ? true : view === "stock" ? stockSet.has(i.id) : lowSet.has(i.id);
    return stockable
      .filter(i => matchView(i)
        && (!q || normalizeStr(i.name).includes(q) || (i.aliases || []).some(a => normalizeStr(a).includes(q))))
      .sort(compareIngredientName);
  }, [stockable, search, view, stockSet, lowSet]);

  // Regroupement par catégorie
  const grouped = useMemo(() => {
    const catOrder = sortedCategoryEntries(categories).map(([k]) => k);
    const map = new Map<string, IngredientDbItem[]>();
    for (const ing of filtered) {
      const key = ing.category || "other";
      const bucket = map.get(key);
      if (bucket) bucket.push(ing); else map.set(key, [ing]);
    }
    return [...map.entries()].sort((a, b) => {
      const ia = catOrder.indexOf(a[0]), ib = catOrder.indexOf(b[0]);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [filtered, categories]);

  const inStockCount = stock.length;
  const isDesktop = useIsDesktop();
  const { scrollRef, contentRef } = useElasticScroll<HTMLDivElement>({ disabled: isDesktop });

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

  // Les badges ne s'animent qu'une fois l'entrée sur la page passée : à l'arrivée,
  // des dizaines d'animations simultanées concurrenceraient la transition d'entrée.
  const [live, setLive] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLive(true), 600);
    return () => clearTimeout(t);
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

  // Lot suivant monté en transition : le bouton répond tout de suite (spinner),
  // le montage des bocaux passe derrière les interactions, sans délai artificiel.
  const [loadingMore, startLoadMore] = useTransition();
  const loadMore = () => {
    if (loadingMore) return;
    startLoadMore(() => setVisibleShelves(c => c + SHELVES_PAGE));
  };

  // Menu du bocal tenu : la recherche de recettes ne tourne que tant qu'il est ouvert.
  const held = useMemo(() => (heldId ? ingredientDB.find(i => i.id === heldId) : undefined), [heldId, ingredientDB]);
  const heldRecipes = useMemo(
    () => (held ? recipesUsingIngredient(held.id, recipes, resolver, stockSet) : []),
    [held, recipes, resolver, stockSet]);
  const heldCat = held?.category || "other";

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
          {([
            { key: "stock", label: "En stock", count: inStockCount },
            { key: "low", label: "Bientôt vide", count: lowStock.length },
            { key: "all", label: "Catalogue", count: stockable.length },
          ] satisfies { key: StockView; label: string; count: number }[]).map(p => {
            const active = view === p.key;
            return (
              <button key={p.key} onClick={() => setView(p.key)} className={`ripple${active ? "" : " hover-neutral hover-ring"}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                  background: active ? "var(--accent)" : "var(--surface)",
                  color: active ? "#fff" : "var(--text2)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  cursor: "pointer",
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
        <div ref={contentRef} className={`stk-wall${live ? " is-live" : ""}`} style={{ minHeight: "100%" }}>
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
                          return <Jar key={ing.id} ing={ing} state={stockLevelOf(ing.id, stockSet, lowSet)} onCycle={cycle} onHold={holdJar} catKey={catKey} />;
                        })}
                      </div>
                      {roomForSprig && <ShelfSprig />}
                      <ShelfBoard />
                    </div>
                  );
                })}
              </div>
            );
          })}
          {remainingShelves > 0 && (
            <LoadMoreButton onClick={loadMore} loading={loadingMore} label="Voir plus d'étagères"
              hint={`${remainingShelves} restante${remainingShelves > 1 ? "s" : ""}`} />
          )}
          </>
        )}
        </div>
      </div>

      {held && (
        <JarSheet
          ingredient={held}
          level={stockLevelOf(held.id, stockSet, lowSet)}
          shelfLabel={(categories[heldCat] || DEFAULT_CATEGORIES.other).label || heldCat}
          fillColor={jarFillColor(held, heldCat)}
          recipes={heldRecipes}
          onSetLevel={level => setLevel(held.id, level)}
          onOpenIngredient={() => onOpenIngredient(held.id)}
          onOpenRecipe={onOpenRecipe}
          onSeeAllRecipes={() => onSeeRecipesWith(held.id)}
          onClose={() => setHeldId(null)}
        />
      )}
    </div>
  );
}
