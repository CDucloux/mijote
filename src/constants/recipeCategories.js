// ─── TYPE / CATÉGORIE DE RECETTE ──────────────────────────────────────────────
// Rôle de la recette dans le repas (axe unique, sélection simple). Distinct de
// `cuisine` (origine) et du filtre `type` (plat vs préparation de base). Une
// recette porte au plus une catégorie (`recipe.category`, l'`id` ci-dessous).
export const RECIPE_CATEGORIES = [
  { id: "aperitif",     label: "Apéritif",        emoji: "🫒" },
  { id: "entree",       label: "Entrée",          emoji: "🥗" },
  { id: "soupe",        label: "Soupe chaude",    emoji: "🍲" },
  { id: "soupe-froide", label: "Soupe froide",    emoji: "🥶" },
  { id: "salade",       label: "Salade",          emoji: "🥬" },
  { id: "plat",         label: "Plat",            emoji: "🍽️" },
  { id: "gratin",       label: "Gratin",          emoji: "🧀" },
  { id: "pasta",        label: "Pasta",           emoji: "🍝" },
  { id: "pizza",        label: "Pizza",           emoji: "🍕" },
  { id: "accompagnement", label: "Accompagnement", emoji: "🥔" },
  { id: "dessert",      label: "Dessert",         emoji: "🍰" },
  { id: "tarte",        label: "Tarte",           emoji: "🥧" },
  { id: "petit-dej",    label: "Petit-déjeuner",  emoji: "🥐" },
  { id: "boisson",      label: "Boisson",         emoji: "🥤" },
  { id: "sauce",        label: "Sauce",           emoji: "🫙" },
  { id: "boulangerie",  label: "Boulangerie",     emoji: "🍞" },
];

// Types propres aux PRÉPARATIONS DE BASE (composants). Les catégories « rôle dans
// le repas » (apéritif, plat, dessert…) n'ont aucun sens pour une base : on
// propose plutôt les grandes familles classiques (fond, sauce mère, appareil,
// liaison, pâte). `sauce` est partagé avec la liste principale.
export const BASE_CATEGORIES = [
  { id: "fond",     label: "Fond",     emoji: "🥣" },
  { id: "sauce",    label: "Sauce",    emoji: "🫙" },
  { id: "appareil", label: "Appareil", emoji: "🥚" },
  { id: "liaison",  label: "Liaison",  emoji: "🧈" },
  { id: "pate",     label: "Pâte",     emoji: "🥟" },
];

/** Ids de catégories réservés aux préparations de base. */
export const BASE_CATEGORY_IDS = new Set(BASE_CATEGORIES.map(c => c.id));

const BY_ID = new Map([...RECIPE_CATEGORIES, ...BASE_CATEGORIES].map(c => [c.id, c]));
export function categoryLabel(id) { return BY_ID.get(id)?.label || ""; }
export function categoryEmoji(id) { return BY_ID.get(id)?.emoji || "🍴"; }
export function isRecipeCategory(id) { return BY_ID.has(id); }
