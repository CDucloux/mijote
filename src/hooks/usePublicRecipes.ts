import type { Dispatch, SetStateAction } from "react";
import { publishPublicBundle, unpublishPublicDocs, fetchPublicDocsByIds } from "@/lib/firebase/firestore.js";
import { publicId, buildPublishBundle, collectComponentDeps, clonePublicBundle, type PubUser, type PubRecipe, type PubDbItem, type PublicDoc } from "@/lib/household/publicRecipes.js";
import { recomputeCollectionCounts } from "@/lib/recipes/recipeActions.js";
import { buildRecipeIndex } from "@/lib/recipes/nutriscore.js";
import { canAddRecipes, FREE_RECIPE_LIMIT } from "@/lib/recipes/plan.js";
import type { Collection } from "@/lib/types.js";

/** Index de recettes tel qu'attendu par les fonctions de `publicRecipes`. */
const indexOf = (recipes: PubRecipe[]): Map<string, PubRecipe> =>
  buildRecipeIndex(recipes as Parameters<typeof buildRecipeIndex>[0]) as unknown as Map<string, PubRecipe>;

/** Dépendances injectées (état + notify + navigate). */
export interface PublicRecipesDeps {
  user: PubUser | null | undefined;
  /** Nom d'affichage de l'app (préférences), prioritaire sur le nom Google au moment
   *  de publier : c'est celui que l'utilisateur a choisi dans Cardamome. */
  displayName?: string;
  recipes: PubRecipe[];
  setRecipes: Dispatch<SetStateAction<PubRecipe[]>>;
  setCollections: Dispatch<SetStateAction<Collection[]>>;
  ingredientDB: PubDbItem[];
  isPlus: boolean;
  notify: (msg: string, type?: string) => void;
  navigate: (path: string, opts?: { state?: unknown }) => void;
}

/**
 * Recettes publiques (communauté) : publier / dépublier ses recettes (avec leurs
 * préparations de base) et cloner une recette publique (+ bases) dans sa bibliothèque.
 *
 * @param deps - État de l'app, `notify` et `navigate`.
 * @returns `{ publishRecipe, unpublishRecipe, cloneFromPublic, quickCloneFromPublic }`.
 */
export function usePublicRecipes({ user, displayName, recipes, setRecipes, setCollections, ingredientDB, isPlus, notify, navigate }: PublicRecipesDeps) {
  // Quota du plan gratuit : cloner une recette publique compte pour 1 (les bases
  // sont des composants, hors quota). Bloque + renvoie vers l'offre si dépassé.
  const guardQuota = (): boolean => {
    if (canAddRecipes(recipes, isPlus, 1)) return true;
    notify(`Plan gratuit limité à ${FREE_RECIPE_LIMIT} recettes. Passe à Cardamome+ pour en créer plus.`, "warning");
    navigate("/plus");
    return false;
  };
  const publishRecipe = async (recipe: PubRecipe): Promise<void> => {
    if (!user) return;
    try {
      const recipesById = indexOf(recipes);
      // Nom d'auteur = celui choisi dans l'app (préférences), pas le nom Google brut.
      const pubUser = { uid: user.uid, displayName: (displayName || "").trim() || user.displayName || "", photoURL: user.photoURL };
      const { docs } = buildPublishBundle(recipe, pubUser, { ingredientDB, recipesById });
      await publishPublicBundle(docs);
      setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, visibility: "public", publicId: publicId(user.uid, recipe.id) } : r));
      const bases = docs.length - 1;
      notify(bases > 0 ? `Recette publiée (+ ${bases} base${bases > 1 ? "s" : ""})` : "Recette publiée");
    } catch { notify("Publication refusée – règles Firestore déployées ?", "error"); }
  };

  const unpublishRecipe = async (recipe: PubRecipe): Promise<void> => {
    if (!user) return;
    try {
      const recipesById = indexOf(recipes);
      const myPub = publicId(user.uid, recipe.id);
      const myComps = collectComponentDeps(recipe, recipesById).map(c => publicId(user.uid, c.id));
      // On ne retire une base que si plus AUCUNE de mes autres recettes publiques ne l'utilise.
      const stillUsed = new Set<string>();
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
  const cloneFromPublic = async (pub: PublicDoc): Promise<void> => {
    if (!pub) return;
    try {
      const compPubIds = (pub.componentRefs || []).map(origId => publicId(pub.authorUid, origId));
      const comps = (compPubIds.length ? await fetchPublicDocsByIds(compPubIds) : []) as PublicDoc[];
      const { added, mainId, alreadyOwned } = clonePublicBundle(pub, comps, { existingRecipes: recipes });
      if (alreadyOwned) { notify("Déjà dans tes recettes"); navigate(`/recipes/${mainId}`); return; }
      if (!guardQuota()) return;
      const updated = [...added, ...recipes];
      setRecipes(updated);
      setCollections(prev => recomputeCollectionCounts(prev, updated));
      const bases = added.length - 1;
      notify(bases > 0 ? `Ajoutée à tes recettes (+ ${bases} base${bases > 1 ? "s" : ""})` : "Ajoutée à tes recettes");
      navigate(`/recipes/${mainId}`);
    } catch { notify("Échec du clonage", "error"); }
  };

  const quickCloneFromPublic = async (pub: PublicDoc): Promise<void> => {
    if (!pub) return;
    try {
      const compPubIds = (pub.componentRefs || []).map(origId => publicId(pub.authorUid, origId));
      const comps = (compPubIds.length ? await fetchPublicDocsByIds(compPubIds) : []) as PublicDoc[];
      const { added, alreadyOwned } = clonePublicBundle(pub, comps, { existingRecipes: recipes });
      if (alreadyOwned) { notify("Déjà dans tes recettes"); return; }
      if (!guardQuota()) return;
      const updated = [...added, ...recipes];
      setRecipes(updated);
      setCollections(prev => recomputeCollectionCounts(prev, updated));
      const bases = added.length - 1;
      notify(bases > 0 ? `Ajoutée à tes recettes (+ ${bases} base${bases > 1 ? "s" : ""})` : "Ajoutée à tes recettes");
    } catch { notify("Échec de l'ajout", "error"); }
  };

  return { publishRecipe, unpublishRecipe, cloneFromPublic, quickCloneFromPublic };
}
