/**
 * Orchestration des listes de courses : sélection d'onglet, agrégat « Toutes les
 * courses », mutations d'articles et de listes, et animations d'achat (barré +
 * glissement avant bascule dans « Acheté »). La logique pure (regroupement,
 * déversement stock, parsing de collage) vit dans `@/lib/food/shoppingList` ;
 * ce hook n'orchestre que l'état React et les écritures via `setShoppingLists`.
 *
 * @module useShopping
 */
import { useState, useMemo, type Dispatch, type SetStateAction } from "react";
import { findIngredientMatch, type DbEntry } from "@/lib/food/nameMatcher.js";
import { parseIngredientInput } from "@/lib/food/parseIngredient.js";
import { aggregateShopping, type ShoppingList, type ShoppingItem, type AggregatedItem } from "@/lib/food/shoppingAggregate.js";
import { stockMatchesFromChecked, splitBulletLines } from "@/lib/food/shoppingList.js";

/** Onglet virtuel « Toutes les courses » (agrégat de toutes les listes actives). */
export const ALL_ID = "__all__";

/** Nombre max d'articles ajoutés en une fois (collage d'une liste). */
export const MAX_LIST_ITEMS = 50;
/** Longueur max du nom d'un article (saisie unique). */
export const MAX_ITEM_CHARS = 200;
/** Longueur max de la zone de collage (~50 articles de ~50 caractères). */
export const MAX_LIST_CHARS = MAX_LIST_ITEMS * 50;

/** Durée de l'animation « barré + glisse » avant bascule dans « Acheté ». */
const BUY_ANIM_MS = 560;
/** Durée de l'animation de décochage (retour dans « À acheter »). */
const UNCHECK_ANIM_MS = 330;

type SetLists = Dispatch<SetStateAction<ShoppingList[]>>;
type SetIds = Dispatch<SetStateAction<string[]>>;

/** Effets sur le stock au moment de valider un achat (déversement placard). */
export interface StockSinks {
  setStock?: SetIds;
  setLowStock?: SetIds;
}

/** Surface exposée par `useShopping` à la page de courses. */
export interface ShoppingController {
  activeListId: string | null;
  setActiveListId: Dispatch<SetStateAction<string | null>>;
  hasAgg: boolean;
  allMode: boolean;
  effectiveId: string | null;
  activeList: ShoppingList | null;
  aggregated: AggregatedItem[];
  pending: Set<string>;
  unchecking: Set<string>;
  catOf: (name: string) => string;
  updateList: (id: string, fn: (l: ShoppingList) => ShoppingList) => void;
  deleteList: (id: string) => void;
  createList: (name: string, hideClear: boolean) => void;
  addItem: (raw: string) => void;
  addManyFromText: (text: string) => void;
  deleteItem: (listId: string, itemId: string) => void;
  buyItem: (item: ShoppingItem) => void;
  buyAggregate: (agg: AggregatedItem) => void;
  clearChecked: (listId: string) => void;
  clearAllChecked: () => void;
}

const addToSet = (s: Set<string>, key: string): Set<string> => { const n = new Set(s); n.add(key); return n; };
const removeFromSet = (s: Set<string>, key: string): Set<string> => { const n = new Set(s); n.delete(key); return n; };

/**
 * Câble l'état et les actions d'une page de courses autour d'un couple
 * `shoppingLists` / `setShoppingLists`.
 *
 * @param shoppingLists - Les listes de courses (source de vérité, hydratée ailleurs).
 * @param setShoppingLists - Setter des listes (persisté par la synchro Firestore).
 * @param ingredientDB - Base d'ingrédients pour reconnaître noms, images et catégories.
 * @param sinks - Setters de stock alimentés au moment de valider l'achat.
 * @returns Données dérivées, sets d'animation et actions de mutation.
 */
