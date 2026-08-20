/**
 * Opérations pures sur une liste de courses : regroupement par catégorie pour
 * l'affichage, déversement des produits de placard dans le stock à l'achat, et
 * nettoyage d'un collage multi-lignes. Aucun I/O ni React ; les mutations d'état
 * (animations, écritures Firestore) vivent dans le hook `useShopping`.
 *
 * @module shoppingList
 */
import { findIngredientMatch, type DbEntry } from "@/lib/food/nameMatcher.js";
import { sortedCategoryEntries, STOCK_CATEGORIES } from "@/constants/categories.js";

/** Réglages d'affichage d'une catégorie (sous-ensemble typé de la config Master). */
export interface CategoryConfig {
  label: string;
  icon: string;
  order?: number;
  color?: string;
}

/** Configuration des catégories, indexée par clé technique. */
export type CategoriesConfig = Record<string, CategoryConfig>;

/** Article regroupable : seuls le nom (tri) et l'état coché sont requis ici. */
export interface Sectionable {
  name: string;
  checked?: boolean;
}

/** Un groupe de catégorie prêt à afficher (en-tête + articles triés). */
export interface Section<T> {
  key: string;
  label: string;
  icon: string;
  items: T[];
}

/** Découpage d'une liste : sections « à acheter » par catégorie + le « Acheté ». */
export interface ShoppingSections<T> {
  sections: Section<T>[];
  done: T[];
}

/** Tri alphabétique français, stable pour l'affichage des articles. */
const byName = (a: Sectionable, b: Sectionable): number => a.name.localeCompare(b.name, "fr");

/**
 * Regroupe les articles à acheter par catégorie (ordre des catégories, puis
 * alphabétique dans chaque groupe) et isole les articles déjà cochés dans
 * `done` (triés de même). La catégorie de chaque article est fournie par
 * `categoryOf` : directe pour un article agrégé, résolue via la Master DB pour
 * un article de liste.
 *
 * @param items - Les articles de la liste (ou de l'agrégat).
 * @param categories - Configuration des catégories (ordre et libellés).
 * @param categoryOf - Résout la clé de catégorie d'un article.
 * @returns Les sections « à acheter » non vides et la liste `done`.
 */
export function buildShoppingSections<T extends Sectionable>(
  items: T[] | null | undefined,
  categories: CategoriesConfig,
  categoryOf: (item: T) => string,
): ShoppingSections<T> {
  const all = items || [];
  const todo = all.filter(i => !i.checked);
  const done = all.filter(i => i.checked).slice().sort(byName);
  const groups: Record<string, T[]> = {};
  for (const it of todo) {
    const c = categoryOf(it) || "other";
    (groups[c] = groups[c] || []).push(it);
  }
  const entries = sortedCategoryEntries(categories) as [string, CategoryConfig][];
  const sections = entries
    .filter(([k]) => groups[k] && groups[k].length)
    .map(([k, c]) => ({ key: k, label: c.label, icon: c.icon, items: groups[k].slice().sort(byName) }));
  return { sections, done };
}

/**
 * Parmi les articles cochés, les produits de placard (catégories non
 * périssables) reconnus par la Master DB. Ce sont eux qui rejoignent le stock
 * quand on valide l'achat ; les produits frais en sont exclus. Les doublons
 * sont conservés (un même produit coché deux fois apparaît deux fois) : la
 * déduplication se fait au point d'usage, selon qu'on compte, qu'on notifie ou
 * qu'on déverse dans le stock.
 *
 * @param items - Les articles à examiner (cochés ou non).
 * @param ingredientDB - Base d'ingrédients pour la résolution des noms.
 * @returns Les entrées Master DB de placard cochées, dans l'ordre, doublons compris.
 */
export function stockMatchesFromChecked(
  items: Sectionable[] | null | undefined,
  ingredientDB: DbEntry[] | null | undefined,
): DbEntry[] {
  const out: DbEntry[] = [];
  for (const it of items || []) {
    if (!it.checked) continue;
    const m = findIngredientMatch(it.name, ingredientDB);
    if (!m || !STOCK_CATEGORIES.has(m.category ?? "")) continue;
    out.push(m);
  }
  return out;
}

/** Retire tiret, puce ou numéro de tête d'une ligne collée, puis l'espace superflu. */
export function stripShoppingBullet(s: string): string {
  return s
    .replace(/^\s*[-*\u2022\u00b7\u2013\u2014]+\s*/, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .trim();
}

/**
 * Découpe un texte collé en lignes d'articles nettoyées (une ligne = un
 * article), les lignes vides écartées. Ne tronque pas : l'appelant applique la
 * borne de quantité (pour distinguer comptage et insertion).
 *
 * @param text - Le contenu brut de la zone de collage.
 * @returns Les noms d'articles nettoyés, sans ligne vide.
 */
export function splitBulletLines(text: string): string[] {
  return text.split(/\r?\n/).map(stripShoppingBullet).filter(Boolean);
}
