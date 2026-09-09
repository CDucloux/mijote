import { useState, useMemo, useRef, useEffect } from "react";
import { Icon } from "./Icon.jsx";
import { BaseIcon } from "./BaseIcon.jsx";
import { EmptyArt } from "./EmptyArt.jsx";
import { ElasticScroll } from "./ElasticScroll.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useDiscoverRecipes } from "../hooks/useDiscoverRecipes.js";
import { useDiscoverFavorites } from "../hooks/useDiscoverFavorites.js";
import { RecipeCard } from "./RecipeCard.jsx";
import { OverscrollRow } from "./OverscrollRow.jsx";
import { OfficialAvatar } from "./OfficialAvatar.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { RecipeFilterSheet } from "./RecipeFilterSheet.jsx";
import { filterPublicRecipes, publicId, isOfficialAuthor } from "@/lib/household/publicRecipes.js";
import { createIngredientResolver } from "@/lib/food/nameMatcher.js";
import { isRecipeInSeason } from "@/lib/food/seasonality.js";
import { isRecipeVegan } from "@/lib/food/dietary.js";
import { computeNutriInfo, buildRecipeIndex } from "@/lib/recipes/nutriscore.js";
import { DEFAULT_FILTERS, activeFilterCount, matchesFilters } from "@/lib/recipes/recipeFilters.js";
import { DEFAULT_SORT_KEY, defaultDirFor, makeComparator } from "@/lib/recipes/recipeSort.js";
import { STATIC_CATEGORIES, matchesDiscoverCategory, isQuickRecipe } from "@/lib/recipes/discoverFeed.js";
import { isEligible } from "@/lib/food/dietFilter.js";
import { buildTechniqueIndex } from "@/lib/recipes/techniques.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { CUISINES } from "../constants/cuisines.js";
import { relativeDate } from "../lib/format.js";

const TINT = "rgba(var(--accent-rgb),0.14)";
const RED = "#e0554e";
// Largeur des cartes en carrousel : moitié de la rangée visible (2 cartes),
// plafonnée à 210px sur desktop, cf. explication `cqw` conservée de l'existant.
const CARD_W = "clamp(150px, calc(50cqw - 6px), 210px)";

// Halos sombres signature pour les tuiles cuisine (mêmes teintes que RecipePlaceholder
// + ambre & sarcelle pour la variété, comme le mockup). Teinte stable dérivée du nom.
const MOSAIC_HALOS = [
  "radial-gradient(115% 78% at 50% 118%, #b5512a 0%, #4a2f22 42%, #221a16 72%, #1a1411 100%)",
  "radial-gradient(115% 78% at 50% 118%, #3f7d52 0%, #243a2a 42%, #18211a 72%, #131a15 100%)",
  "radial-gradient(115% 78% at 50% 118%, #c98a2f 0%, #4a3a22 42%, #221d16 72%, #1a1611 100%)",
  "radial-gradient(115% 78% at 50% 118%, #2f8f88 0%, #22403c 42%, #16211f 72%, #131a19 100%)",
];
function haloForName(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h + name.charCodeAt(i)) % 997;
  return MOSAIC_HALOS[h % MOSAIC_HALOS.length];
}

