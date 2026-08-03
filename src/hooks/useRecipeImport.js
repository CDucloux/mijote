import { prepareRecipeImport } from "../lib/recipeImport.js";
import { importRecipeFromUrl, importRecipeFromImages } from "../lib/recipeUrlImport.js";
import { uploadImage } from "../lib/storage.js";

// base64 (sans préfixe) → Blob, pour ré-uploader une photo importée vers Storage.
function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

// ─── IMPORT DE RECETTE (IA) ───────────────────────────────────────────────────
// Import admin depuis une URL ou 1-2 photos : appelle la Cloud Function, complète
// les dbId + Nutri-Score, purge les ustensiles hors base master, puis OUVRE le
// brouillon dans l'éditeur (jamais d'enregistrement direct — le créateur relit).
// Extrait d'App.jsx. `openEditor` = ouvre l'éditeur sur un brouillon (setEditingRecipe).
export function useRecipeImport({ ingredientDB, utensilDB, openEditor }) {
  // Ids stables sur les items + valeurs par défaut du schéma éditeur.
  const withItemIds = (recipe) => ({
    description: "", collections: [], image: "", cuisine: "", category: "", source: "",
    prepTime: 0, cookTime: 0, servings: 2, ...recipe,
    ingredients: (recipe.ingredients || []).map((i, k) => ({ id: `i${Date.now()}_${k}`, dbId: "", name: "", amount: "", unit: "", ...i })),
    utensils: (recipe.utensils || []).map((u, k) => ({ id: `u${Date.now()}_${k}`, dbId: "", name: "", ...u })),
    steps: (recipe.steps || []).map((s, k) => ({ id: `s${Date.now()}_${k}`, title: "", text: "", ingredients: [], utensils: [], ...s })),
  });

  // Recette brute extraite (URL ou image) → brouillon prêt pour l'éditeur.
  // `coverUrl` (optionnel) : image de couverture déjà uploadée (import photo).
  const openImportedDraft = (recipe, coverUrl = "") => {
    // Complète dbId + Nutri-Score via le pipeline d'import existant (schéma toléré).
    const res = prepareRecipeImport(JSON.stringify(recipe), { ingredientDB, utensilDB });
    let draft = res.prepared?.[0] || recipe;
    // Ustensiles : ne garder QUE ceux réellement en base master (dbId résolu), et
    // purger les liens d'étapes qui pointaient vers un ustensile écarté.
    const keptUt = (draft.utensils || []).filter(u => u.dbId);
    const keptIds = new Set(keptUt.map(u => u.id));
    draft = {
      ...draft,
      utensils: keptUt,
      steps: (draft.steps || []).map(s => ({ ...s, utensils: (s.utensils || []).filter(id => keptIds.has(id)) })),
    };
    if (coverUrl) draft.image = coverUrl;
    openEditor(withItemIds(draft));
  };

  const importFromUrl = async (url) => {
    const { recipe, method } = await importRecipeFromUrl(url, utensilDB.map(u => u.name));
    openImportedDraft(recipe);
    return { method };
  };
  const importFromImages = async (images) => {
    const { recipe, method, coverIndex } = await importRecipeFromImages(images, utensilDB.map(u => u.name));
    // La page identifiée comme photo du plat devient l'image de couverture : on la
    // ré-upload vers Storage (comme n'importe quelle image de recette). Best-effort :
    // un échec d'upload n'empêche pas l'ouverture du brouillon (couverture vide).
    let coverUrl = "";
    const cover = coverIndex >= 0 ? images[coverIndex] : null;
    if (cover?.data) {
      try { coverUrl = await uploadImage(base64ToBlob(cover.data, cover.mediaType), "recipes"); }
      catch { coverUrl = ""; }
    }
    openImportedDraft(recipe, coverUrl);
    return { method };
  };

  return { importFromUrl, importFromImages };
}
