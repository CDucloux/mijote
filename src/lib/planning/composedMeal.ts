/**
 * Repas composé : rôles typés (entrée / plat / accompagnement / dessert) et
 * regroupement des items d'un créneau. Modèle NON destructif — chaque item de
 * `mealPlan` reste plat, mais porte un `groupId` (le repas) et un `role` ; un item
 * legacy sans `groupId` est un plat autonome. Le shopping et le drag-and-drop
 * itèrent les items sans rien savoir de la composition.
 *
 * @module composedMeal
 */
import { RECIPE_CATEGORIES } from "@/constants/recipeCategories.js";
import type { MealItem } from "@/lib/types.js";

export type { MealItem };

/** Rôle d'un item dans un repas composé. */
export type RoleId = "entree" | "plat" | "accompagnement" | "dessert";

/** Recette (forme minimale) : seule la catégorie sert au calcul des rôles. */
export interface CategorizedRecipe {
  category?: string | null;
}

/** Repas d'un créneau : un groupe d'items partageant un `groupId`. */
export interface SlotGroup {
  groupId: string | null;
  items: { item: MealItem; idx: number }[];
}

/** Les quatre rôles d'un repas composé, dans l'ordre de service. */
export const MEAL_ROLES: { id: RoleId; label: string; order: number }[] = [
  { id: "entree", label: "Entrée", order: 0 },
  { id: "plat", label: "Plat", order: 1 },
  { id: "accompagnement", label: "Accompagnement", order: 2 },
  { id: "dessert", label: "Dessert", order: 3 },
];
export const ROLE_BY_ID: Record<string, { id: RoleId; label: string; order: number }> =
  Object.fromEntries(MEAL_ROLES.map(r => [r.id, r]));

/** Libellé d'un rôle (`""` si inconnu). */
export const roleLabel = (id: string | null | undefined): string => ROLE_BY_ID[id || ""]?.label || "";
/** Ordre de service d'un rôle (défaut : celui du plat). */
export const roleOrder = (id: string | null | undefined): number => ROLE_BY_ID[id || ""]?.order ?? 1;

/**
 * Rôle « naturel » d'une recette d'après sa catégorie. Les formes de plat (gratin,
 * pasta, pizza, soupe, salade, tarte…) sont des plats ; l'apéritif compte comme une
 * entrée ; accompagnement / dessert gardent leur rôle.
 *
 * @param cat - La catégorie de la recette.
 * @returns Le rôle correspondant (`plat` par défaut).
 */
export function roleForCategory(cat: string | null | undefined): RoleId {
  if (cat === "entree" || cat === "aperitif") return "entree"; // un apéritif ouvre le repas → rôle d'entrée
  if (cat === "accompagnement") return "accompagnement";
  if (cat === "dessert") return "dessert";
  return "plat";
}

/** Plats « complets » qui se suffisent à eux-mêmes : pas besoin d'accompagnement. */
const SELF_SUFFICIENT_CATEGORIES = new Set(["soupe", "soupe-froide", "salade", "pasta", "pizza", "gratin", "tarte"]);

/**
 * Le plat appelle-t-il un accompagnement ? Un plat générique en veut un ; une soupe /
 * salade / pasta / pizza / gratin / tarte se suffit.
 *
 * @param recipe - La recette (sa catégorie décide).
 * @returns `true` si un accompagnement est pertinent.
 */
export function platNeedsSide(recipe: CategorizedRecipe | null | undefined): boolean {
  return !SELF_SUFFICIENT_CATEGORIES.has(recipe?.category || "");
}

/**
 * Génère un identifiant de repas (groupe d'items partageant le créneau).
 *
 * @returns Un nouvel id de groupe unique.
 */
export function newGroupId(): string {
  return "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Rôle effectif d'un item de planning : explicite s'il est posé, sinon déduit de la recette.
 *
 * @param item - L'item de planning (peut porter un `role` explicite).
 * @param recipe - La recette liée (repli sur sa catégorie).
 * @returns Le rôle effectif de l'item.
 */
export function itemRole(item: MealItem | null | undefined, recipe: CategorizedRecipe | null | undefined): RoleId {
  return (item?.role as RoleId) || roleForCategory(recipe?.category || "");
}

/**
 * Groupe les items d'un créneau en repas composés : ceux qui partagent un `groupId`
 * forment un repas (items triés par rôle) ; les autres sont des repas d'un item.
 * Ordre des groupes = ordre d'apparition.
 *
 * @param entries - Les items du créneau.
 * @param recipesById - Index des recettes (pour trier les items par rôle).
 * @returns Les groupes-repas, dans l'ordre d'apparition.
 */
export function groupSlotMeals(
  entries: MealItem[] = [],
  recipesById: Map<string, CategorizedRecipe> = new Map(),
): SlotGroup[] {
  const groups: SlotGroup[] = [];
  const byId = new Map<string, SlotGroup>();
  entries.forEach((item, idx) => {
    let g = item.groupId ? byId.get(item.groupId) : null;
    if (!g) { g = { groupId: item.groupId || null, items: [] }; groups.push(g); if (item.groupId) byId.set(item.groupId, g); }
    g.items.push({ item, idx });
  });
  for (const g of groups) {
    g.items.sort((a, b) => roleOrder(itemRole(a.item, recipesById.get(a.item.recipeId || ""))) - roleOrder(itemRole(b.item, recipesById.get(b.item.recipeId || ""))));
  }
  return groups;
}

/**
 * Catégories jouant un rôle donné (pour les pickers manuels).
 *
 * @param role - Le rôle recherché.
 * @returns Les catégories de recette dont le rôle naturel correspond.
 */
export function categoriesForRole(role: RoleId): { id: string; label: string; emoji: string }[] {
  return RECIPE_CATEGORIES.filter((c: { id: string }) => roleForCategory(c.id) === role);
}
