import type { Dispatch, SetStateAction } from "react";
import { prepareRecipeForSave, upsertRecipe, recomputeCollectionCounts, buildShoppingItems, type ActionDbItem } from "@/lib/recipes/recipeActions.js";
import { recipesReferencing } from "@/lib/recipes/recipeComponents.js";
import { buildRecipeIndex } from "@/lib/recipes/nutriscore.js";
import { cleanRecipeForExport } from "@/lib/recipes/recipeSchema.js";
import { prepareRecipeImport, type ImportDbItem } from "@/lib/recipes/recipeImport.js";
import { canAddRecipes, FREE_RECIPE_LIMIT } from "@/lib/recipes/plan.js";
import { deleteImageByUrl } from "@/lib/firebase/storage.js";
import { printRecipe, type PdfRecipe } from "@/lib/recipes/recipePdf.js";
import type { Recipe, IngredientLine, Collection } from "@/lib/types.js";
import type { ActivityInput } from "@/lib/notifications/activity.js";
import type { ComponentRecipe } from "@/lib/recipes/recipeComponents.js";

/** Liste de courses (forme minimale manipulée ici). */
export interface ShoppingList {
  id: string;
  name?: string;
  type?: string;
  recipeId?: string;
  items: unknown[];
}

/** Dépendances injectées (état de l'app + setters + notify/navigate). */
export interface RecipeCrudDeps {
  recipes: Recipe[];
  setRecipes: Dispatch<SetStateAction<Recipe[]>>;
  setCollections: Dispatch<SetStateAction<Collection[]>>;
  setEditingRecipe: (r: Recipe | null) => void;
  shoppingLists: ShoppingList[];
  setShoppingLists: Dispatch<SetStateAction<ShoppingList[]>>;
  ingredientDB: ActionDbItem[];
  utensilDB: ImportDbItem[];
  techniques: unknown[];
  stock: string[];
  isPlus: boolean;
  notify: (msg: string, type?: string) => void;
  navigate: (path: string) => void;
  logActivity: (input: ActivityInput) => void;
}

/** Index de recettes tel qu'attendu par les helpers courses/PDF (composants). */
const componentIndex = (recipes: Recipe[]): Map<string, ComponentRecipe> =>
  buildRecipeIndex(recipes as Parameters<typeof buildRecipeIndex>[0]) as unknown as Map<string, ComponentRecipe>;

/**
 * Recettes, opérations cœur (CRUD, courses, import/export). Sauvegarde, suppression
 * (avec déliage des bases référencées), ajout aux courses, import/export JSON et
 * impression PDF.
 *
 * @param deps - État de l'app, setters et `notify`/`navigate`.
 * @returns `{ saveRecipe, deleteRecipe, addToShopping, exportJSON, importJSON, exportPDF }`.
 */
