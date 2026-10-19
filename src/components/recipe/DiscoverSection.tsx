import { useState, useMemo, useRef, useEffect, useCallback, type UIEvent } from "react";
import { Icon } from "../ui/Icon.jsx";
import { ClearSearchButton } from "../ui/ClearSearchButton.jsx";
import { BaseIcon } from "../ui/BaseIcon.jsx";
import { EmptyArt } from "../ui/EmptyArt.jsx";
import { ElasticScroll } from "../ui/ElasticScroll.jsx";
import { useAppShell } from "../../context/AppShellContext.jsx";
import { useDiscoverRecipes } from "../../hooks/useDiscoverRecipes.js";
import { useDiscoverFavorites } from "../../hooks/useDiscoverFavorites.js";
import { PublicRecipeCard, DiscoverSkeleton, DiscoverRow, Carousel, CuisineMosaic, DISCOVER_RED } from "./DiscoverFeed.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { RecipeFilterSheet } from "./RecipeFilterSheet.jsx";
import { filterPublicRecipes, publicId, type PublicDoc } from "@/lib/household/publicRecipes.js";
import { createIngredientResolver } from "@/lib/food/nameMatcher.js";
import { isRecipeInSeason } from "@/lib/food/seasonality.js";
import { isRecipeVegan } from "@/lib/food/dietary.js";
import { asNutriLetter, computeNutriInfo, buildRecipeIndex } from "@/lib/recipes/nutriscore.js";
import { DEFAULT_FILTERS, activeFilterCount, matchesFilters, collectChefs } from "@/lib/recipes/recipeFilters.js";
import { DEFAULT_SORT_KEY, defaultDirFor, makeComparator } from "@/lib/recipes/recipeSort.js";
import { STATIC_CATEGORIES, matchesDiscoverCategory, isQuickRecipe } from "@/lib/recipes/discoverFeed.js";
import { isEligible } from "@/lib/food/dietFilter.js";
import { buildTechniqueIndex } from "@/lib/recipes/techniques.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { CUISINES } from "../../constants/cuisines.js";
import type { Preferences } from "../../constants/preferences.js";
import type { DbEntry } from "@/lib/food/nameMatcher.js";
import type { RecipeFilters } from "@/lib/recipes/recipeFilters.js";
import type { Recipe } from "@/lib/types.js";

const TINT = "rgba(var(--accent-rgb),0.14)";

interface DiscoverSectionProps {
  ingredientDB?: DbEntry[];
  preferences?: Preferences;
  /** Recettes de l'utilisateur : repère celles déjà ajoutées depuis la communauté. */
  recipes?: Recipe[];
  /** Ouvre une recette publique avec ses préparations de base publiques. */
  onOpenPublic?: (pub: PublicDoc, components: Recipe[]) => void;
  onClonePublic?: (pub: PublicDoc) => void;
  /** Création d'une recette pré-nommée depuis une recherche sans résultat. */
  onNewRecipe?: (seed: { name: string }) => void;
  /** Recherche pré-remplie (ex. depuis l'accueil), consommée une fois appliquée. */
  initialSearch?: string;
  onSeedConsumed?: () => void;
}

/** État mémorisé entre deux visites (recherche, filtres, défilement). */
interface DiscoverMemo {
  text: string;
  filters: RecipeFilters;
  activeCat: string;
  usePrefs: boolean;
  authorUid: string | null;
  top: number;
}
// ─── DÉCOUVRIR – recettes publiques de la communauté ──────────────────────────
// Recherche, filtres et position de défilement mémorisés entre deux visites :
// ouvrir une fiche démonte la section. Niveau module (réinitialisé au rechargement
// complet), même dispositif que RecipesPage.
let discoverMemo: DiscoverMemo = { text: "", filters: { ...DEFAULT_FILTERS }, activeCat: "tout", usePrefs: false, authorUid: null, top: 0 };

