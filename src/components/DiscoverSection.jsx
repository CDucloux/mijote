import { useState, useMemo } from "react";
import { Icon } from "./Icon.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useDiscoverRecipes } from "../hooks/useDiscoverRecipes.js";
import { RecipeCard } from "./RecipeCard.jsx";
import { filterPublicRecipes, publicId } from "../lib/publicRecipes.js";
import { createIngredientResolver } from "../lib/nameMatcher.js";
import { isRecipeInSeason } from "../lib/seasonality.js";
import { cuisineEmoji } from "../constants/cuisines.js";
import { relativeDate } from "../lib/format.js";

const NUTRI_LETTERS = ["A", "B", "C", "D", "E"];
const TINT = "rgba(232,112,58,0.2)";
const CARD_W = "clamp(150px, 46vw, 200px)"; // largeur des cartes en carrousel (= grille)

// Carte d'une recette publique : visuel (hover-lift) + crédit créateur & date dessous.
function PublicRecipeCard({ p, onOpen, onAuthor, owned, inSeason, style }) {
  return (
    <div>
      <div className="discover-card"><RecipeCard recipe={p.recipe} onClick={onOpen} inSeason={inSeason} style={style} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "0 2px" }}>
        <button onClick={onAuthor} title="Filtrer par ce créateur"
          style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          {p.authorPhoto
            ? <img src={p.authorPhoto} alt="" referrerPolicy="no-referrer" style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0 }} />
            : <span style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--surface3)", flexShrink: 0 }} />}
          <span style={{ fontSize: 11, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.authorName || "Anonyme"}</span>
          {owned && <Icon name="check" size={12} color="var(--green)" />}
        </button>
        {p.createdAt && <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 10.5, color: "var(--text3)" }}>{relativeDate(p.createdAt)}</span>}
      </div>
    </div>
  );
}

// Rangée éditoriale horizontale (carrousel). Ne s'affiche pas si vide.
function Carousel({ emoji, title, items, renderItem }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>{title}
      </h3>
      <div className="discover-row" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, scrollSnapType: "x proximity" }}>
        {items.map((it, i) => (
          <div key={it.pubId} style={{ flex: `0 0 ${CARD_W}`, scrollSnapAlign: "start" }}>{renderItem(it, i)}</div>
        ))}
      </div>
    </div>
  );
}

