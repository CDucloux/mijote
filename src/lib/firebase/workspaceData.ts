/**
 * Chargement et écriture des données d'un workspace (structure éclatée).
 *
 * - `users/{uid}/recipes/{recipeId}`, un doc par recette (budget 1 Mo chacun)
 * - `users/{uid}/meta/{collections|mealPlan|shoppingLists|stock|userDB|preferences}`
 *
 * Les recettes sont synchronisées par UPSERT seul (jamais de suppression par
 * absence) ; la suppression est une opération explicite ({@link deleteSharedRecipe}).
 * Toutes les écritures partagées respectent le verrou anti-client périmé
 * ({@link isSharedWritesLocked}).
 *
 * @module firebase/workspaceData
 */
import {
  doc, getDoc, getDocs, getDocFromCache, getDocsFromCache, writeBatch, deleteDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase.js";
import { metaDoc, recipesCol, type WorkspaceRef } from "@/lib/firebase/paths.js";
import { userDirDoc } from "@/lib/firebase/userDirectory.js";
import { isSharedWritesLocked } from "@/lib/firebase/writeLock.js";
import type { SharedData } from "@/lib/household/householdMigration.js";
import type { Collection, MealPlan, Recipe, SavedRecipe } from "@/lib/types.js";
import { isSavedRecipe } from "@/lib/recipes/savedRecipes.js";
import type { ShoppingList } from "@/lib/food/shoppingAggregate.js";
import type { PersonalDB } from "@/lib/firebase/masterDb.js";
import { planRecipeUpserts } from "@/lib/recipes/recipeSync.js";
import { preferWithin, type PreferResult } from "@/lib/sync/preferWithin.js";

/** Données complètes d'un workspace, telles que lues depuis la structure éclatée. */
export interface UserData {
  recipes: SavedRecipe[];
  collections: Collection[] | null;
  mealPlan: MealPlan | null;
  shoppingLists: ShoppingList[] | null;
  stock: string[] | null;
  lowStock: string[] | null;
  userDB: PersonalDB | null;
  preferences: DocumentData | null;
}

/** Ajouts personnels d'un doc `meta/userDB` (listes absentes ou malformées = vides). */
const personalDbOf = (d: DocumentData): PersonalDB => ({
  ingredients: Array.isArray(d.ingredients) ? d.ingredients : [],
  utensils: Array.isArray(d.utensils) ? d.utensils : [],
});

/** Ne garde que les slices partageables d'un workspace (absents = vides). */
function toShared(d: UserData): Required<SharedData> {
  return {
    recipes: d.recipes || [],
    collections: d.collections || [],
    mealPlan: d.mealPlan || {},
    shoppingLists: d.shoppingLists || [],
    stock: d.stock || [],
    lowStock: d.lowStock || [],
  };
}

/**
 * Charge uniquement les slices PARTAGÉS d'un workspace (pour la migration/sync foyer).
 *
 * @param ws - Le workspace source.
 * @returns Les slices partageables (recettes, carnets, planning, listes, stock).
 */
export async function loadSharedData(ws: WorkspaceRef): Promise<Required<SharedData>> {
  return toShared(await loadUserData(ws));
}

/**
 * Variante de démarrage de {@link loadSharedData} : le serveur s'il répond dans
 * `budgetMs`, sinon le cache local (cf. {@link loadUserDataFast}).
 *
 * @param ws - Le workspace source.
 * @param budgetMs - Temps accordé au serveur avant de servir le cache.
 * @returns Les slices partageables et leur provenance.
 */
export async function loadSharedDataFast(ws: WorkspaceRef, budgetMs: number): Promise<PreferResult<Required<SharedData>>> {
  const { value, source } = await loadUserDataFast(ws, budgetMs);
  return { value: toShared(value), source };
}

/**
 * Écrit les slices partagés dans un workspace (recettes en diff + méta en bloc).
 *
 * @param ws - Le workspace cible.
 * @param data - Les slices à écrire.
 * @param recipeMap - Carte de synchro précédente des recettes (diff).
 * @returns La nouvelle carte de synchro des recettes.
 */
export async function writeSharedData(ws: WorkspaceRef, data: SharedData, recipeMap: Map<string, Recipe> = new Map()): Promise<Map<string, Recipe>> {
  if (isSharedWritesLocked()) return recipeMap; // client déclassé : aucune écriture partagée
  const newMap = await syncRecipes(ws, (data.recipes || []) as Recipe[], recipeMap);
  const batch = writeBatch(db);
  batch.set(metaDoc(ws, "collections"), { items: data.collections || [] });
  batch.set(metaDoc(ws, "mealPlan"), { data: data.mealPlan || {} });
  batch.set(metaDoc(ws, "shoppingLists"), { items: data.shoppingLists || [] });
  batch.set(metaDoc(ws, "stock"), { items: data.stock || [], low: data.lowStock || [] });
  await batch.commit();
  return newMap;
}

// Suppression RGPD : efface TOUTES les données personnelles de l'utilisateur
// (recettes, méta perso + partagé solo, fiche d'annuaire, pointeur de foyer). Les
// données d'un foyer partagé ne sont PAS supprimées ici (elles appartiennent au
// foyer) : le membre est simplement retiré via son pointeur.
const USER_META_NAMES = ["collections", "mealPlan", "shoppingLists", "stock", "userDB", "preferences", "household"];

/**
 * Efface toutes les données personnelles d'un utilisateur (RGPD).
 *
 * @param uid - L'identifiant de l'utilisateur.
 * @returns La promesse de suppression (recettes par lots + méta + annuaire).
 */
export async function deleteAllUserData(uid: string): Promise<void> {
  // Recettes : suppression par lots de 400 (limite Firestore 500 op/batch).
  const snap = await getDocs(recipesCol(uid));
  const refs = snap.docs.map(d => d.ref);
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach(r => batch.delete(r));
    await batch.commit();
  }
  const batch = writeBatch(db);
  USER_META_NAMES.forEach(n => batch.delete(doc(db, "users", uid, "meta", n)));
  batch.delete(userDirDoc(uid));
  await batch.commit();
}