// Carte d'une recette publique : visuel (hover-lift) + crédit créateur & date dessous.
function PublicRecipeCard({ p, onOpen, onAdd, onAuthor, owned, inSeason, vegan, nutriLetter, favorite, onToggleFavorite, style }) {
  return (
    <div>
      <div className="discover-card"><RecipeCard recipe={p.recipe} onClick={onOpen} inSeason={inSeason} vegan={vegan} nutriLetter={nutriLetter} favorite={favorite} onToggleFavorite={onToggleFavorite} style={style} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, padding: "0 2px" }}>
        <button onClick={onAuthor} title="Filtrer par ce créateur"
          style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          {isOfficialAuthor(p.authorUid)
            ? <OfficialAvatar size={16} />
            : p.authorPhoto
              ? <img src={p.authorPhoto} alt="" referrerPolicy="no-referrer" style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0 }} />
              : <span style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--surface3)", flexShrink: 0 }} />}
          <span style={{ fontSize: 11, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.authorName || "Anonyme"}</span>
          {owned && <Icon name="check" size={12} color="var(--ok)" />}
        </button>
        {!owned && onAdd ? (
          <button onClick={e => { e.stopPropagation(); onAdd(); }}
            style={{ marginLeft: "auto", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>
            <Icon name="plus" size={11} color="#fff" /> Ajouter
          </button>
        ) : p.createdAt && (
          <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 10.5, color: "var(--text3)" }}>{relativeDate(p.createdAt)}</span>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div>
      <div className="skeleton" style={{ width: "100%", aspectRatio: "16 / 10", borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 12, width: "85%", borderRadius: 6, marginTop: 10 }} />
      <div className="skeleton" style={{ height: 10, width: "55%", borderRadius: 6, marginTop: 7 }} />
    </div>
  );
}

function SkeletonRow({ titleWidth = 130, count = 10 }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div className="skeleton" style={{ height: 15, width: titleWidth, borderRadius: 6, marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 14, overflow: "hidden", containerType: "inline-size" }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ flex: `0 0 ${CARD_W}` }}><SkeletonCard /></div>
        ))}
      </div>
    </div>
  );
}

function DiscoverSkeleton() {
  return (
    <div style={{ paddingTop: 14 }}>
      <SkeletonRow titleWidth={110} />
      <SkeletonRow titleWidth={160} />
      <SkeletonRow titleWidth={130} />
    </div>
  );
}

// Rangée éditoriale horizontale (carrousel). Ne s'affiche pas si vide.
function Carousel({ icon, iconNode, iconColor = "var(--accent)", title, extra, count, items, renderItem }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
        {iconNode || (icon && <Icon name={icon} size={16} color={iconColor} />)}{title}
        {count != null && <span style={{ fontSize: 11, fontWeight: 700, color: RED, background: "rgba(224,85,78,.12)", borderRadius: 999, padding: "2px 8px" }}>{count}</span>}
        {extra && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)" }}>{extra}</span>}
      </h3>
      <OverscrollRow stretch className="discover-row" style={{ gap: 14, paddingTop: 6, paddingBottom: 6 }} outerStyle={{ scrollSnapType: "x proximity", containerType: "inline-size" }}>
        {items.map((it, i) => (
          <div key={it.pubId} id={`discover-card-${it.pubId}`} style={{ flex: `0 0 ${CARD_W}`, scrollSnapAlign: "start" }}>{renderItem(it, i)}</div>
        ))}
      </OverscrollRow>
    </div>
  );
}