// ─── DÉCOUVRIR — recettes publiques de la communauté ──────────────────────────
export function DiscoverSection({ ingredientDB = [], preferences, recipes = [], onOpenPublic }) {
  const { user } = useAppShell();
  const { recipes: pubs, loading, error, loadedOnce, online, reload } = useDiscoverRecipes(user);
  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);

  const [text, setText] = useState("");
  const [cuisine, setCuisine] = useState(null);
  const [seasonOnly, setSeasonOnly] = useState(false);
  const [nutriMax, setNutriMax] = useState(null);
  const [usePrefs, setUsePrefs] = useState(false);
  const [authorUid, setAuthorUid] = useState(null);
  const [showNutri, setShowNutri] = useState(false);
  const [showCuisine, setShowCuisine] = useState(false);

  // pubId des recettes déjà dans MA bibliothèque (clonées) ou publiées par moi.
  const ownedIds = useMemo(() => {
    const s = new Set();
    for (const r of recipes) { if (r.clonedFrom?.publicId) s.add(r.clonedFrom.publicId); }
    return s;
  }, [recipes]);
  const isOwned = (p) => ownedIds.has(p.pubId) || p.authorUid === user?.uid;
  const isInSeason = (payload) => isRecipeInSeason(payload, resolver);

  // Payloads des bases référencées, retrouvées parmi les docs déjà chargés.
  const componentsFor = (p) => (p.componentRefs || [])
    .map(origId => pubs.find(x => x.pubId === publicId(p.authorUid, origId)))
    .filter(Boolean)
    .map(x => x.recipe);

  const filtered = useMemo(() => filterPublicRecipes(pubs, {
    text, cuisine, seasonOnly, nutriMax, authorUid,
    diet: usePrefs ? preferences?.diet : null,
  }, { isInSeason }), [pubs, text, cuisine, seasonOnly, nutriMax, authorUid, usePrefs, preferences, resolver]); // eslint-disable-line react-hooks/exhaustive-deps

  const cuisines = useMemo(() => [...new Set(pubs.filter(p => !p.isComponent && p.cuisine).map(p => p.cuisine))].sort(), [pubs]);
  const activeFilters = !!(cuisine || seasonOnly || nutriMax || usePrefs || authorUid || text);

  // Rangées éditoriales (mode navigation, sans recherche ni filtre actif).
  const featured = useMemo(() => pubs.filter(p => !p.isComponent).slice(0, 12), [pubs]);
  const seasonal = useMemo(() => filterPublicRecipes(pubs, { seasonOnly: true }, { isInSeason }).slice(0, 12), [pubs, resolver]); // eslint-disable-line react-hooks/exhaustive-deps
  const forYou = useMemo(() => (preferences?.diet && preferences.diet !== "omnivore")
    ? filterPublicRecipes(pubs, { diet: preferences.diet }).slice(0, 12) : [], [pubs, preferences]);
  // Préparations de base (composants publics) : exclues de la recherche/feed normal
  // par filterPublicRecipes ; on les met en avant dans leur propre rangée.
  const bases = useMemo(() => pubs.filter(p => p.isComponent).slice(0, 12), [pubs]);

  const card = (p, idx) => (
    <PublicRecipeCard
      p={p} owned={isOwned(p)} inSeason={isInSeason(p.recipe)}
      onOpen={() => onOpenPublic?.(p, componentsFor(p))}
      onAuthor={() => setAuthorUid(authorUid === p.authorUid ? null : p.authorUid)}
      style={{ animationDelay: `${(idx % 8) * 0.04}s` }}
    />
  );

  const chip = (active, onClick, content) => (
    <button onClick={onClick} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: active ? TINT : "var(--surface2)", color: active ? "var(--accent)" : "var(--text2)", border: `1px solid ${active ? "rgba(232,112,58,0.5)" : "var(--border)"}` }}>{content}</button>
  );
  const noPublic = pubs.length === 0; // aucun contenu public (ni recette, ni base)

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
          <Icon name="sparkle" size={16} color="var(--accent)" /> Découvrir
          {!online && !noPublic && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--orange)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="wifiOff" size={11} color="var(--orange)" /> en cache</span>}
        </h2>
        <button onClick={online ? reload : undefined} disabled={!online} title={online ? "Rafraîchir" : "Indisponible hors ligne"} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--text3)", background: "none", border: "none", cursor: online ? "pointer" : "not-allowed", opacity: online ? 1 : 0.45 }}>
          <Icon name="history" size={14} color="var(--text3)" /> Rafraîchir
        </button>
      </div>

      {/* Recherche */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}><Icon name="search" size={16} color="var(--text3)" /></span>
        <input className="field-input" placeholder="Rechercher par recette, chef, ingrédient…" value={text} onChange={e => setText(e.target.value)} style={{ paddingLeft: 38 }} />
        {text && <button onClick={() => setText("")} aria-label="Effacer" className="search-clear-btn" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}><Icon name="close" size={13} /></button>}
      </div>

      {/* Filtres progressifs */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 4 }}>
        {chip(seasonOnly, () => setSeasonOnly(v => !v), <><span style={{ fontSize: 13, lineHeight: 1 }}>🌿</span> De saison</>)}
        {preferences?.diet && chip(usePrefs, () => setUsePrefs(v => !v), <><span style={{ fontSize: 13, lineHeight: 1 }}>❤️</span> Selon mes préférences</>)}
        {chip(!!nutriMax || showNutri, () => setShowNutri(v => !v), <>{nutriMax ? `Nutri ≤ ${nutriMax}` : "Nutri-Score"} <span style={{ fontSize: 9 }}>{showNutri ? "▲" : "▼"}</span></>)}
        {cuisines.length > 0 && chip(!!cuisine || showCuisine, () => setShowCuisine(v => !v), <>{cuisine || "Cuisine"} <span style={{ fontSize: 9 }}>{showCuisine ? "▲" : "▼"}</span></>)}
        {authorUid && chip(true, () => setAuthorUid(null), <><Icon name="close" size={11} color="var(--accent)" /> Créateur</>)}
      </div>
      {showNutri && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 4 }}>
          {NUTRI_LETTERS.map(L => chip(nutriMax === L, () => setNutriMax(nutriMax === L ? null : L), <>≤ {L}</>))}
        </div>
      )}
      {showCuisine && cuisines.length > 0 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 4 }}>
          {cuisines.map(c => chip(cuisine === c, () => setCuisine(cuisine === c ? null : c), <><span style={{ fontSize: 13, lineHeight: 1 }}>{cuisineEmoji(c)}</span>{c}</>))}
        </div>
      )}

      {/* Résultats */}
      {loading && !loadedOnce ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
          <div style={{ width: 22, height: 22, border: "2.5px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
        </div>
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
          <Carousel emoji="✨" title="À la une" items={featured} renderItem={card} />
          <Carousel emoji="🍲" title="Préparations de base" items={bases} renderItem={card} />
          <Carousel emoji="🌿" title="De saison" items={seasonal} renderItem={card} />
          <Carousel emoji="❤️" title="Pour toi" items={forYou} renderItem={card} />
          {cuisines.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 15, lineHeight: 1 }}>🍽️</span>Par cuisine
              </h3>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, flexWrap: "wrap" }}>
                {cuisines.map(c => chip(false, () => setCuisine(c), <><span style={{ fontSize: 13, lineHeight: 1 }}>{cuisineEmoji(c)}</span>{c}</>))}
              </div>
            </div>
          )}
        </>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text3)", padding: "32px 16px", fontSize: 13 }}>
          Aucun résultat — essaie d'élargir tes filtres.
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
