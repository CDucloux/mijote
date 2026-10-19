import { parse as parseYaml } from "yaml";
import { parseRecipeCategories } from "@/lib/data/referenceData.js";
import raw from "../../data/recipe-categories.yaml?raw";

// ─── TYPE / CATÉGORIE DE RECETTE ──────────────────────────────────────────────
// Rôle de la recette dans le repas (axe unique, sélection simple). Distinct de
// `cuisine` (origine) et du filtre `type` (plat vs préparation de base). Une
// recette porte au plus une catégorie (`recipe.category`, l'`id` ci-dessous).
// Listes éditées dans data/recipe-categories.yaml. `BASE_CATEGORIES` : types propres
// aux PRÉPARATIONS DE BASE (fond, sauce mère, appareil, liaison, pâte), le rôle dans
// le repas n'ayant aucun sens pour une base.
const { meal, base } = parseRecipeCategories(parseYaml(raw));
export const RECIPE_CATEGORIES = meal;
export const BASE_CATEGORIES = base;

/** Ids de catégories réservés aux préparations de base. */
export const BASE_CATEGORY_IDS: ReadonlySet<string> = new Set(BASE_CATEGORIES.map(c => c.id));

const BY_ID = new Map([...RECIPE_CATEGORIES, ...BASE_CATEGORIES].map(c => [c.id, c]));
export function categoryLabel(id: string | null | undefined): string { return (id ? BY_ID.get(id)?.label : undefined) || ""; }
export function categoryEmoji(id: string | null | undefined): string { return (id ? BY_ID.get(id)?.emoji : undefined) || "🍴"; }
export function isRecipeCategory(id: string | null | undefined): boolean { return !!id && BY_ID.has(id); }
