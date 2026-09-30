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
  doc, getDoc, getDocs, writeBatch, deleteDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase.js";
import { metaDoc, recipesCol, type WorkspaceRef } from "@/lib/firebase/paths.js";
import { userDirDoc } from "@/lib/firebase/userDirectory.js";
import { isSharedWritesLocked } from "@/lib/firebase/writeLock.js";
import type { SharedData } from "@/lib/household/householdMigration.js";
import type { Recipe } from "@/lib/types.js";
import { planRecipeUpserts } from "@/lib/recipes/recipeSync.js";

/** Données complètes d'un workspace, telles que lues depuis la structure éclatée. */
export interface UserData {
  recipes: DocumentData[];
  collections: unknown[] | null;
  mealPlan: Record<string, unknown> | null;
  shoppingLists: unknown[] | null;
  stock: unknown[] | null;
  lowStock: unknown[] | null;
  userDB: DocumentData | null;
  preferences: DocumentData | null;
}

/**
 * Charge uniquement les slices PARTAGÉS d'un workspace (pour la migration/sync foyer).
 *
 * @param ws - Le workspace source.
 * @returns Les slices partageables (recettes, carnets, planning, listes, stock).
 */
export async function loadSharedData(ws: WorkspaceRef): Promise<Required<SharedData>> {
  const d = await loadUserData(ws);
  return {
    recipes: (d.recipes || []) as Required<SharedData>["recipes"],
    collections: (d.collections || []) as Required<SharedData>["collections"],
    mealPlan: (d.mealPlan || {}) as Required<SharedData>["mealPlan"],
    shoppingLists: (d.shoppingLists || []) as Required<SharedData>["shoppingLists"],
    stock: (d.stock || []) as Required<SharedData>["stock"],
    lowStock: (d.lowStock || []) as Required<SharedData>["lowStock"],
  };
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

/**
 * Charge toutes les données d'un workspace depuis la structure éclatée.
 *
 * @param ws - Le workspace source.
 * @returns Les données du workspace (les slices absents valent `null`).
 */
export async function loadUserData(ws: WorkspaceRef): Promise<UserData> {
  const [recipesSnap, collectionsSnap, mealPlanSnap, shoppingSnap, stockSnap, userDBSnap, prefsSnap] = await Promise.all([
    getDocs(recipesCol(ws)),
    getDoc(metaDoc(ws, "collections")),
    getDoc(metaDoc(ws, "mealPlan")),
    getDoc(metaDoc(ws, "shoppingLists")),
    getDoc(metaDoc(ws, "stock")),
    getDoc(metaDoc(ws, "userDB")),
    getDoc(metaDoc(ws, "preferences")),
  ]);
  return {
    recipes: recipesSnap.docs.map(d => d.data()),
    collections: collectionsSnap.exists() ? (collectionsSnap.data().items || []) : null,
    mealPlan: mealPlanSnap.exists() ? (mealPlanSnap.data().data || {}) : null,
    shoppingLists: shoppingSnap.exists() ? (shoppingSnap.data().items || []) : null,
    stock: stockSnap.exists() ? (stockSnap.data().items || []) : null,
    lowStock: stockSnap.exists() ? (stockSnap.data().low || []) : null,
    userDB: userDBSnap.exists() ? userDBSnap.data() : null,
    preferences: prefsSnap.exists() ? prefsSnap.data() : null,
  };
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
