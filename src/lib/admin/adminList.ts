import { normalizeName } from "@/lib/food/nameMatcher.js";

/** Critères communs des listes de la console admin. */
export interface AdminListQuery {
  /** Clé de catégorie retenue, `null` pour toutes. */
  category: string | null;
  /** Recherche libre (casse et accents ignorés). */
  search: string;
}

/** Lecture des champs utiles d'une entrée, propre à chaque base master. */
export interface AdminListAccessors<T> {
  /** Catégorie de l'entrée (repli déjà appliqué). */
  category: (item: T) => string;
  /** Libellés interrogés par la recherche (nom, alias…). */
  labels: (item: T) => readonly (string | undefined)[];
  /** Nom servant au tri. */
  name: (item: T) => string | undefined;
  /** Filtre de suivi éditorial ; absent = tout garder. */
  keep?: (item: T) => boolean;
}

/** Entrées d'une catégorie, triées par nom. */
export interface AdminListGroup<T> {
  category: string;
  items: T[];
}

/**
 * Regroupe une base master par catégorie pour la console admin, dans l'ordre
 * fourni, après filtre de suivi et recherche. Les catégories absentes de l'ordre
 * suivent, triées, pour qu'aucune entrée ne disparaisse de la console. Seuls les
 * groupes non vides sont rendus.
 * @param items - Base master.
 * @param categoryOrder - Clés de catégorie dans l'ordre d'affichage.
 * @param query - Catégorie et recherche actives.
 * @param accessors - Lecture de la catégorie, des libellés, du nom et du filtre.
 * @returns Les groupes non vides, entrées triées par nom (français).
 */
export function groupAdminList<T>(items: readonly T[], categoryOrder: readonly string[], query: AdminListQuery, accessors: AdminListAccessors<T>): AdminListGroup<T>[] {
  const needle = normalizeName(query.search);
  const byCategory = new Map<string, T[]>();
  for (const item of items) {
    const category = accessors.category(item);
    if (query.category !== null && category !== query.category) continue;
    if (accessors.keep && !accessors.keep(item)) continue;
    if (needle && !accessors.labels(item).some(label => normalizeName(label).includes(needle))) continue;
    const bucket = byCategory.get(category);
    if (bucket) bucket.push(item);
    else byCategory.set(category, [item]);
  }
  const known = new Set(categoryOrder);
  const unknown = [...byCategory.keys()].filter(key => !known.has(key)).sort();
  return [...categoryOrder, ...unknown]
    .filter(category => byCategory.has(category))
    .map(category => ({
      category,
      items: (byCategory.get(category) ?? []).sort((a, b) => (accessors.name(a) || "").localeCompare(accessors.name(b) || "", "fr", { sensitivity: "base" })),
    }));
}

/**
 * Effectif par catégorie sous un filtre de suivi, pour la navigation par
 * catégorie (les compteurs suivent le filtre actif, pas la recherche).
 * @param items - Base master.
 * @param category - Catégorie d'une entrée (repli déjà appliqué).
 * @param keep - Filtre de suivi actif ; absent = tout compter.
 * @returns Nombre d'entrées par clé de catégorie.
 */
export function countAdminCategories<T>(items: readonly T[], category: (item: T) => string, keep?: (item: T) => boolean): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (keep && !keep(item)) continue;
    const key = category(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
