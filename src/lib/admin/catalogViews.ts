import type { UtensilDbItem } from "@/lib/types.js";
import type { TechniqueEntry } from "@/lib/recipes/techniques.js";
import { countAdminCategories, groupAdminList } from "@/lib/admin/adminList.js";
import type { AdminListGroup, AdminListQuery } from "@/lib/admin/adminList.js";

// Vues de la console admin pour les ustensiles et le glossaire des gestes :
// filtres de suivi éditorial, regroupement par famille et effectifs.

type AdminUtensil = Pick<UtensilDbItem, "name" | "category" | "image">;
type AdminTechnique = Pick<TechniqueEntry, "name" | "aliases" | "category" | "difficulty">;

/** Filtre de suivi des ustensiles (`null` = tous). */
export type UtensilFilter = "no-image";
/** Filtre de suivi des gestes (`null` = tous). */
export type TechniqueFilter = "no-difficulty";

/** Famille d'un ustensile ; un ustensile sans famille relève de `divers`. */
export const utensilCategory = (utensil: AdminUtensil): string => utensil.category || "divers";
/** Catégorie d'un geste (`""` si absente). */
export const techniqueCategory = (technique: AdminTechnique): string => technique.category ?? "";

/**
 * Indique si un ustensile relève d'un filtre de suivi.
 * @param utensil - Ustensile de la base master.
 * @param filter - Filtre actif, `null` pour tout accepter.
 */
export function matchesUtensilFilter(utensil: AdminUtensil, filter: UtensilFilter | null): boolean {
  return filter === null || !utensil.image;
}

/**
 * Indique si un geste relève d'un filtre de suivi : un niveau hors 1 à 5 compte
 * comme absent.
 * @param technique - Geste du glossaire.
 * @param filter - Filtre actif, `null` pour tout accepter.
 */
export function matchesTechniqueFilter(technique: AdminTechnique, filter: TechniqueFilter | null): boolean {
  if (filter === null) return true;
  const level = technique.difficulty;
  return !(typeof level === "number" && level >= 1 && level <= 5);
}

/** Critères d'une liste d'ustensiles. */
export interface UtensilQuery extends AdminListQuery { filter: UtensilFilter | null }
/** Critères d'une liste de gestes. */
export interface TechniqueQuery extends AdminListQuery { filter: TechniqueFilter | null }

/**
 * Regroupe les ustensiles par famille (recherche sur le nom), cf. `groupAdminList`.
 * @param utensils - Base master.
 * @param categoryOrder - Familles dans l'ordre d'affichage.
 * @param query - Famille, filtre et recherche actifs.
 */
export function groupAdminUtensils<T extends AdminUtensil>(utensils: readonly T[], categoryOrder: readonly string[], query: UtensilQuery): AdminListGroup<T>[] {
  return groupAdminList(utensils, categoryOrder, query, {
    category: utensilCategory, labels: utensil => [utensil.name], name: utensil => utensil.name,
    keep: utensil => matchesUtensilFilter(utensil, query.filter),
  });
}

/**
 * Regroupe les gestes par catégorie (recherche sur le nom et les alias), cf. `groupAdminList`.
 * @param techniques - Glossaire.
 * @param categoryOrder - Catégories dans l'ordre d'affichage.
 * @param query - Catégorie, filtre et recherche actifs.
 */
export function groupAdminTechniques<T extends AdminTechnique>(techniques: readonly T[], categoryOrder: readonly string[], query: TechniqueQuery): AdminListGroup<T>[] {
  return groupAdminList(techniques, categoryOrder, query, {
    category: techniqueCategory, labels: technique => [technique.name, ...(technique.aliases ?? [])], name: technique => technique.name,
    keep: technique => matchesTechniqueFilter(technique, query.filter),
  });
}

/**
 * Effectif par famille d'ustensiles sous un filtre de suivi.
 * @param utensils - Base master.
 * @param filter - Filtre actif, `null` pour tous.
 */
export function countUtensilsByCategory(utensils: readonly AdminUtensil[], filter: UtensilFilter | null): Record<string, number> {
  return countAdminCategories(utensils, utensilCategory, utensil => matchesUtensilFilter(utensil, filter));
}

/**
 * Effectif par catégorie de gestes sous un filtre de suivi.
 * @param techniques - Glossaire.
 * @param filter - Filtre actif, `null` pour tous.
 */
export function countTechniquesByCategory(techniques: readonly AdminTechnique[], filter: TechniqueFilter | null): Record<string, number> {
  return countAdminCategories(techniques, techniqueCategory, technique => matchesTechniqueFilter(technique, filter));
}
