import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { BaseIcon } from "./BaseIcon.jsx";
import { SpotlightIngredient } from "./SpotlightIngredient.jsx";
import { pickSpotlightIngredient, publicRecipesWithIngredient } from "../lib/spotlight.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useDiscoverRecipes } from "../hooks/useDiscoverRecipes.js";
import { RecipeCard } from "./RecipeCard.jsx";
import { OfficialAvatar } from "./OfficialAvatar.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { RecipeFilterSheet } from "./RecipeFilterSheet.jsx";
import { filterPublicRecipes, publicId, isOfficialAuthor } from "../lib/publicRecipes.js";
import { createIngredientResolver } from "../lib/nameMatcher.js";
import { isRecipeInSeason } from "../lib/seasonality.js";
import { isRecipeVegan } from "../lib/dietary.js";
import { DEFAULT_FILTERS, activeFilterCount, matchesFilters } from "../lib/recipeFilters.js";
import { buildTechniqueIndex } from "../lib/techniques.js";
import { normalizeStr } from "../lib/parseIngredient.js";
import { CUISINES, cuisineEmoji } from "../constants/cuisines.js";
import { relativeDate } from "../lib/format.js";

const TINT = "rgba(232,112,58,0.2)";
// Largeur des cartes en carrousel = exactement la moitié de la rangée visible
// (gap 12 → 50% − 6px), pour afficher pile 2 cartes dans la largeur comme la
// grille de /recipes ; plafonné à 200px sur les écrans larges (desktop).
const CARD_W = "clamp(150px, calc(50% - 6px), 200px)";

// Carte d'une recette publique : visuel (hover-lift) + crédit créateur & date dessous.
function PublicRecipeCard({ p, onOpen, onAdd, onAuthor, owned, inSeason, vegan, style }) {
  return (
    <div>
      <div className="discover-card"><RecipeCard recipe={p.recipe} onClick={onOpen} inSeason={inSeason} vegan={vegan} style={style} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "0 2px" }}>
        <button onClick={onAuthor} title="Filtrer par ce créateur"
          style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          {isOfficialAuthor(p.authorUid)
            ? <OfficialAvatar size={16} />
            : p.authorPhoto
              ? <img src={p.authorPhoto} alt="" referrerPolicy="no-referrer" style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0 }} />
              : <span style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--surface3)", flexShrink: 0 }} />}
          <span style={{ fontSize: 11, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.authorName || "Anonyme"}</span>
          {owned && <Icon name="check" size={12} color="var(--green)" />}
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

// Squelette d'une carte recette (visuel + 2 lignes de méta) pendant le chargement.
function SkeletonCard() {
  return (
    <div>
      <div className="skeleton" style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 12, width: "85%", borderRadius: 6, marginTop: 10 }} />
      <div className="skeleton" style={{ height: 10, width: "55%", borderRadius: 6, marginTop: 7 }} />
    </div>
  );
}

// Rangée de squelettes (mime un carrousel) le temps que les recettes arrivent.
function SkeletonRow({ titleWidth = 130, count = 4 }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="skeleton" style={{ height: 15, width: titleWidth, borderRadius: 6, marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 12, overflow: "hidden" }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ flex: `0 0 ${CARD_W}` }}><SkeletonCard /></div>
        ))}
      </div>
    </div>
  );
}

function DiscoverSkeleton() {
  return (
    <div style={{ paddingTop: 4 }}>
      <SkeletonRow titleWidth={110} />
      <SkeletonRow titleWidth={160} />
      <SkeletonRow titleWidth={130} />
    </div>
  );
}

// Rangée éditoriale horizontale (carrousel). Ne s'affiche pas si vide.
function Carousel({ icon, iconNode, title, items, renderItem }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
        {iconNode || (icon && <Icon name={icon} size={15} color="var(--accent)" />)}{title}
      </h3>
      <div className="discover-row" style={{ display: "flex", gap: 12, overflowX: "auto", paddingTop: 6, paddingBottom: 6, scrollSnapType: "x proximity" }}>
        {items.map((it, i) => (
          <div key={it.pubId} style={{ flex: `0 0 ${CARD_W}`, scrollSnapAlign: "start" }}>{renderItem(it, i)}</div>
        ))}
      </div>
    </div>
  );
}

