import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import { isRecipeDraft } from "@/lib/recipes/savedRecipes.js";
import type { Recipe } from "@/lib/types.js";

const DRAFT_KEY = "mijote_draft";

const readCachedDraft = (): Recipe | null => {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    return isRecipeDraft(raw) ? raw : null;
  } catch { return null; }
};

/** Brouillon en cours d'édition et ses commandes. */
export interface DraftEditor {
  /** Nouvelle recette ou brouillon d'import IA en cours d'édition, sinon null. */
  editingRecipe: Recipe | null;
  setEditingRecipe: Dispatch<SetStateAction<Recipe | null>>;
  /** Ouvre l'éditeur sur un brouillon et pose l'URL `/recipes/new`. */
  openDraftEditor: (draft: Recipe) => void;
  /** Ferme l'éditeur, purge le cache et, si fourni, rejoint `to`. */
  closeDraftEditor: (to?: string) => void;
}

/**
 * Éditeur de brouillon (nouvelle recette, import IA) porté par la route
 * `/recipes/new` : le brouillon est mis en cache de session, donc il survit à un
 * rafraîchissement ou un retour arrière ; sans brouillon à restaurer, la route n'a
 * plus d'objet et l'on revient à la bibliothèque.
 *
 * @param newRoute - L'URL courante est `/recipes/new`.
 * @param navigate - Navigation du routeur.
 */
export function useDraftEditor(newRoute: boolean, navigate: NavigateFunction): DraftEditor {
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const openDraftEditor = useCallback((draft: Recipe) => {
    setEditingRecipe(draft);
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* quota / privé */ }
    navigate("/recipes/new");
  }, [navigate]);
  const closeDraftEditor = useCallback((to?: string) => {
    setEditingRecipe(null);
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    if (to) navigate(to, { replace: true });
  }, [navigate]);

  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !newRoute || editingRecipe) return;
    restored.current = true;
    const cached = readCachedDraft();
    if (cached) setEditingRecipe(cached);
    else navigate("/recipes", { replace: true });
  }, [newRoute, editingRecipe, navigate]);

  return { editingRecipe, setEditingRecipe, openDraftEditor, closeDraftEditor };
}
