// ─── ACTIONS RECETTES (logique pure) ──────────────────────────────────────────
// Validations et calculs extraits du composant. Aucune dépendance à React :
// le composant fournit l'état courant et applique le résultat.

import { computeNutriInfo, buildRecipeIndex, isComponentLine } from "./nutriscore.js";
import { flattenForShopping, mergeRawLines } from "./recipeComponents.js";

const norm = s => (s || "").toLowerCase().trim();

// Valide et normalise une recette avant sauvegarde.
// → { error } si invalide, sinon { recipe } prête à insérer/remplacer.
export function prepareRecipeForSave(r, { recipes, ingredientDB }) {
  const missingQty = (r.ingredients || []).filter(ing => (ing.name || ing.dbId || ing.recipeId) && !(Number(ing.amount) > 0));
  if (missingQty.length > 0) {
    const names = missingQty.map(i => i.name || "sans nom").join(", ");
    return { error: `Quantité manquante pour : ${names}` };
  }

  const recipesById = buildRecipeIndex(recipes);

  // Règles propres aux composants (préparations de base).
  if (r.isComponent) {
    if (!(Number(r.yield?.amount) > 0)) return { error: "Un composant doit déclarer un rendement (> 0)" };
    if ((r.ingredients || []).some(isComponentLine)) {
      return { error: "Un composant ne peut pas contenir un autre composant (composition mono-niveau)" };
    }
  }

  // Lignes référençant un composant : la cible doit exister, être un composant
  // valide, et l'unité consommée doit correspondre à l'unité du rendement.
  for (const line of r.ingredients || []) {
    if (!isComponentLine(line)) continue;
    const comp = recipesById.get(line.recipeId);
    if (!comp || !comp.isComponent) return { error: `Composant introuvable : "${line.name || line.recipeId}"` };
    if (!(Number(comp.yield?.amount) > 0)) return { error: `Le composant "${comp.name}" n'a pas de rendement valide` };
    if (norm(line.unit) !== norm(comp.yield.unit)) {
      return { error: `"${comp.name}" se consomme en ${comp.yield.unit} (unité du rendement)` };
    }
  }

  const { score, letter } = computeNutriInfo(r.ingredients, ingredientDB, recipesById);
  const withScore = { ...r, healthScore: score, nutriLetter: letter };
  const isEditing = r.id && recipes.find(x => x.id === r.id);

  if (isEditing) {
    const nameTaken = recipes.some(x => x.id !== r.id && norm(x.name) === norm(r.name));
    if (nameTaken) return { error: `Une recette nommée "${r.name}" existe déjà` };
    return { recipe: withScore };
  }

  const nameTaken = recipes.some(x => norm(x.name) === norm(r.name));
  if (nameTaken) return { error: `Une recette nommée "${r.name}" existe déjà` };
  if (!r.name.trim()) return { error: "Le nom de la recette est obligatoire" };
  return { recipe: { ...withScore, id: "r" + Date.now(), createdAt: new Date().toISOString().slice(0, 10) } };
}

// Insère ou remplace la recette dans la liste selon son id.
export function upsertRecipe(recipes, recipe) {
  return recipes.some(x => x.id === recipe.id)
    ? recipes.map(x => x.id === recipe.id ? recipe : x)
    : [recipe, ...recipes];
}

// Recalcule le compteur de recettes de chaque collection.
export function recomputeCollectionCounts(collections, recipes) {
  return collections.map(col => ({
    ...col,
    count: recipes.filter(rec => (rec.collections || []).includes(col.id)).length,
  }));
}

// Construit les items de liste de courses à partir d'une recette.
// Les composants sont éclatés en ingrédients bruts (× fraction consommée × mult),
// puis les lignes identiques sont cumulées. Un composant en stock est exclu.
export function buildShoppingItems(recipe, selectedIngredients, mult, ingredientDB, recipesById, stockSet) {
  const ings = selectedIngredients || recipe.ingredients;
  const merged = mergeRawLines(flattenForShopping(ings, recipesById, stockSet));
  return merged.map(ing => {
    const dbItem = ingredientDB.find(d => d.id === ing.dbId);
    return { id: "si" + Date.now() + Math.random(), name: ing.name, amount: +(ing.amount * (mult || 1)).toFixed(2), unit: ing.unit, image: dbItem?.image || ing.image || "", checked: false };
  });
}
