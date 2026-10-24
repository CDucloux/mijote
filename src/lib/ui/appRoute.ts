/**
 * Lecture de l'URL de l'app authentifiée. Une seule instance d'`App` est montée sur
 * toutes les routes (pas de remontage entre onglets) : l'écran affiché se déduit du
 * pathname, jamais de `useParams`.
 *
 * @module ui/appRoute
 */

/** Mode d'import IA porté par la route `/recipes/import-from-*`. */
export type ImportRoute = "url" | "picture" | "text" | "pdf";

/** Écran visé par une URL de l'app. */
export interface AppRoute {
  /** Page d'import IA, ou null. */
  importRoute: ImportRoute | null;
  /** Éditeur d'une nouvelle recette (`/recipes/new`). */
  newRoute: boolean;
  /** Page d'offre Cardamome+ (`/plan`). */
  planRoute: boolean;
  /** Pas à pas porté par l'URL (`/recipes/:id/cookmode`). */
  cookModeRoute: boolean;
  /** Édition d'une recette existante (`/recipes/:id/edit`). */
  editRoute: boolean;
  /** Recette ouverte, ou null. */
  recipeId: string | null;
  /** Fiche ingrédient publique (`/admin/ingredients/:id`), ou null. */
  ingredientId: string | null;
}

const IMPORT_ROUTES: Record<string, ImportRoute> = {
  "import-from-url": "url",
  "import-from-picture": "picture",
  "import-from-text": "text",
  "import-from-pdf": "pdf",
};

const safeDecode = (segment: string): string => {
  try { return decodeURIComponent(segment); } catch { return segment; }
};

/**
 * Déduit l'écran visé d'un pathname.
 *
 * @param pathname - Chemin courant, sans le préfixe de base du routeur.
 */
export function parseAppRoute(pathname: string): AppRoute {
  const recipeSeg = pathname.startsWith("/recipes/") ? pathname.slice("/recipes/".length) : "";
  const importRoute = IMPORT_ROUTES[recipeSeg] ?? null;
  const newRoute = recipeSeg === "new";
  const cookModeRoute = recipeSeg.endsWith("/cookmode");
  const editRoute = recipeSeg.endsWith("/edit");
  const suffix = cookModeRoute ? "/cookmode" : editRoute ? "/edit" : "";
  const idSeg = suffix ? recipeSeg.slice(0, -suffix.length) : recipeSeg;
  const ingredientMatch = /^\/admin\/ingredients\/(.+)$/.exec(pathname);
  return {
    importRoute,
    newRoute,
    planRoute: pathname === "/plan",
    cookModeRoute,
    editRoute,
    recipeId: importRoute || newRoute || !idSeg ? null : safeDecode(idSeg) || null,
    ingredientId: ingredientMatch ? safeDecode(ingredientMatch[1]) : null,
  };
}

/**
 * Page d'origine mémorisée dans l'état de navigation à l'ouverture d'une fiche
 * (donnée du routeur, non typée).
 *
 * @param state - `location.state`.
 * @returns Le chemin d'origine, ou null.
 */
export function originPathOf(state: unknown): string | null {
  return state && typeof state === "object" && "originPath" in state && typeof state.originPath === "string" ? state.originPath : null;
}

/**
 * Recette à garder affichée SOUS une fiche ingrédient ouverte depuis sa fiche
 * recette : à la sortie (geste ou bouton retour), la fiche glisse et laisse voir la
 * recette, comme une fiche recette laisse voir sa liste.
 *
 * @param originPath - Page d'origine de la fiche ingrédient (cf. {@link originPathOf}).
 * @returns L'id de la recette, ou null si l'origine n'est pas une fiche recette simple
 *   (liste, éditeur, pas à pas, import…).
 */
export function recipeUnderIngredient(originPath: string | null): string | null {
  if (!originPath) return null;
  const route = parseAppRoute(originPath);
  if (route.editRoute || route.cookModeRoute || route.ingredientId) return null;
  return route.recipeId;
}
