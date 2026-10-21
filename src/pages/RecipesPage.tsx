import { useState, useEffect, useMemo, useCallback, type Dispatch, type SetStateAction } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LoadMoreButton } from "../components/ui/LoadMoreButton.jsx";
import { UserAvatar } from "../components/user/UserAvatar.jsx";
import { NewRecipeButton } from "../components/recipe/NewRecipeButton.jsx";
import { SwipeableSheet } from "../components/ui/SwipeableSheet.jsx";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.jsx";
import { RecipeFilterSheet } from "../components/recipe/RecipeFilterSheet.jsx";
import { LibrarySkeleton } from "../components/library/LibrarySkeleton.jsx";
import { LibraryToolbar } from "../components/library/LibraryToolbar.jsx";
import { LibraryWelcome, NoRecipeResults } from "../components/library/LibraryEmptyStates.jsx";
import { NotebooksRow } from "../components/library/NotebooksRow.jsx";
import { RecipeGridItem } from "../components/library/RecipeGridItem.jsx";
import { RecipeMenuSheet } from "../components/library/RecipeMenuSheet.jsx";
import { NotebookPickerSheet } from "../components/library/NotebookPickerSheet.jsx";
import { NotebookMenuSheet } from "../components/library/NotebookMenuSheet.jsx";
import { NotebookEditorSheet } from "../components/library/NotebookEditorSheet.jsx";
import { CUISINES } from "../constants/cuisines.js";
import { SORT_OPTIONS, DEFAULT_SORT_KEY, defaultDirFor, makeComparator, type SortDir, type SortKey } from "@/lib/recipes/recipeSort.js";
import { DEFAULT_FILTERS, activeFilterCount, matchesFilters, matchesRecipeSearch, collectChefs, type RecipeFilters } from "@/lib/recipes/recipeFilters.js";
import {
  blankNotebookDraft, isSmartNotebook, countNotebook, isSmartViewActive, reorderNotebooks,
  shiftNotebook, createNotebook, applyNotebookEdit, type NotebookDraft,
} from "@/lib/recipes/notebooks.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { buildTechniqueIndex } from "@/lib/recipes/techniques.js";
import { busyFloor } from "@/lib/ui/busyFloor.js";
import type { DbEntry } from "@/lib/food/nameMatcher.js";
import type { Notebook, Recipe, SavedRecipe } from "@/lib/types.js";
import { isSavedRecipe } from "@/lib/recipes/savedRecipes.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useLS } from "../hooks/useLS.js";
import { useLongPress } from "../hooks/useLongPress.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { useLibraryPaging, RECIPES_PAGE } from "../hooks/useLibraryPaging.js";
import type { UseRecipeDerivedResult } from "../hooks/useRecipeDerived.js";

interface RecipesPageProps {
  recipes: Recipe[];
  collections: Notebook[];
  ingredientDB?: DbEntry[] | null;
  /** Dérivés coûteux (saison, vegan, Nutri-Score), calculés dans App qui ne se démonte pas. */
  recipeDerived: UseRecipeDerivedResult;
  loading?: boolean;
  onSelect: (recipeId: string) => void;
  onNewRecipe: (prefill?: { name: string }) => void;
  onSearchCommunity?: (query: string) => void;
  onEditRecipe?: (recipe: SavedRecipe) => void;
  onDeleteRecipe?: (recipeId: string) => void;
  onDuplicate?: (recipe: SavedRecipe) => void;
  onAddToShopping?: (recipe: SavedRecipe) => void;
  onToggleCollection?: (recipeId: string, notebookId: string) => void;
  onPlanRecipe?: (recipe: SavedRecipe) => void;
  onShareRecipe?: (recipe: SavedRecipe) => void;
  setCollections: Dispatch<SetStateAction<Notebook[]>>;
  setTab?: (tab: string) => void;
}

type PendingDelete = { kind: "notebook"; item: Notebook } | { kind: "recipe"; item: SavedRecipe };

// Cascade d'entrée des cartes, plafonnée pour que les dernières n'attendent pas.
const MAX_STAGGER = 0.6;
// Squelette (une fois par session) : laisse aux images le temps d'arriver.
let skeletonSeen = false;
const SKELETON_MS = 550;

const ingredientFilterOf = (state: unknown): string | null =>
  state && typeof state === "object" && "ingredientFilter" in state && typeof state.ingredientFilter === "string" ? state.ingredientFilter : null;

