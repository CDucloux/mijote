/**
 * Carnets de la bibliothèque : manuels (appartenance explicite, `recipe.collections`)
 * ou intelligents (une vue de filtres et de recherche enregistrée, qui se remplit
 * seule). Logique pure : appartenance, comptage, réordonnancement et création.
 *
 * @module recipes/notebooks
 */
import { DEFAULT_FILTERS, filtersEqual, matchesFilters, matchesRecipeSearch, type FilterContext, type RecipeFilters } from "@/lib/recipes/recipeFilters.js";
import type { Notebook, Recipe } from "@/lib/types.js";

/** Brouillon de la feuille de création / modification d'un carnet. */
export interface NotebookDraft {
  name: string;
  color: string;
  icon: string;
  /** Création d'un carnet intelligent depuis la vue courante. */
  smart?: boolean;
  /** Modification d'un carnet existant (`id` renseigné). */
  editing?: boolean;
  id?: string;
  kind?: string;
  filters?: Partial<RecipeFilters>;
  search?: string;
}

export const DEFAULT_NOTEBOOK_COLOR = "#6e9a3f";
export const DEFAULT_NOTEBOOK_ICON = "📓";
/** Teintes proposées pour un carnet. */
export const NOTEBOOK_COLORS = ["#6e9a3f", "#f0c060", "#e05252", "#46ab5f", "#5b9cf6", "#c080e0", "#e0a23e", "#9a9490"] as const;
/** Pictos proposés pour un carnet (contenu choisi par l'utilisateur). */
export const NOTEBOOK_ICONS = ["🍽️", "🥗", "🍝", "🍰", "🥩", "🥦", "🥐", "🍜", "🍛", "🫕", "🥘", "🧁", "🍣", "🫙", "🥚", "🧀", "🫒", "🌮", "🍲"] as const;

/**
 * Brouillon vierge d'un carnet.
 *
 * @param over - Champs à poser d'emblée (vue de filtres d'un carnet intelligent…).
 */
export function blankNotebookDraft(over: Partial<NotebookDraft> = {}): NotebookDraft {
  return { name: "", color: DEFAULT_NOTEBOOK_COLOR, icon: DEFAULT_NOTEBOOK_ICON, ...over };
}

/**
 * Le carnet est-il intelligent (vue de filtres) plutôt que manuel ?
 *
 * @param notebook - Carnet (ou brouillon) à tester.
 */
export function isSmartNotebook(notebook: Pick<Notebook, "kind"> | null | undefined): boolean {
  return notebook?.kind === "smart";
}

/**
 * La recette appartient-elle au carnet ? Appartenance explicite pour un carnet
 * manuel, prédicat de filtres et de recherche pour un carnet intelligent.
 *
 * @param notebook - Carnet.
 * @param recipe - Recette candidate.
 * @param ctx - Dépendances du prédicat de filtres (résolveur, techniques…).
 */
export function notebookMatches(notebook: Notebook, recipe: Recipe, ctx: FilterContext): boolean {
  if (isSmartNotebook(notebook)) {
    return matchesFilters(recipe, { ...DEFAULT_FILTERS, ...notebook.filters }, ctx) && matchesRecipeSearch(recipe, notebook.search);
  }
  return (recipe.collections || []).includes(notebook.id);
}

/**
 * Nombre de recettes d'un carnet.
 *
 * @param notebook - Carnet.
 * @param recipes - Bibliothèque.
 * @param ctx - Dépendances du prédicat de filtres.
 */
export function countNotebook(notebook: Notebook, recipes: readonly Recipe[], ctx: FilterContext): number {
  return recipes.reduce((n, recipe) => n + (notebookMatches(notebook, recipe, ctx) ? 1 : 0), 0);
}

/**
 * Un carnet intelligent est « ouvert » quand la vue courante (sans carnet manuel
 * sélectionné) est exactement la sienne.
 *
 * @param notebook - Carnet intelligent.
 * @param view - Vue courante : filtres, recherche et carnet manuel sélectionné.
 */
export function isSmartViewActive(
  notebook: Notebook, view: { filters: RecipeFilters; search: string; selectedId: string | null },
): boolean {
  return !view.selectedId && filtersEqual(view.filters, notebook.filters) && view.search.trim() === (notebook.search || "").trim();
}

/**
 * Déplace un carnet à la place d'un autre (glisser-déposer).
 *
 * @param notebooks - Carnets dans l'ordre affiché.
 * @param fromId - Carnet déplacé.
 * @param toId - Carnet dont il prend la place.
 * @returns La liste réordonnée, ou la même référence si rien ne bouge.
 */
export function reorderNotebooks<T extends { id: string }>(notebooks: T[], fromId: string, toId: string): T[] {
  const from = notebooks.findIndex(n => n.id === fromId), to = notebooks.findIndex(n => n.id === toId);
  if (from < 0 || to < 0 || from === to) return notebooks;
  const next = [...notebooks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Décale un carnet d'un cran (flèches du menu, mobile).
 *
 * @param notebooks - Carnets dans l'ordre affiché.
 * @param id - Carnet à décaler.
 * @param dir - `-1` vers la gauche, `1` vers la droite.
 * @returns La liste réordonnée, ou la même référence en bout de liste.
 */
export function shiftNotebook<T extends { id: string }>(notebooks: T[], id: string, dir: -1 | 1): T[] {
  const i = notebooks.findIndex(n => n.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= notebooks.length) return notebooks;
  const next = [...notebooks];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * Carnet neuf à partir d'un brouillon : intelligent (vue de filtres complétée par
 * les défauts) ou manuel.
 *
 * @param draft - Brouillon validé (nom non vide).
 * @param id - Identifiant à attribuer.
 */
export function createNotebook(draft: NotebookDraft, id: string): Notebook {
  const base = { id, name: draft.name.trim(), color: draft.color, icon: draft.icon };
  return draft.smart
    ? { ...base, kind: "smart", filters: { ...DEFAULT_FILTERS, ...draft.filters }, search: (draft.search || "").trim() }
    : { ...base, kind: "manual", count: 0 };
}

/**
 * Applique la modification d'un carnet : seuls le nom, la couleur et le picto
 * changent ; la nature et la vue de filtres sont préservées.
 *
 * @param notebooks - Carnets.
 * @param draft - Brouillon de modification (`id` du carnet visé).
 */
export function applyNotebookEdit<T extends Notebook>(notebooks: T[], draft: NotebookDraft): T[] {
  return notebooks.map(n => n.id === draft.id ? { ...n, name: draft.name.trim(), color: draft.color, icon: draft.icon } : n);
}
