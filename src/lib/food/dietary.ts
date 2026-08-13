/**
 * Régime alimentaire (pur). Détection « vegan » d'une recette à partir des
 * catégories de ses ingrédients : viande, poisson/fruits de mer et produits
 * laitiers l'excluent. Les préparations de base (sous-recettes) sont inspectées
 * récursivement, une béchamel rend non-vegan.
 *
 * Limite assumée (comme la saisonnalité) : un ingrédient introuvable n'apporte
 * pas de signal. On exige au moins un ingrédient identifié pour affirmer
 * « vegan », plutôt que d'afficher le badge à tort.
 *
 * @module dietary
 */

interface VeganItem { id: string; category?: string }
interface VeganRecipe { id?: string; ingredients?: { name?: string; recipeId?: string }[] }
type VeganResolver = ((name: string | undefined) => VeganItem | null) | null | undefined;

const ANIMAL_CATEGORIES = new Set(["meat", "fish_seafood", "dairy"]);

interface ScanAcc { resolved: number; animal: boolean }

function scan(recipe: VeganRecipe | null | undefined, resolver: VeganResolver, byId: Map<string, VeganRecipe>, seen: Set<string>, acc: ScanAcc): void {
  for (const ing of recipe?.ingredients || []) {
    if (ing.recipeId) {
      const base = byId.get(ing.recipeId);
      if (base?.id && !seen.has(base.id)) { seen.add(base.id); scan(base, resolver, byId, seen, acc); }
      continue;
    }
    const item = resolver ? resolver(ing.name) : null;
    if (!item) continue;
    acc.resolved++;
    if (item.category && ANIMAL_CATEGORIES.has(item.category)) acc.animal = true;
  }
}

/**
 * La recette est-elle vegan ? (au moins un ingrédient identifié et aucun d'origine
 * animale, préparations de base comprises).
 *
 * @param resolver - Résolveur `(name) => item` (avec `category`).
 * @param opts.recipes - Liste pour résoudre les bases référencées par `recipeId`.
 */
export function isRecipeVegan(recipe: VeganRecipe | null | undefined, resolver: VeganResolver, opts: { recipes?: VeganRecipe[] } = {}): boolean {
  const byId = new Map((opts.recipes || []).filter((r): r is VeganRecipe & { id: string } => !!r.id).map(r => [r.id, r]));
  const acc: ScanAcc = { resolved: 0, animal: false };
  scan(recipe, resolver, byId, new Set(), acc);
  return acc.resolved > 0 && !acc.animal;
}