/** Bibliothèque « Mes Recettes » : recherche, filtres, tri, carnets et grille paginée. */
export function RecipesPage({ recipes: allRecipes, collections, ingredientDB, recipeDerived, loading = false, onSelect, onNewRecipe, onSearchCommunity, onEditRecipe, onDeleteRecipe, onDuplicate, onAddToShopping, onToggleCollection, onPlanRecipe, onShareRecipe, setCollections, setTab }: RecipesPageProps) {
  const { techniques } = useAppShell();
  const recipes = useMemo(() => allRecipes.filter(isSavedRecipe), [allRecipes]);
  const [search, setSearch] = useState("");
  const [booting, setBooting] = useState(() => !skeletonSeen && recipes.length > 0);
  useEffect(() => {
    skeletonSeen = true;
    // Toujours (re)programmé en booting : le double montage de StrictMode annule le
    // 1er timer, gater sur `skeletonSeen` bloquerait le squelette au 2ᵉ montage.
    if (!booting) return;
    const t = setTimeout(() => setBooting(false), SKELETON_MS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Persistés : carnet sélectionné, tri et filtres survivent au rechargement.
  const [filterCol, setFilterCol] = useLS<string | null>("rf_recipes_filterCol", null);
  const [sortBy, setSortBy] = useLS<SortKey>("rf_recipes_sortBy", DEFAULT_SORT_KEY);
  const [sortDir, setSortDir] = useLS<SortDir>("rf_recipes_sortDir", defaultDirFor(DEFAULT_SORT_KEY));
  const [storedFilters, setFilters] = useLS<RecipeFilters>("rf_recipes_filters", DEFAULT_FILTERS);
  // Fusion avec les défauts : robuste si DEFAULT_FILTERS gagne une clé après coup.
  const filters = useMemo(() => ({ ...DEFAULT_FILTERS, ...storedFilters }), [storedFilters]);

  // Arrivée depuis le menu d'un bocal (Stock) : bibliothèque filtrée sur cet ingrédient.
  // Posé PENDANT le rendu (une fois par entrée d'historique), puis l'état de navigation
  // est effacé pour qu'un retour ne le réapplique pas.
  const location = useLocation();
  const navigate = useNavigate();
  const seededIngredient = ingredientFilterOf(location.state);
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (seededIngredient && seededKey !== location.key) {
    setSeededKey(location.key);
    setFilterCol(null);
    setSearch("");
    setFilters({ ...DEFAULT_FILTERS, ingredients: [seededIngredient] });
  }
  useEffect(() => {
    if (seededIngredient) navigate(location.pathname, { replace: true, state: null });
  }, [seededIngredient, location.pathname, navigate]);

  const [filterOpen, setFilterOpen] = useState(false);
  const cycleSort = () => {
    const keys = SORT_OPTIONS.map(o => o.key);
    const next = keys[(keys.indexOf(sortBy) + 1) % keys.length];
    setSortBy(next); setSortDir(defaultDirFor(next));
  };
  const [draft, setDraft] = useState<NotebookDraft | null>(null);
  const [notebookMenu, setNotebookMenu] = useState<Notebook | null>(null);
  const [recipeMenu, setRecipeMenu] = useState<SavedRecipe | null>(null);
  const [pickFor, setPickFor] = useState<SavedRecipe | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingSmartId, setEditingSmartId] = useState<string | null>(null);
  const longPress = useLongPress();
  const { wasLongPress } = longPress;
  const [hideNotebooks, setHideNotebooks] = useLS("mijote_hideCarnets", false);

  const { resolver, seasonVeganById } = recipeDerived;
  const openRecipe = useCallback((r: SavedRecipe) => { if (!wasLongPress()) onSelect(r.id); }, [onSelect, wasLongPress]);
  const openRecipeMenu = useCallback((r: SavedRecipe) => setRecipeMenu(r), []);

  const usedCuisines = CUISINES.filter(c => recipes.some(r => r.cuisine === c.label));
  const usedChefs = useMemo(() => collectChefs(recipes), [recipes]);
  const techIndex = useMemo(() => buildTechniqueIndex(techniques), [techniques]);
  const nActiveFilters = activeFilterCount(filters);

  const matchCtx = useMemo(() => ({ resolver, techniques, techIndex, recipes }), [resolver, techniques, techIndex, recipes]);
  const countOf = useCallback((nb: Notebook) => countNotebook(nb, recipes, matchCtx), [recipes, matchCtx]);
  const view = { filters, search, selectedId: filterCol };
  const smartActive = (nb: Notebook) => isSmartViewActive(nb, view);
  const notebookActive = (nb: Notebook) => isSmartNotebook(nb) ? smartActive(nb) : filterCol === nb.id;
  const showView = (nb: Notebook) => { setFilters({ ...DEFAULT_FILTERS, ...nb.filters }); setSearch(nb.search || ""); };
  const openNotebook = (nb: Notebook) => {
    if (!isSmartNotebook(nb)) setFilterCol(filterCol === nb.id ? null : nb.id);
    else if (smartActive(nb)) { setFilters({ ...DEFAULT_FILTERS }); setSearch(""); }
    else { setFilterCol(null); showView(nb); }
  };
  // Rouvre la feuille de filtres sur la vue d'un carnet intelligent (édition).
  const editNotebookFilters = (nb: Pick<Notebook, "id" | "filters" | "search">) => {
    showView(nb); setEditingSmartId(nb.id); setFilterOpen(true);
  };

  const filtered = useMemo(() => recipes
    .filter(r => matchesRecipeSearch(r, search) && (!filterCol || !!r.collections?.includes(filterCol)) && matchesFilters(r, filters, matchCtx))
    // Le tri « Nutri-Score » lit le score recalculé EN DIRECT (celui des badges), pas la valeur figée.
    .map(r => {
      const live = seasonVeganById.get(r.id)?.healthScore;
      return (typeof live === "number" && live !== r.healthScore) ? { ...r, healthScore: live } : r;
    })
    .sort(makeComparator({ sortBy, sortDir, techniques, techIndex, recipes })),
  [recipes, search, filterCol, filters, sortBy, sortDir, matchCtx, techniques, techIndex, seasonVeganById]);

  // Carnet persisté mais supprimé depuis (autre session / appareil) : on nettoie le filtre.
  useEffect(() => { if (filterCol && !collections.some(c => c.id === filterCol)) setFilterCol(null); }, [filterCol, collections, setFilterCol]);

  // Signature du jeu de résultats : clé de remontage de la grille (cascade d'entrée)
  // et déclencheur du retour au premier lot.
  const gridKey = `${filterCol || "all"}|${normalizeStr(search)}|${sortBy}|${sortDir}`;
  const isDesktop = useIsDesktop();
  const { scrollRef, contentRef } = useElasticScroll<HTMLDivElement>({ disabled: isDesktop });
  const { visibleCount, animateGrid, loadingMore, loadMore, rememberScroll } = useLibraryPaging({ gridKey, revealed: !booting && !loading, scrollRef });
  const visibleRecipes = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visibleRecipes.length;

  const saveDraft = () => {
    if (!draft) return;
    setCollections(prev => draft.editing ? applyNotebookEdit(prev, draft) : [...prev, createNotebook(draft, "c" + Date.now())]);
    setDraft(null);
  };
  const resetView = () => { setSearch(""); setFilters({ ...DEFAULT_FILTERS }); setFilterCol(null); };
  const confirmDeletion = async (pending: PendingDelete) => {
    setDeleting(true);
    await busyFloor();
    if (pending.kind === "notebook") {
      setCollections(prev => prev.filter(c => c.id !== pending.item.id));
      if (filterCol === pending.item.id) setFilterCol(null);
    } else {
      onDeleteRecipe?.(pending.item.id);
    }
    setDeleting(false);
    setConfirmDelete(null);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>Mes Recettes</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NewRecipeButton onManual={() => onNewRecipe()} />
            <UserAvatar />
          </div>
        </div>
        <LibraryToolbar search={search} onSearch={setSearch} nActiveFilters={nActiveFilters} onOpenFilters={() => setFilterOpen(true)}
          sortBy={sortBy} sortDir={sortDir} onCycleSort={cycleSort} onToggleSortDir={() => setSortDir(d => (d === "asc" ? "desc" : "asc"))}
          resultCount={recipes.length > 0 ? filtered.length : null} />
      </div>
      {filterOpen && (
        <SwipeableSheet onClose={() => { setFilterOpen(false); setEditingSmartId(null); }} hideHandle style={{ maxHeight: "90dvh", paddingTop: 0, paddingBottom: 0 }}>
          {(close) => (
            <RecipeFilterSheet filters={filters} setFilters={setFilters} usedCuisines={usedCuisines} usedChefs={usedChefs} ingredientDB={ingredientDB || []} resultCount={filtered.length} onClose={() => close()}
              alreadySaved={!editingSmartId && collections.some(c => isSmartNotebook(c) && smartActive(c))}
              updatingCarnetName={editingSmartId ? collections.find(c => c.id === editingSmartId)?.name : null}
              onSaveAsCarnet={() => {
                const done = () => { setFilterOpen(false); setEditingSmartId(null); };
                if (editingSmartId) {
                  setCollections(prev => prev.map(c => c.id === editingSmartId ? { ...c, filters: { ...DEFAULT_FILTERS, ...filters }, search: search.trim() } : c));
                  close(done);
                } else {
                  close(() => { done(); setDraft(blankNotebookDraft({ smart: true, filters: { ...filters }, search })); });
                }
              }} />
          )}
        </SwipeableSheet>
      )}
      <div ref={scrollRef} onScroll={rememberScroll} style={{ flex: 1, overflowY: "auto", overscrollBehaviorY: "contain", padding: "4px 20px var(--page-pad-b)" }}>
        <div ref={contentRef} style={{ minHeight: "100%" }}>
          {/* Squelette au boot de l'onglet OU tant que le workspace n'est pas prêt : pas
              de flash « bibliothèque vide » avant l'arrivée des recettes. */}
          {(booting || loading) ? <LibrarySkeleton /> : recipes.length === 0 ? (
            <LibraryWelcome onNewRecipe={() => onNewRecipe()} onExplore={setTab && (() => setTab("home"))} />
          ) : (<>
            {/* Carnets masqués quand rien ne correspond : l'état vide doit respirer. */}
            {filtered.length > 0 && (
              <NotebooksRow notebooks={collections} countOf={countOf} isActive={notebookActive}
                hidden={hideNotebooks} onToggleHidden={() => setHideNotebooks(h => !h)}
                onOpen={openNotebook} onMenu={setNotebookMenu} onCreate={() => setDraft(blankNotebookDraft())}
                onReorder={(from, to) => setCollections(prev => reorderNotebooks(prev, from, to))} longPress={longPress} />
            )}
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Recettes</h2>
            {/* Nouvelle clé à chaque jeu de résultats : la grille se remonte et les cartes
                rejouent leur entrée décalée, « une à une ». */}
            <div key={gridKey} className="recipe-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
              {visibleRecipes.map((r, idx) => (
                <RecipeGridItem key={r.id} recipe={r} derived={seasonVeganById.get(r.id)}
                  animate={animateGrid} animDelay={`${Math.min((idx % RECIPES_PAGE) * 0.045, MAX_STAGGER)}s`}
                  onOpen={openRecipe} onMenu={openRecipeMenu}
                  startLongPress={longPress.startLongPress} cancelLongPress={longPress.cancelLongPress} moveLongPress={longPress.moveLongPress} />
              ))}
            </div>
            {remaining > 0 && (
              <LoadMoreButton onClick={loadMore} loading={loadingMore} label="Voir plus de recettes" hint={`${remaining} restante${remaining > 1 ? "s" : ""}`} />
            )}
            {filtered.length === 0 && (
              <NoRecipeResults search={search} hasFilters={nActiveFilters > 0 || !!filterCol} onReset={resetView}
                onSearchCommunity={onSearchCommunity} onCreate={(name) => onNewRecipe({ name })} />
            )}
          </>)}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Supprimer ${confirmDelete.kind === "notebook" ? "ce carnet" : "cette recette"} ?`}
          icon={confirmDelete.kind === "notebook" ? "book" : "trash"}
          busy={deleting}
          busyLabel="Suppression…"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => confirmDeletion(confirmDelete)}>
          <strong style={{ color: "var(--text)" }}>« {confirmDelete.item.name} »</strong>
          {confirmDelete.kind === "notebook"
            ? " sera supprimé. Tes recettes ne sont pas effacées, seulement le carnet."
            : " sera définitivement supprimée. Cette action est irréversible."}
        </ConfirmDialog>
      )}

      {recipeMenu && (
        <RecipeMenuSheet recipe={recipeMenu} onClose={() => setRecipeMenu(null)}
          onOpen={(r) => onSelect(r.id)} onPlan={onPlanRecipe} onShop={onAddToShopping} onPickNotebooks={setPickFor}
          onEdit={onEditRecipe} onDuplicate={onDuplicate} onShare={onShareRecipe} onDelete={(r) => setConfirmDelete({ kind: "recipe", item: r })} />
      )}

      {pickFor && (
        <NotebookPickerSheet recipe={recipes.find(r => r.id === pickFor.id) || pickFor} notebooks={collections}
          onToggle={(recipeId, notebookId) => onToggleCollection?.(recipeId, notebookId)} onClose={() => setPickFor(null)} />
      )}

      {notebookMenu && (
        <NotebookMenuSheet notebook={notebookMenu} index={collections.findIndex(c => c.id === notebookMenu.id)} total={collections.length} count={countOf(notebookMenu)}
          onMove={(dir) => setCollections(prev => shiftNotebook(prev, notebookMenu.id, dir))}
          onAdjustFilters={() => editNotebookFilters(notebookMenu)}
          onEdit={() => setDraft({ ...blankNotebookDraft(), ...notebookMenu, name: notebookMenu.name || "", editing: true })}
          onDelete={() => setConfirmDelete({ kind: "notebook", item: notebookMenu })}
          onClose={() => setNotebookMenu(null)} />
      )}

      {draft && (
        <NotebookEditorSheet draft={draft} setDraft={setDraft}
          smartCount={draft.smart ? countNotebook({ id: "", kind: "smart", filters: draft.filters, search: draft.search }, recipes, matchCtx) : 0}
          onEditFilters={() => { if (draft.id) editNotebookFilters({ id: draft.id, filters: draft.filters, search: draft.search }); setDraft(null); }}
          onSave={saveDraft} onClose={() => setDraft(null)} />
      )}
    </div>
  );
}
