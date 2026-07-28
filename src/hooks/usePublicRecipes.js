import { publishPublicBundle, unpublishPublicDocs, fetchPublicDocsByIds } from "../lib/firestore.js";
import { publicId, buildPublishBundle, collectComponentDeps, clonePublicBundle } from "../lib/publicRecipes.js";
import { recomputeCollectionCounts } from "../lib/recipeActions.js";
import { buildRecipeIndex } from "../lib/nutriscore.js";

// ─── RECETTES PUBLIQUES (communauté) ──────────────────────────────────────────
// Publier / dépublier ses recettes (avec leurs préparations de base) et cloner une
// recette publique (+ bases) dans sa bibliothèque. Extrait d'App.jsx. Les
// dépendances (état + notify + navigate) sont injectées.
export function usePublicRecipes({ user, recipes, setRecipes, setCollections, ingredientDB, notify, navigate }) {
  const publishRecipe = async (recipe) => {
    if (!user) return;
    try {
      const recipesById = buildRecipeIndex(recipes);
      const { docs } = buildPublishBundle(recipe, user, { ingredientDB, recipesById });
      await publishPublicBundle(docs);
      setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, visibility: "public", publicId: publicId(user.uid, recipe.id) } : r));
      const bases = docs.length - 1;
      notify(bases > 0 ? `Recette publiée (+ ${bases} base${bases > 1 ? "s" : ""})` : "Recette publiée");
    } catch { notify("Publication refusée – règles Firestore déployées ?", "error"); }
  };

  const unpublishRecipe = async (recipe) => {
    if (!user) return;
    try {
      const recipesById = buildRecipeIndex(recipes);
      const myPub = publicId(user.uid, recipe.id);
      const myComps = collectComponentDeps(recipe, recipesById).map(c => publicId(user.uid, c.id));
      // On ne retire une base que si plus AUCUNE de mes autres recettes publiques ne l'utilise.
      const stillUsed = new Set();
      for (const r of recipes) {
        if (r.id === recipe.id || r.visibility !== "public") continue;
        for (const c of collectComponentDeps(r, recipesById)) stillUsed.add(publicId(user.uid, c.id));
      }
      await unpublishPublicDocs([myPub, ...myComps.filter(id => !stillUsed.has(id))]);
      setRecipes(prev => prev.map(r => {
        if (r.id !== recipe.id) return r;
        const { visibility, publicId: _p, ...rest } = r; void visibility; void _p; return rest;
      }));
      notify("Recette dépubliée");
    } catch { notify("Échec de la dépublication", "error"); }
  };

  // Clone hybride : récupère la recette publique + ses bases publiques et les
  // installe comme recettes locales (ids remappés, attribution, anti-doublon).
  const cloneFromPublic = async (pub) => {
    if (!pub) return;
    try {
      const compPubIds = (pub.componentRefs || []).map(origId => publicId(pub.authorUid, origId));
      const comps = compPubIds.length ? await fetchPublicDocsByIds(compPubIds) : [];
      const { added, mainId, alreadyOwned } = clonePublicBundle(pub, comps, { existingRecipes: recipes });
      if (alreadyOwned) { notify("Déjà dans tes recettes"); navigate(`/recipes/${mainId}`); return; }
      const updated = [...added, ...recipes];
      setRecipes(updated);
      setCollections(prev => recomputeCollectionCounts(prev, updated));
      const bases = added.length - 1;
      notify(bases > 0 ? `Ajoutée à tes recettes (+ ${bases} base${bases > 1 ? "s" : ""})` : "Ajoutée à tes recettes");
      navigate(`/recipes/${mainId}`);
    } catch { notify("Échec du clonage", "error"); }
  };

  const quickCloneFromPublic = async (pub) => {
    if (!pub) return;
    try {
      const compPubIds = (pub.componentRefs || []).map(origId => publicId(pub.authorUid, origId));
      const comps = compPubIds.length ? await fetchPublicDocsByIds(compPubIds) : [];
      const { added, alreadyOwned } = clonePublicBundle(pub, comps, { existingRecipes: recipes });
      if (alreadyOwned) { notify("Déjà dans tes recettes"); return; }
      const updated = [...added, ...recipes];
      setRecipes(updated);
      setCollections(prev => recomputeCollectionCounts(prev, updated));
      const bases = added.length - 1;
      notify(bases > 0 ? `Ajoutée à tes recettes (+ ${bases} base${bases > 1 ? "s" : ""})` : "Ajoutée à tes recettes");
    } catch { notify("Échec de l'ajout", "error"); }
  };

  return { publishRecipe, unpublishRecipe, cloneFromPublic, quickCloneFromPublic };
}
