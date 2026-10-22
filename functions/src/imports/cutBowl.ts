/**
 * Bol de réserve des découpes : toute étape qui découpe se termine par un passage
 * au bol (on taille, puis on réserve chaque découpe à part jusqu'à la cuisson).
 *
 * @module imports/cutBowl
 */

/** Recette au schéma final, réduite à ce que la règle lit et complète. */
export interface CutBowlRecipe {
  ingredients: { id: string; cut?: unknown }[];
  utensils: { id: string; dbId: string; name: string }[];
  steps: { ingredients: string[]; utensils: string[] }[];
}

const fold = (value: string): string => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const isBowl = (name: string): boolean => /^bols?\b/.test(fold(name));
const isBoard = (name: string): boolean => /^planches?\b/.test(fold(name));

/**
 * Relie un bol à chaque étape de découpe. Une étape découpe quand elle porte un
 * ingrédient doté d'une `cut`, ou qu'elle est reliée à une planche (le modèle l'ajoute
 * à tout geste de taille, même sans découpe nommée). Le bol réutilise celui déjà
 * présent dans la recette ; sinon il est ajouté depuis la base master (le plus court
 * des noms commençant par « bol », donc « Bol » avant « Bol mixeur »). Sans bol connu,
 * la recette reste telle quelle : on n'invente aucun ustensile hors base.
 *
 * @param recipe - Recette assemblée (ids d'ingrédients et d'ustensiles posés). Modifiée en place.
 * @param knownUtensils - Noms d'ustensiles de la base master.
 * @returns La même recette, pour chaîner.
 */
export function linkCutBowl<T extends CutBowlRecipe>(recipe: T, knownUtensils: readonly string[]): T {
  const cutIds = new Set(recipe.ingredients.filter((ingredient) => ingredient.cut).map((ingredient) => ingredient.id));
  const boardIds = new Set(recipe.utensils.filter((utensil) => isBoard(utensil.name)).map((utensil) => utensil.id));
  const cuttingSteps = recipe.steps.filter((step) =>
    step.ingredients.some((id) => cutIds.has(id)) || step.utensils.some((id) => boardIds.has(id)));
  if (!cuttingSteps.length) return recipe;

  let bowl = recipe.utensils.find((utensil) => isBowl(utensil.name));
  if (!bowl) {
    const name = knownUtensils.filter(isBowl).sort((a, b) => a.length - b.length)[0];
    if (!name) return recipe;
    const taken = new Set(recipe.utensils.map((utensil) => utensil.id));
    let k = recipe.utensils.length;
    while (taken.has(`u${k}`)) k++;
    bowl = { id: `u${k}`, dbId: "", name };
    recipe.utensils.push(bowl);
  }
  for (const step of cuttingSteps) {
    if (!step.utensils.includes(bowl.id)) step.utensils.push(bowl.id);
  }
  return recipe;
}
