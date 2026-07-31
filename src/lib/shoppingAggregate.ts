/**
 * Agrégation des listes de courses : fusionne toutes les listes en articles
 * dédupliqués par ingrédient (quantités de même unité sommées, provenance
 * conservée) — une seule « sortie au supermarché » plutôt qu'une check-list par
 * recette.
 *
 * @module shoppingAggregate
 */
import { findIngredientMatch } from "./nameMatcher.js";
import { normalizeStr } from "./parseIngredient.js";
import { fmtQtyUnit } from "./format.js";

/** Un article d'une liste de courses. */
export interface ShoppingItem {
  id: string;
  name: string;
  amount?: number | string | null;
  unit?: string | null;
  image?: string | null;
  checked?: boolean;
}

/** Une liste de courses (recette clonée ou liste libre). */
export interface ShoppingList {
  id: string;
  name?: string;
  items?: ShoppingItem[];
}

/** Référence d'un article source, pour propager l'achat vers la vraie liste. */
export interface Contributor {
  listId: string;
  itemId: string;
}

/** Un article agrégé, prêt à afficher dans la vue « Toutes les courses ». */
export interface AggregatedItem {
  key: string;
  name: string;
  image: string;
  category: string;
  /** Quantités sommées et mises en forme (ex. `"500 g + 2 pièces"`). */
  qtyDisplay: string;
  /** Noms des listes d'origine (dédupliqués). */
  sources: string[];
  contributors: Contributor[];
  /** Vrai seulement si TOUS les contributeurs sont cochés. */
  checked: boolean;
  /** Vrai si une partie seulement des contributeurs est cochée. */
  partial: boolean;
}

interface UnitSlot { unit: string; sum: number; }
interface Group {
  key: string;
  name: string;
  image: string;
  category: string;
  units: Map<string, UnitSlot>;
  sources: string[];
  contributors: Contributor[];
  total: number;
  checkedCount: number;
}

const toNum = (a: number | string | null | undefined): number | null => {
  if (a === "" || a == null) return null;
  const n = typeof a === "number" ? a : parseFloat(String(a).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// Clé d'unité pour SOMMER : sans accent et singularisée, pour que « pièces » et
// « pièce » fusionnent. L'orthographe d'origine, elle, est conservée pour l'affichage.
const canonUnit = (u: string | null | undefined): string => {
  const c = normalizeStr(u);
  return c.length > 2 && c.endsWith("s") ? c.slice(0, -1) : c;
};

/**
 * Agrège toutes les listes en articles dédupliqués par ingrédient.
 *
 * La déduplication passe par la Master DB (`findIngredientMatch`) quand elle
 * reconnaît l'article, sinon par son nom normalisé. Les quantités ne sont
 * sommées qu'entre unités compatibles ; les unités distinctes cohabitent dans
 * `qtyDisplay`.
 *
 * @param lists - Les listes de courses à fusionner.
 * @param ingredientDB - Base d'ingrédients pour la résolution des noms.
 * @returns Les articles agrégés (ordre d'apparition).
 */
export function aggregateShopping(lists: ShoppingList[] | null | undefined, ingredientDB: unknown): AggregatedItem[] {
  const map = new Map<string, Group>();
  for (const list of lists || []) {
    for (const it of list.items || []) {
      const match = findIngredientMatch(it.name, ingredientDB);
      const key = match ? "id:" + match.id : "n:" + normalizeStr(it.name);
      let g = map.get(key);
      if (!g) {
        g = {
          key, name: match?.name || it.name, image: match?.image || it.image || "",
          category: match?.category || "other",
          units: new Map(), sources: [], contributors: [], total: 0, checkedCount: 0,
        };
        map.set(key, g);
      }
      const cu = canonUnit(it.unit);
      const n = toNum(it.amount);
      if (n != null) {
        const slot = g.units.get(cu) || { unit: (it.unit || "").toString().trim(), sum: 0 };
        slot.sum += n;
        if (!slot.unit && it.unit) slot.unit = it.unit.toString().trim();
        g.units.set(cu, slot);
      }
      if (list.name && !g.sources.includes(list.name)) g.sources.push(list.name);
      g.contributors.push({ listId: list.id, itemId: it.id });
      g.total += 1;
      if (it.checked) g.checkedCount += 1;
    }
  }
  return [...map.values()].map(g => {
    const qtyDisplay = [...g.units.values()]
      .filter(s => s.sum > 0)
      .map(s => fmtQtyUnit(+s.sum.toFixed(2), s.unit))
      .join(" + ");
    const checked = g.total > 0 && g.checkedCount === g.total;
    return {
      key: g.key, name: g.name, image: g.image, category: g.category,
      qtyDisplay, sources: g.sources, contributors: g.contributors,
      checked, partial: g.checkedCount > 0 && !checked,
    };
  });
}
