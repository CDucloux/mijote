/**
 * Recettes publiques (logique pure : publication, tags, clone en cascade). Aucune
 * dépendance React/Firestore : ces fonctions transforment des objets. Le doc public
 * porte la recette + des champs dénormalisés indexables (auteur, cuisine, Nutri-Score,
 * régimes compatibles, mots-clés). Les composants (bases) sont publiés à part comme
 * docs publics et reliés par `componentRefs`.
 *
 * @module publicRecipes
 */
import { normalizeStr } from "./parseIngredient.js";
import { isComponentLine } from "./nutriscore.js";

/** Ligne d'ingrédient (brute ou composant). */
export interface PubLine {
  name?: string;
  dbId?: string;
  recipeId?: string;
  [k: string]: unknown;
}

/** Recette locale (forme minimale utilisée par la publication / le clone). */
export interface PubRecipe {
  id: string;
  name?: string;
  cuisine?: string;
  nutriLetter?: string | null;
  healthScore?: number;
  isComponent?: boolean;
  tags?: string[];
  ingredients?: PubLine[];
  collections?: string[];
  clonedFrom?: { publicId: string; authorUid?: string; authorName?: string };
  [k: string]: unknown;
}

/** Utilisateur auteur (forme minimale). */
export interface PubUser {
  uid: string;
  displayName?: string;
  photoURL?: string;
}

/** Ingrédient de la base (forme minimale). */
export interface PubDbItem { id: string; category?: string }

/** Document public complet (recette dénormalisée + refs). */
export interface PublicDoc {
  pubId: string;
  originalId: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  recipe: Record<string, unknown>;
  componentRefs: string[];
  name: string;
  cuisine: string;
  nutriLetter: string | null;
  healthScore: number | null;
  isComponent: boolean;
  dietTags: string[];
  keywords: string[];
  createdAt: number;
  updatedAt: number;
}

// Compte officiel sous lequel sont publiées les préparations de base seedées.
// Synthétique (aucune connexion) → seul le script de seed (SDK Admin) l'écrit.
export const OFFICIAL_AUTHOR_UID = "mijote-official";
export const OFFICIAL_AUTHOR_NAME = "Mijoté";
export const isOfficialAuthor = (uid: string): boolean => uid === OFFICIAL_AUTHOR_UID;

/**
 * Identifiant stable d'un doc public : préfixé par l'uid → unicité garantie et
 * vérifiable côté règles Firestore (l'auteur ne peut écrire que sous son uid).
 */
export function publicId(uid: string, recipeId: string): string {
  return `${uid}__${recipeId}`;
}

/**
 * Composants (préparations de base) directement référencés par une recette.
 * Mono-niveau : pas de récursion à faire.
 */
export function collectComponentDeps(recipe: PubRecipe | null | undefined, recipesById: Map<string, PubRecipe>): PubRecipe[] {
  const ids = new Set<string>();
  for (const line of recipe?.ingredients || []) {
    if (isComponentLine(line) && line.recipeId) ids.add(line.recipeId);
  }
  return [...ids].map(id => recipesById.get(id)).filter((r): r is PubRecipe => !!r);
}

/** Catégories d'ingrédients couvertes par la recette ET ses composants (mono-niveau). */
function collectCategories(recipe: PubRecipe | null | undefined, ingredientDB: PubDbItem[], recipesById: Map<string, PubRecipe> | undefined): Set<string> {
  const byId = new Map((ingredientDB || []).map(i => [i.id, i]));
  const cats = new Set<string>();
  const addFrom = (lines: PubLine[] | undefined): void => {
    for (const line of lines || []) {
      if (isComponentLine(line)) continue;
      const db = line.dbId ? byId.get(line.dbId) : undefined;
      if (db?.category) cats.add(db.category);
    }
  };
  addFrom(recipe?.ingredients);
  for (const line of recipe?.ingredients || []) {
    if (isComponentLine(line) && line.recipeId) addFrom(recipesById?.get(line.recipeId)?.ingredients);
  }
  return cats;
}