export function useShopping(
  shoppingLists: ShoppingList[],
  setShoppingLists: SetLists,
  ingredientDB: DbEntry[] | null | undefined,
  sinks: StockSinks = {},
): ShoppingController {
  const { setStock, setLowStock } = sinks;
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(() => new Set());       // articles en animation -> « Acheté »
  const [unchecking, setUnchecking] = useState<Set<string>>(() => new Set()); // articles décochés en animation -> « À acheter »

  // L'agrégat n'a de sens qu'à partir de 2 listes. Il devient la vue par défaut
  // (la « vraie » sortie supermarché), les onglets par recette restant accessibles.
  const hasAgg = shoppingLists.length >= 2;
  const effectiveId = activeListId ?? (hasAgg ? ALL_ID : (shoppingLists[0]?.id ?? null));
  const allMode = hasAgg && effectiveId === ALL_ID;
  const activeList = allMode ? null : (shoppingLists.find(l => l.id === effectiveId) || shoppingLists[0] || null);
  const aggregated = useMemo(() => (hasAgg ? aggregateShopping(shoppingLists, ingredientDB) : []), [hasAgg, shoppingLists, ingredientDB]);

  const updateList = (id: string, fn: (l: ShoppingList) => ShoppingList) =>
    setShoppingLists(prev => prev.map(l => l.id === id ? fn(l) : l));

  const deleteList = (id: string) => {
    setShoppingLists(prev => prev.filter(l => l.id !== id));
    if (activeListId === id) setActiveListId(null);
  };

  const createList = (name: string, hideClear: boolean) => {
    const l: ShoppingList = { id: "sl" + Date.now(), name, type: "free", items: [], hideClear };
    setShoppingLists(prev => [...prev, l]);
    setActiveListId(l.id);
  };

  const toggleItem = (listId: string, itemId: string) =>
    updateList(listId, l => ({ ...l, items: (l.items || []).map(i => i.id === itemId ? { ...i, checked: !i.checked } : i) }));

  const deleteItem = (listId: string, itemId: string) =>
    updateList(listId, l => ({ ...l, items: (l.items || []).filter(i => i.id !== itemId) }));

  // Catégorie d'un article : résolue depuis la Master DB via le nom (sinon "other").
  const catOf = (name: string) => findIngredientMatch(name, ingredientDB)?.category || "other";

  /** Déverse les produits de placard cochés dans le stock (dédupliqués). */
  const spillToStock = (items: ShoppingItem[]) => {
    if (!setStock) return;
    const ids = stockMatchesFromChecked(items, ingredientDB).map(m => m.id);
    if (!ids.length) return;
    setStock(prev => Array.from(new Set([...prev, ...ids])));
    // Un réachat remet les articles à « en stock » (retire du lowStock).
    if (setLowStock) setLowStock(prev => prev.filter(id => !ids.includes(id)));
  };

  const clearChecked = (listId: string) => {
    const list = shoppingLists.find(l => l.id === listId);
    if (list) spillToStock(list.items || []);
    updateList(listId, l => ({ ...l, items: (l.items || []).filter(i => !i.checked) }));
  };

  const clearAllChecked = () => {
    spillToStock(shoppingLists.flatMap(l => l.items || []));
    setShoppingLists(prev => prev.map(l => ({ ...l, items: (l.items || []).filter(i => !i.checked) })));
  };

  const addItem = (raw: string) => {
    if (!raw.trim() || !activeList) return;
    const parsed = parseIngredientInput(raw);
    const name = (parsed.name || raw.trim()).slice(0, MAX_ITEM_CHARS);
    const match = findIngredientMatch(name, ingredientDB);
    const item: ShoppingItem = { id: "si" + Date.now(), name, amount: parsed.amount || "", unit: parsed.unit || "", image: match?.image || "", checked: false };
    updateList(activeList.id, l => ({ ...l, items: [...(l.items || []), item] }));
  };

  const addManyFromText = (text: string) => {
    if (!activeList) return;
    const lines = splitBulletLines(text).slice(0, MAX_LIST_ITEMS);
    if (!lines.length) return;
    const items = lines.map((line, idx): ShoppingItem => {
      const p = parseIngredientInput(line);
      const name = (p.name || line).slice(0, MAX_ITEM_CHARS);
      const m = findIngredientMatch(name, ingredientDB);
      return { id: "si" + Date.now() + "_" + idx, name, amount: p.amount || "", unit: p.unit || "", image: m?.image || "", checked: false };
    });
    updateList(activeList.id, l => ({ ...l, items: [...(l.items || []), ...items] }));
  };

  /**
   * Achat/décochage animé, factorisé entre article de liste et article agrégé :
   * décocher est immédiat (330 ms), l'achat rejoue le barré + glisse (560 ms).
   * `key` identifie l'élément animé, `apply` applique la bascule d'état.
   */
  const animateBuy = (key: string, checked: boolean | undefined, apply: () => void) => {
    if (checked) {
      if (unchecking.has(key)) return;
      setUnchecking(prev => addToSet(prev, key));
      setTimeout(() => { apply(); setUnchecking(prev => removeFromSet(prev, key)); }, UNCHECK_ANIM_MS);
      return;
    }
    if (pending.has(key)) return;
    setPending(prev => addToSet(prev, key));
    setTimeout(() => { apply(); setPending(prev => removeFromSet(prev, key)); }, BUY_ANIM_MS);
  };

  const buyItem = (item: ShoppingItem) => {
    if (!activeList) return;
    animateBuy(item.id, item.checked, () => toggleItem(activeList.id, item.id));
  };

  // Cocher un article agrégé propage l'état à tous ses contributeurs (chaque vraie liste).
  const buyAggregate = (agg: AggregatedItem) => {
    const target = !agg.checked;
    const byList = new Map<string, Set<string>>();
    for (const c of agg.contributors) {
      const s = byList.get(c.listId) || new Set<string>();
      s.add(c.itemId);
      byList.set(c.listId, s);
    }
    const apply = () => setShoppingLists(prev => prev.map(l => byList.has(l.id)
      ? { ...l, items: (l.items || []).map(it => byList.get(l.id)!.has(it.id) ? { ...it, checked: target } : it) }
      : l));
    animateBuy(agg.key, agg.checked, apply);
  };

  return {
    activeListId, setActiveListId,
    hasAgg, allMode, effectiveId, activeList, aggregated,
    pending, unchecking,
    catOf, updateList, deleteList, createList,
    addItem, addManyFromText, deleteItem,
    buyItem, buyAggregate, clearChecked, clearAllChecked,
  };
}
