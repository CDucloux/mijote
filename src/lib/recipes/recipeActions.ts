/**
 * Actions recettes (logique pure). Validations et calculs extraits du composant.
 * Aucune dépendance à React : le composant fournit l'état courant et applique le
 * résultat.
 *
 * @module recipeActions
 */
import { computeNutriInfo, buildRecipeIndex, isComponentLine } from "@/lib/recipes/nutriscore.js";
import { flattenForShopping, mergeRawLines, type ComponentRecipe } from "@/lib/recipes/recipeComponents.js";

/** Ligne d'ingrédient d'une recette (forme minimale manipulée ici). */
export interface RecipeLine {
  name?: string;
  amount?: number | string;
  unit?: string;
  dbId?: string;
  recipeId?: string;
  image?: string;
}

/** Recette manipulée par les actions (forme minimale, champs additionnels tolérés). */
export interface ActionRecipe {
  id?: string;
  name?: string;
  isComponent?: boolean;
  ingredients?: RecipeLine[];
  utensils?: { name?: string; dbId?: string }[];
  yield?: { amount?: number | string; unit?: string };
  healthScore?: number;
  nutriLetter?: string | null;
  collections?: string[];
  createdAt?: string;
  [k: string]: unknown;
}

/** Ingrédient de la base (forme minimale). */
export interface ActionDbItem { id: string; image?: string }

/** Carnet (manuel ou intelligent). */
export interface ActionCollection {
  id: string;
  kind?: string;
  count?: number;
  [k: string]: unknown;
}

const norm = (s: string | undefined): string => (s || "").toLowerCase().trim();

/**
 * Valide et normalise une recette avant sauvegarde : quantités présentes, règles
 * des composants (rendement, mono-niveau, unité de consommation), unicité du nom,
 * puis recalcul du Nutri-Score.
 *
 * @param r - La recette à valider (édition ou création).
 * @param ctx - Contexte de validation.
 * @param ctx.recipes - Toutes les recettes existantes (unicité du nom, résolution des composants).
 * @param ctx.ingredientDB - Base d'ingrédients (calcul du Nutri-Score).
 * @returns `{ error }` si invalide, sinon `{ recipe }` prête à insérer/remplacer
 *   (id et `createdAt` ajoutés en création).
 */
export function prepareRecipeForSave(
  r: ActionRecipe,
  { recipes, ingredientDB }: { recipes: ActionRecipe[]; ingredientDB: ActionDbItem[] },
): { error: string } | { recipe: ActionRecipe } {
  const missingQty = (r.ingredients || []).filter(ing => (ing.name || ing.dbId || ing.recipeId) && !(Number(ing.amount) > 0));
  if (missingQty.length > 0) {
    const names = missingQty.map(i => i.name || "sans nom").join(", ");
    return { error: `Quantité manquante pour : ${names}` };
  }

  const recipesById = buildRecipeIndex(recipes as Parameters<typeof buildRecipeIndex>[0]);

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
    const comp = recipesById.get(line.recipeId!) as ActionRecipe | undefined;
    if (!comp || !comp.isComponent) return { error: `Composant introuvable : "${line.name || line.recipeId}"` };
    if (!(Number(comp.yield?.amount) > 0)) return { error: `Le composant "${comp.name}" n'a pas de rendement valide` };
    if (norm(line.unit) !== norm(comp.yield!.unit as string)) {
      return { error: `"${comp.name}" se consomme en ${comp.yield!.unit} (unité du rendement)` };
    }
  }

  const { score, letter } = computeNutriInfo(r.ingredients, ingredientDB, recipesById);
  const withScore: ActionRecipe = { ...r, healthScore: score, nutriLetter: letter };
  const isEditing = r.id && recipes.find(x => x.id === r.id);

  if (isEditing) {
    const nameTaken = recipes.some(x => x.id !== r.id && norm(x.name) === norm(r.name));
    if (nameTaken) return { error: `Une recette nommée "${r.name}" existe déjà` };
    return { recipe: withScore };
  }

  const nameTaken = recipes.some(x => norm(x.name) === norm(r.name));
  if (nameTaken) return { error: `Une recette nommée "${r.name}" existe déjà` };
  if (!(r.name || "").trim()) return { error: "Le nom de la recette est obligatoire" };
  return { recipe: { ...withScore, id: "r" + Date.now(), createdAt: new Date().toISOString().slice(0, 10) } };
}

/**
 * Insère ou remplace la recette dans la liste selon son id (nouvelle recette en tête).
 *
 * @param recipes - Liste courante.
 * @param recipe - Recette à insérer ou remplacer.
 * @returns Une nouvelle liste avec la recette insérée (en tête) ou remplacée sur place.
 */
export function upsertRecipe(recipes: ActionRecipe[], recipe: ActionRecipe): ActionRecipe[] {
  return recipes.some(x => x.id === recipe.id)
    ? recipes.map(x => x.id === recipe.id ? recipe : x)
    : [recipe, ...recipes];
}

/**
 * Recalcule le compteur de recettes de chaque carnet manuel. Les carnets
 * intelligents (vues de filtres) sont laissés intacts (contenu calculé à l'affichage).
 *
 * @param collections - Les carnets.
 * @param recipes - Toutes les recettes (pour compter l'appartenance).
 * @returns Les carnets avec leur `count` à jour (carnets intelligents inchangés).
 */
export function recomputeCollectionCounts(collections: ActionCollection[], recipes: ActionRecipe[]): ActionCollection[] {
  // Les carnets intelligents (vues de filtres) n'ont pas d'appartenance explicite :
  // leur contenu est calculé à l'affichage. On ne touche qu'aux carnets manuels.
  return collections.map(col => col.kind === "smart" ? col : ({
    ...col,
    count: recipes.filter(rec => (rec.collections || []).includes(col.id)).length,
  }));
}

/** Item de liste de courses produit à partir d'une recette. */
export interface ShoppingItem {
  id: string;
  name?: string;
  amount: number;
  unit?: string;
  image: string;
  checked: boolean;
}

/**
 * Construit les items de liste de courses à partir d'une recette. Les composants
 * sont éclatés en ingrédients bruts (× fraction consommée × `mult`), puis les lignes
 * identiques sont cumulées. Un composant en stock est exclu.
 *
 * @param recipe - La recette source.
 * @param selectedIngredients - Sous-ensemble d'ingrédients retenus (sinon tous ceux de la recette).
 * @param mult - Multiplicateur de portions (défaut 1).
 * @param ingredientDB - Base d'ingrédients (résolution des images).
 * @param recipesById - Index des recettes (résolution des composants).
 * @param stockSet - Ids des composants déjà en stock (exclus de la liste).
 * @returns Les items de courses cumulés et prêts à ajouter à une liste.
 */
export function buildShoppingItems(
  recipe: ActionRecipe,
  selectedIngredients: RecipeLine[] | null | undefined,
  mult: number | undefined,
  ingredientDB: ActionDbItem[],
  recipesById: Map<string, ComponentRecipe>,
  stockSet: Set<string>,
): ShoppingItem[] {
  const ings = selectedIngredients || recipe.ingredients;
  const merged = mergeRawLines(flattenForShopping(ings, recipesById, stockSet));
  return merged.map(ing => {
    const dbItem = ingredientDB.find(d => d.id === ing.dbId);
    return { id: "si" + Date.now() + Math.random(), name: ing.name, amount: +((Number(ing.amount) || 0) * (mult || 1)).toFixed(2), unit: ing.unit, image: dbItem?.image || ing.image || "", checked: false };
  });
}