// ─── DÉCOUVRIR – recettes publiques de la communauté ──────────────────────────
export function DiscoverSection({ ingredientDB = [], preferences, recipes = [], onOpenPublic, onClonePublic }) {
  const { user, techniques = [] } = useAppShell();
  const navigate = useNavigate();
  const { recipes: pubs, loading, error, loadedOnce, online, reload } = useDiscoverRecipes(user);
  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  const techIndex = useMemo(() => buildTechniqueIndex(techniques), [techniques]);

  const [text, setText] = useState("");
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState("date");
  const [usePrefs, setUsePrefs] = useState(false);
  const [authorUid, setAuthorUid] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { root: null, threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // pubId des recettes déjà dans MA bibliothèque (clonées) ou publiées par moi.
  const ownedIds = useMemo(() => {
    const s = new Set();
    for (const r of recipes) { if (r.clonedFrom?.publicId) s.add(r.clonedFrom.publicId); }
    return s;
  }, [recipes]);
  const isOwned = (p) => ownedIds.has(p.pubId) || p.authorUid === user?.uid;
  const isInSeason = (payload) => isRecipeInSeason(payload, resolver);
  const isVegan = (payload) => isRecipeVegan(payload, resolver);

  // Payloads des bases référencées, retrouvées parmi les docs déjà chargés.
  const componentsFor = (p) => (p.componentRefs || [])
    .map(origId => pubs.find(x => x.pubId === publicId(p.authorUid, origId)))
    .filter(Boolean)
    .map(x => x.recipe);

  // Filtres unifiés avec /recipes (mêmes options via RecipeFilterSheet), + la
  // recherche texte, le filtre auteur (clic sur un créateur) et « selon mes
  // préférences » propres à Découvrir.
  const nActiveFilters = activeFilterCount(filters);
  const filtered = useMemo(() => {
    const q = normalizeStr(text);
    const diet = usePrefs ? preferences?.diet : null;
    return pubs
      .filter(p => {
        if (q) {
          const hay = (p.keywords || []).join(" ");
          if (!normalizeStr(hay).includes(q) && !normalizeStr(p.name).includes(q)) return false;
        }
        if (authorUid && p.authorUid !== authorUid) return false;
        if (diet && diet !== "omnivore" && !(p.dietTags || []).includes(diet)) return false;
        return matchesFilters(p.recipe, filters, { resolver, techniques, techIndex });
      })
      .sort((a, b) => sortBy === "name"
        ? (a.recipe.name || "").localeCompare(b.recipe.name || "")
        : sortBy === "health"
          ? (b.recipe.healthScore || 0) - (a.recipe.healthScore || 0)
          : new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [pubs, text, authorUid, usePrefs, preferences, filters, sortBy, resolver, techniques, techIndex]);

  const cuisines = useMemo(() => [...new Set(pubs.filter(p => !p.isComponent && p.cuisine).map(p => p.cuisine))].sort(), [pubs]);
  const usedCuisines = useMemo(() => CUISINES.filter(c => pubs.some(p => p.cuisine === c.label)), [pubs]);
  const activeFilters = !!(usePrefs || authorUid || text) || nActiveFilters > 0;

  // Rangées éditoriales (mode navigation, sans recherche ni filtre actif).
  const featured = useMemo(() => pubs.filter(p => !p.isComponent).slice(0, 12), [pubs]);
  const seasonal = useMemo(() => filterPublicRecipes(pubs, { seasonOnly: true }, { isInSeason }).slice(0, 12), [pubs, resolver]); // eslint-disable-line react-hooks/exhaustive-deps
  const forYou = useMemo(() => (preferences?.diet && preferences.diet !== "omnivore")
    ? filterPublicRecipes(pubs, { diet: preferences.diet }).slice(0, 12) : [], [pubs, preferences]);
  // Préparations de base (composants publics) : exclues de la recherche/feed normal
  // par filterPublicRecipes ; on les met en avant dans leur propre rangée.
  const bases = useMemo(() => pubs.filter(p => p.isComponent).slice(0, 12), [pubs]);

  // Ingrédient du moment (fruit/légume de saison, rotation hebdo) + recettes
  // publiques qui l'utilisent.
  const spotlight = useMemo(() => pickSpotlightIngredient(ingredientDB), [ingredientDB]);
  const spotlightRecipes = useMemo(() => publicRecipesWithIngredient(spotlight, pubs, resolver, 10), [spotlight, pubs, resolver]);

  const card = (p, idx) => (
    <PublicRecipeCard
      p={p} owned={isOwned(p)} inSeason={isInSeason(p.recipe)} vegan={isVegan(p.recipe)}
      onOpen={() => onOpenPublic?.(p, componentsFor(p))}
      onAdd={onClonePublic ? () => onClonePublic(p) : undefined}
      onAuthor={() => setAuthorUid(authorUid === p.authorUid ? null : p.authorUid)}
      style={{ animationDelay: `${(idx % 8) * 0.04}s` }}
    />
  );

  const chip = (active, onClick, content) => (
    <button onClick={onClick} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: active ? TINT : "var(--surface2)", color: active ? "var(--accent)" : "var(--text2)", border: `1px solid ${active ? "rgba(232,112,58,0.5)" : "var(--border)"}` }}>{content}</button>
  );
  const noPublic = pubs.length === 0; // aucun contenu public (ni recette, ni base)

  return (
    <section className="slide-up" style={{ animationDelay: "0.22s" }}>
      {/* Ingrédient du moment : accroche éditoriale, au-dessus de la barre de
          recherche (uniquement en mode navigation). */}
      {spotlight && !activeFilters && (
        <SpotlightIngredient
          ingredient={spotlight}
          recipes={spotlightRecipes}
          onOpenIngredient={(ing) => navigate(`/config/ingredients/${encodeURIComponent(ing.id)}`)}
          onOpenPublic={(p) => onOpenPublic?.(p, componentsFor(p))}
          onPublish={() => navigate("/recipes")}
        />
      )}

      {/* Sentinelle pour détecter le sticky */}
      <div ref={sentinelRef} style={{ height: 1, marginBottom: -1, pointerEvents: "none" }} />

      {/* En-tête sticky – fond toujours opaque & pleine largeur pour masquer le
          contenu qui défile derrière (l'ombre n'apparaît qu'une fois collé). */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "var(--bg)",
        boxShadow: stuck ? "0 4px 12px rgba(0,0,0,0.10)" : "none",
        margin: "0 -20px",
        padding: "8px 20px 6px",
        transition: "box-shadow 0.2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
            <Icon name="sparkle" size={16} color="var(--accent)" /> Découvrir
            {!online && !noPublic && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--orange)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="wifiOff" size={11} color="var(--orange)" /> en cache</span>}
          </h2>
          <button
            onClick={() => { if (!online || spinning) return; setSpinning(true); reload(); setTimeout(() => setSpinning(false), 1500); }}
            disabled={!online}
            title={online ? "Rafraîchir" : "Indisponible hors ligne"}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: spinning ? "var(--accent)" : "var(--text3)", background: "none", border: "none", cursor: online ? "pointer" : "not-allowed", opacity: online ? 1 : 0.45, transition: "color 0.2s" }}>
            <span style={{ display: "inline-flex", animation: spinning ? "spin 0.75s linear infinite" : undefined }}>
              <Icon name="history" size={14} color={spinning ? "var(--accent)" : "var(--text3)"} />
            </span>
            Rafraîchir
          </button>
        </div>

        {/* Recherche */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}><Icon name="search" size={16} color="var(--text3)" /></span>
          <input className="field-input" placeholder="Rechercher par recette, chef, ingrédient…" value={text} onChange={e => setText(e.target.value)} style={{ paddingLeft: 38 }} />
          {text && <button onClick={() => setText("")} aria-label="Effacer" className="search-clear-btn" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}><Icon name="close" size={13} /></button>}
        </div>

        {/* Barre de filtres — mêmes options que /recipes (feuille dédiée) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12 }}>
          <button className="filter-btn" onClick={() => setFilterOpen(true)} title="Trier et filtrer" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 22, fontSize: 12.5, fontWeight: 600, background: nActiveFilters ? "rgba(232,112,58,0.16)" : "var(--surface2)", color: nActiveFilters ? "var(--accent)" : "var(--text2)", border: `1px solid ${nActiveFilters ? "rgba(232,112,58,0.5)" : "var(--border)"}` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Filtres
            {nActiveFilters > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{nActiveFilters}</span>}
          </button>
          {preferences?.diet && preferences.diet !== "omnivore" && chip(usePrefs, () => setUsePrefs(v => !v), <><Icon name="heart" size={13} color="currentColor" /> Mes préférences</>)}
          {authorUid && chip(true, () => setAuthorUid(null), <><Icon name="close" size={11} color="var(--accent)" /> Créateur</>)}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text3)", whiteSpace: "nowrap" }}>
            Trié par <strong style={{ color: "var(--text2)", fontWeight: 600 }}>{sortBy === "name" ? "A → Z" : sortBy === "health" ? "Santé" : "Récent"}</strong>
          </span>
        </div>
      </div>{/* fin sticky header */}

      {filterOpen && (
        <SwipeableSheet onClose={() => setFilterOpen(false)} hideHandle style={{ maxHeight: "90dvh", paddingBottom: 0 }}>
          <RecipeFilterSheet filters={filters} setFilters={setFilters} sortBy={sortBy} setSortBy={setSortBy} usedCuisines={usedCuisines} ingredientDB={ingredientDB} resultCount={filtered.length} onClose={() => setFilterOpen(false)} />
        </SwipeableSheet>
      )}

      {/* Résultats */}
      {(loading && !loadedOnce) || spinning ? (
        <DiscoverSkeleton />
      ) : error ? (
        <div style={{ textAlign: "center", color: "var(--text3)", padding: "28px 0", fontSize: 13 }}>
          Impossible de charger les recettes publiques.<br />
          <button onClick={reload} className="btn btn-ghost" style={{ marginTop: 10, borderRadius: 12 }}>Réessayer</button>
        </div>
      ) : noPublic && !online ? (
        // Hors-ligne sans rien en cache : on ne fait pas croire qu'il n'y a aucune recette.
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "26px 16px", borderRadius: 16, background: "var(--surface)", border: "1px dashed var(--border)" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(240,153,42,0.14)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
            <Icon name="wifiOff" size={22} color="var(--orange)" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Hors ligne</div>
          <div style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, maxWidth: 300 }}>
            La découverte des recettes de la communauté reviendra automatiquement dès le retour de la connexion.
          </div>
        </div>
      ) : noPublic ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "26px 16px", borderRadius: 16, background: "var(--surface)", border: "1px dashed var(--border)" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(232,112,58,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
            <Icon name="sparkle" size={22} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Encore aucune recette publique</div>
          <div style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, maxWidth: 300 }}>
            Sois le premier à partager : ouvre une de tes recettes et choisis « Rendre publique ».
          </div>
        </div>
      ) : !activeFilters ? (
        // ── Mode navigation : feed éditorial ──
        <>
          <Carousel icon="fire" title="À la une" items={featured} renderItem={card} />
          <Carousel iconNode={<BaseIcon size={15} />} title="Préparations de base" items={bases} renderItem={card} />
          <Carousel icon="leaf" title="De saison" items={seasonal} renderItem={card} />
          <Carousel icon="heart" title="Pour toi" items={forYou} renderItem={card} />
          {cuisines.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                <Icon name="globe" size={15} color="var(--accent)" /> Par cuisine
              </h3>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, flexWrap: "wrap" }}>
                {cuisines.map(c => chip(false, () => setFilters(f => ({ ...f, cuisines: [c] })), <><span style={{ fontSize: 13, lineHeight: 1 }}>{cuisineEmoji(c)}</span>{c}</>))}
              </div>
            </div>
          )}
        </>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text3)", padding: "32px 16px", fontSize: 13 }}>
          Aucun résultat – essaie d'élargir tes filtres.
        </div>
      ) : (
        // ── Mode recherche / filtre : grille complète ──
        <div className="recipe-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {filtered.map((p, idx) => <div key={p.pubId}>{card(p, idx)}</div>)}
        </div>
      )}
    </section>
  );
}
