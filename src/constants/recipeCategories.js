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
export const BASE_CATEGORY_IDS = new Set(BASE_CATEGORIES.map(c => c.id));

const BY_ID = new Map([...RECIPE_CATEGORIES, ...BASE_CATEGORIES].map(c => [c.id, c]));
export function categoryLabel(id) { return BY_ID.get(id)?.label || ""; }
export function categoryEmoji(id) { return BY_ID.get(id)?.emoji || "🍴"; }
export function isRecipeCategory(id) { return BY_ID.has(id); }
