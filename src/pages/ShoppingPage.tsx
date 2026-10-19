import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/ui/Icon.jsx";
import { LoadingSpinner } from "../components/ui/LoadingSpinner.jsx";
import { UserAvatar } from "../components/user/UserAvatar.jsx";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.jsx";
import { useLongPress } from "../hooks/useLongPress.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { useShopping, ALL_ID, type StockSinks } from "../hooks/useShopping.js";
import { stockMatchesFromChecked, type CategoriesConfig } from "@/lib/food/shoppingList.js";
import type { ShoppingList } from "@/lib/food/shoppingAggregate.js";
import type { DbEntry } from "@/lib/food/nameMatcher.js";
import type { Recipe } from "@/lib/types.js";
import { ShoppingListTabs } from "../components/shopping/ShoppingListTabs.jsx";
import { ShoppingEmptyState } from "../components/shopping/ShoppingEmptyState.jsx";
import { ShoppingAggregateView } from "../components/shopping/ShoppingAggregateView.jsx";
import { ShoppingListView } from "../components/shopping/ShoppingListView.jsx";
import { ListMenuSheet } from "../components/shopping/ListMenuSheet.jsx";
import { ConfirmClearSheet } from "../components/shopping/ConfirmClearSheet.jsx";
import { AddItemSheet } from "../components/shopping/AddItemSheet.jsx";
import { ListConfigSheet, type ConfigListDraft } from "../components/shopping/ListConfigSheet.jsx";
import { busyFloor } from "@/lib/ui/busyFloor.js";

interface ShoppingPageProps extends StockSinks {
  shoppingLists: ShoppingList[];
  setShoppingLists: Dispatch<SetStateAction<ShoppingList[]>>;
  ingredientDB: DbEntry[];
  recipes?: Recipe[];
  categories?: CategoriesConfig;
  /** Données partagées encore en hydratation : spinner plutôt qu'état vide. */
  loading?: boolean;
}

