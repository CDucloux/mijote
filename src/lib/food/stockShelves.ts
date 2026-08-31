// ─── STOCK : PAGINATION DES ÉTAGÈRES ────────────────────────────────────────────
// Logique pure (sans React, sans I/O) derrière le « mur d'étagères » du Stock. La
// vue n'affiche qu'un LOT d'étagères à la fois (cf. StockPage) : construire la
// totalité des rangées à chaque montage est un gaspillage O(base) sur le chemin
// critique. Ici on ne découpe que les rangées réellement visibles et on déduit le
// reste par arithmétique.

/** Ingrédient minimal manipulé par la vue Stock : seuls l'id et le nom comptent. */
export interface StockIng {
  id: string;
  name?: string;
}

/** Une rangée de bocaux (une « planche »), telle que rendue par l'UI. */
export interface StockShelf<T extends StockIng> {
  /** Les bocaux de la rangée (au plus `perRow`). */
  row: T[];
  /** Index de la rangée DANS sa catégorie (0-based). */
  ri: number;
  /** Vrai si c'est la dernière rangée de la catégorie (pilote la fioriture). */
  lastRow: boolean;
}

/** Un rayon = une catégorie et ses rangées visibles, avec ses compteurs d'en-tête. */
export interface StockShelfGroup<T extends StockIng> {
  catKey: string;
  /** Nombre total d'ingrédients de la catégorie (toutes rangées confondues). */
  total: number;
  /** Combien sont « en stock » (inclut les « bientôt vide », comme dans l'UI). */
  inStockInCat: number;
  /** Combien sont « bientôt vide ». */
  lowInCat: number;
  /** Rangées effectivement à rendre (bornées par le budget visible). */
  shelves: StockShelf<T>[];
}

/** Résultat de la pagination : rayons visibles + total d'étagères (pour « charger plus »). */
export interface PaginatedShelves<T extends StockIng> {
  groups: StockShelfGroup<T>[];
  /** Nombre total d'étagères tous rayons confondus (indépendant du budget visible). */
  totalShelves: number;
}

/** Collateur français partagé : bien moins coûteux que `localeCompare("fr")` appelé
 * par comparaison (une seule instance pour tout un tri, cf. tri de la base stockable). */
const collator = new Intl.Collator("fr");

/** Comparateur par nom (français, accents/casse gérés), robuste aux noms absents. */
export function compareIngredientName(a: StockIng, b: StockIng): number {
  return collator.compare(a.name || "", b.name || "");
}

/**
 * Pagine les rayons du Stock : ne construit QUE les `visibleCount` premières
 * étagères (à plat, dans l'ordre des catégories), tout en calculant le total réel
 * d'étagères par arithmétique (sans les matérialiser). Les rangées suivent l'ordre
 * exact d'un aplatissement catégorie par catégorie, si bien qu'augmenter
 * `visibleCount` révèle la suite sans jamais réordonner l'existant.
 *
 * @param grouped - Catégories déjà ordonnées, chacune avec ses ingrédients triés.
 * @param perRow - Bocaux par rangée (>= 1 ; une valeur <= 0 est ramenée à 1).
 * @param stockSet - Ids en stock (inclut les « bientôt vide »).
 * @param lowSet - Ids « bientôt vide ».
 * @param visibleCount - Nombre d'étagères à matérialiser (budget).
 * @returns Les rayons visibles et le total d'étagères.
 */
export function paginateStockShelves<T extends StockIng>(
  grouped: readonly (readonly [string, T[]])[],
  perRow: number,
  stockSet: ReadonlySet<string>,
  lowSet: ReadonlySet<string>,
  visibleCount: number,
): PaginatedShelves<T> {
  const cols = Math.max(1, Math.floor(perRow) || 1);
  const groups: StockShelfGroup<T>[] = [];
  let totalShelves = 0;
  let budget = Math.max(0, visibleCount);

  for (const [catKey, ings] of grouped) {
    const rowsInCat = Math.ceil(ings.length / cols);
    totalShelves += rowsInCat;
    if (budget <= 0) continue; // budget épuisé : on ne fait plus que sommer le total

    const take = Math.min(rowsInCat, budget);
    budget -= take;

    const shelves: StockShelf<T>[] = [];
    for (let ri = 0; ri < take; ri++) {
      shelves.push({
        row: ings.slice(ri * cols, ri * cols + cols),
        ri,
        lastRow: ri === rowsInCat - 1,
      });
    }

    let inStockInCat = 0, lowInCat = 0;
    for (const ing of ings) {
      if (stockSet.has(ing.id)) inStockInCat++;
      if (lowSet.has(ing.id)) lowInCat++;
    }
    groups.push({ catKey, total: ings.length, inStockInCat, lowInCat, shelves });
  }

  return { groups, totalShelves };
}