/**
 * Régimes avec lesquels la recette est COMPATIBLE (heuristique sur les catégories).
 * Toujours omnivore/flexitarien ; pescatarien si pas de viande ; végétarien si ni
 * viande ni poisson ; végan si en plus pas de produit laitier. Approximation
 * volontaire (ignore œufs/miel/gélatine) – sert au filtre « selon mes préférences ».
 */
export function deriveDietTags(recipe: PubRecipe, ingredientDB: PubDbItem[], recipesById?: Map<string, PubRecipe>): string[] {
  const cats = collectCategories(recipe, ingredientDB, recipesById);
  const noMeat = !cats.has("meat");
  const noFish = !cats.has("fish_seafood");
  const noDairy = !cats.has("dairy");
  const tags = ["omnivore", "flexitarien"];
  if (noMeat) tags.push("pescatarien");
  if (noMeat && noFish) tags.push("vegetarien");
  if (noMeat && noFish && noDairy) tags.push("vegan");
  return tags;
}

/** Jetons de recherche (nom, cuisine, auteur, ingrédients), normalisés & dédoublonnés. */
export function buildKeywords(recipe: PubRecipe | null | undefined, authorName: string): string[] {
  const out = new Set<string>();
  const push = (s: string | undefined): void => { const n = normalizeStr(s || ""); if (n) n.split(/\s+/).forEach(w => w.length > 1 && out.add(w)); };
  push(recipe?.name);
  push(recipe?.cuisine);
  push(authorName);
  (recipe?.tags || []).forEach(push);
  (recipe?.ingredients || []).forEach(l => push(l.name));
  return [...out];
}

/**
 * Retire les champs purement locaux avant publication (carnets, journal d'itérations,
 * attribution d'un clone). Le `source` web (URL d'origine) est conservé : info publique.
 */
function stripForPublic(recipe: PubRecipe): Record<string, unknown> {
  const { collections, versions, journal, clonedFrom, visibility, publicId: _p, ...rest } = recipe;
  void collections; void versions; void journal; void clonedFrom; void visibility; void _p;
  return rest;
}

/**
 * Construit le doc public d'une recette (ou d'un composant).
 * `componentRefs` = liste des ids LOCAUX (auteur) des composants référencés ;
 * chaque composant publié porte `originalId` pour relier ces refs au clone.
 */