// ─── DÉCOUVRIR – recettes publiques de la communauté ──────────────────────────
export function DiscoverSection({ ingredientDB = [], preferences, recipes = [], onOpenPublic, onClonePublic, onNewRecipe, initialSearch = "", onSeedConsumed }) {
  const { user, techniques = [] } = useAppShell();
  const { recipes: pubs, loading, error, loadedOnce, online, reload } = useDiscoverRecipes(user);
  const { favorites, favIds, favCount, toggleFavorite } = useDiscoverFavorites(user);
  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  const techIndex = useMemo(() => buildTechniqueIndex(techniques), [techniques]);

  const [text, setText] = useState("");
  const searchRef = useRef(null);
  useEffect(() => {
    const seed = (initialSearch || "").trim();
    if (!seed) return;
    setText(seed);
    requestAnimationFrame(() => searchRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    onSeedConsumed?.();
  }, [initialSearch, onSeedConsumed]);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeCat, setActiveCat] = useState("tout");
  const [usePrefs, setUsePrefs] = useState(false);
  const [authorUid, setAuthorUid] = useState(null);
  const [spinning, setSpinning] = useState(false);

  // pubId des recettes déjà dans MA bibliothèque (clonées) ou publiées par moi.
  const ownedIds = useMemo(() => {
    const s = new Set();
    for (const r of recipes) { if (r.clonedFrom?.publicId) s.add(r.clonedFrom.publicId); }
    return s;
  }, [recipes]);
  const isOwned = (p) => ownedIds.has(p.pubId) || p.authorUid === user?.uid;
  const isInSeason = (payload) => isRecipeInSeason(payload, resolver);
  const isVegan = (payload) => isRecipeVegan(payload, resolver);
  const pubRecipesById = useMemo(() => buildRecipeIndex(pubs.map(x => x.recipe)), [pubs]);
  const liveNutri = (recipe) => computeNutriInfo(recipe.ingredients, ingredientDB || [], pubRecipesById).letter ?? recipe.nutriLetter;

  const componentsFor = (p) => (p.componentRefs || [])
    .map(origId => pubs.find(x => x.pubId === publicId(p.authorUid, origId)))
    .filter(Boolean)
    .map(x => x.recipe);

  // Drapeaux d'une recette pour l'appariement de catégorie (favori/vegan/saison/rapide/base/cuisine).
  const flagsFor = (p) => ({
    isFavorite: favorites.has(p.pubId),
    isVegan: isVegan(p.recipe),
    isInSeason: isInSeason(p.recipe),
    isQuick: isQuickRecipe(p.recipe),
    isComponent: !!p.isComponent,
    cuisine: p.cuisine || p.recipe?.cuisine || "",
  });

  const nActiveFilters = activeFilterCount(filters);
  // Navigation « pure » = aucune contrainte : on montre le feed éditorial. Dès qu'une
  // catégorie (hors « Tout »), une recherche, un filtre, un auteur ou « mes préférences »
  // est actif, on bascule sur la grille filtrée.
  const browsing = activeCat === "tout" && !text.trim() && nActiveFilters === 0 && !usePrefs && !authorUid;

  const filtered = useMemo(() => {
    const q = normalizeStr(text);
    // Tri fixe (le plus récent d'abord) : la vue Découvrir n'expose plus de contrôle
    // de tri, le classement se fait via les pastilles/catégories.
    const cmp = makeComparator({ sortBy: DEFAULT_SORT_KEY, sortDir: defaultDirFor(DEFAULT_SORT_KEY), techniques, techIndex, recipes: [] });
    return pubs
      .filter(p => {
        if (q) {
          const hay = (p.keywords || []).join(" ");
          if (!normalizeStr(hay).includes(q) && !normalizeStr(p.name).includes(q)) return false;
        }
        if (authorUid && p.authorUid !== authorUid) return false;
        if (usePrefs && !isEligible(p.recipe, preferences, { resolver })) return false;
        if (!matchesDiscoverCategory(flagsFor(p), activeCat)) return false;
        return matchesFilters(p.recipe, filters, { resolver, techniques, techIndex });
      })
      .map(p => ({ p, view: { ...p.recipe, id: p.pubId, createdAt: p.createdAt } }))
      .sort((a, b) => cmp(a.view, b.view))
      .map(x => x.p);
  }, [pubs, text, authorUid, usePrefs, preferences, filters, activeCat, favorites, resolver, techniques, techIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const usedCuisines = useMemo(() => CUISINES.filter(c => pubs.some(p => p.cuisine === c.label)), [pubs]);
  // Catégories = statiques + cuisines réellement présentes (chips collants).
  const categories = useMemo(() => [
    ...STATIC_CATEGORIES,
    ...usedCuisines.map(c => ({ key: c.label, label: c.label })),
  ], [usedCuisines]);

  // Rangées éditoriales (mode navigation).
  const favList = useMemo(() => favIds.map(id => pubs.find(p => p.pubId === id)).filter(Boolean), [favIds, pubs]);
  const trending = useMemo(() => pubs.filter(p => !p.isComponent).slice(0, 12), [pubs]);
  const bases = useMemo(() => pubs.filter(p => p.isComponent).slice(0, 12), [pubs]);
  const seasonal = useMemo(() => filterPublicRecipes(pubs, { seasonOnly: true }, { isInSeason }).slice(0, 12), [pubs, resolver]); // eslint-disable-line react-hooks/exhaustive-deps
  const rapide = useMemo(() => pubs.filter(p => !p.isComponent && isQuickRecipe(p.recipe)).slice(0, 12), [pubs]);
  const mosaic = useMemo(() => usedCuisines
    .map(c => ({ label: c.label, emoji: c.emoji, count: pubs.filter(p => !p.isComponent && p.cuisine === c.label).length }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count), [usedCuisines, pubs]);

  const card = (p, idx) => (
    <PublicRecipeCard
      p={p} owned={isOwned(p)} inSeason={isInSeason(p.recipe)} vegan={isVegan(p.recipe)} nutriLetter={liveNutri(p.recipe)}
      favorite={favorites.has(p.pubId)} onToggleFavorite={() => toggleFavorite(p.pubId)}
      onOpen={() => onOpenPublic?.(p, componentsFor(p))}
      onAdd={onClonePublic ? () => onClonePublic(p) : undefined}
      onAuthor={() => setAuthorUid(authorUid === p.authorUid ? null : p.authorUid)}
      style={{ animationDelay: `${(idx % 8) * 0.04}s` }}
    />
  );

  const noPublic = pubs.length === 0;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* En-tête FIXE (hors défilement) : plus rien ne défile derrière lui. */}
      <div style={{ flexShrink: 0, background: "var(--bg)", padding: "0 20px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", display: "flex", alignItems: "center", gap: 7 }}>
            <Icon name="sparkle" size={15} color="var(--accent)" /> Recettes de la communauté
            {!online && !noPublic && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--orange)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="wifiOff" size={11} color="var(--orange)" /> en cache</span>}
          </h2>
          <button className="ripple"
            onClick={() => { if (!online || spinning) return; setSpinning(true); reload(); setTimeout(() => setSpinning(false), 1500); }}
            disabled={!online} title={online ? "Rafraîchir" : "Indisponible hors ligne"}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: spinning ? "var(--accent)" : "var(--text3)", background: "none", border: "none", cursor: online ? "pointer" : "not-allowed", opacity: online ? 1 : 0.45, borderRadius: 8, padding: "4px 6px", transition: "color 0.2s" }}>
            <span style={{ display: "inline-flex", animation: spinning ? "spin 0.75s linear infinite" : undefined }}>
              <Icon name="history" size={14} color={spinning ? "var(--accent)" : "var(--text3)"} />
            </span>
            Rafraîchir
          </button>
        </div>

        <div ref={searchRef} style={{ position: "relative", marginBottom: 12, scrollMarginTop: 12 }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}><Icon name="search" size={17} color="var(--text3)" /></span>
          <input className="field-input recipe-search" placeholder="Rechercher par recette, chef, ingrédient…" value={text} onChange={e => setText(e.target.value)}
            enterKeyHint="search" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
            style={{ paddingLeft: 44, paddingRight: text ? 40 : 16 }} />
          {text && <button onClick={() => setText("")} aria-label="Effacer" className="search-clear-btn" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}><Icon name="close" size={13} /></button>}
        </div>
      </div>

      {filterOpen && (
        <SwipeableSheet onClose={() => setFilterOpen(false)} hideHandle style={{ maxHeight: "90dvh", paddingTop: 0, paddingBottom: 0 }}>
          {(close) => (
            <RecipeFilterSheet filters={filters} setFilters={setFilters} usedCuisines={usedCuisines} ingredientDB={ingredientDB} resultCount={filtered.length} onClose={() => close()} />
          )}
        </SwipeableSheet>
      )}

      {/* Zone défilante : catégories collantes + feed/grille */}
      <ElasticScroll style={{ flex: 1, padding: "0 20px var(--page-pad-b)" }}>
        {!noPublic && !error && (
          <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", padding: "14px 0 12px", margin: "0 -20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", padding: "0 20px" }}>
              {/* Filtres : action (ouvre la feuille), distincte des catégories. */}
              <button className="ripple" onClick={() => setFilterOpen(true)} title="Filtrer"
                style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", border: `1px solid ${nActiveFilters > 0 ? "rgba(var(--accent-rgb),0.5)" : "var(--border)"}`, background: nActiveFilters > 0 ? TINT : "var(--surface)", color: nActiveFilters > 0 ? "var(--accent)" : "var(--text2)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                Filtres
                {nActiveFilters > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{nActiveFilters}</span>}
              </button>
              {/* Séparateur discret entre l'action Filtres et les catégories. */}
              <span style={{ flex: "0 0 auto", width: 1, height: 20, background: "var(--border)", borderRadius: 1 }} />
              {categories.map(c => (
                <button key={c.key} className="ripple" onClick={() => setActiveCat(c.key)}
                  style={{ flex: "0 0 auto", padding: "8px 15px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", border: `1px solid ${activeCat === c.key ? "rgba(var(--accent-rgb),0.5)" : "var(--border)"}`, background: activeCat === c.key ? TINT : "var(--surface)", color: activeCat === c.key ? "var(--accent)" : "var(--text2)", transition: "background .16s, color .16s, border-color .16s" }}>
                  {c.label}
                </button>
              ))}
              {!!((preferences?.diet && preferences.diet !== "omnivore") || preferences?.allergens?.length || preferences?.excludedCategories?.length) && (
                <button className="ripple" onClick={() => setUsePrefs(v => !v)} title="Selon mes préférences alimentaires"
                  style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", border: `1px solid ${usePrefs ? "rgba(var(--accent-rgb),0.5)" : "var(--border)"}`, background: usePrefs ? TINT : "var(--surface)", color: usePrefs ? "var(--accent)" : "var(--text2)" }}>
                  <Icon name="heart" size={13} color="currentColor" /> Mes préférences
                </button>
              )}
              {authorUid && (
                <button className="ripple" onClick={() => setAuthorUid(null)}
                  style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", border: "1px solid rgba(var(--accent-rgb),0.5)", background: TINT, color: "var(--accent)" }}>
                  <Icon name="close" size={11} color="var(--accent)" /> Créateur
                </button>
              )}
            </div>
          </div>
        )}

        {(loading && !loadedOnce) || spinning ? (
          <DiscoverSkeleton />
        ) : error ? (
          <div style={{ textAlign: "center", color: "var(--text3)", padding: "28px 0", fontSize: 13 }}>
            Impossible de charger les recettes publiques.<br />
            <button onClick={reload} className="btn btn-ghost" style={{ marginTop: 10, borderRadius: 12 }}>Réessayer</button>
          </div>
        ) : noPublic && !online ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "26px 16px", marginTop: 14, borderRadius: 16, background: "var(--surface)", border: "1px dashed var(--border)" }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(240,153,42,0.14)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Icon name="wifiOff" size={22} color="var(--orange)" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Hors ligne</div>
            <div style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, maxWidth: 300 }}>
              La découverte des recettes de la communauté reviendra automatiquement dès le retour de la connexion.
            </div>
          </div>
        ) : noPublic ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "26px 16px", marginTop: 14, borderRadius: 16, background: "var(--surface)", border: "1px dashed var(--border)" }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(var(--accent-rgb),0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Icon name="sparkle" size={22} color="var(--accent)" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Encore aucune recette publique</div>
            <div style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, maxWidth: 300 }}>
              Sois le premier à partager : ouvre une de tes recettes et choisis « Rendre publique ».
            </div>
          </div>
        ) : browsing ? (
          // ── Mode navigation : feed éditorial ──
          <div style={{ paddingTop: 2 }}>
            {/* Mes favoris (rangée ou état vide invitant) */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={RED} stroke={RED} strokeWidth="1.5"><path d="M12 20.3 4.2 12.5a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 6.5z" /></svg>
                Mes favoris
                {favCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: RED, background: "rgba(224,85,78,.12)", borderRadius: 999, padding: "2px 8px" }}>{favCount}</span>}
              </h3>
              {favList.length > 0 ? (
                <OverscrollRow stretch className="discover-row" style={{ gap: 14, paddingTop: 6, paddingBottom: 6 }} outerStyle={{ scrollSnapType: "x proximity", containerType: "inline-size" }}>
                  {favList.map((p, i) => (
                    <div key={p.pubId} id={`discover-card-${p.pubId}`} style={{ flex: `0 0 ${CARD_W}`, scrollSnapAlign: "start" }}>{card(p, i)}</div>
                  ))}
                </OverscrollRow>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 16, background: "var(--surface)", border: "1px dashed rgba(224,85,78,.4)" }}>
                  <span style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(224,85,78,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.3 4.2 12.5a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 6.5z" /></svg>
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>Aucun favori pour l'instant</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--text3)", marginTop: 3 }}>Touche le cœur sur une recette pour la garder ici, à portée de main.</span>
                  </span>
                </div>
              )}
            </div>

            <Carousel icon="fire" title="Tendances" extra="· cette semaine" items={trending} renderItem={card} />
            <Carousel iconNode={<BaseIcon size={16} />} title="Préparations de base" items={bases} renderItem={card} />
            <Carousel icon="leaf" iconColor="var(--green)" title="De saison" items={seasonal} renderItem={card} />
            <Carousel iconNode={<Icon name="bolt" size={16} weight="fill" color="var(--spice)" />} title="Recettes rapides" extra="· moins de 20 min" items={rapide} renderItem={card} />

            {mosaic.length > 0 && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="globe" size={16} color="var(--accent)" /> Par cuisine
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                  {mosaic.map(c => (
                    <button key={c.label} className="cuisine-tile ripple" onClick={() => setActiveCat(c.label)}
                      style={{ position: "relative", aspectRatio: "4/3", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", cursor: "pointer", padding: 0, background: haloForName(c.label) }}>
                      <span style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 32%, rgba(0,0,0,.55) 100%)" }} />
                      <span style={{ position: "absolute", top: 9, right: 10, fontSize: 17 }}>{c.emoji}</span>
                      <span style={{ position: "absolute", left: 14, bottom: 12, textAlign: "left" }}>
                        <span style={{ display: "block", fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", textShadow: "0 2px 8px rgba(0,0,0,.45)" }}>{c.label}</span>
                        <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,.82)", marginTop: 2 }}>{c.count} recette{c.count > 1 ? "s" : ""}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : filtered.length === 0 ? (() => {
          const q = text.trim();
          const qShort = q.length > 22 ? q.slice(0, 22) + "…" : q;
          const hasConstraint = nActiveFilters > 0 || usePrefs || !!authorUid || activeCat !== "tout";
          const reset = () => { setText(""); setFilters({ ...DEFAULT_FILTERS }); setUsePrefs(false); setAuthorUid(null); setActiveCat("tout"); };
          return (
            <div style={{ minHeight: "40vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px", maxWidth: 380, margin: "0 auto" }}>
              <EmptyArt name="loupe" size={116} style={{ marginBottom: 6 }} />
              <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 7 }}>Aucune recette trouvée</h3>
              <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 22 }}>
                {q
                  ? <>Personne n'a encore partagé « <strong style={{ color: "var(--text)", fontWeight: 600 }}>{qShort}</strong> » dans la communauté.<br />Élargis ta recherche ou crée-la toi-même.</>
                  : "Aucune recette publique ne correspond à cette sélection."}
              </p>
              {q ? (onNewRecipe && (
                <button className="btn btn-primary btn-pill" style={{ fontSize: 14 }} onClick={() => onNewRecipe({ name: q })}>
                  <Icon name="plus" size={16} color="#fff" /> Créer « {qShort} »
                </button>
              )) : hasConstraint && (
                <button className="btn btn-primary btn-pill" style={{ fontSize: 14 }} onClick={reset}>
                  <Icon name="close" size={15} color="#fff" /> Tout réafficher
                </button>
              )}
              {q && (
                <button onClick={reset} style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text3)" }}>
                  <Icon name="eraser" size={15} color="var(--text3)" /> {hasConstraint ? "Réinitialiser recherche et filtres" : "Effacer la recherche"}
                </button>
              )}
            </div>
          );
        })() : (
          // ── Mode recherche / catégorie / filtre : grille complète ──
          <div className="recipe-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 14, paddingTop: 2 }}>
            {filtered.map((p, idx) => <div key={p.pubId} id={`discover-card-${p.pubId}`}>{card(p, idx)}</div>)}
          </div>
        )}
      </ElasticScroll>
    </div>
  );
}
