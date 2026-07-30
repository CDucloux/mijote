import { findIngredientMatch } from "./nameMatcher.js";
import { normalizeStr } from "./parseIngredient.js";
import { fmtQtyUnit } from "./format.js";

// ─── AGRÉGATION DES LISTES DE COURSES ─────────────────────────────────────────
// Fusionne toutes les listes en articles dédupliqués par ingrédient : les
// quantités de même unité sont sommées, la provenance (listes d'origine) est
// conservée. Objectif : une seule liste « sortie au supermarché » plutôt qu'une
// check-list par recette.

const toNum = (a) => {
  if (a === "" || a == null) return null;
  const n = typeof a === "number" ? a : parseFloat(String(a).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// Unité canonique pour SOMMER (sans accent, singularisée) : « pièces » et
// « pièce » fusionnent. On garde l'orthographe d'origine pour l'affichage.
const canonUnit = (u) => {
  const c = normalizeStr(u);
  return c.length > 2 && c.endsWith("s") ? c.slice(0, -1) : c;
};

// Retourne la liste des articles agrégés. Chaque article :
//   { key, name, image, category, qtyDisplay, sources[], contributors[{listId,itemId}],
//     checked, partial }
// `contributors` permet de propager l'achat vers les vraies listes ; `checked`
// est vrai quand TOUS les contributeurs sont cochés (partial = certains seulement).
export function aggregateShopping(lists, ingredientDB) {
  const map = new Map();
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