/** Lecteurs Firestore : serveur d'abord (défaut) ou cache local seul. */
interface Readers {
  getDoc: typeof getDoc;
  getDocs: typeof getDocs;
}

async function readUserData(ws: WorkspaceRef, r: Readers): Promise<UserData> {
  const [recipesSnap, collectionsSnap, mealPlanSnap, shoppingSnap, stockSnap, userDBSnap, prefsSnap] = await Promise.all([
    r.getDocs(recipesCol(ws)),
    r.getDoc(metaDoc(ws, "collections")),
    r.getDoc(metaDoc(ws, "mealPlan")),
    r.getDoc(metaDoc(ws, "shoppingLists")),
    r.getDoc(metaDoc(ws, "stock")),
    r.getDoc(metaDoc(ws, "userDB")),
    r.getDoc(metaDoc(ws, "preferences")),
  ]);
  return {
    // Chaque doc porte son `id` (écrit tel quel) : un doc sans id serait inouvrable.
    recipes: recipesSnap.docs.map(d => d.data()).filter(isSavedRecipe),
    collections: collectionsSnap.exists() ? (collectionsSnap.data().items || []) : null,
    mealPlan: mealPlanSnap.exists() ? (mealPlanSnap.data().data || {}) : null,
    shoppingLists: shoppingSnap.exists() ? (shoppingSnap.data().items || []) : null,
    stock: stockSnap.exists() ? (stockSnap.data().items || []) : null,
    lowStock: stockSnap.exists() ? (stockSnap.data().low || []) : null,
    userDB: userDBSnap.exists() ? personalDbOf(userDBSnap.data()) : null,
    preferences: prefsSnap.exists() ? prefsSnap.data() : null,
  };
}

/**
 * Charge toutes les données d'un workspace depuis la structure éclatée.
 *
 * @param ws - Le workspace source.
 * @returns Les données du workspace (les slices absents valent `null`).
 */
