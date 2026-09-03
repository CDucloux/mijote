import { prepareRecipeImport, type ImportDbItem } from "@/lib/recipes/recipeImport.js";
import { importRecipeFromUrl, importRecipeFromImages, importRecipeFromText, type ImagePart } from "@/lib/recipes/recipeUrlImport.js";
import { uploadImage } from "@/lib/firebase/storage.js";
import { applianceImportInfos, sanitizeStepUtensilParams } from "@/lib/utensils/appliances.js";
import type { Recipe } from "@/lib/types.js";

/** base64 (sans préfixe) → Blob, pour ré-uploader une photo importée vers Storage. */
function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Dépendances : bases de rapprochement + ouverture de l'éditeur sur un brouillon. */
export interface RecipeImportDeps {
  ingredientDB: ImportDbItem[];
  utensilDB: ImportDbItem[];
  openEditor: (draft: Record<string, unknown>) => void;
}

/**
 * Import de recette (IA) depuis une URL ou 1-2 photos : appelle la Cloud Function,
 * complète les dbId + Nutri-Score, purge les ustensiles hors base master, puis OUVRE
 * le brouillon dans l'éditeur (jamais d'enregistrement direct, le créateur relit).
 *
 * @param deps - Bases d'ingrédients/ustensiles et `openEditor`.
 * @returns `{ importFromUrl, importFromImages, importFromText }`.
 */
export function useRecipeImport({ ingredientDB, utensilDB, openEditor }: RecipeImportDeps) {
  // Ids stables sur les items + valeurs par défaut du schéma éditeur.
  const withItemIds = (recipe: Recipe): Record<string, unknown> => ({
    description: "", collections: [], image: "", cuisine: "", category: "", source: "",
    prepTime: 0, cookTime: 0, servings: 2, ...recipe,
    ingredients: (recipe.ingredients || []).map((i, k) => ({ id: `i${Date.now()}_${k}`, dbId: "", name: "", amount: "", unit: "", ...i })),
    utensils: (recipe.utensils || []).map((u, k) => ({ id: `u${Date.now()}_${k}`, dbId: "", name: "", ...u })),
    steps: (recipe.steps || []).map((s, k) => ({ id: `s${Date.now()}_${k}`, title: "", text: "", ingredients: [], utensils: [], ...s })),
  });

  // Recette brute extraite (URL ou image) → brouillon prêt pour l'éditeur.
  // `coverUrl` (optionnel) : image de couverture déjà uploadée (import photo).
  const openImportedDraft = (recipe: Recipe, coverUrl = ""): void => {
    // Complète dbId + Nutri-Score via le pipeline d'import existant (schéma toléré).
    const res = prepareRecipeImport(JSON.stringify(recipe), { ingredientDB, utensilDB });
    let draft: Recipe = ("prepared" in res ? res.prepared[0] : undefined) || recipe;
    // Ustensiles : ne garder QUE ceux réellement en base master (dbId résolu), et
    // purger les liens d'étapes qui pointaient vers un ustensile écarté.
    const keptUt = (draft.utensils || []).filter(u => u.dbId);
    const keptIds = new Set(keptUt.map(u => u.id));
    // Appareil de chaque ustensile conservé (résolu via la base master par dbId) :
    // sert à valider les réglages déduits à l'import contre le bon schéma.
    const applianceByUtId = new Map<string, unknown>();
    for (const u of keptUt) {
      const row = utensilDB.find(d => d.id === u.dbId);
      if (row?.appliance) applianceByUtId.set(u.id ?? "", row.appliance);
    }
    draft = {
      ...draft,
      utensils: keptUt,
      steps: (draft.steps || []).map(s => {
        const params = sanitizeStepUtensilParams(s.utensilParams, id => applianceByUtId.get(id));
        const step = { ...s, utensils: (s.utensils || []).filter(id => keptIds.has(id)) };
        if (Object.keys(params).length) step.utensilParams = params;
        else delete step.utensilParams;
        return step;
      }),
    };
    if (coverUrl) draft.image = coverUrl;
    openEditor(withItemIds(draft));
  };

  // Descripteurs d'appareils (nom + réglages) transmis au serveur pour que le LLM
  // déduise les réglages d'étape ; recalculés à chaque appel (base à jour).
  const appliancesOf = (): ReturnType<typeof applianceImportInfos> => applianceImportInfos(utensilDB);

  const importFromUrl = async (url: string): Promise<{ method: string }> => {
    const { recipe, method } = await importRecipeFromUrl(url, utensilDB.map(u => u.name), appliancesOf()) as { recipe: Recipe; method: string };
    openImportedDraft(recipe);
    return { method };
  };
  const importFromText = async (text: string): Promise<{ method: string }> => {
    const { recipe, method } = await importRecipeFromText(text, utensilDB.map(u => u.name), appliancesOf()) as { recipe: Recipe; method: string };
    openImportedDraft(recipe);
    return { method };
  };
  const importFromImages = async (images: ImagePart[]): Promise<{ method: string }> => {
    const { recipe, method, coverIndex } = await importRecipeFromImages(images, utensilDB.map(u => u.name), appliancesOf()) as { recipe: Recipe; method: string; coverIndex: number };
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

  return { importFromUrl, importFromImages, importFromText };
}