export function useRecipeCrud({
  recipes, setRecipes, setCollections, setEditingRecipe, shoppingLists, setShoppingLists,
  ingredientDB, utensilDB, techniques, stock, isPlus, notify, navigate, logActivity,
}: RecipeCrudDeps) {
  // Quota du plan gratuit : bloque la création au-delà de la limite. `redirect`
  // renvoie vers l'offre, désactivé depuis l'éditeur (qui masquerait /plan).
  const guardQuota = (adding = 1, redirect = true): boolean => {
    if (canAddRecipes(recipes, isPlus, adding)) return true;
    notify(`Plan gratuit limité à ${FREE_RECIPE_LIMIT} recettes. Passe à Cardamome+ pour en créer plus.`, "warning");
    if (redirect) navigate("/plan");
    return false;
  };

  const saveRecipe = (r: Recipe): boolean => {
    const result = prepareRecipeForSave(r, { recipes, ingredientDB });
    if ("error" in result) { notify(result.error, "error"); return false; }
    // Création d'une NOUVELLE recette (≠ édition) : soumise au quota du plan.
    // Filet de sécurité (l'ouverture est déjà gardée en amont) → sans redirection.
    const isNew = !recipes.some(x => x.id === result.recipe.id) && !result.recipe.isComponent;
    if (isNew && !guardQuota(1, false)) return false;
    const updatedRecipes = upsertRecipe(recipes, result.recipe);
    setRecipes(updatedRecipes);
    setCollections(prev => recomputeCollectionCounts(prev, updatedRecipes));
    setEditingRecipe(null);
    notify("Recette sauvegardée");
    // Une base (isComponent) n'est pas un ajout de recette « visible » : on ne la
    // journalise pas comme telle. On distingue création et édition pour le libellé.
    if (!result.recipe.isComponent) logActivity({ type: isNew ? "recipe.add" : "recipe.edit", target: result.recipe.name, targetId: result.recipe.id });
    return true;
  };

  const deleteRecipe = (id: string): void => {
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
    if (r) logActivity({ type: "recipe.delete", target: r.name });
  };

  const addToShopping = (recipe: Recipe, selectedIngredients: IngredientLine[] | null | undefined, mult = 1): void => {
    const items = buildShoppingItems(recipe, selectedIngredients, mult, ingredientDB, componentIndex(recipes), new Set(stock));
    if (items.length === 0) return;
    // Id de la liste cible (existante ou nouvelle), résolu sur l'état courant pour
    // un lien profond fiable (les updaters React ne s'exécutent pas de façon synchrone).
    const existing = shoppingLists.find(l => l.type === "recipe" && l.recipeId === recipe.id);
    const listId = existing ? existing.id : "sl" + Date.now();
    setShoppingLists(prev => {
      if (prev.find(l => l.id === listId)) return prev.map(l => l.id === listId ? { ...l, items: [...l.items, ...items] } : l);
      return [...prev, { id: listId, name: recipe.name, type: "recipe", recipeId: recipe.id, items }];
    });
    notify(`${items.length} ingrédient(s) ajoutés aux courses`);
    logActivity({ type: "shopping.add", target: recipe.name, targetId: listId, count: items.length });
  };

  const exportJSON = (recipe: Recipe): void => {
    const blob = new Blob([JSON.stringify(cleanRecipeForExport(recipe), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${(recipe.name || "").split(" ").join("_")}.json`; a.click();
    notify("Export JSON téléchargé");
  };

  const importJSON = (json: string): void => {
    const result = prepareRecipeImport(json, { ingredientDB: ingredientDB as unknown as ImportDbItem[], utensilDB });
    if ("error" in result) { notify(result.error, "error"); return; }
    const { prepared, linked, rejected } = result;
    // Quota du plan : borne haute (avant déduplication) des recettes ajoutées.
    if (!guardQuota(prepared.filter(r => !r.isComponent).length)) return;
    setRecipes(prev => {
      const existingNames = new Set(prev.map(r => (r.name || "").toLowerCase().trim()));
      const newOnes = prepared.filter(r => !existingNames.has((r.name || "").toLowerCase().trim()));
      const dupes = prepared.length - newOnes.length;
      const extras = [
        linked > 0 ? `${linked} élément(s) reliés à ta base` : "",
        dupes > 0 ? `${dupes} doublon(s) ignoré(s)` : "",
        rejected > 0 ? `${rejected} recette(s) non conforme(s) écartée(s)` : "",
      ].filter(Boolean).join(" · ");
      if (newOnes.length > 0) { notify(`${newOnes.length} recette(s) importée(s)${extras ? ` · ${extras}` : ""}`); logActivity({ type: "recipe.import", count: newOnes.length }); }
      else notify(`Aucune recette importée${extras ? ` – ${extras}` : ""}`, "error");
      return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
    });
  };

  const exportPDF = (recipe: Recipe): void => {
    notify("Ouverture de l'aperçu d'impression…");
    printRecipe(recipe as unknown as PdfRecipe, {
      ingredientDB, utensilDB,
      recipesById: buildRecipeIndex(recipes as Parameters<typeof buildRecipeIndex>[0]) as unknown as Map<string, PdfRecipe>,
      techniques,
    } as Parameters<typeof printRecipe>[1]).catch(() => notify("Impression indisponible sur cet appareil.", "error"));
  };

  return { saveRecipe, deleteRecipe, addToShopping, exportJSON, importJSON, exportPDF };
}