export function DiscoverSection({ ingredientDB = [], preferences, recipes = [], onOpenPublic, onClonePublic, onNewRecipe, initialSearch = "", onSeedConsumed }: DiscoverSectionProps) {
  const { user, techniques = [] } = useAppShell();
  const { recipes: pubs, loading, error, loadedOnce, online, reload } = useDiscoverRecipes(user);
  const { favorites, favIds, favCount, toggleFavorite } = useDiscoverFavorites(user);
  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  const techIndex = useMemo(() => buildTechniqueIndex(techniques), [techniques]);

  const [text, setText] = useState(discoverMemo.text);
  const searchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const seed = (initialSearch || "").trim();
    if (!seed) return;
    setText(seed);
    requestAnimationFrame(() => searchRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    onSeedConsumed?.();
  }, [initialSearch, onSeedConsumed]);
  const [filters, setFilters] = useState(discoverMemo.filters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(discoverMemo.activeCat);
  const [usePrefs, setUsePrefs] = useState(discoverMemo.usePrefs);
  const [authorUid, setAuthorUid] = useState(discoverMemo.authorUid);
  useEffect(() => { discoverMemo = { ...discoverMemo, text, filters, activeCat, usePrefs, authorUid }; }, [text, filters, activeCat, usePrefs, authorUid]);
  const rememberScroll = useCallback((e: UIEvent<HTMLElement>) => { discoverMemo.top = e.currentTarget.scrollTop; }, []);
  const [spinning, setSpinning] = useState(false);

  // pubId des recettes déjà dans MA bibliothèque (clonées) ou publiées par moi.
  const ownedIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of recipes) { if (r.clonedFrom?.publicId) s.add(r.clonedFrom.publicId); }
    return s;
  }, [recipes]);
  const isOwned = (p: PublicDoc) => ownedIds.has(p.pubId) || p.authorUid === user?.uid;
  const isInSeason = (payload: Recipe) => isRecipeInSeason(payload, resolver);
  const isVegan = (payload: Recipe) => isRecipeVegan(payload, resolver);
  const pubRecipesById = useMemo(() => buildRecipeIndex(pubs.map(x => x.recipe)), [pubs]);
  const liveNutri = (recipe: Recipe) => computeNutriInfo(recipe.ingredients, ingredientDB || [], pubRecipesById).letter ?? asNutriLetter(recipe.nutriLetter);

  const componentsFor = (p: PublicDoc) => p.componentRefs
    .map(origId => pubs.find(x => x.pubId === publicId(p.authorUid, origId))?.recipe)
    .filter((recipe): recipe is Recipe => recipe !== undefined);

  // Drapeaux d'une recette pour l'appariement de catégorie (favori/vegan/saison/rapide/base/cuisine).
  const flagsFor = (p: PublicDoc) => ({
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
      .map(p => ({ p, view: { ...p.recipe, id: p.pubId, name: p.recipe.name ?? "", createdAt: p.createdAt } }))
      .sort((a, b) => cmp(a.view, b.view))
      .map(x => x.p);
  }, [pubs, text, authorUid, usePrefs, preferences, filters, activeCat, favorites, resolver, techniques, techIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const usedCuisines = useMemo(() => CUISINES.filter(c => pubs.some(p => p.cuisine === c.label)), [pubs]);
  const usedChefs = useMemo(() => collectChefs(pubs.map(p => p.recipe)), [pubs]);
  // Catégories = statiques + cuisines réellement présentes (chips collants).
  const categories = useMemo(() => [
    ...STATIC_CATEGORIES,
    ...usedCuisines.map(c => ({ key: c.label, label: c.label })),
  ], [usedCuisines]);

  // Rangées éditoriales (mode navigation).
  const favList = useMemo(() => favIds.map(id => pubs.find(p => p.pubId === id)).filter((p): p is PublicDoc => p !== undefined), [favIds, pubs]);
  const trending = useMemo(() => pubs.filter(p => !p.isComponent).slice(0, 12), [pubs]);
  const bases = useMemo(() => pubs.filter(p => p.isComponent).slice(0, 12), [pubs]);
  const seasonal = useMemo(() => filterPublicRecipes(pubs, { seasonOnly: true }, { isInSeason }).slice(0, 12), [pubs, resolver]); // eslint-disable-line react-hooks/exhaustive-deps
  const rapide = useMemo(() => pubs.filter(p => !p.isComponent && isQuickRecipe(p.recipe)).slice(0, 12), [pubs]);
  const mosaic = useMemo(() => usedCuisines
    .map(c => ({ label: c.label, emoji: c.emoji, count: pubs.filter(p => !p.isComponent && p.cuisine === c.label).length }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count), [usedCuisines, pubs]);

  const card = (p: PublicDoc, idx: number) => (
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
      {/* En-tête FIXE (hors défilement) : recherche + pastilles, sans filet gris.
          Le padding-bas des pastilles (ci-dessous) réserve la place de la barre de
          scroll horizontale sur desktop, pour qu'elle passe SOUS les pills. */}
      <div style={{ flexShrink: 0, background: "var(--bg)", padding: "0 20px 4px" }}>
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

        {/* Pastilles DIRECTEMENT sous la recherche (dans l'en-tête fixe, pas de barre
            grise ni de zone collante à part) : action Filtres, puis catégories
            défilantes, puis préférences / créateur. Débord latéral pour défiler
            d'un bord à l'autre. */}
        {!noPublic && !error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", margin: "0 -20px", padding: "0 20px 10px" }}>
            <button className="ripple" onClick={() => setFilterOpen(true)} title="Filtrer"
              style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", border: `1px solid ${nActiveFilters > 0 ? "rgba(var(--accent-rgb),0.5)" : "var(--border)"}`, background: nActiveFilters > 0 ? TINT : "var(--surface)", color: nActiveFilters > 0 ? "var(--accent)" : "var(--text2)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              Filtres
              {nActiveFilters > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{nActiveFilters}</span>}
            </button>
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
        )}
      </div>

      {filterOpen && (
        <SwipeableSheet onClose={() => setFilterOpen(false)} hideHandle style={{ maxHeight: "90dvh", paddingTop: 0, paddingBottom: 0 }}>
          {(close) => (
            <RecipeFilterSheet filters={filters} setFilters={setFilters} usedCuisines={usedCuisines} usedChefs={usedChefs} ingredientDB={ingredientDB} resultCount={filtered.length} onClose={() => close()} />
          )}
        </SwipeableSheet>
      )}

      {/* Zone défilante : feed éditorial / grille */}
      <ElasticScroll initialScrollTop={discoverMemo.top} onScroll={rememberScroll} style={{ flex: 1, padding: "14px 20px var(--page-pad-b)" }}>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill={DISCOVER_RED} stroke={DISCOVER_RED} strokeWidth="1.5"><path d="M12 20.3 4.2 12.5a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 6.5z" /></svg>
                Mes favoris
                {favCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: DISCOVER_RED, background: "rgba(224,85,78,.12)", borderRadius: 999, padding: "2px 8px" }}>{favCount}</span>}
              </h3>
              {favList.length > 0 ? (
                <DiscoverRow items={favList} renderItem={card} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 16, background: "var(--surface)", border: "1px dashed rgba(224,85,78,.4)" }}>
                  <span style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(224,85,78,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={DISCOVER_RED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.3 4.2 12.5a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 6.5z" /></svg>
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

            <CuisineMosaic tiles={mosaic} onSelect={setActiveCat} />
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
                <ClearSearchButton onClick={reset} label={hasConstraint ? "Réinitialiser recherche et filtres" : undefined} style={{ marginTop: 16 }} />
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