export async function loadUserData(ws: WorkspaceRef): Promise<UserData> {
  return readUserData(ws, { getDoc, getDocs });
}

/**
 * Lit un workspace dans le seul cache local Firestore (IndexedDB), sans réseau.
 * Tout ou rien : si un document méta n'a jamais été mis en cache, on renvoie
 * `null` plutôt qu'un état partiel qui ferait croire à un slice vide.
 *
 * @param ws - Le workspace source.
 * @returns Les données en cache, ou `null` si le cache est incomplet.
 */
export async function loadUserDataFromCache(ws: WorkspaceRef): Promise<UserData | null> {
  try {
    return await readUserData(ws, { getDoc: getDocFromCache, getDocs: getDocsFromCache });
  } catch {
    return null;
  }
}

/**
 * Lecture de démarrage : le serveur s'il répond dans `budgetMs`, sinon le cache
 * local, que les abonnements temps réel rafraîchissent ensuite. Évite l'attente
 * du délai du SDK (~10 s) quand le réseau est absent ou ne répond pas. Cache
 * incomplet (premier lancement) : on attend le serveur, comme avant.
 *
 * @param ws - Le workspace source.
 * @param budgetMs - Temps accordé au serveur (0 = cache tout de suite).
 * @returns Les données et leur provenance (`primary` = serveur, `fallback` = cache).
 */
export async function loadUserDataFast(ws: WorkspaceRef, budgetMs: number): Promise<PreferResult<UserData>> {
  return preferWithin(loadUserData(ws), () => loadUserDataFromCache(ws), budgetMs);
}

/**
 * Migration ponctuelle depuis l'ancien document unique (`users/{uid}/data/app`).
 *
 * @param uid - L'identifiant de l'utilisateur.
 * @returns Les données legacy, ou `null` si absentes/illisibles.
 */
export async function migrateLegacyDoc(uid: string): Promise<DocumentData | null> {
  try {
    const legacy = await getDoc(doc(db, "users", uid, "data", "app"));
    if (!legacy.exists()) return null;
    return legacy.data();
  } catch {
    return null;
  }
}

/**
 * Synchro des recettes par UPSERT uniquement : écrit les nouvelles/modifiées, ne
 * supprime JAMAIS par absence. Une recette absente de `recipes` mais présente
 * côté serveur est laissée intacte (une suppression est une opération explicite,
 * cf. `deleteSharedRecipe`). Un état local périmé ne peut donc plus effacer de
 * données distantes.
 *
 * @param ws - Le workspace cible.
 * @param recipes - L'état courant des recettes.
 * @param lastSyncedMap - La carte de synchro précédente (id -> recette).
 * @returns La nouvelle carte de synchro (id -> recette).
 */
export async function syncRecipes(ws: WorkspaceRef, recipes: Recipe[], lastSyncedMap: Map<string, Recipe>): Promise<Map<string, Recipe>> {
  // Client déclassé : on n'écrit rien et on préserve la carte de synchro connue.
  if (isSharedWritesLocked()) return lastSyncedMap;
  const upserts = planRecipeUpserts(recipes, lastSyncedMap);
  if (upserts.length > 0) {
    const batch = writeBatch(db);
    const col = recipesCol(ws);
    for (const r of upserts) batch.set(doc(col, r.id as string), r);
    await batch.commit();
  }
  const newMap = new Map<string, Recipe>();
  for (const r of recipes) if (r.id) newMap.set(r.id, r);
  return newMap;
}

/**
 * Suppression EXPLICITE d'une recette dans le workspace actif. C'est le seul
 * chemin qui retire une recette côté serveur : une intention utilisateur ciblée
 * sur un document précis, jamais une déduction par absence. No-op si le client
 * est déclassé (verrou d'écriture).
 *
 * @param ws - Le workspace cible (solo ou foyer).
 * @param id - L'identifiant de la recette à supprimer.
 */
export async function deleteSharedRecipe(ws: WorkspaceRef, id: string): Promise<void> {
  if (isSharedWritesLocked()) return;
  await deleteDoc(doc(recipesCol(ws), id));
}