export function ShoppingPage({ shoppingLists, setShoppingLists, ingredientDB, recipes = [], categories = DEFAULT_CATEGORIES, loading = false, setStock, setLowStock }: ShoppingPageProps) {
  const navigate = useNavigate();
  const { notify, logActivity } = useAppShell();
  // Focus sans scroll : empêche la page de « sauter » à l'ouverture des bottom-sheets.
  const focusNoScroll = useCallback((el: HTMLInputElement | null) => { if (el && typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches) el.focus({ preventScroll: true }); }, []);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingList, setDeletingList] = useState(false); // spinner du dialogue de suppression
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [listMenu, setListMenu] = useState<ShoppingList | null>(null);      // liste dont le menu (⋯ / appui long) est ouvert
  const [configList, setConfigList] = useState<ConfigListDraft | null>(null);  // brouillon d'édition des réglages de liste
  const longPress = useLongPress();

  const shop = useShopping(shoppingLists, setShoppingLists, ingredientDB, { setStock, setLowStock });
  const { activeList, allMode, aggregated } = shop;

  // Lien profond depuis les notifications (?list=<id>) : sélectionne la liste ciblée
  // dès qu'elle est chargée, puis nettoie l'URL pour ne pas re-forcer la sélection.
  const [searchParams, setSearchParams] = useSearchParams();
  const listParam = searchParams.get("list");
  const setActiveListId = shop.setActiveListId;
  useEffect(() => {
    if (!listParam) return;
    if (shoppingLists.some(l => l.id === listParam)) { setActiveListId(listParam); setSearchParams({}, { replace: true }); }
    else if (!loading) setSearchParams({}, { replace: true }); // liste absente (supprimée) : nettoie l'URL
  }, [listParam, shoppingLists, loading, setActiveListId, setSearchParams]);

  const openNewList = () => setConfigList({ isNew: true, name: "", hideClear: false });

  // Supprime une liste en journalisant l'évènement (nom résolu avant suppression).
  const deleteList = (id: string) => {
    logActivity?.({ type: "shopping.delete", target: shoppingLists.find(l => l.id === id)?.name || "" });
    shop.deleteList(id);
  };

  // Aperçu « Valider l'achat » : produits de placard cochés (doublons conservés
  // pour le compte affiché, dédupliqués pour les toasts, comme à l'origine).
  const clearItems = confirmClearId === ALL_ID
    ? shoppingLists.flatMap(l => l.items || [])
    : (shoppingLists.find(l => l.id === confirmClearId)?.items || []);
  const clearStockMatches = stockMatchesFromChecked(clearItems, ingredientDB);

  const confirmClear = () => {
    const clearId = confirmClearId;
    if (!clearId) return;
    setConfirmClearId(null); // sinon le sheet reste monté (close(cb) shunte onClose)
    if (clearId === ALL_ID) shop.clearAllChecked(); else shop.clearChecked(clearId);
    // Un toast de succès par produit ajouté au stock, en cascade (dédupliqués).
    const seen = new Set<string>();
    clearStockMatches.filter(m => !seen.has(m.id) && seen.add(m.id))
      .forEach((m, idx) => setTimeout(() => notify?.(`${m.name} ajouté à ton stock`), idx * 900));
  };

  const saveConfig = () => {
    if (!configList) return;
    const name = configList.name.trim();
    const hideClear = !!configList.hideClear;
    if (configList.isNew) { const id = shop.createList(name, hideClear); logActivity?.({ type: "shopping.create", target: name, targetId: id }); }
    else if (configList.id) shop.updateList(configList.id, l => ({ ...l, name, hideClear }));
    // `close(cb)` exécute cb À LA PLACE de `onClose` → on ferme nous-mêmes.
    setConfigList(null);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0, position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>Courses</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-primary btn-pill" onClick={openNewList}><Icon name="plus" size={16} /> Nouvelle liste</button>
            <UserAvatar />
          </div>
        </div>

        {shoppingLists.length > 0 && (
          <ShoppingListTabs
            shoppingLists={shoppingLists} hasAgg={shop.hasAgg} allMode={allMode} effectiveId={shop.effectiveId}
            aggregated={aggregated} longPress={longPress}
            onSelectAll={() => shop.setActiveListId(ALL_ID)} onSelect={id => shop.setActiveListId(id)} onOpenMenu={setListMenu} />
        )}
      </div>

      {/* Hydratation des données partagées : spinner plutôt que l'empty state,
          qui flasherait avant l'arrivée des listes (bootstrap / cache temps réel). */}
      {shoppingLists.length === 0 && loading && <LoadingSpinner />}

      {shoppingLists.length === 0 && !loading && (
        <ShoppingEmptyState onCreate={openNewList} onBrowseRecipes={() => navigate("/recipes")} />
      )}

      {allMode && (
        <ShoppingAggregateView
          aggregated={aggregated} categories={categories} pending={shop.pending} unchecking={shop.unchecking}
          onBuy={shop.buyAggregate} onClear={() => setConfirmClearId(ALL_ID)} />
      )}

      {activeList && (
        <ShoppingListView
          activeList={activeList} categories={categories} ingredientDB={ingredientDB} catOf={shop.catOf}
          pending={shop.pending} unchecking={shop.unchecking}
          onBuy={shop.buyItem} onDeleteItem={shop.deleteItem} onClear={() => setConfirmClearId(activeList.id)}
          onDeleteList={deleteList} onOpenAdd={() => setShowAddModal(true)} />
      )}

      {/* Menu d'une liste (⋯ de la pastille active / appui long) */}
      {listMenu && (
        <ListMenuSheet list={listMenu} onClose={() => setListMenu(null)}
          onSettings={list => setConfigList({ id: list.id, name: list.name ?? "", hideClear: list.hideClear })}
          onPlan={listMenu.type === "recipe" && listMenu.recipeId && recipes.some(r => r.id === listMenu.recipeId)
            ? list => navigate(`/recipes/${list.recipeId}`, { state: { intent: "plan" } })
            : undefined}
          onDelete={list => list.type === "free" ? setConfirmDeleteId(list.id) : deleteList(list.id)} />
      )}

      {/* Confirm delete – uniquement pour les listes libres */}
      {confirmDeleteId && (
        <ConfirmDialog title="Supprimer la liste ?" busy={deletingList}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={async () => {
            setDeletingList(true);
            await busyFloor();
            deleteList(confirmDeleteId);
            setDeletingList(false);
            setConfirmDeleteId(null);
          }}>
          <strong style={{ color: "var(--text)" }}>« {shoppingLists.find(l => l.id === confirmDeleteId)?.name} »</strong> sera supprimée définitivement avec tous ses articles.
        </ConfirmDialog>
      )}

      {/* Confirmation : valider l'achat (déversement dans le stock) */}
      {confirmClearId && (
        <ConfirmClearSheet stockCount={clearStockMatches.length}
          onClose={() => setConfirmClearId(null)} onConfirm={confirmClear} />
      )}

      {/* Modal ajout d'article / liste */}
      {showAddModal && activeList?.type === "free" && (
        <AddItemSheet activeList={activeList} ingredientDB={ingredientDB}
          onClose={() => setShowAddModal(false)}
          onAddItem={name => { shop.addItem(name); setShowAddModal(false); }}
          onAddMany={text => { shop.addManyFromText(text); setShowAddModal(false); }} />
      )}

      {/* Configuration de la liste */}
      {configList && (
        <ListConfigSheet configList={configList} setConfigList={update => setConfigList(prev => prev && update(prev))}
          focusNoScroll={focusNoScroll} onClose={() => setConfigList(null)} onSave={saveConfig} />
      )}
    </div>
  );
}
