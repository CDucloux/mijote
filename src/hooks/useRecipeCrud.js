import { prepareRecipeForSave, upsertRecipe, recomputeCollectionCounts, buildShoppingItems } from "@/lib/recipes/recipeActions.js";
import { recipesReferencing } from "@/lib/recipes/recipeComponents.js";
import { buildRecipeIndex } from "@/lib/recipes/nutriscore.js";
import { cleanRecipeForExport } from "@/lib/recipes/recipeSchema.js";
import { prepareRecipeImport } from "@/lib/recipes/recipeImport.js";
import { deleteImageByUrl } from "@/lib/firebase/storage.js";
import { printRecipe } from "@/lib/recipes/recipePdf.js";

// ─── RECETTES — opérations cœur (CRUD, courses, import/export) ─────────────────
// Sauvegarde, suppression (avec déliage des bases référencées), ajout aux courses,
// import/export JSON et impression PDF. Extrait d'App.jsx ; dépendances injectées.
export function useRecipeCrud({
  recipes, setRecipes, setCollections, setEditingRecipe, setShoppingLists,
  ingredientDB, utensilDB, techniques, stock, notify, navigate,
}) {
  const saveRecipe = (r) => {
    const result = prepareRecipeForSave(r, { recipes, ingredientDB });
    if (result.error) { notify(result.error, "error"); return false; }
    const updatedRecipes = upsertRecipe(recipes, result.recipe);
    setRecipes(updatedRecipes);
    setCollections(prev => recomputeCollectionCounts(prev, updatedRecipes));
    setEditingRecipe(null);
    notify("Recette sauvegardée");
    return true;
  };

  const deleteRecipe = (id) => {
    const r = recipes.find(x => x.id === id);
    if (r?.isComponent) {
      const refs = recipesReferencing(id, recipes);
      if (refs.length > 0) {
        const names = refs.slice(0, 3).map(x => `« ${x.name} »`).join(", ");
        const extra = refs.length > 3 ? ` et ${refs.length - 3} autre(s)` : "";
        const ok = window.confirm(
          `Cette base est utilisée dans ${refs.length} recette(s) : ${names}${extra}.\n\nLes lignes qui y font référence seront supprimées. Continuer ?`
        );
        if (!ok) return;
        // Délie les lignes orphelines dans les recettes référencées.
        setRecipes(prev => prev.map(recipe => {
          if (!refs.some(x => x.id === recipe.id)) return recipe;
          return { ...recipe, ingredients: (recipe.ingredients || []).filter(ing => ing.recipeId !== id) };
        }).filter(recipe => recipe.id !== id));
        if (r?.image) deleteImageByUrl(r.image);
        navigate("/recipes");
        notify("Base supprimée");
        return;
      }
    }
    if (r?.image) deleteImageByUrl(r.image);
    setRecipes(prev => prev.filter(x => x.id !== id));
    navigate("/recipes");
    notify("Recette supprimée");
  };

  const addToShopping = (recipe, selectedIngredients, mult = 1) => {
    const items = buildShoppingItems(recipe, selectedIngredients, mult, ingredientDB, buildRecipeIndex(recipes), new Set(stock));
    if (items.length === 0) return;
    setShoppingLists(prev => {
      const existing = prev.find(l => l.type === "recipe" && l.recipeId === recipe.id);
      if (existing) return prev.map(l => l.id === existing.id ? { ...l, items: [...l.items, ...items] } : l);
      return [...prev, { id: "sl" + Date.now(), name: recipe.name, type: "recipe", recipeId: recipe.id, items }];
    });
    notify(`${items.length} ingrédient(s) ajoutés aux courses`);
  };

  const exportJSON = (recipe) => {
    const blob = new Blob([JSON.stringify(cleanRecipeForExport(recipe), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${recipe.name.split(" ").join("_")}.json`; a.click();
    notify("Export JSON téléchargé");
  };

  const importJSON = (json) => {
    const result = prepareRecipeImport(json, { ingredientDB, utensilDB });
    if (result.error) { notify(result.error, "error"); return; }
    const { prepared, linked, rejected } = result;
    setRecipes(prev => {
      const existingNames = new Set(prev.map(r => r.name.toLowerCase().trim()));
      const newOnes = prepared.filter(r => !existingNames.has(r.name.toLowerCase().trim()));
      const dupes = prepared.length - newOnes.length;
      const extras = [
        linked > 0 ? `${linked} élément(s) reliés à ta base` : "",
        dupes > 0 ? `${dupes} doublon(s) ignoré(s)` : "",
        rejected > 0 ? `${rejected} recette(s) non conforme(s) écartée(s)` : "",
      ].filter(Boolean).join(" · ");
      if (newOnes.length > 0) notify(`${newOnes.length} recette(s) importée(s)${extras ? ` · ${extras}` : ""}`);
      else notify(`Aucune recette importée${extras ? ` – ${extras}` : ""}`, "error");
      return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
    });
  };

  const exportPDF = (recipe) => {
    printRecipe(recipe, { ingredientDB, utensilDB, recipesById: buildRecipeIndex(recipes), techniques });
    notify("Ouverture de l'aperçu d'impression…");
  };

  return { saveRecipe, deleteRecipe, addToShopping, exportJSON, importJSON, exportPDF };
}