export function toPublicRecipe(recipe: PubRecipe, user: PubUser, { ingredientDB = [], recipesById = new Map<string, PubRecipe>() }: { ingredientDB?: PubDbItem[]; recipesById?: Map<string, PubRecipe> } = {}): PublicDoc {
  const authorName = user?.displayName || "";
  const pubId = publicId(user.uid, recipe.id);
  return {
    pubId,
    originalId: recipe.id,
    authorUid: user.uid,
    authorName,
    authorPhoto: user?.photoURL || "",
    recipe: stripForPublic(recipe),
    componentRefs: collectComponentDeps(recipe, recipesById).map(c => c.id),
    // Champs dénormalisés pour la découverte :
    name: recipe.name || "",
    cuisine: recipe.cuisine || "",
    nutriLetter: recipe.nutriLetter || null,
    healthScore: typeof recipe.healthScore === "number" ? recipe.healthScore : null,
    isComponent: !!recipe.isComponent,
    dietTags: deriveDietTags(recipe, ingredientDB, recipesById),
    keywords: buildKeywords(recipe, authorName),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Construit le bundle public complet (recette + composants) à publier en une fois. */
export function buildPublishBundle(recipe: PubRecipe, user: PubUser, { ingredientDB = [], recipesById = new Map<string, PubRecipe>() }: { ingredientDB?: PubDbItem[]; recipesById?: Map<string, PubRecipe> } = {}): { docs: PublicDoc[]; components: PubRecipe[] } {
  const components = collectComponentDeps(recipe, recipesById);
  const docs = [
    toPublicRecipe(recipe, user, { ingredientDB, recipesById }),
    ...components.map(c => toPublicRecipe(c, user, { ingredientDB, recipesById })),
  ];
  return { docs, components };
}

/**
 * Clone d'une charge utile publique vers une recette locale neuve (id remappé,
 * carnets vidés, attribution `source`).
 */
function cloneOne(pub: PublicDoc, newId: string, now: number): PubRecipe {
  return {
    ...(pub.recipe as PubRecipe),
    id: newId,
    collections: [],
    createdAt: new Date(now).toISOString().slice(0, 10),
    clonedFrom: { publicId: pub.pubId, authorUid: pub.authorUid, authorName: pub.authorName },
  };
}

/**
 * Clone hybride : recette publique + ses composants publics → recettes locales.
 * - remappe les ids des composants et réécrit les lignes `recipeId` ;
 * - dédoublonne contre ce que l'utilisateur possède déjà (par `source.publicId`) ;
 * - composant manquant (dé-publié) → la ligne orpheline est retirée proprement.
 * → `{ added: Recipe[], mainId, alreadyOwned }`.
 */
export function clonePublicBundle(
  pub: PublicDoc,
  publicComponents: PublicDoc[] = [],
  { existingRecipes = [], now = Date.now() }: { existingRecipes?: PubRecipe[]; now?: number } = {},
): { added: PubRecipe[]; mainId: string; alreadyOwned: boolean } {
  const compByOrig = new Map(publicComponents.map(c => [c.originalId, c]));
  const ownedBySource = new Map(
    (existingRecipes || []).filter(r => r.clonedFrom?.publicId).map(r => [r.clonedFrom!.publicId, r])
  );

  // Déjà clonée → on ne refait rien, on pointe vers la copie existante.
  const ownedMain = ownedBySource.get(pub.pubId);
  if (ownedMain) return { added: [], mainId: ownedMain.id, alreadyOwned: true };

  const added: PubRecipe[] = [];
  const idMap = new Map<string, string>(); // id local auteur du composant → id local du cloneur
  let seq = 0;

  for (const origId of pub.componentRefs || []) {
    const comp = compByOrig.get(origId);
    if (!comp) continue; // composant indisponible → ligne retirée plus bas
    const owned = ownedBySource.get(comp.pubId);
    if (owned) { idMap.set(origId, owned.id); continue; }
    const newId = "c" + now + "_" + (seq++);
    idMap.set(origId, newId);
    added.push(cloneOne(comp, newId, now));
  }

  const mainId = "r" + now + "_" + seq;
  const main = cloneOne(pub, mainId, now);
  main.ingredients = (main.ingredients || [])
    .map(line => {
      if (!line.recipeId) return line;
      const local = idMap.get(line.recipeId);
      return local ? { ...line, recipeId: local } : null; // composant manquant → drop
    })
    .filter((l): l is PubLine => l !== null);
  added.push(main);
  return { added, mainId, alreadyOwned: false };
}

// ─── FILTRAGE CÔTÉ DÉCOUVERTE (pur) ───────────────────────────────────────────
/** Filtres de découverte. */
export interface DiscoverFilters {
  text?: string;
  cuisine?: string;
  nutriMax?: string;
  diet?: string;
  authorUid?: string;
  seasonOnly?: boolean;
}

// `isInSeason(pubRecipePayload)` injecté par l'appelant (dépend de la base d'ingrédients).
const LETTER_RANK: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
export function filterPublicRecipes(
  list: PublicDoc[],
  filters: DiscoverFilters = {},
  { isInSeason }: { isInSeason?: (recipe: Record<string, unknown>) => boolean } = {},
): PublicDoc[] {
  const q = normalizeStr(filters.text || "");
  return (list || []).filter(p => {
    if (p.isComponent) return false; // les bases ne s'affichent pas seules
    if (q) {
      const hay = (p.keywords || []).join(" ");
      if (!normalizeStr(hay).includes(q) && !normalizeStr(p.name).includes(q)) return false;
    }
    if (filters.cuisine && p.cuisine !== filters.cuisine) return false;
    if (filters.authorUid && p.authorUid !== filters.authorUid) return false;
    if (filters.diet && filters.diet !== "omnivore" && !(p.dietTags || []).includes(filters.diet)) return false;
    if (filters.nutriMax && p.nutriLetter && LETTER_RANK[p.nutriLetter] > LETTER_RANK[filters.nutriMax]) return false;
    if (filters.seasonOnly && isInSeason && !isInSeason(p.recipe)) return false;
    return true;
  });
}
