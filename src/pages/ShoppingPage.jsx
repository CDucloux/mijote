import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { LoadingSpinner } from "../components/LoadingSpinner.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { useLongPress } from "../hooks/useLongPress.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { useShopping, ALL_ID } from "../hooks/useShopping.js";
import { stockMatchesFromChecked } from "@/lib/food/shoppingList.js";
import { ShoppingListTabs } from "../components/shopping/ShoppingListTabs.jsx";
import { ShoppingEmptyState } from "../components/shopping/ShoppingEmptyState.jsx";
import { ShoppingAggregateView } from "../components/shopping/ShoppingAggregateView.jsx";
import { ShoppingListView } from "../components/shopping/ShoppingListView.jsx";
import { ListMenuSheet } from "../components/shopping/ListMenuSheet.jsx";
import { ConfirmClearSheet } from "../components/shopping/ConfirmClearSheet.jsx";
import { AddItemSheet } from "../components/shopping/AddItemSheet.jsx";
import { ListConfigSheet } from "../components/shopping/ListConfigSheet.jsx";

export function ShoppingPage({ shoppingLists, setShoppingLists, ingredientDB, categories = DEFAULT_CATEGORIES, loading = false, setStock, setLowStock }) {
  const navigate = useNavigate();
  const { notify } = useAppShell();
  // Focus sans scroll : empêche la page de « sauter » à l'ouverture des bottom-sheets.
  const focusNoScroll = useCallback(el => { if (el && typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches) el.focus({ preventScroll: true }); }, []);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmClearId, setConfirmClearId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [listMenu, setListMenu] = useState(null);      // liste dont le menu (⋯ / appui long) est ouvert
  const [configList, setConfigList] = useState(null);  // brouillon d'édition des réglages de liste
  const longPress = useLongPress();

  const shop = useShopping(shoppingLists, setShoppingLists, ingredientDB, { setStock, setLowStock });
  const { activeList, allMode, aggregated } = shop;

  const openNewList = () => setConfigList({ isNew: true, name: "", type: "free", hideClear: false });

  // Aperçu « Valider l'achat » : produits de placard cochés (doublons conservés
  // pour le compte affiché, dédupliqués pour les toasts, comme à l'origine).
  const clearItems = confirmClearId === ALL_ID
    ? shoppingLists.flatMap(l => l.items || [])
    : (shoppingLists.find(l => l.id === confirmClearId)?.items || []);
  const clearStockMatches = stockMatchesFromChecked(clearItems, ingredientDB);

  const confirmClear = () => {
    const isAll = confirmClearId === ALL_ID;
    setConfirmClearId(null); // sinon le sheet reste monté (close(cb) shunte onClose)
    if (isAll) shop.clearAllChecked(); else shop.clearChecked(confirmClearId);
    // Un toast de succès par produit ajouté au stock, en cascade (dédupliqués).
    const seen = new Set();
    clearStockMatches.filter(m => !seen.has(m.id) && seen.add(m.id))
      .forEach((m, idx) => setTimeout(() => notify?.(`${m.name} ajouté à ton stock`), idx * 900));
  };

  const saveConfig = () => {
    const name = configList.name.trim();
    if (configList.isNew) shop.createList(name, !!configList.hideClear);
    else shop.updateList(configList.id, l => ({ ...l, name, hideClear: !!configList.hideClear }));
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
          onDeleteList={shop.deleteList} onOpenAdd={() => setShowAddModal(true)} />
      )}

      {/* Menu d'une liste (⋯ de la pastille active / appui long) */}
      {listMenu && (
        <ListMenuSheet list={listMenu} onClose={() => setListMenu(null)}
          onSettings={list => setConfigList({ ...list })}
          onDelete={list => list.type === "free" ? setConfirmDeleteId(list.id) : shop.deleteList(list.id)} />
      )}

      {/* Confirm delete – uniquement pour les listes libres */}
      {confirmDeleteId && (
        <ConfirmDialog title="Supprimer la liste ?"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => { shop.deleteList(confirmDeleteId); setConfirmDeleteId(null); }}>
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
        <ListConfigSheet configList={configList} setConfigList={setConfigList}
          focusNoScroll={focusNoScroll} onClose={() => setConfigList(null)} onSave={saveConfig} />
      )}
    </div>
  );
}
