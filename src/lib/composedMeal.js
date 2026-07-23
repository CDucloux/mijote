// ─── REPAS COMPOSÉ (rôles typés, logique pure) ───────────────────────────────
// Un repas n'est plus « 1 recette = 1 créneau » : c'est une composition typée
// (entrée + plat + accompagnement + dessert). Modèle NON destructif : chaque item
// de mealPlan reste plat, mais porte un `groupId` (le repas) et un `role`. Un item
// legacy sans groupId = plat autonome. Le shopping/DnD itèrent les items sans rien
// savoir de la composition.
import { RECIPE_CATEGORIES } from "../constants/recipeCategories.js";

export const MEAL_ROLES = [
  { id: "entree", label: "Entrée", order: 0 },
  { id: "plat", label: "Plat", order: 1 },
  { id: "accompagnement", label: "Accompagnement", order: 2 },
  { id: "dessert", label: "Dessert", order: 3 },
];
export const ROLE_BY_ID = Object.fromEntries(MEAL_ROLES.map(r => [r.id, r]));
export const roleLabel = (id) => ROLE_BY_ID[id]?.label || "";
export const roleOrder = (id) => (ROLE_BY_ID[id]?.order ?? 1);

// Rôle « naturel » d'une recette d'après son type. Les formes de plat (gratin,
// pasta, pizza, soupe, salade, tarte…) sont des plats ; entrée/accompagnement/
// dessert gardent leur rôle.
export function roleForCategory(cat) {
  if (cat === "entree") return "entree";
  if (cat === "accompagnement") return "accompagnement";
  if (cat === "dessert") return "dessert";
  return "plat";
}

// Identifiant de repas (groupe d'items partageant le créneau).
export function newGroupId() {
  return "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Rôle effectif d'un item de mealPlan (explicite, sinon déduit de la recette).
export function itemRole(item, recipe) {
  return item?.role || roleForCategory(recipe?.category || "");
}

// Groupe les items d'un créneau en repas composés : ceux qui partagent un groupId
// forment un repas (items triés par rôle) ; les autres sont des repas d'un item.
// Renvoie [{ groupId, items: [{ item, idx }] }], dans l'ordre d'apparition.
export function groupSlotMeals(entries = [], recipesById = new Map()) {
  const groups = [];
  const byId = new Map();
  entries.forEach((item, idx) => {
    const key = item.groupId || `solo-${idx}`;
    let g = item.groupId ? byId.get(item.groupId) : null;
    if (!g) { g = { groupId: item.groupId || null, items: [] }; groups.push(g); if (item.groupId) byId.set(item.groupId, g); }
    g.items.push({ item, idx });
  });
  for (const g of groups) {
    g.items.sort((a, b) => roleOrder(itemRole(a.item, recipesById.get(a.item.recipeId))) - roleOrder(itemRole(b.item, recipesById.get(b.item.recipeId))));
  }
  return groups;
}

// Libellés des catégories jouant un rôle donné (pour les pickers manuels).
export function categoriesForRole(role) {
  return RECIPE_CATEGORIES.filter(c => roleForCategory(c.id) === role);
}
