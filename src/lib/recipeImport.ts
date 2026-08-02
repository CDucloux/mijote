/**
 * Import de recettes. Parsing + validation de schéma + rapprochement de noms
 * (dbId) + recalcul du score. Fonction pure : ne touche ni à l'état React ni au
 * DOM. Le composant se contente de dédoublonner contre l'existant et d'afficher
 * le résultat.
 *
 * @module recipeImport
 */
import { validateRecipeSchema } from "./recipeSchema.js";
import { buildNameMatcher } from "./nameMatcher.js";
import { computeNutriInfo } from "./nutriscore.js";

/** Recette importée (forme minimale ; champs additionnels conservés). */
export interface ImportRecipe {
  name?: string;
  ingredients?: { name?: string; dbId?: string }[];
  utensils?: { name?: string; dbId?: string }[];
  [k: string]: unknown;
}

/** Ingrédient / ustensile de la base (forme minimale). */
export interface ImportDbItem { id: string; name: string; aliases?: string[]; [k: string]: unknown }

/** Résultat d'un import réussi. */
export interface ImportResult {
  prepared: ImportRecipe[];
  linked: number;
  rejected: number;
}

/** → `{ error }` en cas d'échec, sinon `{ prepared, linked, rejected }`. */
export function prepareRecipeImport(
  json: string,
  { ingredientDB = [], utensilDB = [] }: { ingredientDB?: ImportDbItem[]; utensilDB?: ImportDbItem[] } = {},
): { error: string } | ImportResult {
  let data: unknown;
  try { data = JSON.parse(json); }
  catch { return { error: "JSON invalide : fichier illisible" }; }

  const incoming = (Array.isArray(data) ? data : [data]) as ImportRecipe[];
  if (!incoming.length) return { error: "Aucune recette dans le fichier" };

  // Validation de schéma : on écarte les recettes non conformes plutôt que
  // d'injecter des données corrompues. Import refusé si TOUT est invalide.
  const validRecipes: ImportRecipe[] = [], schemaErrors: string[] = [];
  incoming.forEach((r, i) => {
    const label = `Recette ${r && typeof r === "object" && r.name ? `« ${r.name} »` : `#${i + 1}`}`;
    const e = validateRecipeSchema(r, label);
    if (e.length) schemaErrors.push(...e); else validRecipes.push(r);
  });
  if (!validRecipes.length) return { error: `Import refusé – schéma invalide : ${schemaErrors[0]}` };

  try {
    const matchIng = buildNameMatcher(ingredientDB);
    const matchUt = buildNameMatcher(utensilDB);
    let linked = 0;
    // Remplit les dbId vides par rapprochement de nom contre la base de
    // l'utilisateur, puis recalcule le score santé. Un dbId déjà présent est respecté.
    const prepared = validRecipes.map(r => {
      const ingredients = (r.ingredients || []).map(ing => {
        if (ing.dbId) return ing;
        const dbId = matchIng(ing.name);
        if (dbId) linked++;
        return { ...ing, dbId };
      });
      const utensils = (r.utensils || []).map(u => {
        if (u.dbId) return u;
        const dbId = matchUt(u.name);
        if (dbId) linked++;
        return { ...u, dbId };
      });
      const { score, letter } = computeNutriInfo(ingredients, ingredientDB);
      return { ...r, id: "r" + Date.now() + Math.random(), ingredients, utensils, healthScore: score, nutriLetter: letter };
    });
    return { prepared, linked, rejected: incoming.length - validRecipes.length };
  } catch { return { error: "Erreur lors de l'import" }; }
}
