// ─── DASHBOARD (helpers purs pour l'onglet Accueil) ──────────────────────────
// Tout le bloc « Aujourd'hui » se dérive de l'état local déjà présent dans l'app
// (mealPlan, listes de courses, stock bas). Ces fonctions sont pures pour rester
// testables et réutilisables côté découverte (PR2).

// Clé ISO du jour (YYYY-MM-DD), cohérente avec les clés de mealPlan.
export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// Repas planifiés pour une date donnée, enrichis de la recette résolue.
// Renvoie [{ recipeId, portions, slot, recipe }], dans l'ordre midi → soir.
const SLOT_ORDER = { midi: 0, soir: 1 };
export function getTodayMeals(mealPlan = {}, recipes = [], key = todayKey()) {
  const entries = (mealPlan && mealPlan[key]) || [];
  const byId = new Map(recipes.map(r => [r.id, r]));
  return entries
    .map(m => ({ ...m, recipe: byId.get(m.recipeId) }))
    .filter(m => m.recipe)
    .sort((a, b) => (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9));
}

// Le créneau « à venir » selon l'heure : avant 15h on met en avant le midi, sinon le soir.
export function upcomingSlot(date = new Date()) {
  return date.getHours() < 15 ? "midi" : "soir";
}

// Nombre total d'articles non cochés sur l'ensemble des listes de courses.
export function countShoppingTodo(lists = []) {
  return lists.reduce((sum, l) => sum + ((l.items || []).filter(i => !i.checked).length), 0);
}

// Noms (résolus via la base d'ingrédients) des ingrédients marqués « bientôt vide ».
export function getLowStockNames(lowStock = [], ingredientDB = []) {
  const byId = new Map(ingredientDB.map(i => [i.id, i]));
  return lowStock.map(id => byId.get(id)).filter(Boolean).map(i => i.name);
}

// Agrège tout ce dont l'en-tête « Aujourd'hui » a besoin + un drapeau « rien à signaler ».
export function buildDashboardSummary({ mealPlan, recipes, shoppingLists, lowStock, ingredientDB, date = new Date() } = {}) {
  const key = todayKey(date);
  const meals = getTodayMeals(mealPlan, recipes, key);
  const shoppingTodo = countShoppingTodo(shoppingLists);
  const lowStockNames = getLowStockNames(lowStock, ingredientDB);
  return {
    meals,
    upcomingSlot: upcomingSlot(date),
    shoppingTodo,
    lowStockNames,
    isCalm: meals.length === 0 && shoppingTodo === 0 && lowStockNames.length === 0,
  };
}
